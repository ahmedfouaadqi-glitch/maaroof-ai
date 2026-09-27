import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { fcSearch } from "@/lib/firecrawl";
import { describeMarket, type GeoScope } from "@/lib/geo-scope.server";
import { FACTUAL_SAFETY_PROMPT, LOVABLE_AI_CHAT_COMPLETIONS_URL, extractJsonObject, lovableAiHeaders } from "@/lib/lovable-ai";
import { chargeTokens, chargeFailureBody } from "@/lib/tokens.server";
import { resolveToolModel, resolveEngineModels, excludeUnhealthyEngines } from "@/lib/ai-engines.server";
import { ENGINE_KEYS, type EngineKey } from "@/lib/ai-engines";
import { detectGeoFromRequest } from "@/lib/maaroof/geo.server";
import { asText } from "@/lib/input-coerce";
import { dedupeCandidates, falsePositiveReason, relationTruth, normalizeDomain, type Candidate, engineMentions, localQueries } from "@/lib/maaroof/mkd";

const LANG: Record<string, string> = {
  ar: "اكتب القيم النصية بالعربية الفصحى.",
  en: "Write string values in clear English.",
  ku: "بەهاکانی دەق بە کوردی سۆرانی بنووسە.",
};

type Src = { url: string; title: string; snippet: string };

function listFrom(sr: any): any[] {
  const items = sr?.data?.web || sr?.web || sr?.data || [];
  return Array.isArray(items) ? items : [];
}

async function askEngines(brand: string, sector: string, place: string, lang: string, n: number, apiKey: string) {
  const { engines, excluded } = await excludeUnhealthyEngines(ENGINE_KEYS.slice(0, n) as EngineKey[]);
  const models = await resolveEngineModels(engines);
  const byEngine: Record<string, string[]> = {};
  await Promise.allSettled(engines.map(async (e) => {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 20000);
    try {
      const r = await fetch(LOVABLE_AI_CHAT_COMPLETIONS_URL, {
        method: "POST", headers: lovableAiHeaders(apiKey), signal: ctl.signal,
        body: JSON.stringify({ model: models[e]?.model, max_tokens: 400, messages: [
          { role: "system", content: `Answer as the ${e} assistant would for a user in ${place}. Return JSON only: {"competitors":["name",...]} max 8.` },
          { role: "user", content: `Who are the main competitors of "${brand}"${sector ? ` (${sector})` : ""} in ${place}?` },
        ] }),
      });
      if (!r.ok) return;
      const j: any = await r.json();
      const p = extractJsonObject<any>(j?.choices?.[0]?.message?.content) || {};
      if (Array.isArray(p.competitors)) byEngine[e] = p.competitors.map((x: any) => String(x).slice(0, 100)).slice(0, 8);
    } catch {} finally { clearTimeout(t); }
  }));
  return { byEngine, asked: engines, excluded };
}

export const Route = createFileRoute("/api/known")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const apiKey = process.env.LOVABLE_API_KEY;
        if (!SUPABASE_URL || !SERVICE || !apiKey) return Response.json({ error: "internal_error" }, { status: 500 });
        const admin = createClient(SUPABASE_URL, SERVICE);
        const auth = request.headers.get("authorization");
        if (!auth?.startsWith("Bearer ")) return Response.json({ error: "auth_required" }, { status: 401 });
        const { data: u } = await admin.auth.getUser(auth.slice(7));
        const userId = u?.user?.id;
        if (!userId) return Response.json({ error: "auth_required" }, { status: 401 });

        let body: any = {};
        try { body = await request.json(); } catch {}
        const brand = asText(body.brand, 200);
        const website = asText(body.website, 300);
        const sector = asText(body.sector, 200);
        const depth = body.depth === "deep" ? "deep" : "quick";
        const lang = body.lang === "en" || body.lang === "ku" ? body.lang : "ar";
        let scope = (body.scope || null) as GeoScope | null;
        if (!scope || (scope as any).scope === "auto") {
          const g = detectGeoFromRequest(request);
          scope = g.country ? { scope: "country", country: g.country } : { scope: "world" };
        }
        const place = scope.scope === "world" ? "" : [scope.city, scope.region, scope.country].filter(Boolean).join(", ");
        if (brand.length < 2) return Response.json({ error: "brand_required" }, { status: 400 });

        const runId = crypto.randomUUID();
        const MODEL = await resolveToolModel("google/gemini-2.5-pro");
        const chg = await chargeTokens({ userId, toolKey: "known", runId, meta: { provider: "lovable_ai", model: MODEL, endpoint: "/api/known", depth } });
        if (!chg.ok) return Response.json(chargeFailureBody(chg.reason as any, chg.left), { status: 402 });

        const m = describeMarket(scope as any);
        const { data: run } = await admin.from("mkd_runs").insert({
          user_id: userId, brand, depth, scope: (scope || {}) as any, status: "running", cost_tokens: (chg as any).tokens || 0,
        }).select("id").single();
        const dbRunId = (run as any)?.id as string | undefined;

        try {
          // 1) Discovery — web search (bounded)
          const qs = localQueries(brand, sector, place, lang, depth === "deep");
          // Engine perception runs in parallel with web discovery.
          const enginePromise = askEngines(brand, sector, place || "worldwide", lang, depth === "deep" ? 9 : 4, apiKey);
          const sources: Src[] = [];
          for (const q of qs.slice(0, depth === "deep" ? 5 : 3)) {
            try {
              const sr = await fcSearch(q, { limit: depth === "deep" ? 6 : 4, lang, ...(scope.country && scope.scope !== "world" ? { location: place } : {}) }, { userId, toolKey: "known" });
              for (const it of listFrom(sr)) {
                const url = String(it?.url || "");
                if (!url || sources.some((s) => s.url === url)) continue;
                sources.push({ url, title: String(it?.title || "").slice(0, 160), snippet: String(it?.description || it?.markdown || "").slice(0, 500) });
                if (sources.length >= 8 * 3) break;
              }
            } catch { /* keep going with what we have */ }
          }

          // 2) Extract + classify (one structured call)
          const srcBlock = sources.map((s, i) => `[${i + 1}] ${s.title} — ${s.url}\n${s.snippet}`).join("\n\n");
          const system = `${FACTUAL_SAFETY_PROMPT}
You discover competitive relationships for a brand. Market: ${m.region} (${m.market}). ${m.contextHint}
Categories: direct, indirect, substitute, hidden, emerging, perceived (AI engines associate them but no market evidence), seasonal.
Return JSON only: {"summary":"...","candidates":[{"name":"...","domain":"example.com or null","category":"...","confidence":0-100,"reason":"one or two sentences: why","source_ids":[1,2]}]}
Rules: up to 25 candidates. Use source_ids only for sources that actually mention the entity. If you name an entity from your own knowledge without a source, use source_ids: [] and category "perceived" unless strongly justified. Exclude the brand itself, platforms, directories and marketplaces. ${LANG[lang]}`;
          const eng = await enginePromise;
          const engBlock = Object.entries(eng.byEngine).map(([e, l]) => `${e}: ${l.join(", ")}`).join("\n");
          const prompt = `Market: ${place || "worldwide"} — prefer entities operating in this market; exclude foreign-only players unless market is worldwide.\nAI engines named (unverified): ${engBlock || "-"}\nBrand: ${brand}\nWebsite: ${website || "-"}\nSector: ${sector || "-"}\n\nSources:\n${srcBlock || "(none)"}`;
          const r = await fetch(LOVABLE_AI_CHAT_COMPLETIONS_URL, {
            method: "POST",
            headers: lovableAiHeaders(apiKey),
            body: JSON.stringify({ model: MODEL, max_tokens: 4096, messages: [{ role: "system", content: system }, { role: "user", content: prompt }] }),
          });
          if (!r.ok) throw new Error(r.status === 429 ? "rate_limited" : r.status === 402 ? "ai_credits" : "ai_failed");
          const j: any = await r.json();
          const parsed = extractJsonObject<any>(j?.choices?.[0]?.message?.content) || {};
          const raw: any[] = Array.isArray(parsed.candidates) ? parsed.candidates : [];

          // 3) Normalize, dedupe, filter
          const meta = new Map<string, any>();
          const cands: Candidate[] = raw.map((c) => {
            const ids: number[] = Array.isArray(c.source_ids) ? c.source_ids.map(Number).filter((n: number) => n >= 1 && n <= sources.length) : [];
            const urls = ids.map((n) => sources[n - 1].url);
            const cand: Candidate = { name: String(c.name || "").slice(0, 120), domain: c.domain ? String(c.domain) : null, sources: urls, fromWeb: urls.length > 0, fromAi: urls.length === 0 };
            meta.set(cand.name, c);
            return cand;
          });
          const brandDomain = normalizeDomain(website);
          const filtered: { name: string; reason: string }[] = [];
          const kept = dedupeCandidates(cands, 25).filter((c) => {
            const fp = falsePositiveReason(c, brand, brandDomain);
            if (fp) filtered.push({ name: c.name, reason: fp });
            return !fp;
          });

          // 4) Truth rule + persist
          const relations = kept.map((c) => {
            const mm = meta.get(c.name) || {};
            const t = relationTruth({ category: String(mm.category || ""), confidence: Number(mm.confidence), fromWeb: c.fromWeb, fromAi: c.fromAi, sourceCount: c.sources.length });
            const engines = engineMentions(c.name, eng.byEngine);
            return { entity_name: c.name, entity_domain: c.domain || null, reason: String(mm.reason || "").slice(0, 600), sources: c.sources, engines, ...t };
          }).sort((a, b) => (Number(b.sources.length > 0) - Number(a.sources.length > 0)) || b.confidence - a.confidence);

          if (dbRunId && relations.length) {
            await admin.from("mkd_relations").insert(relations.map((x) => ({
              run_id: dbRunId, user_id: userId, entity_name: x.entity_name, entity_domain: x.entity_domain,
              category: x.category, confidence: x.confidence, reason: x.reason,
              verification_state: x.verification_state, is_ai_observation: x.is_ai_observation,
            })) as any);
          }
          const summary = { text: String(parsed.summary || "").slice(0, 1200), sources: sources.length, candidates: relations.length, filtered };
          if (dbRunId) await admin.from("mkd_runs").update({ status: "done", summary: summary as any }).eq("id", dbRunId);

          return Response.json({ run_id: dbRunId, brand, depth, market: place || "World", scope, engines_asked: eng.asked, engines_excluded: eng.excluded, summary: summary.text, relations, filtered, sources });
        } catch (e: any) {
          if (dbRunId) await admin.from("mkd_runs").update({ status: "failed", error: String(e?.message || e).slice(0, 300) }).eq("id", dbRunId);
          return Response.json({ error: String(e?.message || "failed") }, { status: 502 });
        }
      },
    },
  },
});
