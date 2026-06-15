import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { fcSearch } from "@/lib/firecrawl";
import { getUserContext, specialtyHint } from "@/lib/user-context.server";
import { describeMarket } from "@/lib/geo-scope.server";
import { FACTUAL_SAFETY_PROMPT, LOVABLE_AI_CHAT_COMPLETIONS_URL, extractJsonObject, lovableAiHeaders } from "@/lib/lovable-ai";
import { chargeTokens, chargeFailureBody } from "@/lib/tokens.server";

type Mode = "search" | "email" | "brand";

export const Route = createFileRoute("/api/company-email")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { company, sector, notes, lang = "en", goal, mode, scope } = await request.json();
          if (!company) return Response.json({ error: "company required" }, { status: 400 });
          const m: Mode = (mode === "search" || mode === "email" || mode === "brand") ? mode : "email";

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
          const _runId = crypto.randomUUID();
          const _t0 = Date.now();
          const _chg = await chargeTokens({ userId, toolKey: "company_email", runId: _runId, meta: { provider: "lovable_ai", model: "google/gemini-2.5-flash-lite", endpoint: "/api/company-email" } });
          if (!_chg.ok) return Response.json(chargeFailureBody(_chg.reason as any, _chg.left), { status: 402 });
          const userCtx = await getUserContext(admin, userId);

          const market = describeMarket(scope);
          const specBoost = userCtx.specialty ? ` ${userCtx.specialty}` : "";
          const q = `${company} ${sector || ""} ${notes || ""}${specBoost} ${market.region}`.slice(0, 300);
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

          const sys = `${FACTUAL_SAFETY_PROMPT}

You write STRICTLY in language code: ${lang}. ${modeInstruction} Use only the supplied Sources and user notes; if sources are empty, say evidence is missing and do not invent company details. Output a single JSON object only.${specialtyHint(userCtx, lang as any)}`;
          const user = `Company / Brand: ${company}\nSector: ${sector || "-"}\nGoal: ${goal || "-"}\nTarget market: ${market.region}\nUser notes: ${notes || "-"}\n\nSources:\n${ctx || "(no sources found)"}`;

          const ai = await fetch(LOVABLE_AI_CHAT_COMPLETIONS_URL, {
            method: "POST",
            headers: lovableAiHeaders(lovableKey),
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [{ role: "system", content: sys }, { role: "user", content: user }]
            }),
          });
          if (ai.status === 429) return Response.json({ error: "rate_limited" }, { status: 429 });
          if (ai.status === 402) return Response.json({ error: "credits_exhausted" }, { status: 402 });
          if (!ai.ok) {
            console.error("[api/company-email] gateway error", ai.status, await ai.text().catch(() => ""));
            return Response.json({ error: "ai_error" }, { status: 500 });
          }
          const j: any = await ai.json();

          const parsed: any = extractJsonObject(j?.choices?.[0]?.message?.content) || {};
          return Response.json({ ...parsed, mode: m, sources, specialty: userCtx.specialty });
        } catch (e) {
          console.error("[api/company-email] failed", e);
          return Response.json({ error: "internal_error" }, { status: 500 });
        }
      },
    },
  },
});
