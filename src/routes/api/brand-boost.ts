import { createFileRoute } from "@tanstack/react-router";

const PLATFORMS = ["chatgpt", "gemini", "claude", "perplexity", "copilot", "grok", "mistral"];

export const Route = createFileRoute("/api/brand-boost")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { brand_name, brand_keywords, platforms = PLATFORMS, lang = "en" } = await request.json();
          if (!brand_name) return Response.json({ error: "brand_name required" }, { status: 400 });
          const lovableKey = process.env.LOVABLE_API_KEY;
          if (!lovableKey) return Response.json({ error: "AI not configured" }, { status: 500 });

          const langInstr = lang === "ar" ? "اكتب جميع القيم النصية داخل JSON باللغة العربية الفصحى فقط." : lang === "ku" ? "هەموو بەهای دەقی ناو JSON بە کوردی سۆرانی بنووسە." : "Write all string values inside the JSON in clear English only.";
          const sys = `You are a brand visibility strategist. ${langInstr} For each AI platform, return an action plan to improve brand citation likelihood. Keys: { plan: [{platform, current_signal, recommended_actions:[string], content_pieces:[string]}], summary }.`;
          const user = `Brand: ${brand_name}\nKeywords: ${brand_keywords || "-"}\nPlatforms: ${platforms.join(", ")}`;
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
          return Response.json(parsed);
        } catch (e: any) {
          return Response.json({ error: e?.message || "failed" }, { status: 500 });
        }
      },
    },
  },
});
