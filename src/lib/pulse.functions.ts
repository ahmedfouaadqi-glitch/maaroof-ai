import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { LOVABLE_AI_CHAT_COMPLETIONS_URL, lovableAiHeaders } from "@/lib/lovable-ai";

const AssistantSchema = z.object({
  question: z.string().min(3).max(2000),
  governorateSlug: z.string().max(64).optional(),
  specialty: z.string().max(64).optional(),
  lang: z.enum(["ar", "en", "ku"]).default("ar"),
});

export const pulseAssistant = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => AssistantSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { ok: false as const, error: "AI key not configured", markdown: "" };
    }

    // Load context: governorate (if any) + latest metrics + trending apps
    type GovCtx = { id: string; name_ar: string; name_en: string; population_base: number | null };
    let govRow: GovCtx | null = null;
    if (data.governorateSlug) {
      const { data: g } = await supabaseAdmin
        .from("governorates")
        .select("id, name_ar, name_en, population_base")
        .eq("slug", data.governorateSlug)
        .maybeSingle();
      govRow = (g as GovCtx | null) ?? null;
    }

    const metricsQ = supabaseAdmin
      .from("pulse_metrics")
      .select("metric_key, sector, value, unit, meta, captured_at, governorate_id")
      .order("captured_at", { ascending: false })
      .limit(120);
    if (govRow) metricsQ.or(`governorate_id.eq.${govRow.id},governorate_id.is.null`);
    const { data: metrics } = await metricsQ;

    const { data: apps } = await supabaseAdmin
      .from("pulse_trending_apps")
      .select("app_name, category, rank, governorate_id")
      .order("captured_at", { ascending: false })
      .limit(40);

    const contextBlock = JSON.stringify(
      {
        governorate: govRow,
        specialty: data.specialty ?? null,
        metrics: (metrics ?? []).slice(0, 80),
        trending_apps: apps ?? [],
      },
      null,
      2,
    ).slice(0, 18000);

    const langName = data.lang === "ar" ? "Arabic" : data.lang === "ku" ? "Kurdish (Sorani)" : "English";
    const systemPrompt = `You are "نبض" — a sovereign Iraq business intelligence strategist.
RULES:
- Reply in ${langName}.
- USE ONLY the JSON context provided. Never invent numbers, dates, or sources.
- If a fact is missing, say so explicitly.
- Structure the answer as Markdown: ## Summary, ## Key signals (bullets with numbers), ## Strategic recommendations, ## Risks, ## Next steps.
- Tailor advice to the user's specialty when given.
- Keep it tight, evidence-grounded, action-oriented.`;

    try {
      const res = await fetch(LOVABLE_AI_CHAT_COMPLETIONS_URL, {
        method: "POST",
        headers: lovableAiHeaders(apiKey),
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `Question: ${data.question}\n\nLIVE CONTEXT (JSON):\n${contextBlock}`,
            },
          ],
        }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        return { ok: false as const, error: `AI ${res.status}: ${txt.slice(0, 200)}`, markdown: "" };
      }
      const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const markdown = j?.choices?.[0]?.message?.content ?? "";
      return { ok: true as const, markdown, error: null };
    } catch (e) {
      return {
        ok: false as const,
        error: e instanceof Error ? e.message : "AI request failed",
        markdown: "",
      };
    }
  });

const CrawlSchema = z.object({ sourceKey: z.string().max(64).optional() });

/** Admin-triggered manual crawl. Calls the public hook with the anon key server-side. */
export const triggerPulseCrawl = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => CrawlSchema.parse(input ?? {}))
  .handler(async ({ data }) => {
    const anon = process.env.SUPABASE_PUBLISHABLE_KEY;
    const base = process.env.SUPABASE_URL ? "" : "";
    // Use the project's stable public URL for the hook
    const url = `https://project--fa07a113-c24f-4419-b1d8-07ffd60e98c6.lovable.app/api/public/hooks/pulse-crawl${data.sourceKey ? `?source=${encodeURIComponent(data.sourceKey)}` : ""}`;
    void base;
    if (!anon) return { ok: false as const, error: "anon key missing" };
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: anon },
        body: "{}",
      });
      const body = await res.text();
      return { ok: res.ok, status: res.status, body: body.slice(0, 400) };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "fetch failed" };
    }
  });
