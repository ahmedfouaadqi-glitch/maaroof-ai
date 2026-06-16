import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { describeMarket, type GeoScope } from "@/lib/geo-scope.server";
import { FACTUAL_SAFETY_PROMPT, LOVABLE_AI_CHAT_COMPLETIONS_URL, lovableAiHeaders } from "@/lib/lovable-ai";
import { chargeTokens, chargeFailureBody } from "@/lib/tokens.server";
import { qualityShell, buildEvidencePack } from "@/lib/tool-quality.server";


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
  count?: number;
  scope?: GeoScope;
};

const buildSystem = (m: ReturnType<typeof describeMarket>) => `${FACTUAL_SAFETY_PROMPT}

You are an expert GEO (Generative Engine Optimization) copywriter for ${m.market}.

CRITICAL FACTUAL SAFETY RULES (must follow):
- NEVER invent historical events, dates, statistics, prices, names, quotes, or product features.
- Use ONLY facts the user provided. If a fact would strengthen the post but you don't have it, write a generic phrasing or insert a clearly marked placeholder like [أضف رقماً موثقاً هنا] / [add verified stat here].
- Do NOT add famous historical references unless the user's input explicitly mentions them.
- If the user's input is too vague, keep the post abstract and useful — do not fabricate.

LOCALIZATION CONTEXT for this run: ${m.contextHint}

WRITING RULES:
- Match the requested language exactly. Use natural phrasing appropriate for ${m.audience}.
- Adapt tone, length, hashtags, and formatting to each target platform AND the stated goal.
- For PROMOTIONAL: clear value prop, benefit-led hook, soft CTA, no fake testimonials.
- For EDUCATIONAL: structured, factual, lists/steps, named entities, citation-friendly.
- For NEWS: lead with the 5W, neutral tone.
- For BRAND_STORY: emotional but truthful, focus on the brand's actual offering.

VARIANT DIVERSITY: Each variant MUST be meaningfully different — different hook angle, structure, and opening line.

GEO SCORING RUBRIC (be strict, conservative, evidence-based):
- 90-100: Quote-worthy by an LLM. Named entities + concrete numbers/dates + clear claims + unique angle + citable structure.
- 70-89: Solid post with some entities and clarity, but missing concrete data or unique angle.
- 50-69: Generic but acceptable; few entities; vague phrasing; LLM unlikely to cite.
- 30-49: Weak — vague, no entities, no data, generic CTA.
- 0-29: Promotional fluff with no facts.
Penalize HEAVILY vague claims, missing entities, no numbers, "best/leading" without proof.
Reward specific names and places relevant to ${m.region}, real numbers, dates, structured lists, expert framing.

EXPECTED REACH RUBRIC (organic reach in ${m.region}):
- "high": viral hook + emotional/topical angle + platform-native format + strong CTA + locally relevant.
- "medium": solid post, decent hook, fits platform conventions, no clear viral driver.
- "low": generic, weak hook, off-format, or purely transactional.
Default to "medium" unless clearly earned. Justify in expected_reach_reason with 1 concrete sentence.

OUTPUT: You MUST call the function "generate_geo_content" with structured fields.`;


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
          const _runId = crypto.randomUUID();
          const _t0 = Date.now();
          const _chg = await chargeTokens({ userId, toolKey: "suggest", runId: _runId, meta: { provider: "lovable_ai", model: "google/gemini-2.5-flash-lite", endpoint: "/api/suggest" } });
          if (!_chg.ok) return Response.json(chargeFailureBody(_chg.reason as any, _chg.left), { status: 402 });

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
              limit = Math.max(plan?.monthly_suggestions || 50, Number((prof as any)?.quota_overrides?.monthly_suggestions || 0));
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
          const count = Math.max(1, Math.min(10, parseInt(String(body.count ?? 1), 10) || 1));
          const platformBlock = platforms.length
            ? `\n\nTarget platforms: ${platforms.join(", ")}.\n${platforms.map((p) => "- " + (platformGuide[p] || p)).join("\n")}\nProduce ${count} DISTINCT variant(s) for EACH platform (total = ${platforms.length * count}). Each variant must have a different hook angle and structure — do not paraphrase. Label variants with platform name; if multiple per platform, append " #1", " #2", etc.`
            : `\n\nProduce ${count} DISTINCT generic variant(s) (platform="generic"). Each must use a different hook angle.`;

          const goal = body.goal || "engagement";
          const goalLabel: Record<string, string> = {
            promotional: "promotional / marketing a product or service",
            educational: "educational / teaching a concept",
            news: "news / informational announcement",
            brand_story: "brand storytelling",
            personal: "personal opinion / thought leadership",
            engagement: "engagement / community discussion",
          };

          let instruction =
`REPORT_LANGUAGE: ${body.lang || "en"} (${lang})
WRITE EVERY variant.content, expected_reach_reason, factual_warnings, improvement_tips and detected_goal STRICTLY in ${lang}. Do NOT mix languages. Match the requested language regardless of the source text language.

Goal: ${goalLabel[goal]}.
${body.brand ? `Brand/author: ${body.brand}.` : ""}
${body.audience ? `Audience: ${body.audience}.` : ""}
Content type: ${contentType}. Target length: ${lengthGuide}.${platformBlock}

Score each variant individually with geo_score (0-100) using the strict rubric in the system prompt. Then return overall_geo_score = average of variant scores rounded to integer. Set expected_reach (low/medium/high) for the BEST variant with a concrete one-sentence reason citing the actual hook/format. List factual_warnings (claims you avoided due to lack of source data) and 2-4 improvement_tips a human can act on.`;

          if (body.sourceText) {
            instruction += `\n\nThe user already has this content; produce an IMPROVED, more citation-worthy version. Do NOT add historical events, dates or statistics that are not in the source:\n\n"""${body.sourceText.slice(0, 4000)}"""`;
          } else if (body.description) {
            instruction += `\n\nUser brief (use ONLY these facts; do not invent history/numbers):\n"""${body.description.slice(0, 2000)}"""`;
          } else if (body.imageBase64) {
            instruction += `\n\nThe user uploaded an image. Describe ONLY what you can see; do not invent context, history, or location unless visually evident.`;
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

          const tool = {
            type: "function",
            function: {
              name: "generate_geo_content",
              description: "Return GEO-optimized content with QA metadata.",
              parameters: {
                type: "object",
                properties: {
                  variants: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        platform: { type: "string" },
                        content: { type: "string" },
                        geo_score: { type: "number" },
                        word_count: { type: "number" },
                      },
                      required: ["platform", "content", "geo_score"],
                      additionalProperties: false,
                    },
                  },
                  overall_geo_score: { type: "number", description: "0-100 GEO citation-worthiness" },
                  expected_reach: { type: "string", enum: ["low", "medium", "high"] },
                  expected_reach_reason: { type: "string" },
                  factual_warnings: { type: "array", items: { type: "string" }, description: "Claims that need user verification or facts the user should add" },
                  improvement_tips: { type: "array", items: { type: "string" } },
                  detected_goal: { type: "string" },
                },
                required: ["variants", "overall_geo_score", "expected_reach", "expected_reach_reason", "factual_warnings", "improvement_tips"],
                additionalProperties: false,
              },
            },
          };

          const resp = await fetch(LOVABLE_AI_CHAT_COMPLETIONS_URL, {
            method: "POST",
            headers: lovableAiHeaders(apiKey),
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [
                { role: "system", content: buildSystem(describeMarket(body.scope)) },
                { role: "user", content: userParts },
              ],
              tools: [tool],
              tool_choice: { type: "function", function: { name: "generate_geo_content" } },
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
          try {
            const _u: any = (data as any)?.usage || {};
            const { enrichLedger: _el } = await import("@/lib/spend.server");
            await _el({ runId: _runId, provider: "lovable_ai", model: "google/gemini-2.5-flash-lite", endpoint: "/api/suggest", inputTokens: Number(_u.prompt_tokens)||0, outputTokens: Number(_u.completion_tokens)||0, latencyMs: Date.now() - _t0 });
          } catch {}

          const call = data?.choices?.[0]?.message?.tool_calls?.[0];
          let parsed: any = null;
          try { parsed = call?.function?.arguments ? JSON.parse(call.function.arguments) : null; } catch {}
          if (!parsed) {
            const fallback = data?.choices?.[0]?.message?.content ?? "";
            parsed = { variants: [{ platform: "generic", content: fallback, geo_score: 60 }], overall_geo_score: 60, expected_reach: "medium", expected_reach_reason: "", factual_warnings: [], improvement_tips: [] };
          }
          const post = parsed.variants.map((v: any) => `=== ${v.platform} ===\n${v.content}`).join("\n\n");

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

          return Response.json({ post, ...parsed });
        } catch (e) {
          console.error("suggest error", e);
          return Response.json({ error: "internal_error" }, { status: 500 });
        }
      },
    },
  },
});
