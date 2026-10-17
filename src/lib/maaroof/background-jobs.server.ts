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

  const now = new Date().toISOString();
  const { data: claimed, error: claimError } = await admin.from("maaroof_background_jobs")
    .update({ status: "running", started_at: now, updated_at: now })
    .eq("id", jobId).eq("status", "queued").select("id").maybeSingle();
  if (claimError) throw new Error("job_claim_failed");
  if (!claimed) return;

  const payload = (job.request_payload || {}) as Record<string, any>;
  const controller = new AbortController();
  const emit = async (eventType: string, eventData: any) => {
    const { data: current } = await admin.from("maaroof_background_jobs").select("status")
      .eq("id", jobId).eq("user_id", job.user_id).maybeSingle();
    if (current?.status === "cancelled") controller.abort();
    await admin.from("maaroof_background_job_events").insert({
      job_id: jobId, user_id: job.user_id, event_type: eventType, payload: eventData || {},
    });
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (eventType === "phase") patch.current_stage = String(eventData?.phase || "").slice(0, 100);
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
