import { createClient } from "@supabase/supabase-js";
import { runMaaroof } from "@/lib/maaroof/orchestrator.server";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function encryptionKey(secret: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptJobToken(token: string, secret: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(secret), encoder.encode(token));
  return toBase64(iv) + "." + toBase64(new Uint8Array(encrypted));
}

async function decryptJobToken(value: string, secret: string): Promise<string> {
  const [ivPart, encryptedPart] = value.split(".");
  if (!ivPart || !encryptedPart) throw new Error("job_auth_token_invalid");
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(ivPart) },
    await encryptionKey(secret),
    fromBase64(encryptedPart),
  );
  return decoder.decode(decrypted);
}

function adminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("server_not_configured");
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Process one durable queue message. The browser connection is not part of this lifecycle. */
export async function processMaaroofBackgroundJob(jobId: string): Promise<void> {
  const admin = adminClient();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const { data: job, error } = await admin.from("maaroof_background_jobs")
    .select("id,user_id,workspace_id,goal,language,mode,status,request_payload,auth_token_ciphertext")
    .eq("id", jobId).maybeSingle();
  if (error) throw new Error("job_lookup_failed");
  if (job?.status === "dispatching") throw new Error("job_not_ready_for_processing");
  if (!job || job.status !== "queued") return;

  // A queue delivery can race with the request handler that charges and finalizes
  // the job. Never execute a job whose billing/finalization confirmation is absent.
  const payload = (job.request_payload || {}) as Record<string, any>;
  if (payload.charge_confirmed !== true) {
    const message = "job_charge_not_confirmed";
    const now = new Date().toISOString();
    await admin.from("maaroof_background_jobs").update({
      status: "failed",
      auth_token_ciphertext: null,
      error: message,
      finished_at: now,
      updated_at: now,
    }).eq("id", jobId).eq("user_id", job.user_id).eq("status", "queued");
    await admin.from("maaroof_background_job_events").insert({
      job_id: jobId,
      user_id: job.user_id,
      event_type: "error",
      payload: { message },
    });
    return;
  }

  const now = new Date().toISOString();
  const { data: claimed, error: claimError } = await admin.from("maaroof_background_jobs")
    .update({ status: "running", started_at: now, updated_at: now })
    .eq("id", jobId).eq("status", "queued").select("id").maybeSingle();
  if (claimError) throw new Error("job_claim_failed");
  if (!claimed) return;

  const controller = new AbortController();
  let knownToolRan = false;
  const emit = async (eventType: string, eventData: any) => {
    if ((eventType === "tool_call" || eventType === "tool_result") && String(eventData?.tool || "") === "known") knownToolRan = true;
    const { data: current } = await admin.from("maaroof_background_jobs").select("status")
      .eq("id", jobId).eq("user_id", job.user_id).maybeSingle();
    if (current?.status === "cancelled") controller.abort();
    await admin.from("maaroof_background_job_events").insert({
      job_id: jobId, user_id: job.user_id, event_type: eventType, payload: eventData || {},
    });
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (eventType === "phase") patch.current_stage = String(eventData?.phase || "").slice(0, 100);
    if (eventType === "deep_entity_discovery") patch.current_stage = "deep_entity_discovery";
    if (eventType === "final" || eventType === "done") patch.result = { type: eventType, data: eventData || {} };
    await admin.from("maaroof_background_jobs").update(patch)
      .eq("id", jobId).eq("user_id", job.user_id).eq("status", "running");
  };

  try {
    if (!job.auth_token_ciphertext) throw new Error("job_auth_token_missing");
    const authBearer = await decryptJobToken(job.auth_token_ciphertext, serviceKey);
    await runMaaroof({
      userId: job.user_id,
      goal: job.goal,
      language: job.language as "ar" | "en" | "ku",
      detectedGeo: payload.detected_geo,
      geoScope: payload.geo_scope || undefined,
      workspaceId: job.workspace_id || null,
      authBearer,
      origin: String(payload.origin || ""),
      emit,
      signal: controller.signal,
      executionMode: job.mode as "execution" | "recommendation" | "simulation",
      useSubagents: payload.use_subagents === false ? false : undefined,
      liveProbe: payload.live_probe === false ? false : undefined,
      clarifications: payload.clarifications || {},
      selectedSkills: Array.isArray(payload.selected_skills) ? payload.selected_skills : undefined,
    });
    const { data: latest } = await admin.from("maaroof_background_jobs").select("status")
      .eq("id", jobId).eq("user_id", job.user_id).maybeSingle();
    if (latest?.status === "cancelled") return;

    // One best-effort entity discovery pass per job. Reuse the main run's
    // "known" tool result instead of paying for a duplicate discovery.
    try {
      const weight = (payload.weight || {}) as { weight?: string; score?: number };
      if (knownToolRan) {
        await emit("deep_entity_discovery", { status: "skipped", reason: "already_run", actual_cost_tokens: 0, weight: weight.weight || "light" });
      } else {
        const [{ data: profile }, { data: workspace }] = await Promise.all([
          admin.from("profiles").select("brand_name,brand_keywords,specialty_scope,hq_country").eq("id", job.user_id).maybeSingle(),
          job.workspace_id
            ? admin.from("workspaces").select("name,brand_url,keywords,country,city,brand_summary").eq("id", job.workspace_id).eq("owner_id", job.user_id).maybeSingle()
            : Promise.resolve({ data: null }),
        ]);
        const brand = String((profile as any)?.brand_name || ((workspace as any)?.brand_url ? (workspace as any)?.name : "") || "").trim().slice(0, 200);
        if (brand.length < 2) {
          await emit("deep_entity_discovery", { status: "skipped", reason: "entity_identity_missing", actual_cost_tokens: 0, weight: weight.weight || "light" });
        } else {
          const origin = String(payload.origin || "").replace(/\/$/, "");
          if (!origin) throw new Error("job_origin_missing");
          const depth = weight.weight === "deep" ? "deep" : "quick";
          const detected = (payload.detected_geo || {}) as Record<string, any>;
          const country = String((profile as any)?.hq_country || (workspace as any)?.country || detected.country || "").trim();
          const city = String((workspace as any)?.city || detected.city || "").trim();
          const scope = country
            ? { scope: city ? "city" : "country", country, ...(city ? { city } : {}) }
            : { scope: "world" };
          await emit("deep_entity_discovery", { status: "started", brand, depth, weight: weight.weight || "light", score: Number(weight.score || 0) });
          const response = await fetch(origin + "/api/known", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + authBearer },
            body: JSON.stringify({
              brand,
              website: String((workspace as any)?.brand_url || "").slice(0, 300),
              sector: String((profile as any)?.brand_keywords || (profile as any)?.specialty_scope || (workspace as any)?.keywords || "").slice(0, 200),
              depth,
              lang: job.language,
              scope,
            }),
            signal: controller.signal,
          });
          const raw = await response.text();
          if (!response.ok) {
            let reason = "entity_discovery_http_" + response.status;
            try { reason = String(JSON.parse(raw)?.error || reason); } catch {}
            throw new Error(reason);
          }
          let result: any = null;
          let streamError = "";
          for (const block of raw.split(/\n\n+/)) {
            const event = block.match(/^event:\s*([^\n]+)/m)?.[1]?.trim();
            const dataLine = block.split("\n").find((line) => line.startsWith("data: "));
            if (!dataLine) continue;
            try {
              const data = JSON.parse(dataLine.slice(6));
              if (event === "result") result = data;
              if (event === "error") streamError = String(data?.error || "entity_discovery_failed");
            } catch {}
          }
          if (!result) throw new Error(streamError || "entity_discovery_result_missing");
          let actualCostTokens = 0;
          if (result.run_id && !result.reused) {
            const { data: discoveryRun } = await admin.from("mkd_runs").select("cost_tokens,status").eq("id", result.run_id).maybeSingle();
            actualCostTokens = Math.max(0, Number((discoveryRun as any)?.cost_tokens || 0));
          }
          await emit("deep_entity_discovery", {
            status: "completed",
            brand,
            depth,
            run_id: result.run_id || null,
            reused: !!result.reused,
            candidates: Array.isArray(result.relations) ? result.relations.length : 0,
            sources: Array.isArray(result.sources) ? result.sources.length : 0,
            actual_cost_tokens: actualCostTokens,
            weight: weight.weight || "light",
          });
        }
      }
    } catch (discoveryError: any) {
      // Discovery is additive and must never turn a successful main task into a failure.
      await emit("deep_entity_discovery", {
        status: "failed",
        reason: String(discoveryError?.message || discoveryError || "entity_discovery_failed").slice(0, 200),
        actual_cost_tokens: 0,
        weight: String((payload.weight as any)?.weight || "light"),
      });
    }

    const { data: afterDiscovery } = await admin.from("maaroof_background_jobs").select("status")
      .eq("id", jobId).eq("user_id", job.user_id).maybeSingle();
    if (afterDiscovery?.status === "cancelled") return;
    await admin.from("maaroof_background_jobs").update({
      status: "completed", auth_token_ciphertext: null, finished_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq("id", jobId).eq("user_id", job.user_id).eq("status", "running");
  } catch (error) {
    const message = String((error as any)?.message || error || "job_failed").slice(0, 500);
    await admin.from("maaroof_background_job_events").insert({
      job_id: jobId, user_id: job.user_id, event_type: "error", payload: { message },
    });
    await admin.from("maaroof_background_jobs").update({
      status: "failed", auth_token_ciphertext: null, error: message, finished_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq("id", jobId).eq("user_id", job.user_id).eq("status", "running");
    throw error;
  }
}
