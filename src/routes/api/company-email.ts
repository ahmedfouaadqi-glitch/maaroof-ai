import { createFileRoute } from "@tanstack/react-router";
import { fcSearch } from "@/lib/firecrawl";

export const Route = createFileRoute("/api/company-email")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { company, sector, notes, lang = "en", goal } = await request.json();
          if (!company) return Response.json({ error: "company required" }, { status: 400 });
          const q = `${company} ${sector || ""} ${notes || ""}`.slice(0, 250);
          let sources: any[] = [];
          try {
            const sr = await fcSearch(q, { limit: 5, lang });
            sources = (sr?.data || sr?.web || []).slice(0, 5).map((r: any) => ({
              title: r.title, url: r.url, snippet: (r.markdown || r.description || "").slice(0, 500),
            }));
          } catch {}

          const lovableKey = process.env.LOVABLE_API_KEY;
          if (!lovableKey) return Response.json({ error: "AI not configured" }, { status: 500 });

          const ctx = sources.map((s, i) => `[${i + 1}] ${s.title} (${s.url})\n${s.snippet}`).join("\n\n");
          const sys = `You are an outreach copywriter. Write STRICTLY in language code: ${lang}. Output JSON with keys: company_brief, key_points (array), email_subject, email_body. Keep email professional and under 180 words.`;
          const user = `Company: ${company}\nSector: ${sector || "-"}\nGoal: ${goal || "intro/partnership"}\nUser notes: ${notes || "-"}\n\nSources:\n${ctx}`;
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
          return Response.json({ ...parsed, sources });
        } catch (e: any) {
          return Response.json({ error: e?.message || "failed" }, { status: 500 });
        }
      },
    },
  },
});
