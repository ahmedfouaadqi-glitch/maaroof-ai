import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { fcSearch } from "@/lib/firecrawl";
import { getUserContext, specialtyHint } from "@/lib/user-context.server";

type Mode = "search" | "email" | "brand";

export const Route = createFileRoute("/api/company-email")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { company, sector, notes, lang = "en", goal, mode } = await request.json();
          if (!company) return Response.json({ error: "company required" }, { status: 400 });
          const m: Mode = (mode === "search" || mode === "email" || mode === "brand") ? mode : "email";

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

          const specBoost = userCtx.specialty ? ` ${userCtx.specialty}` : "";
          const q = `${company} ${sector || ""} ${notes || ""}${specBoost}`.slice(0, 300);
          let sources: any[] = [];
          try {
            const sr = await fcSearch(q, { limit: 6, lang });
            sources = (sr?.data || sr?.web || []).slice(0, 6).map((r: any) => ({
              title: r.title, url: r.url, snippet: (r.markdown || r.description || "").slice(0, 500),
              domain: (() => { try { return new URL(r.url).hostname.replace(/^www\./, ""); } catch { return ""; } })(),
            }));
          } catch {}

          const lovableKey = process.env.LOVABLE_API_KEY;
          if (!lovableKey) return Response.json({ error: "AI not configured" }, { status: 500 });

          const ctx = sources.map((s, i) => `[${i + 1}] ${s.title} (${s.url})\n${s.snippet}`).join("\n\n");

          const modeInstruction =
            m === "search"
              ? `Mode: SEARCH ONLY. Return JSON with keys: company_brief (150-220 words, factual, cite [n]), key_points (5-8 bullets), website (best official URL or ""), social (object with linkedin/instagram/facebook/x as URLs or ""), contacts (array of {name, role, source_index} only if explicitly in snippets, else []). DO NOT write an email.`
              : m === "brand"
              ? `Mode: BRAND LOOKUP. Treat "${company}" as a BRAND/PRODUCT NAME (not a corporate buyer). Return JSON: company_brief (what the brand sells, positioning, tone), key_points (5-8 bullets — products, target audience, USPs, weaknesses visible online), competitors (3-6 short names), opportunities (3-5 actionable ideas in user's specialty). DO NOT write an outreach email.`
              : `Mode: OUTREACH EMAIL. Return JSON: company_brief (concise), key_points (3-5 bullets a sender should know), email_subject, email_body (professional, under 180 words, addressed to the company, references one concrete fact from the brief).`;

          const sys = `You write STRICTLY in language code: ${lang}. ${modeInstruction} Output a single JSON object only.${specialtyHint(userCtx, lang as any)}`;
          const user = `Company / Brand: ${company}\nSector: ${sector || "-"}\nGoal: ${goal || "-"}\nUser notes: ${notes || "-"}\n\nSources:\n${ctx || "(no sources found)"}`;

          const ai = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovableKey}` },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [{ role: "system", content: sys }, { role: "user", content: user }],
              response_format: { type: "json_object" },
            }),
          });
          if (!ai.ok) return Response.json({ error: `AI ${ai.status}` }, { status: 500 });
          const j: any = await ai.json();
          let parsed: any = {};
          try { parsed = JSON.parse(j?.choices?.[0]?.message?.content || "{}"); } catch {}
          return Response.json({ ...parsed, mode: m, sources, specialty: userCtx.specialty });
        } catch (e: any) {
          return Response.json({ error: e?.message || "failed" }, { status: 500 });
        }
      },
    },
  },
});
