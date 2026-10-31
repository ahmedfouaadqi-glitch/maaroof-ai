import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { resolveAuthenticatedUserId } from "@/lib/api-auth.server";

/** Opt-in: mark one owned visibility run as the baseline for its brand + workspace scope. Free. */
export const Route = createFileRoute("/api/visibility-baseline")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
        const userId = await resolveAuthenticatedUserId(request, admin);
        if (!userId) return Response.json({ error: "auth_required" }, { status: 401 });
        const body = await request.json().catch(() => ({}));
        const id = String(body?.operation_id || "");
        const { data: row } = await admin.from("brand_operations").select("id, user_id, workspace_id, brand_name, operation_type")
          .eq("id", id).eq("user_id", userId).maybeSingle();
        if (!row || row.operation_type !== "visibility_probe") return Response.json({ error: "not_found" }, { status: 404 });
        let clear = admin.from("brand_operations").update({ is_baseline: false } as any).eq("user_id", userId)
          .eq("operation_type", "visibility_probe").eq("brand_name", row.brand_name);
        clear = row.workspace_id ? clear.eq("workspace_id", row.workspace_id) : clear.is("workspace_id", null);
        await clear;
        if (body?.baseline !== false) await admin.from("brand_operations").update({ is_baseline: true } as any).eq("id", id);
        return Response.json({ ok: true });
      },
    },
  },
});
