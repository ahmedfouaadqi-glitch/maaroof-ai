import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { scrapeSource, type PulseSourceRow, type GovernorateRow } from "@/lib/pulse-scraper.server";

export const Route = createFileRoute("/api/public/hooks/pulse-crawl")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Light auth: require apikey header (Supabase anon) OR x-hook-secret if set
        const apikey = request.headers.get("apikey");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!apikey || (expected && apikey !== expected)) {
          return new Response("unauthorized", { status: 401 });
        }

        const url = new URL(request.url);
        const onlyKey = url.searchParams.get("source"); // optional: run one source

        // Respect global enable/disable switch
        const { data: cfg } = await supabaseAdmin
          .from("pulse_app_config")
          .select("value")
          .eq("key", "pulse_enabled")
          .maybeSingle();
        const enabled = (cfg?.value as { enabled?: boolean } | null)?.enabled !== false;
        if (!enabled) {
          return Response.json({ ok: true, skipped: true, reason: "pulse_disabled" });
        }

        const { data: govs } = await supabaseAdmin
          .from("governorates")
          .select("id, slug, name_ar, name_en, population_base");
        const { data: sources } = await supabaseAdmin
          .from("pulse_sources")
          .select("id, key, url, scrape_config, active")
          .eq("active", true);

        if (!govs || !sources) return Response.json({ error: "load_failed" }, { status: 500 });

        const toRun = onlyKey ? sources.filter((s) => s.key === onlyKey) : sources;
        const summary: Record<string, { metrics: number; trending: number; error?: string }> = {};

        await Promise.all(
          toRun.map(async (src) => {
            const { data: logRow } = await supabaseAdmin
              .from("pulse_scrape_log")
              .insert({ source_id: src.id, status: "running" })
              .select("id")
              .single();
            try {
              const result = await scrapeSource(src as PulseSourceRow, govs as GovernorateRow[]);
              await supabaseAdmin.from("pulse_raw_snapshots").insert({
                source_id: src.id,
                payload: result.rawPayload as any,
                url: src.url,
              });
              if (result.metrics.length > 0) {
                await supabaseAdmin.from("pulse_metrics").insert(
                  result.metrics.map((m) => ({ ...m, meta: (m.meta ?? {}) as any, source_id: src.id })) as any,
                );
              }
              if (result.trendingApps && result.trendingApps.length > 0) {
                await supabaseAdmin.from("pulse_trending_apps").insert(
                  result.trendingApps.map((a) => ({ ...a, source_id: src.id })),
                );
              }
              await supabaseAdmin
                .from("pulse_sources")
                .update({ last_success_at: new Date().toISOString() })
                .eq("id", src.id);
              if (logRow?.id) {
                await supabaseAdmin
                  .from("pulse_scrape_log")
                  .update({
                    finished_at: new Date().toISOString(),
                    status: "success",
                    rows_inserted: result.metrics.length + (result.trendingApps?.length || 0),
                  })
                  .eq("id", logRow.id);
              }
              summary[src.key] = {
                metrics: result.metrics.length,
                trending: result.trendingApps?.length || 0,
              };
            } catch (e) {
              const err = e instanceof Error ? e.message : String(e);
              console.error(`[pulse-crawl] ${src.key} failed:`, err);
              if (logRow?.id) {
                await supabaseAdmin
                  .from("pulse_scrape_log")
                  .update({
                    finished_at: new Date().toISOString(),
                    status: "error",
                    error: err.slice(0, 500),
                  })
                  .eq("id", logRow.id);
              }
              summary[src.key] = { metrics: 0, trending: 0, error: err };
            }
          }),
        );

        return Response.json({ ok: true, sources_run: toRun.length, summary });
      },
    },
  },
});
