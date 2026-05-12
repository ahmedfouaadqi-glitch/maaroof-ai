import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { describeMarket } from "@/lib/geo-scope.server";
import { LOVABLE_AI_CHAT_COMPLETIONS_URL, lovableAiHeaders } from "@/lib/lovable-ai";

const PLATFORMS = ["chatgpt", "gemini", "claude", "perplexity", "copilot", "grok", "mistral", "deepseek"];

export const Route = createFileRoute("/api/brand-boost")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const lovableKey = process.env.LOVABLE_API_KEY;
          const SUPABASE_URL = process.env.SUPABASE_URL;
          const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
          if (!lovableKey || !SUPABASE_URL || !SERVICE) {
            return Response.json({ error: "internal_error" }, { status: 500 });
          }
          const admin = createClient(SUPABASE_URL, SERVICE);

          // Mandatory auth
          const auth = request.headers.get("authorization");
          if (!auth?.startsWith("Bearer ")) {
            return Response.json({ error: "auth_required" }, { status: 401 });
          }
          const { data: userData, error: userErr } = await admin.auth.getUser(auth.slice(7));
          const userId = userData?.user?.id;
          if (userErr || !userId) return Response.json({ error: "auth_required" }, { status: 401 });

          // Quota enforcement (uses monthly_analyses budget; brand_boost is premium add-on)
          const { data: prof } = await admin.from("profiles").select("*").eq("id", userId).maybeSingle();
          if (!prof) return Response.json({ error: "auth_required" }, { status: 401 });
          let allowed = false;
          if ((prof as any).is_subscribed) {
            if ((prof as any).subscription_expires_at && new Date((prof as any).subscription_expires_at) < new Date()) {
              await admin.from("profiles").update({ is_subscribed: false }).eq("id", userId);
            } else {
              allowed = true;
            }
          }
          // Allow override quota even without subscription
          const overrideLimit = Number((prof as any)?.quota_overrides?.monthly_analyses || 0);
          if (!allowed && overrideLimit <= ((prof as any).monthly_analyses_used || 0)) {
            return Response.json({ error: "subscription_required" }, { status: 402 });
          }

          const { brand_name, brand_keywords, platforms = PLATFORMS, lang = "en", scope } = await request.json();
          if (!brand_name) return Response.json({ error: "brand_name required" }, { status: 400 });

          const market = describeMarket(scope);
          const langInstr =
            lang === "ar"
              ? "اكتب جميع القيم النصية داخل JSON باللغة العربية الفصحى فقط."
              : lang === "ku"
              ? "هەموو بەهای دەقی ناو JSON بە کوردی سۆرانی بنووسە."
              : "Write all string values inside the JSON in clear English only.";

          const sys = `You are a brand visibility strategist for ${market.market}.
LOCALIZATION CONTEXT: ${market.contextHint}
${langInstr}
For each AI platform listed, return an action plan to improve brand citation likelihood specifically for ${market.audience}.
Return ONLY valid JSON in this exact shape:
{
  "summary": "1-2 sentence overview in REPORT language",
  "plan": [
    { "platform": "<platform key>", "current_signal": "short status", "recommended_actions": ["action 1","action 2"], "content_pieces": ["idea 1","idea 2"] }
  ]
}`;

          const userMsg = `Brand: ${brand_name}\nKeywords: ${brand_keywords || "-"}\nTarget market: ${market.region}\nPlatforms: ${platforms.join(", ")}`;

          const callModel = (model: string) =>
            fetch(LOVABLE_AI_CHAT_COMPLETIONS_URL, {
              method: "POST",
              headers: lovableAiHeaders(lovableKey),
              body: JSON.stringify({
                model,
                messages: [
                  { role: "system", content: sys },
                  { role: "user", content: userMsg },
                ],
              }),
            });

          let ai = await callModel("google/gemini-2.5-flash-lite");
          if (!ai.ok && ai.status !== 429 && ai.status !== 402) {
            const errText = await ai.text().catch(() => "");
            console.error("[api/brand-boost] gateway error", ai.status, errText);
            ai = await callModel("google/gemini-2.5-flash-lite");
          }

          if (ai.status === 429) return Response.json({ error: "rate_limited" }, { status: 429 });
          if (ai.status === 402) return Response.json({ error: "credits_exhausted" }, { status: 402 });
          if (!ai.ok) {
            const errText = await ai.text().catch(() => "");
            console.error("[api/brand-boost] gateway error (final)", ai.status, errText);
            return Response.json({ error: "ai_error" }, { status: 500 });
          }

          const j: any = await ai.json();
          const content = String(j?.choices?.[0]?.message?.content || "{}");
          let parsed: any = {};
          try {
            parsed = JSON.parse(content);
          } catch {
            const match = content.match(/\{[\s\S]*\}/);
            if (match) {
              try { parsed = JSON.parse(match[0]); } catch {}
            }
          }
          if (!parsed || typeof parsed !== "object") parsed = {};
          if (!Array.isArray(parsed.plan)) parsed.plan = [];

          // Track usage
          const { data: cur } = await admin.from("profiles").select("monthly_analyses_used").eq("id", userId).single();
          await admin.from("profiles").update({
            monthly_analyses_used: ((cur as any)?.monthly_analyses_used || 0) + 1,
          }).eq("id", userId);
          await admin.from("activity_log").insert({ user_id: userId, action: "brand_boost", metadata: { brand: brand_name } });

          return Response.json(parsed);
        } catch (e) {
          console.error("[api/brand-boost] failed", e);
          return Response.json({ error: "internal_error" }, { status: 500 });
        }
      },
    },
  },
});
