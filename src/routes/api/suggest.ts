import { createFileRoute } from "@tanstack/react-router";

type Body = {
  description?: string;
  imageBase64?: string; // data URL or raw base64
  imageMime?: string;
  lang?: "en" | "ar" | "ku";
  sourceText?: string; // when suggesting based on an analyzed post
};

const SYSTEM = `You are an expert GEO (Generative Engine Optimization) copywriter for the Iraqi market.
Write content optimized so LLMs (ChatGPT, Gemini, Claude) cite it as an authoritative source.
- Use clear factual claims, named entities, dates, numbers, and citations-friendly structure.
- Add a short, magnetic hook, then 2-4 concise paragraphs, then a takeaway line.
- Match the requested language exactly. For Arabic/Kurdish, use natural local phrasing.
- Output ONLY the post body (no preamble, no markdown headings).`;

const langName = (l?: string) =>
  l === "ar" ? "Arabic (العربية)" : l === "ku" ? "Kurdish Sorani (کوردی)" : "English";

export const Route = createFileRoute("/api/suggest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as Body;
          const apiKey = process.env.LOVABLE_API_KEY;
          if (!apiKey) {
            return Response.json({ error: "LOVABLE_API_KEY not configured" }, { status: 500 });
          }

          const lang = langName(body.lang);
          const userParts: any[] = [];

          let instruction = `Write a GEO-optimized post in ${lang}.`;
          if (body.sourceText) {
            instruction += `\n\nThe user already has this content; produce an IMPROVED, more citation-worthy version (do not just rewrite — strengthen authority, add structure, named entities, and Iraq-local relevance where appropriate):\n\n"""${body.sourceText.slice(0, 4000)}"""`;
          } else if (body.description) {
            instruction += `\n\nTopic / brief from the user:\n"""${body.description.slice(0, 2000)}"""`;
          } else if (body.imageBase64) {
            instruction += `\n\nThe user uploaded an image. Analyze it and write a compelling, GEO-optimized post about its subject.`;
          } else {
            return Response.json({ error: "Provide description, sourceText, or image" }, { status: 400 });
          }

          userParts.push({ type: "text", text: instruction });

          if (body.imageBase64) {
            const url = body.imageBase64.startsWith("data:")
              ? body.imageBase64
              : `data:${body.imageMime || "image/png"};base64,${body.imageBase64}`;
            userParts.push({ type: "image_url", image_url: { url } });
          }

          const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [
                { role: "system", content: SYSTEM },
                { role: "user", content: userParts },
              ],
            }),
          });

          if (resp.status === 429) {
            return Response.json({ error: "Rate limited. Try again shortly." }, { status: 429 });
          }
          if (resp.status === 402) {
            return Response.json({ error: "AI credits exhausted. Add funds in Workspace > Usage." }, { status: 402 });
          }
          if (!resp.ok) {
            const t = await resp.text();
            console.error("AI gateway error", resp.status, t);
            return Response.json({ error: "AI gateway error" }, { status: 500 });
          }

          const data = await resp.json();
          const post = data?.choices?.[0]?.message?.content ?? "";
          return Response.json({ post });
        } catch (e) {
          console.error("suggest error", e);
          return Response.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
        }
      },
    },
  },
});
