import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { resolveAuthenticatedUserId } from "@/lib/api-auth.server";
import { isValidReportEmail } from "@/lib/brand-boost-automation";
import { sendBrandReportVerificationCode } from "@/lib/brand-boost-mail.server";

function safeEqual(a: string, b: string): boolean {
  const aa = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  let diff = aa.length ^ bb.length;
  const n = Math.max(aa.length, bb.length);
  for (let i = 0; i < n; i++) diff |= (aa[i] || 0) ^ (bb[i] || 0);
  return diff === 0;
}

async function hashCode(userId: string, workspaceId: string | null, code: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(userId + "|" + (workspaceId || "account") + "|" + code),
  );
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function getContext(request: Request) {
  const url = process.env.SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return { error: Response.json({ error: "server_not_configured" }, { status: 500 }) } as const;
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const userId = await resolveAuthenticatedUserId(request, admin);
  if (!userId) return { error: Response.json({ error: "auth_required" }, { status: 401 }) } as const;
  const requestUrl = new URL(request.url);
  const workspaceRaw = String(requestUrl.searchParams.get("workspace_id") || "").trim();
  if (workspaceRaw && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(workspaceRaw)) {
    return { error: Response.json({ error: "invalid_workspace" }, { status: 400 }) } as const;
  }
  const workspaceId = workspaceRaw || null;
  if (workspaceId) {
    const { data: owned } = await admin.from("workspaces").select("id").eq("id", workspaceId).eq("owner_id", userId).maybeSingle();
    if (!owned) return { error: Response.json({ error: "workspace_not_found" }, { status: 404 }) } as const;
  }

  let query = admin.from("brand_boost_report_settings")
    .select("id, email_to, enabled, email_verified_at, verification_code_hash, verification_expires_at, verification_sent_at, verification_attempts")
    .eq("user_id", userId);
  query = workspaceId ? query.eq("workspace_id", workspaceId) : query.is("workspace_id", null);
  const { data: existing, error } = await query.maybeSingle();
  if (error) return { error: Response.json({ error: "report_settings_unavailable" }, { status: 503 }) } as const;
  return { admin, userId, workspaceId, existing } as const;
}

export const Route = createFileRoute("/api/brand-boost-report-settings")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const ctx = await getContext(request);
        if ("error" in ctx) return ctx.error;
        const row = ctx.existing;
        return Response.json({
          settings: {
            email_to: row?.email_to || "",
            enabled: row?.enabled === true && Boolean(row?.email_verified_at),
            email_verified: Boolean(row?.email_verified_at),
            verification_pending: Boolean(row?.verification_code_hash && row?.verification_expires_at && new Date(row.verification_expires_at).getTime() > Date.now()),
            verification_expires_at: row?.verification_expires_at || null,
          },
        });
      },
      POST: async ({ request }) => {
        const ctx = await getContext(request);
        if ("error" in ctx) return ctx.error;
        const body = await request.json().catch(() => ({} as any));
        const action = String(body?.action || "save");

        if (action === "request_verification") {
          const emailTo = String(body?.email_to || "").trim().toLowerCase();
          if (!isValidReportEmail(emailTo)) return Response.json({ error: "valid_email_required" }, { status: 400 });
          if (ctx.existing?.email_to === emailTo && ctx.existing?.email_verified_at) {
            return Response.json({ ok: true, email_verified: true, already_verified: true });
          }
          const lastSentAt = ctx.existing?.verification_sent_at ? new Date(ctx.existing.verification_sent_at).getTime() : 0;
          if (lastSentAt && Date.now() - lastSentAt < 60_000) {
            return Response.json({ error: "verification_rate_limited", retry_after_seconds: Math.ceil((60_000 - (Date.now() - lastSentAt)) / 1000) }, { status: 429 });
          }

          const codeValue = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
          const code = String(codeValue).padStart(6, "0");
          const codeHash = await hashCode(ctx.userId, ctx.workspaceId, code);
          const verificationId = crypto.randomUUID();
          try {
            await sendBrandReportVerificationCode(emailTo, code, verificationId);
          } catch (error: any) {
            console.error("[brand-boost-report-settings] verification email failed", error?.message || error);
            return Response.json({ error: "verification_email_failed" }, { status: 502 });
          }

          const now = new Date();
          const row = {
            user_id: ctx.userId,
            workspace_id: ctx.workspaceId,
            email_to: emailTo,
            enabled: false,
            email_verified_at: null,
            verification_code_hash: codeHash,
            verification_expires_at: new Date(now.getTime() + 15 * 60_000).toISOString(),
            verification_sent_at: now.toISOString(),
            verification_attempts: 0,
            updated_at: now.toISOString(),
          };
          const write = ctx.existing?.id
            ? await ctx.admin.from("brand_boost_report_settings").update(row).eq("id", ctx.existing.id).eq("user_id", ctx.userId)
            : await ctx.admin.from("brand_boost_report_settings").insert(row);
          if (write.error) {
            console.error("[brand-boost-report-settings] verification state save failed", write.error.message);
            return Response.json({ error: "verification_state_save_failed" }, { status: 503 });
          }
          return Response.json({ ok: true, verification_sent: true, expires_in_seconds: 900 });
        }

        if (action === "verify_code") {
          const code = String(body?.code || "").trim();
          const row = ctx.existing;
          if (!/^\d{6}$/.test(code) || !row?.id || !row.verification_code_hash || !row.verification_expires_at) {
            return Response.json({ error: "verification_not_pending" }, { status: 400 });
          }
          if (Number(row.verification_attempts || 0) >= 5) {
            return Response.json({ error: "verification_attempt_limit" }, { status: 429 });
          }
          if (new Date(row.verification_expires_at).getTime() <= Date.now()) {
            return Response.json({ error: "verification_code_expired" }, { status: 400 });
          }
          const candidate = await hashCode(ctx.userId, ctx.workspaceId, code);
          if (!safeEqual(candidate, String(row.verification_code_hash))) {
            await ctx.admin.from("brand_boost_report_settings")
              .update({ verification_attempts: Number(row.verification_attempts || 0) + 1, updated_at: new Date().toISOString() })
              .eq("id", row.id).eq("user_id", ctx.userId);
            return Response.json({ error: "verification_code_invalid" }, { status: 400 });
          }
          const now = new Date().toISOString();
          const { error } = await ctx.admin.from("brand_boost_report_settings").update({
            email_verified_at: now,
            verification_code_hash: null,
            verification_expires_at: null,
            verification_attempts: 0,
            enabled: false,
            updated_at: now,
          }).eq("id", row.id).eq("user_id", ctx.userId);
          if (error) return Response.json({ error: "verification_save_failed" }, { status: 503 });
          return Response.json({ ok: true, email_verified: true, enabled: false });
        }

        if (action !== "save") return Response.json({ error: "unsupported_action" }, { status: 400 });
        const emailTo = String(body?.email_to || "").trim().toLowerCase();
        const enabled = body?.enabled === true;
        if (emailTo && !isValidReportEmail(emailTo)) return Response.json({ error: "invalid_email" }, { status: 400 });
        if (enabled && (!isValidReportEmail(emailTo) || ctx.existing?.email_to !== emailTo || !ctx.existing?.email_verified_at)) {
          return Response.json({ error: "verified_email_required" }, { status: 409 });
        }
        const emailChanged = Boolean(ctx.existing?.email_to && ctx.existing.email_to !== emailTo);
        const row = {
          user_id: ctx.userId,
          workspace_id: ctx.workspaceId,
          email_to: emailTo,
          enabled,
          ...(emailChanged ? { email_verified_at: null, verification_code_hash: null, verification_expires_at: null, verification_attempts: 0 } : {}),
          updated_at: new Date().toISOString(),
        };
        const write = ctx.existing?.id
          ? await ctx.admin.from("brand_boost_report_settings").update(row).eq("id", ctx.existing.id).eq("user_id", ctx.userId)
          : await ctx.admin.from("brand_boost_report_settings").insert(row);
        if (write.error) return Response.json({ error: "report_settings_save_failed" }, { status: 503 });
        return Response.json({ ok: true, enabled, email_to: emailTo, email_verified: !emailChanged && Boolean(ctx.existing?.email_verified_at) });
      },
    },
  },
});