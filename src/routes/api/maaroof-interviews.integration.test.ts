import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { Route } from "@/routes/api/maaroof-interviews";

type AdminDb = ReturnType<typeof createClient<Database>>;
type Method = "GET" | "POST" | "PATCH";
type Handler = (args: { request: Request }) => Promise<Response>;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const configured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_SERVICE_ROLE_KEY);
const integrationDescribe = configured ? describe : describe.skip;
const handlers = (Route.options as unknown as { server: { handlers: Record<Method, Handler> } })
  .server.handlers;

let admin: AdminDb | null = null;
let publicClient: AdminDb | null = null;
let ownerId = "";
let viewerId = "";
let ownerToken = "";
let viewerToken = "";
let workspaceId = "";
let personalInterviewId = "";
let workspaceInterviewId = "";

function makeRequest(
  method: Method,
  token: string,
  body: unknown = {},
  url = "http://localhost/api/maaroof-interviews",
): Request {
  const headers = new Headers({ authorization: "Bearer " + token });
  if (method !== "GET") headers.set("content-type", "application/json");
  return new Request(url, {
    method,
    headers,
    ...(method === "GET" ? {} : { body: JSON.stringify(body) }),
  });
}

async function createAuthenticatedUser(
  serviceClient: AdminDb,
  anonymousClient: AdminDb,
  email: string,
  password: string,
  fullName: string,
): Promise<{ id: string; token: string }> {
  const { data, error } = await serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data.user) {
    throw new Error("Could not create local test user: " + (error?.message || "missing user"));
  }

  const signIn = await anonymousClient.auth.signInWithPassword({ email, password });
  if (signIn.error || !signIn.data.session?.access_token) {
    throw new Error(
      "Could not sign in local test user: " + (signIn.error?.message || "missing token"),
    );
  }

  return { id: data.user.id, token: signIn.data.session.access_token };
}

integrationDescribe("Maaroof interview API against local Supabase", () => {
  beforeAll(async () => {
    // The suite is enabled only in the isolated local Supabase CI job.
    const url = SUPABASE_URL!;
    const anonKey = SUPABASE_ANON_KEY!;
    const serviceKey = SUPABASE_SERVICE_ROLE_KEY!;
    admin = createClient<Database>(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    publicClient = createClient<Database>(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const suffix = Date.now().toString(36) + "-" + crypto.randomUUID().slice(0, 8);
    const password = "Maaroof-Test-" + crypto.randomUUID() + "!9";
    const owner = await createAuthenticatedUser(
      admin,
      publicClient,
      "interview-owner-" + suffix + "@example.test",
      password,
      "Interview API Owner",
    );
    ownerId = owner.id;
    ownerToken = owner.token;

    const viewer = await createAuthenticatedUser(
      admin,
      publicClient,
      "interview-viewer-" + suffix + "@example.test",
      password,
      "Interview API Viewer",
    );
    viewerId = viewer.id;
    viewerToken = viewer.token;

    const { data: workspace, error: workspaceError } = await admin
      .from("workspaces")
      .insert({
        name: "Interview API integration " + suffix,
        owner_id: ownerId,
        kind: "client",
      })
      .select("id")
      .single();
    if (workspaceError || !workspace) {
      throw new Error(
        "Could not create local test workspace: " +
          (workspaceError?.message || "missing workspace"),
      );
    }
    workspaceId = workspace.id;

    const { error: memberError } = await admin.from("workspace_members").insert({
      workspace_id: workspaceId,
      user_id: viewerId,
      role: "viewer",
    });
    if (memberError) {
      throw new Error("Could not create local viewer membership: " + memberError.message);
    }
  });

  afterAll(async () => {
    if (!admin) return;
    // Deleting Auth users cascades their personal interviews, workspace memberships, and owned workspace.
    if (viewerId) await admin.auth.admin.deleteUser(viewerId);
    if (ownerId) await admin.auth.admin.deleteUser(ownerId);
  });

  it("persists, pauses, resumes, and updates a personal interview through the real API", async () => {
    const created = await handlers.POST({
      request: makeRequest("POST", ownerToken, {
        target_type: "company",
        target_name: "Integration Test Company",
        domains: ["general", "seo"],
        locale: "ar",
        interview_depth: "focused",
      }),
    });
    expect(created.status).toBe(201);
    const createdBody = await created.json();
    expect(createdBody.interview.user_id).toBe(ownerId);
    expect(createdBody.next_question.id).toBe("objective");
    personalInterviewId = createdBody.interview.id;

    const fetched = await handlers.GET({
      request: makeRequest(
        "GET",
        ownerToken,
        {},
        "http://localhost/api/maaroof-interviews?id=" + personalInterviewId,
      ),
    });
    expect(fetched.status).toBe(200);
    expect((await fetched.json()).next_question.id).toBe("objective");

    const paused = await handlers.PATCH({
      request: makeRequest("PATCH", ownerToken, {
        id: personalInterviewId,
        expected_version: 1,
        action: "status",
        status: "paused",
      }),
    });
    expect(paused.status).toBe(200);
    expect((await paused.json()).interview).toMatchObject({ status: "paused", version: 2 });

    const answerWhilePaused = await handlers.PATCH({
      request: makeRequest("PATCH", ownerToken, {
        id: personalInterviewId,
        expected_version: 2,
        action: "answer",
        answer: { questionId: "objective", status: "answered", value: "should be rejected" },
      }),
    });
    expect(answerWhilePaused.status).toBe(409);
    expect((await answerWhilePaused.json()).error).toBe("resume_interview_first");

    const resumed = await handlers.PATCH({
      request: makeRequest("PATCH", ownerToken, {
        id: personalInterviewId,
        expected_version: 2,
        action: "status",
        status: "in_progress",
      }),
    });
    expect(resumed.status).toBe(200);
    expect((await resumed.json()).interview).toMatchObject({ status: "in_progress", version: 3 });

    const answered = await handlers.PATCH({
      request: makeRequest("PATCH", ownerToken, {
        id: personalInterviewId,
        expected_version: 3,
        action: "answer",
        answer: {
          questionId: "objective",
          status: "answered",
          value: "Increase qualified organic traffic",
        },
      }),
    });
    expect(answered.status).toBe(200);
    expect((await answered.json()).interview.version).toBe(4);

    const verified = await handlers.GET({
      request: makeRequest(
        "GET",
        ownerToken,
        {},
        "http://localhost/api/maaroof-interviews?id=" + personalInterviewId,
      ),
    });
    expect(verified.status).toBe(200);
    const verifiedBody = await verified.json();
    expect(verifiedBody.interview.state.answers.objective).toMatchObject({
      status: "answered",
      source: "user",
      value: "Increase qualified organic traffic",
    });
    expect(verifiedBody.interview.version).toBe(4);
  });

  it("allows a workspace viewer to read a session but denies writes and new sessions", async () => {
    const created = await handlers.POST({
      request: makeRequest("POST", ownerToken, {
        target_type: "company",
        target_name: "Workspace Integration Company",
        workspace_id: workspaceId,
        domains: ["general"],
        locale: "ar",
      }),
    });
    expect(created.status).toBe(201);
    workspaceInterviewId = (await created.json()).interview.id;

    const viewerRead = await handlers.GET({
      request: makeRequest(
        "GET",
        viewerToken,
        {},
        "http://localhost/api/maaroof-interviews?id=" + workspaceInterviewId,
      ),
    });
    expect(viewerRead.status).toBe(200);

    const viewerUpdate = await handlers.PATCH({
      request: makeRequest("PATCH", viewerToken, {
        id: workspaceInterviewId,
        expected_version: 1,
        action: "status",
        status: "paused",
      }),
    });
    expect(viewerUpdate.status).toBe(404);
    expect((await viewerUpdate.json()).error).toBe("interview_not_found");

    const viewerCreate = await handlers.POST({
      request: makeRequest("POST", viewerToken, {
        target_type: "company",
        target_name: "Viewer Must Not Create",
        workspace_id: workspaceId,
      }),
    });
    expect(viewerCreate.status).toBe(403);
    expect((await viewerCreate.json()).error).toBe("workspace_access_denied");
  });
});
