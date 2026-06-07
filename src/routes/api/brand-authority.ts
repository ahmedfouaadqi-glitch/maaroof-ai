import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { fcScrape } from "@/lib/firecrawl";
import { FACTUAL_SAFETY_PROMPT, LOVABLE_AI_CHAT_COMPLETIONS_URL, extractJsonObject, lovableAiHeaders } from "@/lib/lovable-ai";
import { chargeTokens, chargeFailureBody } from "@/lib/tokens.server";
import { slugify } from "@/lib/crawler-bots";
import { pingIndexNow } from "@/lib/indexnow.server";

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
        const { admin, userId, err } = await authUser(request);
        if (err) return err;

        const url = new URL(request.url);
        const slug = String(url.searchParams.get("slug") || "").toLowerCase().slice(0, 80);

        let packQ = admin.from("brand_authority_packs").select("*").eq("user_id", userId!);
        if (slug) packQ = packQ.eq("brand_slug", slug);
        const { data: packs } = await packQ.order("updated_at", { ascending: false }).limit(5);

        const slugs = (packs || []).map((p: any) => p.brand_slug);
        let hits: any[] = [];
        if (slugs.length) {
          const since = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
          const { data: h } = await admin
            .from("crawler_hits")
            .select("brand_slug, bot_name, user_agent, path, hit_at")
            .eq("user_id", userId!)
            .gte("hit_at", since)
            .order("hit_at", { ascending: false })
            .limit(200);
          hits = h || [];
        }
        return Response.json({ packs: packs || [], hits });
      },

      POST: async ({ request }) => {
        try {
          const lovableKey = process.env.LOVABLE_API_KEY;
          if (!lovableKey) return Response.json({ error: "internal_error" }, { status: 500 });
          const { admin, userId, profile, err } = await authUser(request);
          if (err) return err;

          // Quota check (same model as brand-boost)
          const bbToggle = String((profile as any)?.quota_overrides?.brand_boost || "").toLowerCase();
          if (bbToggle === "off") return Response.json({ error: "tool_disabled_by_admin" }, { status: 403 });
          let allowed = bbToggle === "on" || !!(profile as any).is_subscribed;
          const overrideLimit = Number((profile as any)?.quota_overrides?.monthly_analyses || 0);
          const used = Number((profile as any).monthly_analyses_used || 0);
          if (!allowed && overrideLimit - used < AUTHORITY_COST) {
            return Response.json({ error: "subscription_required" }, { status: 402 });
          }

          const body = await request.json();
          const brand_name = String(body?.brand_name || "").trim();
          const brand_keywords = String(body?.brand_keywords || "").trim();
          const source_url = String(body?.source_url || "").trim();
          const shouldPing = Boolean(body?.ping);
          const lang = String(body?.lang || "en");
          if (!brand_name) return Response.json({ error: "brand_name required" }, { status: 400 });

          const slug = slugify(brand_name);
          if (!slug) return Response.json({ error: "invalid_brand_name" }, { status: 400 });

          // Step 1: optional scrape for grounding
          let evidenceText = "";
          if (source_url) {
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
              model: "google/gemini-2.5-flash",
              messages: [{ role: "system", content: sys }, { role: "user", content: usr }],
            }),
          });
          if (r.status === 402) return Response.json({ error: "credits_exhausted" }, { status: 402 });
          if (r.status === 429) return Response.json({ error: "rate_limited" }, { status: 429 });
          const j: any = await r.json().catch(() => ({}));
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

          // Step 3: upsert
          const { data: existing } = await admin
            .from("brand_authority_packs")
            .select("id, user_id")
            .eq("brand_slug", slug)
            .maybeSingle();
          if (existing && (existing as any).user_id !== userId) {
            return Response.json({ error: "slug_taken" }, { status: 409 });
          }

          const row = {
            user_id: userId!,
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
          await admin.from("activity_log").insert({
            user_id: userId,
            action: "brand_authority",
            metadata: { brand: brand_name, slug, cost: AUTHORITY_COST, pinged: shouldPing },
          });

          return Response.json({
            slug,
            public_url: publicUrl,
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
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return { admin, err: Response.json({ error: "auth_required" }, { status: 401 }) } as const;
  }
  const { data: ud, error } = await admin.auth.getUser(auth.slice(7));
  const userId = ud?.user?.id;
  if (error || !userId) return { admin, err: Response.json({ error: "auth_required" }, { status: 401 }) } as const;
  const { data: prof } = await admin.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (!prof) return { admin, err: Response.json({ error: "auth_required" }, { status: 401 }) } as const;
  return { admin, userId, profile: prof, err: null as null } as const;
}
