import { createFileRoute } from "@tanstack/react-router";
import { describeMarket } from "@/lib/geo-scope.server";

const PLATFORMS = ["chatgpt", "gemini", "claude", "perplexity", "copilot", "grok", "mistral"];

export const Route = createFileRoute("/api/brand-boost")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { brand_name, brand_keywords, platforms = PLATFORMS, lang = "en", scope } = await request.json();
          if (!brand_name) return Response.json({ error: "brand_name required" }, { status: 400 });
          const lovableKey = process.env.LOVABLE_API_KEY;
          if (!lovableKey) return Response.json({ error: "AI not configured" }, { status: 500 });

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
            fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovableKey}` },
              body: JSON.stringify({
                model,
                messages: [
                  { role: "system", content: sys },
                  { role: "user", content: userMsg },
                ],
                response_format: { type: "json_object" },
              }),
            });

          let ai = await callModel("google/gemini-2.5-flash");
          if (!ai.ok && ai.status !== 429 && ai.status !== 402) {
            const errText = await ai.text().catch(() => "");
            console.error("[api/brand-boost] gateway error", ai.status, errText);
            // retry once on lite
            ai = await callModel("google/gemini-2.5-flash-lite");
          }

          if (ai.status === 429) return Response.json({ error: "rate_limited" }, { status: 429 });
          if (ai.status === 402) return Response.json({ error: "credits_exhausted" }, { status: 402 });
          if (!ai.ok) {
            const errText = await ai.text().catch(() => "");
            console.error("[api/brand-boost] gateway error (final)", ai.status, errText);
            return Response.json({ error: `ai_${ai.status}`, details: errText.slice(0, 200) }, { status: 500 });
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
          return Response.json(parsed);
        } catch (e: any) {
          console.error("[api/brand-boost] failed", e);
          return Response.json({ error: e?.message || "failed" }, { status: 500 });
        }
      },
    },
  },
});
