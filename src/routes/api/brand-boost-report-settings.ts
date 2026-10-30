import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { resolveAuthenticatedUserId } from "@/lib/api-auth.server";
import { isValidReportEmail } from "@/lib/brand-boost-automation";

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
  return { admin, userId, workspaceId } as const;
}

export const Route = createFileRoute("/api/brand-boost-report-settings")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const ctx = await getContext(request);
        if ("error" in ctx) return ctx.error;
        let query = ctx.admin.from("brand_boost_report_settings").select("id, email_to, enabled, updated_at")
          .eq("user_id", ctx.userId);
        query = ctx.workspaceId ? query.eq("workspace_id", ctx.workspaceId) : query.is("workspace_id", null);
        const { data, error } = await query.maybeSingle();
        if (error) return Response.json({ error: "report_settings_unavailable" }, { status: 503 });
        return Response.json({ settings: data || { email_to: "", enabled: false } });
      },
      POST: async ({ request }) => {
        const ctx = await getContext(request);
        if ("error" in ctx) return ctx.error;
        const body = await request.json().catch(() => ({} as any));
        const emailTo = String(body?.email_to || "").trim().toLowerCase();
        const enabled = body?.enabled === true;
        if (enabled && !isValidReportEmail(emailTo)) {
          return Response.json({ error: "valid_email_required" }, { status: 400 });
        }
        if (emailTo && !isValidReportEmail(emailTo)) {
          return Response.json({ error: "invalid_email" }, { status: 400 });
        }
        let lookup = ctx.admin.from("brand_boost_report_settings").select("id")
          .eq("user_id", ctx.userId);
        lookup = ctx.workspaceId ? lookup.eq("workspace_id", ctx.workspaceId) : lookup.is("workspace_id", null);
        const { data: existing, error: lookupError } = await lookup.maybeSingle();
        if (lookupError) return Response.json({ error: "report_settings_unavailable" }, { status: 503 });
        const row = { user_id: ctx.userId, workspace_id: ctx.workspaceId, email_to: emailTo, enabled, updated_at: new Date().toISOString() };
        const write = existing
          ? await ctx.admin.from("brand_boost_report_settings").update(row).eq("id", existing.id).eq("user_id", ctx.userId)
          : await ctx.admin.from("brand_boost_report_settings").insert(row);
        if (write.error) return Response.json({ error: "report_settings_save_failed" }, { status: 503 });
        return Response.json({ ok: true, enabled, email_to: emailTo });
      },
    },
  },
});
