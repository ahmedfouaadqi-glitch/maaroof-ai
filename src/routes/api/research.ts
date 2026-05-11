import { createFileRoute } from "@tanstack/react-router";
import { fcSearch } from "@/lib/firecrawl";

export const Route = createFileRoute("/api/research")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { query, lang = "en", scope } = await request.json();
          if (!query || typeof query !== "string") return Response.json({ error: "query required" }, { status: 400 });
          const limited = String(query).slice(0, 300);
          const geo = scope?.country ? ` ${scope.country}` : "";
          const sr = await fcSearch(limited + geo, { limit: 6, lang });
          const results = (sr?.data || sr?.web || []).slice(0, 6).map((r: any) => ({
            title: r.title || r.url,
            url: r.url,
            description: r.description || "",
            snippet: (r.markdown || "").slice(0, 600),
          }));

          // Use Lovable AI to synthesize answer with citations
          const lovableKey = process.env.LOVABLE_API_KEY;
          let answer = "";
          if (lovableKey) {
            const sys = `You are a research assistant. Write the answer STRICTLY in language code: ${lang}. Cite sources inline as [1], [2], ...`;
            const ctx = results.map((r: any, i: number) => `[${i + 1}] ${r.title} (${r.url})\n${r.snippet}`).join("\n\n");
            const ai = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovableKey}` },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                messages: [
                  { role: "system", content: sys },
                  { role: "user", content: `Question: ${limited}\n\nSources:\n${ctx}\n\nWrite a concise, factual answer (200-400 words) with [n] citations.` },
                ],
              }),
            });
            if (ai.ok) {
              const j: any = await ai.json();
              answer = j?.choices?.[0]?.message?.content || "";
            }
          }
          return Response.json({ query: limited, answer, sources: results });
        } catch (e: any) {
          return Response.json({ error: e?.message || "research failed" }, { status: 500 });
        }
      },
    },
  },
});
