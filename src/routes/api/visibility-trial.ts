import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { ENGINE_KEYS, ENGINE_CATALOG, type EngineKey } from "@/lib/ai-engines";
import { resolveEngineModels } from "@/lib/ai-engines.server";
import {
  classifyEntityType,
  getTrustedClientIp,
  hashTrialSignal,
  trialEntityFingerprint,
  verifyTrialIpRisk,
  type TrialEntityType,
} from "@/lib/visibility-trial.server";

type StartBody = {
  action?: "start" | "retrieve";
  request_key?: string;
  attempt_id?: string;
  entity_name?: string;
  entity_type?: "auto" | TrialEntityType;
  category?: string;
  description?: string;
  market?: string;
  language?: "ar" | "en" | "ku";
  assets?: string[];
};

const PROVIDER_PREFIX: Partial<Record<EngineKey, string>> = {
  chatgpt: "openai/",
  gemini: "google/",
  claude: "anthropic/",
  perplexity: "perplexity/",
  copilot: "microsoft/",
  grok: "x-ai/",
  mistral: "mistralai/",
  deepseek: "deepseek/",
  kimi: "moonshotai/",
  qwen: "qwen/",
};
const CANDIDATE_ORDER: EngineKey[] = ["chatgpt", "gemini", "claude", "grok", "mistral", "deepseek", "kimi", "qwen", "perplexity", "copilot"];
const ENGINE_LABELS: Record<EngineKey, string> = Object.fromEntries(
  ENGINE_KEYS.map((key) => [key, ENGINE_CATALOG[key].name]),
) as Record<EngineKey, string>;

function jsonError(error: string, status: number, extra: Record<string, unknown> = {}) {
  return Response.json({ ok: false, error, ...extra }, { status, headers: { "Cache-Control": "no-store" } });
}

function cleanText(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function parseModelJson(content: unknown): any {
  if (typeof content !== "string") return null;
  const cleaned = content.trim().replace(/^\`\`\`(?:json)?\s*/i, "").replace(/\s*\`\`\`$/, "");
  try { return JSON.parse(cleaned); } catch {}
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first >= 0 && last > first) {
    try { return JSON.parse(cleaned.slice(first, last + 1)); } catch {}
  }
  return { summary: cleaned.slice(0, 1800), answer: cleaned.slice(0, 5000) };
}

function safeUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v || "").trim()).filter((v) => {
    try { const u = new URL(v); return u.protocol === "https:" || u.protocol === "http:"; } catch { return false; }
  }).slice(0, 5);
}

function buildTrialPrompt(input: {
  name: string; category: string; description: string; market: string; language: string;
  entityType: string; assets: string[];
}) {
  const labels: Record<string, string> = {
    ar: "أجب باللغة العربية. افصل الحقائق المعروفة عن غير المعروفة. لا تختلق روابط أو مصادر أو ادعاءات.",
    en: "Answer in English. Separate known facts from unknowns. Do not invent links, sources, or claims.",
    ku: "بە کوردیی سۆرانی وەڵام بدە. زانیاریی پشتڕاستکراو لە نەزانراو جیا بکەرەوە. سەرچاوە و بەستەری دروست مەکە.",
  };
  return [
    "You are performing a cautious, live entity visibility probe. This is a sample of your own response, not a market-wide measurement.",
    "Entity name: " + input.name,
    "Declared entity type: " + input.entityType + " (may be unknown; do not force a classification)",
    "Category or sector supplied by user: " + (input.category || "not supplied"),
    "Description supplied by user: " + (input.description || "not supplied"),
    "Target market supplied by user: " + (input.market || "not specified"),
    "Optional digital assets supplied by user: " + (input.assets.length ? input.assets.join(", ") : "none"),
    "Tasks: 1) state whether you recognize this entity, 2) identify whether it appears to be a person, organization, or unknown and give classification confidence, 3) assess whether you could recommend it in the supplied category and market, 4) state the evidence basis and important unknowns, 5) list only sources/URLs you can genuinely identify, 6) give two practical improvements.",
    labels[input.language] || labels.en,
    "Return ONLY JSON with this shape: " + JSON.stringify({
      entity_type: "person|organization|unknown",
      entity_type_confidence: "high|medium|low",
      recognized: "yes|no|uncertain",
      mentioned: false,
      recommendation: "yes|no|conditional|unknown",
      confidence: "high|medium|low",
      summary: "brief factual summary",
      evidence_basis: "what is known and what is not established",
      strengths: ["observation"],
      gaps: ["unknown or missing evidence"],
      recommendations: ["actionable improvement"],
      sources: ["https://..."]
    }),
    "Do not infer that an asset exists if it was not supplied. Do not claim a search or browsing operation occurred. If you do not know the entity, say so explicitly."
  ].join("\n");
}

async function getContactSettings(admin: any) {
  try {
    const { data } = await admin.from("app_settings").select("value").eq("key", "contact_info").maybeSingle();
    const v = data?.value && typeof data.value === "object" ? data.value as Record<string, unknown> : {};
    const whatsappNumber = cleanText(v.whatsapp_number, 32).replace(/[^0-9]/g, "");
    return {
      title: "MAAROOF Ai",
      message: "",
      email: cleanText(v.email, 200),
      phone: cleanText(v.phone_display, 80),
      whatsapp: whatsappNumber ? "https://wa.me/" + whatsappNumber : "",
      website: "",
      channels: ["facebook", "instagram", "twitter", "linkedin", "telegram"]
        .filter((key) => typeof v[key] === "string" && String(v[key]).trim())
        .map((key) => ({ label: key, url: cleanText(v[key], 300) })),
      fallbackPath: "/contact",
    };
  } catch {
    return { title: "", message: "", email: "", phone: "", whatsapp: "", website: "", channels: [], fallbackPath: "/contact" };
  }
}

async function getAdmin(request: Request) {
  const url = process.env.SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) throw new Error("server_not_configured");
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return { error: "auth_required" as const };
  const { data } = await admin.auth.getUser(auth.slice(7));
  if (!data.user?.id) return { error: "auth_required" as const };
  return { admin, userId: data.user.id };
}

async function chooseThreeVerifiedModels() {
  const resolved = await resolveEngineModels([...ENGINE_KEYS]);
  const selected: Array<{ key: EngineKey; model: string }> = [];
  const providers = new Set<string>();
  const models = new Set<string>();
  for (const key of CANDIDATE_ORDER) {
    const model = String(resolved[key]?.model || "");
    const prefix = PROVIDER_PREFIX[key];
    if (!prefix || !model.startsWith(prefix) || providers.has(prefix) || models.has(model)) continue;
    providers.add(prefix);
    models.add(model);
    selected.push({ key, model });
    if (selected.length === 3) break;
  }
  return selected.length === 3 ? selected : null;
}

async function runOneEngine(model: string, prompt: string, apiKey: string, signal: AbortSignal) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + apiKey,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.APP_URL || "https://maaroof.ai",
      "X-Title": "MAAROOF AI Free Visibility Trial",
    },
    body: JSON.stringify({ model, temperature: 0.2, max_tokens: 1100, messages: [
      { role: "system", content: "You are a cautious factual analyst. Do not fabricate evidence. Return valid JSON only." },
      { role: "user", content: prompt },
    ] }),
    signal,
    cache: "no-store",
  });
  if (!response.ok) throw new Error("engine_http_" + response.status);
  const data: any = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  const parsed = parseModelJson(content);
  if (!parsed) throw new Error("engine_empty_response");
  return parsed;
}

export const Route = createFileRoute("/api/visibility-trial")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: StartBody;
        try { body = await request.json() as StartBody; } catch { return jsonError("invalid_json", 400); }
        const auth = await getAdmin(request).catch(() => ({ error: "server_not_configured" as const }));
        if ("error" in auth) return jsonError(auth.error, auth.error === "auth_required" ? 401 : 503);
        const { admin, userId } = auth;
        // Opportunistic cleanup: report payloads are erased at 72h and lock rows at 77h.
        await admin.rpc("purge_expired_visibility_trial_data").catch(() => null);

        if (body.action === "retrieve") {
          if (!body.attempt_id || !/^[0-9a-f-]{36}$/i.test(body.attempt_id)) return jsonError("attempt_id_invalid", 400);
          const { data, error } = await admin.rpc("claim_visibility_trial_result", { p_attempt_id: body.attempt_id, p_user_id: userId });
          if (error) return jsonError("trial_storage_unavailable", 503);
          const result = data as any;
          if (result?.status === "retrieved") return Response.json({ ok: true, result: result.result, result_expires_at: result.result_expires_at }, { headers: { "Cache-Control": "no-store" } });
          if (result?.status === "retrieval_exhausted") return Response.json({ ok: false, error: result.status, contact: await getContactSettings(admin) }, { status: 403, headers: { "Cache-Control": "no-store" } });
          return jsonError(result?.status || "result_unavailable", 410);
        }

        if (body.action !== "start") return jsonError("action_invalid", 400);
        const name = cleanText(body.entity_name, 180);
        if (name.length < 2) return jsonError("entity_name_required", 400);
        if (!body.request_key || !/^[0-9a-f-]{36}$/i.test(body.request_key)) return jsonError("request_key_invalid", 400);
        const lang = body.language === "ar" || body.language === "ku" ? body.language : "en";
        const category = cleanText(body.category, 180);
        const description = cleanText(body.description, 600);
        const market = cleanText(body.market, 120);
        const rawAssets = Array.isArray(body.assets) ? body.assets : [];
        const assets = rawAssets.map((x) => cleanText(x, 300)).filter(Boolean).slice(0, 8);
        const entityType = classifyEntityType(body.entity_type, name + " " + description);
        const fingerprint = trialEntityFingerprint(name, entityType);
        const ip = getTrustedClientIp(request);
        if (!ip) return jsonError("ip_verification_unavailable", 503);
        let ipRisk;
        try { ipRisk = await verifyTrialIpRisk(ip); }
        catch { return jsonError("ip_verification_unavailable", 503, { retry_verification: true }); }
        if (ipRisk.vpn || ipRisk.proxy || ipRisk.tor || ipRisk.risk === "high") {
          return Response.json({ ok: false, error: "connection_not_eligible", risk: "blocked", contact: await getContactSettings(admin) }, { status: 403, headers: { "Cache-Control": "no-store" } });
        }

        const requestKey = body.request_key;
        const userAgent = cleanText(request.headers.get("user-agent"), 300);
        const deviceSignal = cleanText(request.headers.get("x-trial-device"), 200) || userAgent;
        const sessionSignal = cleanText(request.headers.get("x-trial-session"), 200);
        if (!deviceSignal || !sessionSignal) return jsonError("session_verification_unavailable", 503);
        let deviceHash: string, sessionHash: string, ipHash: string;
        try {
          deviceHash = hashTrialSignal(deviceSignal, "device");
          sessionHash = hashTrialSignal(sessionSignal, "session");
          ipHash = hashTrialSignal(ip, "ip");
        } catch { return jsonError("trial_security_not_configured", 503); }

        const models = await chooseThreeVerifiedModels().catch(() => null);
        const openRouterKey = process.env.OPENROUTER_API_KEY;
        if (!models || !openRouterKey) return jsonError("three_verified_engine_routes_unavailable", 503, { retryable: true });

        const attemptId = crypto.randomUUID();
        let entityHash: string;
        try { entityHash = fingerprint; } catch { return jsonError("entity_identity_invalid", 400); }
        const { data: reserved, error: reserveError } = await admin.rpc("reserve_visibility_trial_attempt", {
          p_attempt_id: attemptId,
          p_user_id: userId,
          p_request_key: requestKey,
          p_entity_fingerprint: entityHash,
          p_entity_name: name,
          p_entity_type: entityType,
          p_device_hash: deviceHash,
          p_session_hash: sessionHash,
          p_ip_hash: ipHash,
          p_risk_metadata: { risk: ipRisk.risk, vpn: ipRisk.vpn, proxy: ipRisk.proxy, tor: ipRisk.tor },
        });
        if (reserveError) return jsonError("trial_storage_unavailable", 503);
        const reservation = reserved as any;
        if (reservation?.status === "existing") {
          const { data: existing } = await admin.from("visibility_trial_attempts").select("id,status,result_payload,result_expires_at").eq("id", reservation.attempt_id).eq("user_id", userId).maybeSingle();
          if (existing?.result_payload) return Response.json({ ok: true, attempt_id: existing.id, result: existing.result_payload, result_expires_at: existing.result_expires_at, idempotent_replay: true }, { headers: { "Cache-Control": "no-store" } });
          return Response.json({ ok: false, error: "request_already_started", attempt_id: reservation.attempt_id, attempt_status: existing?.status || reservation.attempt_status }, { status: 409, headers: { "Cache-Control": "no-store" } });
        }
        if (reservation?.status !== "reserved") {
          return Response.json({ ok: false, error: reservation?.status || "trial_not_available", retry_at: reservation?.retry_at || null, contact: await getContactSettings(admin) }, { status: 403, headers: { "Cache-Control": "no-store" } });
        }

        const { data: counter, error: startError } = await admin.rpc("mark_visibility_trial_attempt_started", { p_attempt_id: attemptId });
        if (startError) {
          await admin.from("visibility_trial_attempts").delete().eq("id", attemptId).eq("user_id", userId).eq("status", "reserved");
          return jsonError("trial_start_failed", 503);
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 45_000);
        const startedAt = Date.now();
        const prompt = buildTrialPrompt({ name, category, description, market, language: lang, entityType, assets });
        try {
          const settled = await Promise.allSettled(models.map((item) => runOneEngine(item.model, prompt, openRouterKey, controller.signal)));
          const results = settled.map((entry, index) => {
            const model = models[index];
            if (entry.status === "rejected") return {
              engine: model.key, name: ENGINE_LABELS[model.key], status: "error",
              mentioned: false, recommendation: "unknown", confidence: "low",
              summary: "تعذر الحصول على إجابة من هذا المسار في هذه المحاولة.",
              evidence_basis: "No usable response was returned.",
              strengths: [], gaps: ["No answer returned"], recommendations: [], sources: [],
            };
            const value: any = entry.value;
            const allowedType = ["person", "organization", "unknown"].includes(value.entity_type) ? value.entity_type : "unknown";
            return {
              engine: model.key, name: ENGINE_LABELS[model.key], status: "answered",
              entity_type: allowedType,
              entity_type_confidence: ["high", "medium", "low"].includes(value.entity_type_confidence) ? value.entity_type_confidence : "low",
              recognized: ["yes", "no", "uncertain"].includes(value.recognized) ? value.recognized : "uncertain",
              mentioned: value.mentioned === true,
              recommendation: ["yes", "no", "conditional", "unknown"].includes(value.recommendation) ? value.recommendation : "unknown",
              confidence: ["high", "medium", "low"].includes(value.confidence) ? value.confidence : "low",
              summary: cleanText(value.summary || value.answer, 900),
              evidence_basis: cleanText(value.evidence_basis, 1200),
              strengths: Array.isArray(value.strengths) ? value.strengths.map((x: unknown) => cleanText(x, 240)).filter(Boolean).slice(0, 5) : [],
              gaps: Array.isArray(value.gaps) ? value.gaps.map((x: unknown) => cleanText(x, 240)).filter(Boolean).slice(0, 6) : [],
              recommendations: Array.isArray(value.recommendations) ? value.recommendations.map((x: unknown) => cleanText(x, 260)).filter(Boolean).slice(0, 5) : [],
              sources: safeUrls(value.sources),
            };
          });
          const answered = results.filter((x) => x.status === "answered");
          if (!answered.length) {
            await admin.rpc("complete_visibility_trial_attempt", { p_attempt_id: attemptId, p_user_id: userId, p_result: null, p_status: "failed" });
            return jsonError("all_engine_routes_failed", 502, { attempt_id: attemptId, counted_as_started: true });
          }
          const autoTypes = results.filter((x) => x.status === "answered" && x.entity_type && x.entity_type !== "unknown").map((x) => x.entity_type);
          const inferredType = autoTypes.length ? (autoTypes.filter((x) => x === "person").length >= 2 ? "person" : autoTypes.filter((x) => x === "organization").length >= 2 ? "organization" : "unknown") : "unknown";
          const mentionCount = answered.filter((x) => x.mentioned).length;
          const recommendationCount = answered.filter((x) => x.recommendation === "yes").length;
          const result = {
            report_version: "trial-1",
            attempt_id: attemptId,
            entity: { name, type: body.entity_type === "person" || body.entity_type === "organization" ? body.entity_type : inferredType, type_detection: body.entity_type === "person" || body.entity_type === "organization" ? "manual" : "model_consensus", category: category || null, market: market || null },
            sample: { planned_engines: 3, answered_engines: answered.length, is_market_measurement: false, note: "This is a limited three-engine sample, not a market-wide visibility measurement." },
            metrics: { mention_rate_percent: Math.round(mentionCount / Math.max(1, answered.length) * 100), recommendation_rate_percent: Math.round(recommendationCount / Math.max(1, answered.length) * 100), answered_engines: answered.length },
            summary: "A limited live sample from the three configured, provider-distinct model routes.",
            engines: results,
            generated_at: new Date().toISOString(),
            result_expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
            free_trial_counter: Number(counter || 0),
          };
          const completeStatus = answered.length === 3 ? "completed" : "partial";
          const { data: completed, error: completeError } = await admin.rpc("complete_visibility_trial_attempt", {
            p_attempt_id: attemptId, p_user_id: userId, p_result: result, p_status: completeStatus,
          });
          if (completeError || completed !== true) return jsonError("trial_result_persistence_failed", 500, { attempt_id: attemptId, counted_as_started: true });
          return Response.json({ ok: true, attempt_id: attemptId, result, result_expires_at: result.result_expires_at, free_trial_counter: Number(counter || 0), duration_ms: Date.now() - startedAt }, { headers: { "Cache-Control": "no-store" } });
        } catch (error) {
          await admin.rpc("complete_visibility_trial_attempt", { p_attempt_id: attemptId, p_user_id: userId, p_result: null, p_status: "failed" });
          console.error("[visibility-trial] run failed", error);
          return jsonError(controller.signal.aborted ? "trial_timeout" : "trial_execution_failed", controller.signal.aborted ? 504 : 502, { attempt_id: attemptId, counted_as_started: true });
        } finally {
          clearTimeout(timer);
        }
      },
    },
  },
});
