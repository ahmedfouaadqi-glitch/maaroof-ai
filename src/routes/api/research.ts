import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { fcSearch } from "@/lib/firecrawl";
import { getUserContext, specialtyHint } from "@/lib/user-context.server";

export const Route = createFileRoute("/api/research")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const reqBody = await request.json();
          const { query, lang = "en", scope } = reqBody;
          if (!query || typeof query !== "string") return Response.json({ error: "query required" }, { status: 400 });
          const limited = String(query).slice(0, 300);

          // Resolve user context (specialty / brand) for prompt anchoring
          const SUPABASE_URL = process.env.SUPABASE_URL;
          const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
          let userCtx = { specialty: null, brand_name: null, brand_keywords: null } as any;
          if (SUPABASE_URL && SERVICE) {
            const admin = createClient(SUPABASE_URL, SERVICE);
            const auth = request.headers.get("authorization");
            if (auth?.startsWith("Bearer ")) {
              const { data } = await admin.auth.getUser(auth.slice(7));
              if (data.user?.id) userCtx = await getUserContext(admin, data.user.id);
            }
          }

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
          if (lovableKey) {
            const sys = `You are a precise research assistant. Write the answer STRICTLY in language code: ${lang}.
Rules:
- Cite EVERY non-trivial claim inline as [1], [2] matching the source list order.
- If sources contradict, say so explicitly.
- Never invent facts not present in the snippets.
- Output JSON: { "answer": string (300-500 words, with [n] citations), "key_findings": string[] (3-6 short bullets, each with at least one [n]) }${specialtyHint(userCtx, lang as any)}`;
            const ctx = results.map((r: any, i: number) => `[${i + 1}] ${r.title} — ${r.domain} (${r.url})\n${r.snippet}`).join("\n\n");
            const ai = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovableKey}` },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                messages: [
                  { role: "system", content: sys },
                  { role: "user", content: `Question: ${limited}\n\nSources:\n${ctx}\n\nReturn the JSON object now.` },
                ],
                response_format: { type: "json_object" },
              }),
            });
            if (ai.ok) {
              const j: any = await ai.json();
              const raw = j?.choices?.[0]?.message?.content || "{}";
              try {
                const p = JSON.parse(raw);
                answer = String(p.answer || "").slice(0, 4000);
                key_findings = Array.isArray(p.key_findings) ? p.key_findings.slice(0, 6).map((s: any) => String(s).slice(0, 240)) : [];
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

          return Response.json({ query: limited, answer, key_findings, sources: results, channels, specialty: userCtx.specialty });
        } catch (e: any) {
          return Response.json({ error: e?.message || "research failed" }, { status: 500 });
        }
      },
    },
  },
});
