import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { fcSearch } from "@/lib/firecrawl";
import {
  buildInterviewResearchQuery,
  normalizeInterviewResearchSources,
} from "@/lib/maaroof/interview-research";
import { generateInterviewEvidenceReport } from "@/lib/maaroof/interview-report.server";
import { deriveEntityProfileSync } from "@/lib/maaroof/interview-entity-sync";
import type { Database } from "@/integrations/supabase/types";
import {
  INTERVIEW_LOCALES,
  createInterviewState,
  getInterviewProgress,
  getNextInterviewQuestion,
  isInterviewQuestionCursorConsistent,
  isInterviewDataComplete,
  recordInterviewResponse,
  validateInterviewQuestionSet,
  type InterviewAnswerStatus,
  type InterviewContext,
  type InterviewDomain,
  type InterviewState,
  type InterviewValue,
} from "@/lib/maaroof/interview-engine";
import {
  buildInterviewQuestionSet,
  INTERVIEW_QUESTION_SET_VERSION,
  isInterviewTargetType,
  normalizeInterviewDomains,
} from "@/lib/maaroof/interview-question-bank";

type AdminDb = ReturnType<typeof createClient<Database>>;
type AuthResult = { ok: true; admin: AdminDb; userId: string } | { ok: false; response: Response };

const SUMMARY_FIELDS =
  "id, user_id, workspace_id, target_type, target_name, initial_goal, domains, locale, status, current_question_id, version, created_at, updated_at, completed_at";

function errorResponse(error: string, status: number, extra: Record<string, unknown> = {}) {
  return Response.json({ error, ...extra }, { status });
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

function isInterviewValue(value: unknown): value is InterviewValue {
  if (typeof value === "string") return value.length <= 10000;
  if (typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  return (
    Array.isArray(value) &&
    value.length <= 50 &&
    value.every((part) => typeof part === "string" && part.length <= 1000)
  );
}

function isStoredInterviewState(
  value: unknown,
  validQuestionIds: ReadonlySet<string>,
): value is InterviewState {
  if (!isPlainRecord(value) || !isPlainRecord(value.context) || !isPlainRecord(value.answers))
    return false;
  const context = value.context;
  if (
    !isInterviewTargetType(context.targetType) ||
    typeof context.locale !== "string" ||
    !(INTERVIEW_LOCALES as readonly string[]).includes(context.locale) ||
    !normalizeInterviewDomains(context.domains)
  ) {
    return false;
  }

  return Object.entries(value.answers).every(([questionId, rawAnswer]) => {
    if (!validQuestionIds.has(questionId)) return false;
    if (!isPlainRecord(rawAnswer)) return false;
    if (rawAnswer.questionId !== questionId) return false;
    if (!["answered", "skipped", "unknown"].includes(String(rawAnswer.status))) return false;
    if (!["user", "client", "verified_source", "inferred"].includes(String(rawAnswer.source)))
      return false;
    if (typeof rawAnswer.updatedAt !== "string") return false;
    return rawAnswer.value === null || isInterviewValue(rawAnswer.value);
  });
}

async function authenticate(request: Request): Promise<AuthResult> {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) {
    return { ok: false, response: errorResponse("auth_required", 401) };
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return { ok: false, response: errorResponse("server_auth_not_configured", 500) };
  }

  try {
    const admin = createClient<Database>(url, key, { auth: { persistSession: false } });
    const { data, error } = await admin.auth.getUser(authorization.slice(7));
    if (error || !data.user?.id) {
      return { ok: false, response: errorResponse("auth_required", 401) };
    }
    return { ok: true, admin, userId: data.user.id };
  } catch {
    return { ok: false, response: errorResponse("authentication_failed", 500) };
  }
}

/** Workspace members can read; owners and editors can create or update interviews. */
async function workspaceAccess(
  admin: AdminDb,
  workspaceId: string,
  userId: string,
  write: boolean,
): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;
  const { data: workspace, error: workspaceError } = await db
    .from("workspaces")
    .select("id, owner_id")
    .eq("id", workspaceId)
    .maybeSingle();

  if (workspaceError || !workspace) return false;
  if (workspace.owner_id === userId) return true;

  const { data: member, error: memberError } = await db
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (memberError || !member) return false;
  return !write || member.role === "owner" || member.role === "editor";
}

async function interviewAccess(
  admin: AdminDb,
  userId: string,
  interview: { user_id: string; workspace_id: string | null },
  write: boolean,
): Promise<boolean> {
  if (!interview.workspace_id) return interview.user_id === userId;
  return workspaceAccess(admin, interview.workspace_id, userId, write);
}

async function readJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  const body = await request.json().catch(() => null);
  return isPlainRecord(body) ? body : null;
}

function includeOptionalInterviewQuestions(contextSnapshot: unknown): boolean {
  return isPlainRecord(contextSnapshot) && contextSnapshot.interview_depth === "comprehensive";
}

function isStoredInterviewContextConsistent(
  interview: {
    target_type: unknown;
    target_name: unknown;
    workspace_id: unknown;
    domains: unknown;
    locale: unknown;
    context_snapshot: unknown;
  },
  state: InterviewState,
): boolean {
  const snapshot = interview.context_snapshot;
  if (!isPlainRecord(snapshot)) return false;

  if (
    state.context.targetType !== interview.target_type ||
    state.context.locale !== interview.locale ||
    JSON.stringify(state.context.domains) !== JSON.stringify(interview.domains) ||
    snapshot.target_type !== interview.target_type ||
    snapshot.target_name !== interview.target_name ||
    snapshot.workspace_id !== interview.workspace_id ||
    snapshot.locale !== interview.locale ||
    JSON.stringify(snapshot.domains) !== JSON.stringify(interview.domains)
  ) {
    return false;
  }

  return (
    snapshot.interview_depth === undefined ||
    snapshot.interview_depth === "focused" ||
    snapshot.interview_depth === "comprehensive"
  );
}

async function handleGet(request: Request): Promise<Response> {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = auth.admin as any;
  const id = new URL(request.url).searchParams.get("id");

  if (id) {
    if (!isUuid(id)) return errorResponse("invalid_interview_id", 400);
    const { data: interview, error } = await db
      .from("maaroof_interviews")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) return errorResponse("interview_lookup_failed", 500);
    if (!interview || !(await interviewAccess(auth.admin, auth.userId, interview, false))) {
      return errorResponse("interview_not_found", 404);
    }
    const questionSet = validateInterviewQuestionSet(interview.questions_snapshot);
    if (!questionSet.ok) return errorResponse("stored_interview_invalid", 500);
    const validQuestionIds = new Set(questionSet.questions.map((question) => question.id));
    if (!isStoredInterviewState(interview.state, validQuestionIds)) {
      return errorResponse("stored_interview_invalid", 500);
    }
    if (!isStoredInterviewContextConsistent(interview, interview.state)) {
      return errorResponse("stored_interview_context_mismatch", 500);
    }
    const includeOptional = includeOptionalInterviewQuestions(interview.context_snapshot);
    if (
      !isInterviewQuestionCursorConsistent(
        questionSet.questions,
        interview.state,
        interview.current_question_id,
        { includeOptional },
      )
    ) {
      return errorResponse("stored_interview_cursor_mismatch", 500);
    }
    return Response.json({
      interview,
      progress: getInterviewProgress(questionSet.questions, interview.state),
      next_question: getNextInterviewQuestion(questionSet.questions, interview.state, {
        includeOptional,
      }),
      data_complete: isInterviewDataComplete(questionSet.questions, interview.state),
    });
  }

  const [ownResult, ownedWorkspaceResult, membershipsResult] = await Promise.all([
    db
      .from("maaroof_interviews")
      .select(SUMMARY_FIELDS)
      .eq("user_id", auth.userId)
      .is("workspace_id", null)
      .order("updated_at", { ascending: false })
      .limit(50),
    db.from("workspaces").select("id").eq("owner_id", auth.userId),
    db.from("workspace_members").select("workspace_id").eq("user_id", auth.userId),
  ]);

  if (ownResult.error || ownedWorkspaceResult.error || membershipsResult.error) {
    return errorResponse("interview_list_failed", 500);
  }

  const workspaceIds: string[] = [
    ...new Set<string>([
      ...(ownedWorkspaceResult.data || []).map((row: { id: string }) => row.id),
      ...(membershipsResult.data || []).map((row: { workspace_id: string }) => row.workspace_id),
    ]),
  ].filter(isUuid);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let workspaceRows: Array<Record<string, any>> = [];
  if (workspaceIds.length) {
    const { data, error } = await db
      .from("maaroof_interviews")
      .select(SUMMARY_FIELDS)
      .in("workspace_id", workspaceIds)
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error) return errorResponse("interview_list_failed", 500);
    workspaceRows = data || [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const merged = new Map<string, Record<string, any>>();
  for (const row of [...(ownResult.data || []), ...workspaceRows]) merged.set(row.id, row);
  const interviews = [...merged.values()]
    .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
    .slice(0, 50);

  return Response.json({ interviews });
}

async function handleCreate(request: Request): Promise<Response> {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;

  const body = await readJsonBody(request);
  if (!body) return errorResponse("invalid_json_body", 400);
  if (!isInterviewTargetType(body.target_type)) return errorResponse("invalid_target_type", 400);
  if (
    typeof body.target_name !== "string" ||
    body.target_name.trim().length === 0 ||
    body.target_name.length > 200
  ) {
    return errorResponse("invalid_target_name", 400);
  }
  const targetName = body.target_name.trim();

  const domains =
    body.domains === undefined
      ? (["general"] as InterviewDomain[])
      : normalizeInterviewDomains(body.domains);
  if (!domains) return errorResponse("invalid_domains", 400);

  const locale = body.locale === undefined ? "ar" : body.locale;
  if (typeof locale !== "string" || !(INTERVIEW_LOCALES as readonly string[]).includes(locale)) {
    return errorResponse("invalid_locale", 400);
  }
  const selectedLocale = locale as InterviewContext["locale"];

  const interviewDepth = body.interview_depth === undefined ? "focused" : body.interview_depth;
  if (interviewDepth !== "focused" && interviewDepth !== "comprehensive") {
    return errorResponse("invalid_interview_depth", 400);
  }
  const includeOptional = interviewDepth === "comprehensive";

  let workspaceId: string | null = null;
  if (body.workspace_id !== undefined && body.workspace_id !== null) {
    if (!isUuid(body.workspace_id)) return errorResponse("invalid_workspace_id", 400);
    workspaceId = body.workspace_id;
  }
  if (workspaceId && !(await workspaceAccess(auth.admin, workspaceId, auth.userId, true))) {
    return errorResponse("workspace_access_denied", 403);
  }

  let goal: string | null = null;
  if (body.goal !== undefined && body.goal !== null) {
    if (typeof body.goal !== "string" || body.goal.trim().length > 2000) {
      return errorResponse("invalid_goal", 400);
    }
    goal = body.goal.trim() || null;
  }

  const targetType = body.target_type;
  const questions = buildInterviewQuestionSet(targetType, domains);
  const validation = validateInterviewQuestionSet(questions);
  if (!validation.ok) return errorResponse("invalid_server_question_set", 500);

  const now = new Date().toISOString();
  let state = createInterviewState({ targetType, domains, locale: selectedLocale });
  if (goal) {
    const initial = recordInterviewResponse(
      state,
      validation.questions,
      { questionId: "objective", status: "answered", value: goal, source: "user" },
      now,
    );
    if (!initial.ok) return errorResponse("failed_to_initialize_interview", 500);
    state = initial.state;
  }

  const currentQuestion = getNextInterviewQuestion(validation.questions, state, {
    includeOptional,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = auth.admin as any;
  const { data: interview, error } = await db
    .from("maaroof_interviews")
    .insert({
      user_id: auth.userId,
      workspace_id: workspaceId,
      target_type: targetType,
      target_name: targetName,
      initial_goal: goal,
      domains,
      locale: selectedLocale,
      question_set_version: INTERVIEW_QUESTION_SET_VERSION,
      questions_snapshot: validation.questions,
      state,
      context_snapshot: {
        target_type: targetType,
        target_name: targetName,
        workspace_id: workspaceId,
        domains,
        locale: selectedLocale,
        interview_depth: interviewDepth,
      },
      status: "in_progress",
      current_question_id: currentQuestion?.id || null,
      version: 1,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();

  if (error || !interview) return errorResponse("interview_create_failed", 500);
  return Response.json(
    {
      interview,
      progress: getInterviewProgress(validation.questions, state),
      next_question: currentQuestion,
    },
    { status: 201 },
  );
}

async function handleUpdate(request: Request): Promise<Response> {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;

  const body = await readJsonBody(request);
  if (!body) return errorResponse("invalid_json_body", 400);
  if (!isUuid(body.id)) return errorResponse("invalid_interview_id", 400);
  if (
    typeof body.expected_version !== "number" ||
    !Number.isInteger(body.expected_version) ||
    body.expected_version < 1
  ) {
    return errorResponse("invalid_expected_version", 400);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = auth.admin as any;
  const { data: interview, error: fetchError } = await db
    .from("maaroof_interviews")
    .select("*")
    .eq("id", body.id)
    .maybeSingle();

  if (fetchError) return errorResponse("interview_lookup_failed", 500);
  if (!interview || !(await interviewAccess(auth.admin, auth.userId, interview, true))) {
    return errorResponse("interview_not_found", 404);
  }
  if (Number(interview.version) !== body.expected_version) {
    return errorResponse("interview_version_conflict", 409, { current_version: interview.version });
  }
  if (interview.status === "completed") return errorResponse("interview_already_completed", 409);

  const questionSet = validateInterviewQuestionSet(interview.questions_snapshot);
  if (!questionSet.ok) return errorResponse("stored_interview_invalid", 500);
  const validQuestionIds = new Set(questionSet.questions.map((question) => question.id));
  if (!isStoredInterviewState(interview.state, validQuestionIds)) {
    return errorResponse("stored_interview_invalid", 500);
  }
  const state = interview.state;
  if (!isStoredInterviewContextConsistent(interview, state)) {
    return errorResponse("stored_interview_context_mismatch", 500);
  }

  const includeOptional = includeOptionalInterviewQuestions(interview.context_snapshot);
  if (
    !isInterviewQuestionCursorConsistent(
      questionSet.questions,
      state,
      interview.current_question_id,
      { includeOptional },
    )
  ) {
    return errorResponse("stored_interview_cursor_mismatch", 500);
  }

  const now = new Date().toISOString();
  let nextState = state;
  let nextStatus = String(interview.status);
  let completedAt: string | null = interview.completed_at || null;

  if (body.action === "answer") {
    if (interview.status !== "in_progress") {
      return errorResponse("resume_interview_first", 409, { status: interview.status });
    }
    if (!isPlainRecord(body.answer)) return errorResponse("invalid_answer", 400);
    const answer = body.answer;
    if (
      typeof answer.questionId !== "string" ||
      !["answered", "skipped", "unknown"].includes(String(answer.status))
    ) {
      return errorResponse("invalid_answer", 400);
    }
    if (answer.questionId !== interview.current_question_id) {
      return errorResponse("unexpected_question", 409, {
        current_question_id: interview.current_question_id,
      });
    }
    if (answer.status === "answered" && !isInterviewValue(answer.value)) {
      return errorResponse("invalid_answer_value", 400);
    }

    const result = recordInterviewResponse(
      state,
      questionSet.questions,
      {
        questionId: answer.questionId,
        status: answer.status as InterviewAnswerStatus,
        value: answer.status === "answered" ? (answer.value as InterviewValue) : null,
        // Provenance is assigned by the server; callers cannot claim a verified or inferred source.
        source: "user",
      },
      now,
    );
    if (!result.ok) {
      return errorResponse(result.error, result.error === "unknown_question" ? 400 : 409);
    }
    nextState = result.state;
    nextStatus = "in_progress";
    completedAt = null;
  } else if (body.action === "status") {
    const allowedStatuses = ["in_progress", "paused", "completed", "abandoned"];
    if (typeof body.status !== "string" || !allowedStatuses.includes(body.status)) {
      return errorResponse("invalid_interview_status", 400);
    }
    const includeOptional = includeOptionalInterviewQuestions(interview.context_snapshot);
    if (
      body.status === "completed" &&
      getNextInterviewQuestion(questionSet.questions, state, { includeOptional }) !== null
    ) {
      return errorResponse("interview_questions_unhandled", 409, {
        progress: getInterviewProgress(questionSet.questions, state),
      });
    }
    nextStatus = body.status;
    completedAt = nextStatus === "completed" ? now : null;
  } else {
    return errorResponse("invalid_interview_action", 400);
  }

  const currentQuestion = getNextInterviewQuestion(questionSet.questions, nextState, {
    includeOptional,
  });
  const expectedVersion = body.expected_version;
  const { data: updated, error: updateError } = await db
    .from("maaroof_interviews")
    .update({
      state: nextState,
      status: nextStatus,
      current_question_id: currentQuestion?.id || null,
      version: expectedVersion + 1,
      completed_at: completedAt,
      updated_at: now,
    })
    .eq("id", body.id)
    .eq("version", expectedVersion)
    .select("*")
    .maybeSingle();

  if (updateError) return errorResponse("interview_update_failed", 500);
  if (!updated) return errorResponse("interview_version_conflict", 409);

  // A completed personal interview may fill only empty, unlocked truth-card fields.
  // Workspace interviews and inferred/external answers never mutate the personal profile.
  if (
    body.action === "status" &&
    body.status === "completed" &&
    !interview.workspace_id &&
    interview.user_id === auth.userId
  ) {
    try {
      const { data: profile } = await db
        .from("profiles")
        .select("full_name,brand_name,entity_type,specialty_scope,entity_locked")
        .eq("id", auth.userId)
        .maybeSingle();
      if (profile && !profile.entity_locked) {
        const patch = deriveEntityProfileSync(
          {
            completed: true,
            workspaceId: interview.workspace_id,
            targetType: String(interview.target_type || ""),
            targetName: String(interview.target_name || ""),
            state: nextState,
          },
          profile,
        );
        if (Object.keys(patch).length) {
          await db.from("profiles").update(patch).eq("id", auth.userId).eq("entity_locked", false);
        }
      }
    } catch {
      // Profile sync is additive; an interview save must succeed even if profile sync is unavailable.
    }
  }

  return Response.json({
    interview: updated,
    progress: getInterviewProgress(questionSet.questions, nextState),
    next_question: currentQuestion,
    data_complete: isInterviewDataComplete(questionSet.questions, nextState),
  });
}

async function handleEnrich(request: Request): Promise<Response> {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const body = await readJsonBody(request);
  if (!body || !isUuid(body.interview_id)) return errorResponse("invalid_interview_id", 400);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = auth.admin as any;
  const { data: interview, error } = await db
    .from("maaroof_interviews")
    .select(
      "id,user_id,workspace_id,target_type,target_name,initial_goal,domains,locale,state,status,questions_snapshot,context_snapshot",
    )
    .eq("id", body.interview_id)
    .maybeSingle();
  if (error) return errorResponse("interview_lookup_failed", 500);
  if (!interview || !(await interviewAccess(auth.admin, auth.userId, interview, true))) {
    return errorResponse("interview_not_found", 404);
  }
  if (interview.status !== "completed") return errorResponse("interview_must_be_completed", 409);
  if (
    !interview.state ||
    typeof interview.state !== "object" ||
    !interview.state.answers ||
    typeof interview.state.answers !== "object" ||
    !Array.isArray(interview.questions_snapshot) ||
    !isPlainRecord(interview.context_snapshot)
  ) {
    return errorResponse("stored_interview_invalid", 500);
  }
  if (
    interview.context_snapshot.workspace_id !== interview.workspace_id ||
    interview.context_snapshot.target_name !== interview.target_name ||
    interview.context_snapshot.target_type !== interview.target_type
  ) {
    return errorResponse("stored_interview_context_mismatch", 500);
  }

  const locale = (INTERVIEW_LOCALES as readonly string[]).includes(interview.locale)
    ? (interview.locale as "ar" | "en" | "ku")
    : "ar";
  const query = buildInterviewResearchQuery({
    targetType: interview.target_type,
    targetName: interview.target_name,
    goal: interview.initial_goal,
    domains: normalizeInterviewDomains(interview.domains) || ["general"],
    locale,
    state: interview.state,
  });
  if (!query) return errorResponse("research_query_empty", 422);

  // Reuse evidence collected for this exact interview query during the 12-hour freshness window.
  // This avoids repeat Firecrawl calls when users reopen the report or retry the UI.
  const cacheSince = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
  const { data: cachedSources, error: cacheError } = await db
    .from("maaroof_interview_evidence")
    .select("id,title,source_url,domain,description,snippet,query,locale,collected_at")
    .eq("interview_id", interview.id)
    .eq("query", query)
    .eq("locale", locale)
    .gte("collected_at", cacheSince)
    .order("collected_at", { ascending: false })
    .limit(8);
  if (cacheError) return errorResponse("research_evidence_read_failed", 500);
  if (Array.isArray(cachedSources) && cachedSources.length > 0) {
    return Response.json({
      interview_id: interview.id,
      query,
      sources: cachedSources,
      collected_at: cachedSources[0].collected_at,
      reused: true,
    });
  }

  try {
    const providerPayload = await fcSearch(
      query,
      { limit: 6, lang: locale },
      { userId: auth.userId, toolKey: "interview_enrichment" },
    );
    const sources = normalizeInterviewResearchSources(providerPayload, 6);
    const collectedAt = new Date().toISOString();
    const rows = sources.map((source) => ({
      interview_id: interview.id,
      user_id: auth.userId,
      workspace_id: interview.workspace_id,
      query,
      title: source.title,
      source_url: source.url,
      domain: source.domain,
      description: source.description,
      snippet: source.snippet,
      locale,
      collected_at: collectedAt,
    }));
    if (rows.length) {
      const { error: saveError } = await db
        .from("maaroof_interview_evidence")
        .upsert(rows, { onConflict: "interview_id,source_url" });
      if (saveError) return errorResponse("research_evidence_save_failed", 500);
    }
    const { data: saved, error: readError } = await db
      .from("maaroof_interview_evidence")
      .select("id,title,source_url,domain,description,snippet,query,locale,collected_at")
      .eq("interview_id", interview.id)
      .order("collected_at", { ascending: false })
      .limit(8);
    if (readError) return errorResponse("research_evidence_read_failed", 500);
    return Response.json({
      interview_id: interview.id,
      query,
      sources: saved || [],
      collected_at: collectedAt,
    });
  } catch (error) {
    const isQuota = Boolean(
      error && typeof error === "object" && "name" in error && error.name === "FirecrawlLimitError",
    );
    return errorResponse(
      isQuota ? "research_quota_reached" : "external_research_failed",
      isQuota ? 429 : 502,
    );
  }
}

async function handleGenerateReport(request: Request): Promise<Response> {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const body = await readJsonBody(request);
  if (!body || !isUuid(body.interview_id)) return errorResponse("invalid_interview_id", 400);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = auth.admin as any;
  const { data: interview, error } = await db
    .from("maaroof_interviews")
    .select(
      "id,user_id,workspace_id,target_type,target_name,initial_goal,domains,locale,state,status,questions_snapshot,context_snapshot",
    )
    .eq("id", body.interview_id)
    .maybeSingle();
  if (error) return errorResponse("interview_lookup_failed", 500);
  if (!interview || !(await interviewAccess(auth.admin, auth.userId, interview, true))) {
    return errorResponse("interview_not_found", 404);
  }
  if (interview.status !== "completed") return errorResponse("interview_must_be_completed", 409);
  if (
    !interview.state ||
    typeof interview.state !== "object" ||
    !interview.state.answers ||
    !Array.isArray(interview.questions_snapshot) ||
    !isPlainRecord(interview.context_snapshot) ||
    interview.context_snapshot.workspace_id !== interview.workspace_id ||
    interview.context_snapshot.target_name !== interview.target_name ||
    interview.context_snapshot.target_type !== interview.target_type
  ) {
    return errorResponse("stored_interview_context_mismatch", 500);
  }
  const result = await generateInterviewEvidenceReport(db, auth.userId, interview);
  return Response.json(result.body, { status: result.status });
}

export const Route = createFileRoute("/api/maaroof-interviews")({
  server: {
    handlers: {
      GET: async ({ request }) => handleGet(request),
      POST: async ({ request }) => {
        const body = await request
          .clone()
          .json()
          .catch(() => null);
        if (isPlainRecord(body) && body.action === "enrich") return handleEnrich(request);
        if (isPlainRecord(body) && body.action === "report") return handleGenerateReport(request);
        return handleCreate(request);
      },
      PATCH: async ({ request }) => handleUpdate(request),
    },
  },
});
