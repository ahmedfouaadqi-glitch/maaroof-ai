import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

type Body = { text: string; lang?: "en" | "ar" | "ku" };

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const SYS = `You are a strict GEO (Generative Engine Optimization) scoring engine for the Iraqi market.
Return ONLY a compact JSON object with these integer keys (0-100):
{ "score": overall, "authority": technical authority and named-entity density, "local": Iraq local relevance, "citation": likelihood that an LLM will cite this content }
No prose, no markdown, no explanation — JSON only.`;

export const Route = createFileRoute("/api/analyze")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as Body;
          const text = (body.text || "").trim();
          const lang = body.lang || "en";
          if (text.length < 20) return Response.json({ error: "Text too short" }, { status: 400 });
          if (text.length > 8000) return Response.json({ error: "Text too long" }, { status: 400 });

          const apiKey = process.env.LOVABLE_API_KEY;
          const SUPABASE_URL = process.env.SUPABASE_URL;
          const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
          if (!apiKey || !SUPABASE_URL || !SERVICE) {
            return Response.json({ error: "Server not configured" }, { status: 500 });
          }
          const admin = createClient(SUPABASE_URL, SERVICE);

          // Auth (optional) — pull user from bearer
          let userId: string | null = null;
          const auth = request.headers.get("authorization");
          if (auth?.startsWith("Bearer ")) {
            const token = auth.slice(7);
            const { data } = await admin.auth.getUser(token);
            userId = data.user?.id || null;
          }

          // Quota check for authenticated users
          if (userId) {
            const { data: prof } = await admin.from("profiles").select("*").eq("id", userId).maybeSingle();
            if (prof) {
              // monthly reset
              const periodStart = new Date(prof.usage_period_start);
              if (Date.now() - periodStart.getTime() > 30 * 86400000) {
                await admin.from("profiles").update({
                  monthly_analyses_used: 0, monthly_suggestions_used: 0, usage_period_start: new Date().toISOString(),
                }).eq("id", userId);
                prof.monthly_analyses_used = 0;
              }
              // Determine plan limit
              let limit = 5; // Free default
              if (prof.is_subscribed) {
                const { data: plan } = await admin.from("subscription_plans").select("monthly_analyses").eq("name", prof.subscription_tier).maybeSingle();
                limit = plan?.monthly_analyses || 200;
                if (prof.subscription_expires_at && new Date(prof.subscription_expires_at) < new Date()) {
                  await admin.from("profiles").update({ is_subscribed: false }).eq("id", userId);
                  limit = 5;
                }
              }
              if (prof.monthly_analyses_used >= limit) {
                return Response.json({ error: "limit", limit }, { status: 402 });
              }
            }
          }

          const hash = await sha256Hex(`${lang}::${text}`);

          // Cache lookup
          const { data: cached } = await admin.from("analysis_cache").select("result").eq("input_hash", hash).maybeSingle();
          let result: any;
          let fromCache = false;

          if (cached?.result) {
            result = cached.result;
            fromCache = true;
            await admin.from("analysis_cache").update({ hits: (cached as any).hits ? undefined : 1 }).eq("input_hash", hash);
          } else {
            const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash-lite",
                messages: [
                  { role: "system", content: SYS },
                  { role: "user", content: `Language: ${lang}\n\nContent:\n"""${text}"""` },
                ],
                response_format: { type: "json_object" },
              }),
            });
            if (resp.status === 429) return Response.json({ error: "rate_limit" }, { status: 429 });
            if (resp.status === 402) return Response.json({ error: "credits" }, { status: 402 });
            if (!resp.ok) {
              console.error("AI error", resp.status, await resp.text());
              return Response.json({ error: "ai_error" }, { status: 500 });
            }
            const data = await resp.json();
            const content = data?.choices?.[0]?.message?.content || "{}";
            try {
              const parsed = JSON.parse(content);
              const clamp = (n: any) => Math.max(0, Math.min(100, parseInt(n, 10) || 0));
              result = {
                score: clamp(parsed.score),
                authority: clamp(parsed.authority),
                local: clamp(parsed.local),
                citation: clamp(parsed.citation),
              };
            } catch {
              return Response.json({ error: "parse_error" }, { status: 500 });
            }
            await admin.from("analysis_cache").insert({ input_hash: hash, lang, result });
          }

          // Persist + bump usage
          if (userId) {
            await admin.from("analyses").insert({
              user_id: userId, input_text: text.slice(0, 4000), input_hash: hash,
              lang, score: result.score, authority: result.authority, local_relevance: result.local, citation: result.citation, cached: fromCache,
            });
            await admin.rpc("noop").catch(() => {});
            await admin.from("profiles").update({
              monthly_analyses_used: (await admin.from("profiles").select("monthly_analyses_used").eq("id", userId).single()).data!.monthly_analyses_used + 1,
            }).eq("id", userId);
            await admin.from("activity_log").insert({ user_id: userId, action: "analyze", metadata: { score: result.score, cached: fromCache } });
          }

          return Response.json({ ...result, cached: fromCache });
        } catch (e) {
          console.error(e);
          return Response.json({ error: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
        }
      },
    },
  },
});
