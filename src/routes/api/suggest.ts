import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

type Body = {
  description?: string;
  imageBase64?: string;
  imageMime?: string;
  lang?: "en" | "ar" | "ku";
  sourceText?: string;
  platforms?: string[];
  length?: "short" | "medium" | "long";
  contentType?: "post" | "article";
};

const SYSTEM = `You are an expert GEO (Generative Engine Optimization) copywriter for the Iraqi market.
Write content optimized so LLMs (ChatGPT, Gemini, Claude) cite it as an authoritative source.
- Use clear factual claims, named entities, dates, numbers, and citations-friendly structure.
- Match the requested language exactly. For Arabic/Kurdish, use natural local phrasing.
- Adapt tone, length, hashtags, and formatting to each requested target platform.
- Output ONLY the final content (no preamble). If multiple platforms are requested, separate each with a heading like "=== LinkedIn ===".`;

const langName = (l?: string) =>
  l === "ar" ? "Arabic (العربية)" : l === "ku" ? "Kurdish Sorani (کوردی)" : "English";

export const Route = createFileRoute("/api/suggest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as Body;
          const apiKey = process.env.LOVABLE_API_KEY;
          const SUPABASE_URL = process.env.SUPABASE_URL;
          const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
          if (!apiKey || !SUPABASE_URL || !SERVICE) {
            return Response.json({ error: "Server not configured" }, { status: 500 });
          }
          const admin = createClient(SUPABASE_URL, SERVICE);

          // Require auth
          const auth = request.headers.get("authorization");
          if (!auth?.startsWith("Bearer ")) {
            return Response.json({ error: "auth_required" }, { status: 401 });
          }
          const token = auth.slice(7);
          const { data: u } = await admin.auth.getUser(token);
          const userId = u.user?.id;
          if (!userId) return Response.json({ error: "auth_required" }, { status: 401 });

          // Quota
          const { data: prof } = await admin.from("profiles").select("*").eq("id", userId).maybeSingle();
          if (prof) {
            const periodStart = new Date(prof.usage_period_start);
            if (Date.now() - periodStart.getTime() > 30 * 86400000) {
              await admin.from("profiles").update({
                monthly_analyses_used: 0, monthly_suggestions_used: 0, usage_period_start: new Date().toISOString(),
              }).eq("id", userId);
              prof.monthly_suggestions_used = 0;
            }
            let limit = 2; // free
            if (prof.is_subscribed) {
              const { data: plan } = await admin.from("subscription_plans")
                .select("monthly_suggestions").eq("name", prof.subscription_tier).maybeSingle();
              limit = plan?.monthly_suggestions || 50;
              if (prof.subscription_expires_at && new Date(prof.subscription_expires_at) < new Date()) {
                await admin.from("profiles").update({ is_subscribed: false }).eq("id", userId);
                limit = 2;
              }
            }
            if (prof.monthly_suggestions_used >= limit) {
              return Response.json({ error: "limit", limit }, { status: 402 });
            }
          }

          const lang = langName(body.lang);
          const userParts: any[] = [];

          let instruction = `Write a GEO-optimized post in ${lang}.`;
          if (body.sourceText) {
            instruction += `\n\nThe user already has this content; produce an IMPROVED, more citation-worthy version (do not just rewrite — strengthen authority, add structure, named entities, and Iraq-local relevance):\n\n"""${body.sourceText.slice(0, 4000)}"""`;
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
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                { role: "system", content: SYSTEM },
                { role: "user", content: userParts },
              ],
            }),
          });

          if (resp.status === 429) return Response.json({ error: "rate_limit" }, { status: 429 });
          if (resp.status === 402) return Response.json({ error: "credits" }, { status: 402 });
          if (!resp.ok) {
            const t = await resp.text();
            console.error("AI gateway error", resp.status, t);
            return Response.json({ error: "ai_error" }, { status: 500 });
          }

          const data = await resp.json();
          const post = data?.choices?.[0]?.message?.content ?? "";

          // Persist + bump
          await admin.from("suggestions").insert({
            user_id: userId,
            mode: body.sourceText ? "improve" : body.imageBase64 ? "image" : "text",
            input: (body.sourceText || body.description || "").slice(0, 2000) || null,
            output: post,
            lang: body.lang || "en",
          });
          const { data: cur } = await admin.from("profiles").select("monthly_suggestions_used").eq("id", userId).single();
          await admin.from("profiles").update({
            monthly_suggestions_used: (cur?.monthly_suggestions_used || 0) + 1,
          }).eq("id", userId);
          await admin.from("activity_log").insert({ user_id: userId, action: "suggest", metadata: { mode: body.sourceText ? "improve" : body.imageBase64 ? "image" : "text" } });

          return Response.json({ post });
        } catch (e) {
          console.error("suggest error", e);
          return Response.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
        }
      },
    },
  },
});
