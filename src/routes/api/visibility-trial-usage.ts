import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

/** Public-safe aggregate endpoint. It never returns trial rows or personal identifiers. */
export const Route = createFileRoute("/api/visibility-trial-usage")({
  server: {
    handlers: {
      GET: async () => {
        const url = process.env.SUPABASE_URL;
        const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !service) {
          return Response.json({ totalStarted: null, available: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
        }
        try {
          const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
          const { data, error } = await admin.from("visibility_trial_stats").select("total_started").eq("id", 1).maybeSingle();
          if (error || !data) throw error || new Error("trial_counter_not_initialized");
          return Response.json({ totalStarted: Number(data.total_started), available: true }, { headers: { "Cache-Control": "no-store, max-age=0" } });
        } catch {
          return Response.json({ totalStarted: null, available: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
        }
      },
    },
  },
});
