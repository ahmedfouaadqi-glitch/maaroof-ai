import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { resolveAuthenticatedUserId } from "@/lib/api-auth.server";
import { fcScrape } from "@/lib/firecrawl";
import { FACTUAL_SAFETY_PROMPT, LOVABLE_AI_CHAT_COMPLETIONS_URL, extractJsonObject, lovableAiHeaders } from "@/lib/lovable-ai";
import { chargeTokens, chargeFailureBody } from "@/lib/tokens.server";
import { slugify } from "@/lib/crawler-bots";
import { pingIndexNow } from "@/lib/indexnow.server";
import { resolveToolModel } from "@/lib/ai-engines.server";
import { asText } from "@/lib/input-coerce";
import { recordBrandOperation } from "@/lib/brand-operations.server";

const AUTHORITY_COST = 3;

/**
 * Brand Authority Engine — generates a structured "authority pack" (JSON-LD + Markdown + HTML)
 * for the user's brand, stores it, and publishes it at /api/public/brand/{slug} where AI crawlers
 * can read it. Optionally pings IndexNow to speed up Bing/Yandex/etc.
 *
 * Methods:
 *  POST  body: { brand_name, brand_keywords?, source_url?, ping?: boolean }  → generate & save
 *  GET   ?slug=... → fetch pack + last-7-days crawler hits (own user only)
 */
export const Route = createFileRoute("/api/brand-authority")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { admin, userId, profile, err } = await authUser(request);
        if (err) return err;

        const url = new URL(request.url);
        const slug = String(url.searchParams.get("slug") || "").toLowerCase().slice(0, 80);
        const workspaceRaw = String(url.searchParams.get("workspace_id") || "").trim();
        if (workspaceRaw && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(workspaceRaw)) {
          return Response.json({ error: "invalid_workspace" }, { status: 400 });
        }
        const workspaceId = workspaceRaw || null;
        if (workspaceId) {
          const { data: owned } = await admin.from("workspaces").select("id")
            .eq("id", workspaceId).eq("owner_id", userId!).maybeSingle();
          if (!owned) return Response.json({ error: "workspace_not_found" }, { status: 404 });
        }

        let packQ = admin.from("brand_authority_packs").select("*").eq("user_id", userId!);
        packQ = workspaceId ? packQ.eq("workspace_id", workspaceId) : packQ.is("workspace_id", null);
        if (slug) packQ = packQ.eq("brand_slug", slug);
        const { data: packs, error: packError } = await packQ.order("updated_at", { ascending: false }).limit(50);
        if (packError) {
          console.error("[brand-authority] scoped pack read failed", packError.message);
          return Response.json({ error: "brand_packs_unavailable" }, { status: 503 });
        }

        const COLS = "brand_slug, bot_name, user_agent, path, hit_at";
        const CAP = 20000;
        const hits: any[] = [];
        for (let from = 0; from < CAP; from += 1000) {
          let hitsQ = admin.from("crawler_hits").select(COLS).eq("user_id", userId!);
          hitsQ = workspaceId ? hitsQ.eq("workspace_id", workspaceId) : hitsQ.is("workspace_id", null);
          const { data, error } = await hitsQ.order("hit_at", { ascending: false }).range(from, from + 999);
          if (error) {
            console.error("[brand-authority] scoped crawler read failed", error.message);
            return Response.json({ error: "crawler_hits_unavailable" }, { status: 503 });
          }
          if (!data?.length) break;
          hits.push(...data);
          if (data.length < 1000) break;
        }
        const allHits = slug ? hits.filter((h) => h.brand_slug === slug) : hits;
        const known = allHits.filter((h) => h.bot_name && h.bot_name !== "Unknown" && h.bot_name !== "Browser");
        const stats = {
          total: allHits.length,
          known: known.length,
          first: allHits.length ? allHits[allHits.length - 1].hit_at : null,
          last: allHits.length ? allHits[0].hit_at : null,
        };
        return Response.json({ workspace_id: workspaceId, packs: packs || [], hits: allHits, stats, username: String((profile as any)?.username || "") });
      },

      POST: async ({ request }) => {
        try {
          const lovableKey = process.env.LOVABLE_API_KEY;
          if (!lovableKey) return Response.json({ error: "internal_error" }, { status: 500 });
          const { admin, userId, profile, err } = await authUser(request);
          if (err) return err;

          const body = await request.json().catch(() => ({} as any));
          const brand_name = asText(body?.brand_name, 200);
          const brand_keywords = asText(body?.brand_keywords, 400);
          const source_url = asText(body?.source_url, 500);
          const shouldPing = Boolean(body?.ping);
          const lang = String(body?.lang || "en");
          if (!brand_name) return Response.json({ error: "brand_name required" }, { status: 400 });

          const workspaceRaw = typeof body?.workspace_id === "string" ? body.workspace_id.trim() : "";
          if (workspaceRaw && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(workspaceRaw)) {
            return Response.json({ error: "invalid_workspace" }, { status: 400 });
          }
          const workspaceId = workspaceRaw || null;
          if (workspaceId) {
            const { data: owned } = await admin.from("workspaces").select("id")
              .eq("id", workspaceId).eq("owner_id", userId!).maybeSingle();
            if (!owned) return Response.json({ error: "workspace_not_found" }, { status: 404 });
          }

          const slugBase = slugify(brand_name);
          if (!slugBase) return Response.json({ error: "invalid_brand_name" }, { status: 400 });
          const slug = workspaceId ? `${slugBase.slice(0, 70)}-${workspaceId.replace(/-/g, "").slice(0, 8)}` : slugBase;

          const _runId = crypto.randomUUID();
          const _t0 = Date.now();
          // Governed model selection (Part 12 registry) with the legacy default as fallback.
          const _MODEL = await resolveToolModel("google/gemini-2.5-flash");
          const _chg = await chargeTokens({ userId: userId!, toolKey: "brand_authority", runId: _runId, meta: { provider: "lovable_ai", model: _MODEL, endpoint: "/api/brand-authority", workspace_id: workspaceId } });
          if (!_chg.ok) return Response.json(chargeFailureBody(_chg.reason as any, _chg.left), { status: 402 });

          // Quota check (same model as brand-boost)
          const bbToggle = String((profile as any)?.quota_overrides?.brand_boost || "").toLowerCase();
          if (bbToggle === "off") return Response.json({ error: "tool_disabled_by_admin" }, { status: 403 });
          let allowed = bbToggle === "on" || !!(profile as any).is_subscribed;
          const overrideLimit = Number((profile as any)?.quota_overrides?.monthly_analyses || 0);
          const used = Number((profile as any).monthly_analyses_used || 0);
          if (!allowed && overrideLimit - used < AUTHORITY_COST) {
            /* balance-only: charge already succeeded */ void overrideLimit;
          }



          // Step 1: optional scrape for grounding
          let evidenceText = "";
          if (source_url && /^https?:\/\//i.test(source_url)) {
            try {
              const s: any = await fcScrape(source_url, { deep: false });
              const md = String(s?.data?.markdown || s?.markdown || "").slice(0, 6000);
              if (md) evidenceText = `Source: ${source_url}\n\n${md}`;
            } catch (e) {
              console.warn("[brand-authority] scrape failed", e);
            }
          }

          // Step 2: ask the AI to produce JSON-LD + Markdown brand card + summary
          const sys = `${FACTUAL_SAFETY_PROMPT}
You produce a "Brand Authority Pack" optimized for AI crawlers (GPTBot, PerplexityBot, Google-Extended, Claude, etc.).
Output ONLY valid JSON with this exact shape:
{
  "summary": "1-2 sentence neutral factual overview, max 280 chars",
  "markdown": "300-500 word Markdown brand card with H2 sections: Overview, What they do, Key facts, FAQ. Use only facts from the input.",
  "json_ld": { "@context": "https://schema.org", "@type": "Organization", "name": "...", "description": "...", "knowsAbout": [...], "sameAs": [], "url": "" }
}
Rules:
- Never invent facts. If you don't know, omit the field.
- Use the brand keywords as topics in knowsAbout.
- If a source URL was provided, put it in url and sameAs.
- Language of markdown/summary: ${lang === "ar" ? "Arabic" : lang === "ku" ? "Kurdish Sorani" : "English"}.`;

          const usr = `Brand: ${brand_name}
Keywords/topics: ${brand_keywords || "(none)"}
Source URL: ${source_url || "(none)"}

EVIDENCE FROM SOURCE (if any):
${evidenceText || "(no source content)"}`;

          const r = await fetch(LOVABLE_AI_CHAT_COMPLETIONS_URL, {
            method: "POST",
            headers: lovableAiHeaders(lovableKey),
            body: JSON.stringify({
              model: _MODEL,
              messages: [{ role: "system", content: sys }, { role: "user", content: usr }],
            }),
          });
          if (r.status === 402) return Response.json({ error: "credits_exhausted" }, { status: 402 });
          if (r.status === 429) return Response.json({ error: "rate_limited" }, { status: 429 });
          const j: any = await r.json().catch(() => ({}));
          try {
            const _u: any = (j as any)?.usage || {};
            const { enrichLedger: _el } = await import("@/lib/spend.server");
            await _el({ runId: _runId, provider: "lovable_ai", model: _MODEL, endpoint: "/api/brand-authority", inputTokens: Number(_u.prompt_tokens)||0, outputTokens: Number(_u.completion_tokens)||0, latencyMs: Date.now() - _t0 });
          } catch {}
          const content = String(j?.choices?.[0]?.message?.content || "");
          const parsed = extractJsonObject<any>(content) || {};

          const summary = String(parsed.summary || "").slice(0, 320);
          const markdown = String(parsed.markdown || "");
          let json_ld = parsed.json_ld && typeof parsed.json_ld === "object" ? parsed.json_ld : {
            "@context": "https://schema.org", "@type": "Organization", name: brand_name,
          };
          // Ensure name + url present
          (json_ld as any).name = (json_ld as any).name || brand_name;
          if (source_url && !(json_ld as any).url) (json_ld as any).url = source_url;
          // GEO/AEO: areaServed from the owner's declared target markets (any country).
          try {
            const { data: prof } = await (admin as any).from("profiles").select("target_markets, hq_country").eq("id", userId).maybeSingle();
            const tm = Array.isArray(prof?.target_markets) ? prof.target_markets : String(prof?.target_markets || "").split(/[,،]/);
            const markets = tm.map((m: unknown) => String(m || "").trim()).filter(Boolean).slice(0, 30);
            if (markets.length && !(json_ld as any).areaServed) (json_ld as any).areaServed = markets.map((name: string) => ({ "@type": "Country", name }));
          } catch {}

          // Step 3: upsert
          let existingQuery = admin.from("brand_authority_packs")
            .select("id, user_id")
            .eq("brand_slug", slug);
          existingQuery = workspaceId ? existingQuery.eq("workspace_id", workspaceId) : existingQuery.is("workspace_id", null);
          const { data: existing } = await existingQuery.maybeSingle();
          if (existing && (existing as any).user_id !== userId) {
            return Response.json({ error: "slug_taken" }, { status: 409 });
          }

          const row = {
            user_id: userId!,
            workspace_id: workspaceId,
            brand_slug: slug,
            brand_name,
            brand_keywords,
            json_ld,
            markdown,
            summary,
            html: "", // generated on the fly in the public endpoint
            updated_at: new Date().toISOString(),
          };
          if (existing) {
            await admin.from("brand_authority_packs").update(row).eq("id", (existing as any).id);
          } else {
            await admin.from("brand_authority_packs").insert(row);
          }

          // Step 4: optional IndexNow ping
          const host = new URL(request.url).host;
          const publicUrl = `${new URL(request.url).origin}/api/public/brand/${slug}`;
          let pingResult: any = null;
          if (shouldPing) pingResult = await pingIndexNow([publicUrl], host);

          // Step 5: track usage (same monthly_analyses bucket as brand-boost)
          await admin.from("profiles").update({
            monthly_analyses_used: used + AUTHORITY_COST,
          }).eq("id", userId!);
          await recordBrandOperation(admin, {
            id: _runId,
            userId: userId!,
            workspaceId,
            operationType: "brand_authority",
            brandName: brand_name,
            durationMs: Date.now() - _t0,
            chargedUnits: AUTHORITY_COST,
            requestMeta: { source_url_provided: Boolean(source_url), indexnow_requested: shouldPing },
            resultMeta: { slug, public_url: publicUrl, publication_scope: "maaroof_host", published_on_customer_domain: false, indexnow_result: pingResult },
          });
          await admin.from("activity_log").insert({
            user_id: userId,
            action: "brand_authority",
            metadata: { operation_id: _runId, workspace_id: workspaceId, brand: brand_name, slug, cost: AUTHORITY_COST, pinged: shouldPing, publication_scope: "maaroof_host" },
          });

          return Response.json({
            operation_id: _runId,
            slug,
            public_url: publicUrl,
            publication_scope: "maaroof_host",
            published_on_customer_domain: false,
            summary,
            markdown,
            json_ld,
            ping: pingResult,
          });
        } catch (e) {
          console.error("[api/brand-authority] failed", e);
          return Response.json({ error: "internal_error" }, { status: 500 });
        }
      },
    },
  },
});

async function authUser(request: Request) {
  const SUPABASE_URL = process.env.SUPABASE_URL!;
  const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const admin = createClient(SUPABASE_URL, SERVICE);
  const userId = await resolveAuthenticatedUserId(request, admin);
  if (!userId) return { admin, err: Response.json({ error: "auth_required" }, { status: 401 }) } as const;
  const { data: prof } = await admin.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (!prof) return { admin, err: Response.json({ error: "auth_required" }, { status: 401 }) } as const;
  return { admin, userId, profile: prof, err: null as null } as const;
}
