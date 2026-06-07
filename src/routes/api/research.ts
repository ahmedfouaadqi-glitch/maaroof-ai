import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { fcSearch } from "@/lib/firecrawl";
import { getUserContext, specialtyHint } from "@/lib/user-context.server";
import { FACTUAL_SAFETY_PROMPT, LOVABLE_AI_CHAT_COMPLETIONS_URL, extractJsonObject, lovableAiHeaders } from "@/lib/lovable-ai";
import { chargeTokens, chargeFailureBody } from "@/lib/tokens.server";

export const Route = createFileRoute("/api/research")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const reqBody = await request.json();
          const { query, lang = "en", scope, mode = "web" } = reqBody;
          if (!query || typeof query !== "string") return Response.json({ error: "query required" }, { status: 400 });
          const limited = String(query).slice(0, 300);
          const isCompany = mode === "company";

          // Mandatory auth — endpoint consumes paid Firecrawl + AI gateway credits
          const SUPABASE_URL = process.env.SUPABASE_URL;
          const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
          if (!SUPABASE_URL || !SERVICE) return Response.json({ error: "internal_error" }, { status: 500 });
          const admin = createClient(SUPABASE_URL, SERVICE);
          const authHeader = request.headers.get("authorization");
          if (!authHeader?.startsWith("Bearer ")) {
            return Response.json({ error: "auth_required" }, { status: 401 });
          }
          const { data: userData } = await admin.auth.getUser(authHeader.slice(7));
          const userId = userData?.user?.id;
          if (!userId) return Response.json({ error: "auth_required" }, { status: 401 });
          const _chg = await chargeTokens({ userId, toolKey: "research" });
          if (!_chg.ok) return Response.json(chargeFailureBody(_chg.reason as any, _chg.left), { status: 402 });
          const userCtx = await getUserContext(admin, userId);

          const geo = scope?.country ? ` ${scope.country}` : "";
          const specBoost = userCtx.specialty ? ` ${userCtx.specialty}` : "";
          const includeChannels: boolean = !!reqBody?.include_channels;
          const channelTypes: string[] = Array.isArray(reqBody?.channel_types) && reqBody.channel_types.length
            ? reqBody.channel_types : ["website", "linkedin", "twitter", "instagram", "facebook", "youtube", "telegram", "whatsapp", "email"];

          const sr = await fcSearch(limited + geo + specBoost, { limit: 8, lang });
          // Firecrawl v2 returns { data: { web: [...], news: [...] } } OR legacy { data: [...] }
          const pickArr = (v: any): any[] => {
            if (Array.isArray(v)) return v;
            if (v && typeof v === "object") {
              return [...(Array.isArray(v.web) ? v.web : []), ...(Array.isArray(v.news) ? v.news : [])];
            }
            return [];
          };
          const rawList: any[] = pickArr(sr?.data).length ? pickArr(sr.data)
            : pickArr(sr?.web).length ? pickArr(sr.web)
            : Array.isArray(sr?.results) ? sr.results : [];
          const results = rawList.slice(0, 8).map((r: any) => ({
            title: r.title || r.url,
            url: r.url,
            description: r.description || "",
            snippet: (r.markdown || "").slice(0, 600),
            domain: (() => { try { return new URL(r.url).hostname.replace(/^www\./, ""); } catch { return ""; } })(),
          }));

          const lovableKey = process.env.LOVABLE_API_KEY;
          let answer = "";
          let key_findings: string[] = [];
          let sge_summary = "";
          let visibility_opportunities: string[] = [];
          if (lovableKey) {
            const brandLine = userCtx.brand_name ? `\nUser brand to position: ${userCtx.brand_name}${userCtx.brand_keywords ? ` (${userCtx.brand_keywords})` : ""}` : "";
            const sys = `${FACTUAL_SAFETY_PROMPT}

You are a precise research assistant that mimics a Generative Search Experience (SGE). Write STRICTLY in language code: ${lang}.
${isCompany ? `MODE: COMPANY PROFILE. Treat the query as the name of a company/brand. Build a concise company profile from the supplied snippets only: what they do, sector, geography, official website if visible, products/services, target customers, public reputation signals. Do NOT fabricate revenue, headcount, dates, founders, awards, or contacts.\n` : ""}Rules:
- Cite EVERY non-trivial claim inline as [1], [2] matching the source list order.
- If sources contradict, say so explicitly.
- Never invent facts not present in the snippets.
- Output JSON with these keys EXACTLY:
  {
    "sge_summary": string (60-90 words, the kind of compact AI overview Google/Bing show on top of search; plain prose with [n] citations, no bullets),
    "answer": string (300-500 words, ${isCompany ? "structured company profile" : "deeper answer"} with [n] citations),
    "key_findings": string[] (3-6 short bullets, each with at least one [n]),
    "visibility_opportunities": string[] (3-5 concrete actions ${isCompany ? "to reach or partner with this company, or to position your brand against it" : "the user/brand can take to BE CITED by AI engines on this topic"} — content angles, missing entities, structured-data ideas, channels to publish on)
  }${specialtyHint(userCtx, lang as any)}${brandLine}`;
            const ctx = results.map((r: any, i: number) => `[${i + 1}] ${r.title} — ${r.domain} (${r.url})\n${r.snippet}`).join("\n\n");
            const ai = await fetch(LOVABLE_AI_CHAT_COMPLETIONS_URL, {
              method: "POST",
              headers: lovableAiHeaders(lovableKey),
              body: JSON.stringify({
                model: "google/gemini-2.5-flash-lite",
                messages: [
                  { role: "system", content: sys },
                  { role: "user", content: `Question: ${limited}\n\nSources:\n${ctx}\n\nReturn the JSON object now.` },
                ]
              }),
            });
            if (ai.ok) {
              const j: any = await ai.json();
              const raw = j?.choices?.[0]?.message?.content || "{}";
              try {
                const p = extractJsonObject(raw) || {};
                sge_summary = String(p.sge_summary || "").slice(0, 1200);
                answer = String(p.answer || "").slice(0, 4000);
                key_findings = Array.isArray(p.key_findings) ? p.key_findings.slice(0, 6).map((s: any) => String(s).slice(0, 240)) : [];
                visibility_opportunities = Array.isArray(p.visibility_opportunities) ? p.visibility_opportunities.slice(0, 5).map((s: any) => String(s).slice(0, 280)) : [];
              } catch { answer = raw; }
            }
          }

          // Optional: discover communication channels related to the topic
          let channels: Array<{ type: string; label: string; url: string; source?: string }> = [];
          if (includeChannels) {
            try {
              const domainMap: Record<string, string> = {
                linkedin: "linkedin.com", twitter: "x.com OR twitter.com", instagram: "instagram.com",
                facebook: "facebook.com", youtube: "youtube.com", telegram: "t.me", whatsapp: "wa.me OR whatsapp.com",
              };
              const queries: Array<{ type: string; q: string }> = [];
              for (const t of channelTypes) {
                if (t === "website") queries.push({ type: "website", q: `${limited}${specBoost} official website${geo}` });
                else if (t === "email") queries.push({ type: "email", q: `${limited}${specBoost} contact email${geo}` });
                else if (domainMap[t]) queries.push({ type: t, q: `${limited}${specBoost} site:${domainMap[t]}` });
              }
              const seen = new Set<string>();
              const settled = await Promise.allSettled(queries.map((q) => fcSearch(q.q, { limit: 4, lang })));
              settled.forEach((s, idx) => {
                if (s.status !== "fulfilled") return;
                const list = (() => {
                  const v: any = (s.value as any)?.data;
                  if (Array.isArray(v)) return v;
                  if (v && typeof v === "object") return [...(v.web || []), ...(v.news || [])];
                  return [];
                })();
                for (const r of list.slice(0, 3)) {
                  const url = r?.url; if (!url || seen.has(url)) continue; seen.add(url);
                  channels.push({ type: queries[idx].type, label: r.title || url, url, source: (() => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; } })() });
                }
              });
              // Extract emails from snippets if email channel requested
              if (channelTypes.includes("email")) {
                const blob = results.map((r: any) => r.snippet || "").join("\n");
                const emails = Array.from(new Set((blob.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []))).slice(0, 5);
                for (const e of emails) channels.push({ type: "email", label: e, url: `mailto:${e}` });
              }
            } catch { /* non-fatal */ }
          }

          return Response.json({ query: limited, sge_summary, answer, key_findings, visibility_opportunities, sources: results, channels, specialty: userCtx.specialty });
        } catch (e) {
          console.error("[api/research] failed", e);
          return Response.json({ error: "internal_error" }, { status: 500 });
        }
      },
    },
  },
});
