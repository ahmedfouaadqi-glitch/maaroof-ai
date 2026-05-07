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
  goal?: "promotional" | "educational" | "news" | "brand_story" | "personal" | "engagement";
  audience?: string;
  brand?: string;
};

const SYSTEM = `You are an expert GEO (Generative Engine Optimization) copywriter for the Iraqi market.

CRITICAL FACTUAL SAFETY RULES (must follow):
- NEVER invent historical events, dates, statistics, prices, names, quotes, or product features.
- Use ONLY facts the user provided. If a fact would strengthen the post but you don't have it, write a generic phrasing or insert a clearly marked placeholder like [أضف رقم/تاريخ هنا] / [add stat here].
- Do NOT add famous historical references (battles, ancient kings, religious dates) unless the user's input explicitly mentions them.
- If the user's input is too vague to support claims, keep the post abstract and useful — do not fabricate.

WRITING RULES:
- Match the requested language exactly. Use natural local Iraqi phrasing for Arabic/Kurdish.
- Adapt tone, length, hashtags, and formatting to each target platform AND the stated goal (promotional vs educational vs news vs brand story vs personal vs engagement).
- For PROMOTIONAL: clear value proposition, benefit-led hook, soft CTA, no fake testimonials.
- For EDUCATIONAL: structured, factual, lists/steps, named entities, citation-friendly.
- For NEWS: lead with the 5W, neutral tone.
- For BRAND_STORY: emotional but truthful, focus on the brand's actual offering.

OUTPUT: You MUST call the function "generate_geo_content" with structured fields. Do not write free-form text.`;

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

          const platforms = (body.platforms || []).filter(Boolean);
          const length = body.length || "medium";
          const contentType = body.contentType || "post";

          const lengthGuide =
            contentType === "article"
              ? length === "short" ? "~250 words" : length === "long" ? "~1200 words" : "~600 words"
              : length === "short" ? "~50 words / 2-3 short lines" : length === "long" ? "~250 words" : "~120 words";

          const platformGuide: Record<string, string> = {
            linkedin: "LinkedIn: professional tone, hook line, 3-5 short paragraphs, 3 hashtags max.",
            facebook: "Facebook: friendly conversational tone, emojis allowed, end with a question.",
            tiktok: "TikTok: punchy script for a 30-60s video, scene-by-scene with hook + payoff + CTA.",
            instagram: "Instagram: visual caption with strong hook, line breaks, 5-10 relevant hashtags.",
          };
          const platformBlock = platforms.length
            ? `\n\nTarget platforms: ${platforms.join(", ")}.\n${platforms.map((p) => "- " + (platformGuide[p] || p)).join("\n")}\nProduce a tailored version for EACH platform, separated by "=== <Platform> ===" headings.`
            : "";

          let instruction = `Write a GEO-optimized ${contentType} in ${lang}. Target length: ${lengthGuide}.${platformBlock}`;
          if (body.sourceText) {
            instruction += `\n\nThe user already has this content; produce an IMPROVED, more citation-worthy version (do not just rewrite — strengthen authority, add structure, named entities, and Iraq-local relevance):\n\n"""${body.sourceText.slice(0, 4000)}"""`;
          } else if (body.description) {
            instruction += `\n\nTopic / brief from the user:\n"""${body.description.slice(0, 2000)}"""`;
          } else if (body.imageBase64) {
            instruction += `\n\nThe user uploaded an image. Analyze it and write compelling, GEO-optimized content about its subject.`;
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
