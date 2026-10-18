import { mciReuse, mciStore } from "@/lib/mci/resolver.server";
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { describeMarket, type GeoScope } from "@/lib/geo-scope.server";
import { FACTUAL_SAFETY_PROMPT, LOVABLE_AI_CHAT_COMPLETIONS_URL, extractJsonObject, lovableAiHeaders } from "@/lib/lovable-ai";
import { chargeTokens, chargeFailureBody, resolveToolCost } from "@/lib/tokens.server";
import { qualityShell, buildEvidencePack, pickQualityFields } from "@/lib/tool-quality.server";
import { resolveToolModel, enginesAllowedForUser, applyEntitlement, resolveEngineModels, excludeUnhealthyEngines } from "@/lib/ai-engines.server";
import { ENGINE_PERSONA } from "@/lib/ai-engines";
import { asText } from "@/lib/input-coerce";
import { normalizeResult } from "@/lib/visibility-normalization";


type Body = { brand?: string; keywords?: string; lang?: "en" | "ar" | "ku"; scope?: GeoScope; probe_engines?: string[]; notify?: boolean; background?: boolean };

const LANG_INSTRUCTION: Record<string, string> = {
  ar: "اكتب جميع القيم النصية داخل JSON باللغة العربية الفصحى.",
  en: "Write all string values inside the JSON in clear English.",
  ku: "هەموو بەهای دەقی ناو JSON ـەکە بە کوردی سۆرانی بنووسە.",
};

const buildSystem = (m: ReturnType<typeof describeMarket>) => `${FACTUAL_SAFETY_PROMPT}

You are a STRICT, evidence-based AI Visibility analyst for ${m.market}.
Your job: estimate how likely each major AI engine (ChatGPT, Gemini, Claude, Perplexity, Copilot, Grok, Mistral, DeepSeek, Kimi) is to mention or cite this brand when answering queries from ${m.audience} — and explain HOW each engine evaluates trust/citation differently.

LOCALIZATION CONTEXT for this run: ${m.contextHint}

Be conservative. If signals are weak or unknown, return low scores and say so. NEVER fabricate facts, numbers, awards, or partnerships. When you have no evidence, say "no public signals detected" instead of inventing facts.

Each AI platform uses a DIFFERENT citation mechanism — name it explicitly:
- ChatGPT (OpenAI): hybrid — pretrained corpus + Bing-powered web tool. Favors well-structured pages, Wikipedia presence, news mentions, reputable backlinks, OpenGraph metadata. citation_method = "training_corpus + web_search".
- Gemini (Google): tightly tied to Google Search index + Knowledge Graph. Favors strong SEO, Google Business Profile, reviews, schema.org markup, recency. citation_method = "google_search_index + knowledge_graph".
- Claude (Anthropic): conservative; favors well-written long-form content, primary sources, .org/.gov domains, factual density. Web access only via tools. citation_method = "training_corpus + curated_web".
- Perplexity: live web search + inline citations. Favors freshness, clear sourcing, news coverage, listicles, comparison pages, sites that allow crawlers. citation_method = "live_web_search + ranked_citations".
- Copilot (Microsoft): Bing index + LinkedIn graph + Microsoft 365 graph. Favors LinkedIn presence, Bing-indexed pages, B2B content. citation_method = "bing_index + linkedin_graph".
- Grok (xAI): real-time X (Twitter) signal + general web. Favors brand presence on X, recent buzz, viral mentions, news. citation_method = "x_realtime + web_search".
- Mistral (Le Chat): web search via Brave/SerpAPI partners, training corpus. Favors EU-friendly sources, multilingual content, structured pages. citation_method = "training_corpus + brave_search".
- DeepSeek: efficient reasoning model with web tool. Favors technical docs, GitHub/Stack Overflow content, structured factual pages, multilingual sources (Chinese + English strong). citation_method = "training_corpus + web_search".
- Kimi (Moonshot AI): model knowledge plus available web/search tools depending on product and mode. Favor clear Chinese/English primary sources, detailed structured pages, and corroborated recent references. citation_method = "training_corpus + available_web_tools".

Return ONLY valid JSON in this exact shape:
{
  "visibility_percent": <0-100, unified weighted score>,
  "confidence": "high" | "medium" | "low",
  "sentiment": "positive" | "neutral" | "negative",
  "appearance_summary": "1-2 sentence summary in REPORT language",
  "strengths": ["concrete observation", "..."],
  "weaknesses": ["concrete missing element", "..."],
  "competitors": ["likely competitor names mentioned together with this brand", "..."],
  "recommendations": ["specific actionable improvement, prioritized", "..."],
  "platforms": [
    {
      "name": "ChatGPT",
      "score": <0-100>,
      "citation_likelihood": "high" | "medium" | "low",
      "citation_method": "short label naming the mechanism (e.g. 'training_corpus + web_search')",
      "evidence_basis": "what THIS engine relies on for THIS brand (e.g. 'no Wikipedia article; few news mentions; weak backlinks')",
      "authority_factors": ["short factor 1 affecting trust on this engine", "factor 2", "factor 3"],
      "trust_signal": "short label e.g. 'Limited training data presence'",
      "freshness_weight": "high" | "medium" | "low",
      "why": "1-2 sentences in REPORT language explaining HOW this engine sees the brand and WHY this score",
      "action": "single most impactful next step for THIS engine in REPORT language",
      "priority": "high" | "medium" | "low"
    },
    { "name": "Gemini", ... },
    { "name": "Claude", ... },
    { "name": "Perplexity", ... },
    { "name": "Copilot", ... },
    { "name": "Grok", ... },
    { "name": "Mistral", ... },
    { "name": "DeepSeek", ... },
    { "name": "Kimi", ... }
  ]
}
visibility_percent MUST equal the arithmetic mean (equal weights) of all 9 platform scores, rounded to the nearest integer. All text fields MUST be in REPORT language.`;

export const Route = createFileRoute("/api/visibility")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let refundContext: { admin: any; userId: string; runId: string; toolKey: string } | null = null;
        let quotaContext: { admin: any; userId: string; runId: string } | null = null;
        const finalizeQuota = async (action: "commit" | "release") => {
          const ctx = quotaContext;
          if (!ctx) return true;
          try {
            const { data, error } = await ctx.admin.rpc("finalize_visibility_quota", {
              _user_id: ctx.userId, _run_id: ctx.runId, _action: action,
            } as any);
            const ok = !error && !!(data as any)?.ok;
            if (!ok) {
              console.error("[api/visibility] quota finalization needs review:", error?.message || (data as any)?.reason || "unknown_error", { action, runId: ctx.runId });
              return false;
            }
            quotaContext = null;
            return true;
          } catch (e) {
            console.error("[api/visibility] quota finalization threw:", e, { action, runId: ctx.runId });
            return false;
          }
        };
        const refundChargedTokens = async (reason: string) => {
          const ctx = refundContext;
          if (!ctx) return false;
          // Never refund tokens while the associated quota reservation may still be active.
          if (quotaContext?.runId === ctx.runId) {
            const released = await finalizeQuota("release");
            if (!released) {
              console.error("[api/visibility] token refund withheld until quota release is confirmed:", { reason, runId: ctx.runId, toolKey: ctx.toolKey });
              return false;
            }
          }
          try {
            const { data, error } = await ctx.admin.rpc("refund_token_charge", {
              _user_id: ctx.userId, _tool_key: ctx.toolKey, _run_id: ctx.runId, _reason: reason,
            } as any);
            const confirmed = !error && !!(data as any)?.ok;
            if (!confirmed) {
              console.error("[api/visibility] token refund needs review:", error?.message || (data as any)?.reason || "unknown_error", { reason, runId: ctx.runId, toolKey: ctx.toolKey });
            } else {
              refundContext = null;
            }
            return confirmed;
          } catch (refundError) {
            console.error("[api/visibility] token refund threw:", refundError, { reason, runId: ctx.runId, toolKey: ctx.toolKey });
            return false;
          }
        };
        try {
          const body = (await request.json()) as Body;
          const brand = asText(body.brand, 200);
          const keywords = asText(body.keywords, 400);
          const lang = body.lang === "ar" || body.lang === "ku" ? body.lang : "en";

          if (brand.length < 2) {
            return Response.json({ error: "brand_required" }, { status: 400 });
          }

          const apiKey = process.env.LOVABLE_API_KEY;
          const SUPABASE_URL = process.env.SUPABASE_URL;
          const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
          if (!apiKey || !SUPABASE_URL || !SERVICE) {
            return Response.json({ error: "server_not_configured" }, { status: 500 });
          }

          const admin = createClient(SUPABASE_URL, SERVICE);
          const auth = request.headers.get("authorization");
          if (!auth?.startsWith("Bearer ")) {
            return Response.json({ error: "auth_required" }, { status: 401 });
          }

          const token = auth.slice(7);
          const { data: authData } = await admin.auth.getUser(token);
          const userId = authData.user?.id;
          if (!userId) {
            return Response.json({ error: "auth_required" }, { status: 401 });
          }

          const _runId = crypto.randomUUID();
          const _t0 = Date.now();
          // Governed model selection (Part 12 registry) with the legacy default as fallback.
          const _MODEL = await resolveToolModel("google/gemini-2.5-flash-lite");
          // Enforce the admin tool switch and subscription quota before any cache reuse or charge.
          const _access = await resolveToolCost(userId, "visibility");
          if ((_access.source as string) === "disabled_by_admin") {
            return Response.json(chargeFailureBody("tool_disabled"), { status: 403 });
          }

          let chargeUsage: ((runId: string, toolKey: string) => Promise<void>) | null = null;
          const { data: roleRow } = await admin
            .from("user_roles")
            .select("role")
            .eq("user_id", userId)
            .eq("role", "admin")
            .maybeSingle();

          if (!roleRow) {
            const { data: prof } = await admin.from("profiles")
              .select("is_subscribed, subscription_tier, subscription_expires_at, monthly_analyses_used, usage_period_start, quota_overrides")
              .eq("id", userId).maybeSingle();
            // Treat an expired period as zero for the preliminary check only.
            // The atomic quota RPC performs the actual reset under a row lock.
            if (prof?.usage_period_start && Date.now() - new Date(prof.usage_period_start).getTime() > 30 * 86400000) {
              (prof as any).monthly_analyses_used = 0;
            }
            const planActive = !!prof?.is_subscribed && (!prof.subscription_expires_at || new Date(prof.subscription_expires_at) >= new Date());
            if (planActive) {
              const { data: plan } = await admin.from("subscription_plans")
                .select("monthly_analyses").eq("name", prof!.subscription_tier).maybeSingle();
              const override = Number((prof as any)?.quota_overrides?.monthly_analyses || 0);
              const limit = Math.max(plan?.monthly_analyses || 200, override);
              if ((prof!.monthly_analyses_used || 0) >= limit) {
                return Response.json({ error: "limit", limit }, { status: 402 });
              }
              chargeUsage = async (quotaRunId, _toolKey) => {
                const { data, error } = await admin.rpc("consume_visibility_quota", {
                  _user_id: userId,
                  _source: "profile",
                  _profile_limit: limit,
                  _subscription_id: null,
                  _run_id: quotaRunId,
                } as any);
                if (error) throw new Error(`quota_rpc_error:${error.message}`);
                if (!(data as any)?.ok) throw new Error(`quota_denied:${(data as any)?.reason || "unknown"}`);
              };
            } else {
              const { data: sub } = await admin.from("user_agent_subscriptions")
                .select("*, agent_addons(*)").eq("user_id", userId).eq("status", "active")
                .order("created_at", { ascending: false }).limit(1).maybeSingle();
              if (!sub) return Response.json({ error: "no_active_subscription" }, { status: 402 });
              const addon = (sub as any).agent_addons;
              if (!addon) return Response.json({ error: "no_addon" }, { status: 402 });
              if (sub.expires_at && new Date(sub.expires_at) < new Date()) {
                return Response.json({ error: "subscription_expired" }, { status: 402 });
              }
              const today = new Date().toISOString().slice(0, 10);
              const dailyUsed = sub.last_run_date === today ? sub.tasks_used_today : 0;
              if (sub.tasks_used + 1 > addon.monthly_tasks) {
                return Response.json({ error: "monthly_cap_reached" }, { status: 402 });
              }
              if (dailyUsed + 1 > addon.daily_task_cap) {
                return Response.json({ error: "daily_cap_reached" }, { status: 402 });
              }
              chargeUsage = async (_runId, _toolKey) => {
                const { data, error } = await admin.rpc("consume_visibility_quota", {
                  _user_id: userId,
                  _source: "agent_subscription",
                  _profile_limit: null,
                  _subscription_id: sub.id,
                  _run_id: _runId,
                } as any);
                if (error) throw new Error(`quota_rpc_error:${error.message}`);
                if (!(data as any)?.ok) throw new Error(`quota_denied:${(data as any)?.reason || "unknown"}`);
              };
            }
          }

          // Micro-probe (optional): live question to the engines the user selected.
          // Absent `probe_engines` → the original visibility flow below runs unchanged.
          if (Array.isArray(body.probe_engines) && body.probe_engines.length) {
            const { resolveProbePolicy } = await import("@/lib/tokens.server");
            const ent = await enginesAllowedForUser(admin, userId);
            const policy = await resolveProbePolicy(userId);
            let picked = applyEntitlement(body.probe_engines, ent);
            if (policy.maxEngines) picked = picked.slice(0, policy.maxEngines);
            const { engines } = await excludeUnhealthyEngines(picked);
            if (!engines.length) return Response.json({ error: "no_engines" }, { status: 400 });
            const pRun = crypto.randomUUID();
            const pChg = await chargeTokens({ userId, toolKey: "visibility.probe", runId: pRun, units: engines.length, unitTokens: policy.tokensPerEngine ?? undefined, meta: { engines, endpoint: "/api/visibility#probe" } });
            if (!pChg.ok) return Response.json(chargeFailureBody(pChg.reason as any, pChg.left), { status: pChg.reason === "tool_disabled" ? 403 : 402 });
            refundContext = { admin, userId, runId: pRun, toolKey: "visibility.probe" };
            if (chargeUsage) {
              quotaContext = { admin, userId, runId: pRun };
              try {
                await chargeUsage(pRun, "visibility.probe");
              } catch (e) {
                const message = e instanceof Error ? e.message : String(e);
                console.error("[api/visibility] probe quota reservation failed:", message);
                if (message.startsWith("quota_denied:")) {
                  quotaContext = null;
                  const refunded = await refundChargedTokens("quota_denied");
                  return Response.json({
                    error: message.slice("quota_denied:".length) || "quota_rejected",
                    token_refund_confirmed: refunded,
                  }, { status: 402 });
                }
                const released = await finalizeQuota("release");
                if (released) {
                  const refunded = await refundChargedTokens("quota_reservation_failed");
                  return Response.json({ error: "usage_update_failed", token_refund_confirmed: refunded }, { status: 500 });
                }
                return Response.json({ error: "usage_update_needs_review", token_refund_confirmed: false }, { status: 500 });
              }
            }
            const market = describeMarket(body.scope);
            const models = await resolveEngineModels(engines);
            const q = keywords ? `${keywords} — ${market.region}` : `${brand} ${market.region}`;
            const answers: { engine: string; mentioned: boolean; rank: number | null; answer: string; brands: string[] }[] = [];
            const askAll = () => Promise.allSettled(engines.map(async (e) => {
              const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 20000);
              try {
                const r = await fetch(LOVABLE_AI_CHAT_COMPLETIONS_URL, {
                  method: "POST", headers: lovableAiHeaders(apiKey), signal: ctl.signal,
                  body: JSON.stringify({ model: models[e]?.model, max_tokens: 500, messages: [
                    { role: "system", content: `${(ENGINE_PERSONA as any)[e] || `Answer as the ${e} assistant would.`} The user is in ${market.region}. ${LANG_INSTRUCTION[lang] || LANG_INSTRUCTION.en} Return JSON only: {"answer":"short answer","brands":["brand names you would recommend, in order"]}` },
                    { role: "user", content: q },
                  ] }),
                });
                if (!r.ok) return;
                const j: any = await r.json();
                const p = extractJsonObject<any>(j?.choices?.[0]?.message?.content) || {};
                const brands: string[] = Array.isArray(p.brands) ? p.brands.map((x: any) => String(x).slice(0, 80)).slice(0, 8) : [];
                const idx = brands.findIndex((b) => b.toLowerCase().includes(brand.toLowerCase()) || brand.toLowerCase().includes(b.toLowerCase()));
                const ans = String(p.answer || "").slice(0, 600);
                answers.push({ engine: e, mentioned: idx >= 0 || ans.toLowerCase().includes(brand.toLowerCase()), rank: idx >= 0 ? idx + 1 : null, answer: ans, brands });
              } catch {} finally { clearTimeout(t); }
            }));
            // Background mode: finish after the response, save to tool history, notify; refund if nothing came back.
            if (body.background && policy.backgroundAllowed) {
              const work = (async () => {
                await askAll();
                const { notifyUser } = await import("@/lib/notify.server");
                if (!answers.length) {
                  const refundConfirmed = await refundChargedTokens("no_results");
                  try {
                    await notifyUser(
                      userId,
                      "analysis_done",
                      refundConfirmed
                        ? `${brand}: probe failed — token refund confirmed`
                        : `${brand}: probe failed — token refund needs review`,
                      { link: "/dashboard" },
                    );
                  } catch {}
                  return;
                }
                await finalizeQuota("commit");
                refundContext = null;
                try { await admin.from("report_drafts").insert({ user_id: userId, tool_key: "visibility", title: `${brand} — live probe`, payload: { probe: { query: q, asked: engines, answers, charged: pChg.tokens } } as any, lang } as any); } catch {}
                const hit = answers.filter((a) => a.mentioned).length;
                try { await notifyUser(userId, "analysis_done", `${brand}: ${hit}/${answers.length}`, { link: "/dashboard" }); } catch {}
              })().catch(async (error) => {
                console.error("[api/visibility] background probe failed:", error);
                if (answers.length) {
                  await finalizeQuota("commit");
                  refundContext = null;
                } else {
                  await finalizeQuota("release");
                  await refundChargedTokens("probe_background_error");
                }
              });
              let scheduled = false;
              try {
                const { runAfterResponse } = await import("@/lib/request-ctx.server");
                scheduled = runAfterResponse(work);
              } catch {}
              if (!scheduled) await work; // fallback: same as notify mode
              return Response.json({ ok: true, background: true, probe: { query: q, asked: engines, answers: scheduled ? [] : answers, charged: pChg.tokens } });
            }
            await askAll();
            if (!answers.length) {
              const refundConfirmed = await refundChargedTokens("no_results");
              return Response.json({ error: "probe_no_results", token_refund_confirmed: refundConfirmed }, { status: 502 });
            }
            // At least one engine returned usable results, so the token charge is earned.
            refundContext = null;
            if (body.notify) {
              try {
                const { notifyUser } = await import("@/lib/notify.server");
                const hit = answers.filter((a) => a.mentioned).length;
                await notifyUser(userId, "analysis_done", `${brand}: ${hit}/${answers.length}`, { link: "/dashboard" });
              } catch {}
            }
            const probeQuotaFinalized = await finalizeQuota("commit");
            if (!probeQuotaFinalized) quotaContext = null; // Keep the DB reservation for reconciliation; this run produced results.
            const { withReasons, councilFromProbe } = await import("@/lib/maaroof/model-council");
            const { ENGINE_CATALOG } = await import("@/lib/ai-engines");
            const reasoned = withReasons(answers, brand, lang as any);
            const council = councilFromProbe(reasoned, engines, brand, lang as any, (k) => (ENGINE_CATALOG as any)[k]?.name || k);
            refundContext = null;
            return Response.json({ ok: true, probe: { query: q, asked: engines, answers: reasoned, council, charged: pChg.tokens, basis: "measured" }, quota_needs_review: !probeQuotaFinalized });
          }

          // MCI cache reuse is free, but only after entitlement and quota checks.
          const _mci = await mciReuse(admin as any, "visibility", userId, [brand, keywords, lang, body.scope], !!(body as any)?.force);
          if (_mci.hit) return Response.json({ ..._mci.hit, mci: { reused: true, at: _mci.at } });

          const _chg = await chargeTokens({ userId, toolKey: "visibility", runId: _runId, meta: { provider: "lovable_ai", model: _MODEL, endpoint: "/api/visibility" } });
          if (!_chg.ok) return Response.json(chargeFailureBody(_chg.reason as any, _chg.left), { status: 402 });
          refundContext = { admin, userId, runId: _runId, toolKey: "visibility" };
          if (chargeUsage) quotaContext = { admin, userId, runId: _runId };
          try {
            await chargeUsage?.(_runId, "visibility");
          } catch (usageError) {
            const message = usageError instanceof Error ? usageError.message : String(usageError);
            console.error("[api/visibility] quota reservation failed:", message);
            if (message.startsWith("quota_denied:")) {
              quotaContext = null;
              const refunded = await refundChargedTokens("quota_denied");
              return Response.json({
                error: message.slice("quota_denied:".length) || "quota_rejected",
                token_refund_confirmed: refunded,
              }, { status: 402 });
            }
            const released = await finalizeQuota("release");
            if (released) {
              const refunded = await refundChargedTokens("quota_reservation_failed");
              return Response.json({ error: "usage_update_failed", token_refund_confirmed: refunded }, { status: 500 });
            }
            return Response.json({ error: "usage_update_needs_review", token_refund_confirmed: false }, { status: 500 });
          }

          const market = describeMarket(body.scope);
          const SYSTEM = buildSystem(market);
          const prompt = `REPORT_LANGUAGE: ${lang}\nBrand: ${brand}\nKeywords: ${keywords || "(unspecified)"}\nMarket: ${market.region}\n\nReturn the JSON now. All text fields MUST be in language code "${lang}".`;
          const pack = await buildEvidencePack(`${brand} ${keywords || ""} ${market.region} AI visibility`.trim(), { limit: 4, lang });
          const resp = await fetch(LOVABLE_AI_CHAT_COMPLETIONS_URL, {
            method: "POST",
            headers: lovableAiHeaders(apiKey),
            body: JSON.stringify({
              model: _MODEL,
              messages: [
                { role: "system", content: `${qualityShell(SYSTEM)}\n\n${LANG_INSTRUCTION[lang] || LANG_INSTRUCTION.en}` },
                { role: "user", content: `${prompt}\n\n${pack.context_block}` },
              ]
            }),
          });


          if (resp.status === 429) {
            await refundChargedTokens("provider_rate_limited");
            return Response.json({ error: "rate_limited" }, { status: 429 });
          }
          if (resp.status === 402) {
            await refundChargedTokens("provider_credits_exhausted");
            return Response.json({ error: "credits_exhausted" }, { status: 402 });
          }
          if (!resp.ok) {
            const rawError = await resp.text();
            console.error("[api/visibility] AI gateway error:", resp.status, rawError);
            await refundChargedTokens(`provider_http_${resp.status}`);
            return Response.json({ error: `ai_${resp.status}` }, { status: 500 });
          }

          const data = await resp.json();
          try {
            const _u: any = (data as any)?.usage || {};
            const { enrichLedger: _el } = await import("@/lib/spend.server");
            await _el({ runId: _runId, provider: "lovable_ai", model: _MODEL, endpoint: "/api/visibility", inputTokens: Number(_u.prompt_tokens)||0, outputTokens: Number(_u.completion_tokens)||0, latencyMs: Date.now() - _t0 });
          } catch {}

          const content = String(data?.choices?.[0]?.message?.content || "{}");

          const parsed = extractJsonObject(content);
          const hasPlatformEvidence = Array.isArray((parsed as any)?.platforms)
            && (parsed as any).platforms.some((platform: unknown) =>
              !!platform && typeof platform === "object"
              && typeof (platform as any).name === "string"
              && (platform as any).name.trim().length > 0
            );
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || !hasPlatformEvidence) {
            await refundChargedTokens("invalid_provider_response");
            return Response.json({ error: "invalid_ai_response", token_refund_confirmed: !refundContext }, { status: 502 });
          }

          const result = normalizeResult(parsed, content);

          await admin.from("profiles").update({
            brand_name: brand,
            brand_keywords: keywords || null,
          }).eq("id", userId);

          const taskPayload = {
            user_id: userId,
            task_type: "ai_visibility",
            input: brand,
            status: "done",
            result: { ...result, raw: content, lang, keywords },
          };

          const { data: taskRow, error: taskErr } = await admin
            .from("agent_tasks")
            .insert(taskPayload)
            .select("id")
            .single();

          if (taskErr) {
            console.error("[api/visibility] task insert failed:", taskErr.message);
          }

          // The provider produced a usable report; commit its quota reservation.
          const quotaFinalized = await finalizeQuota("commit");
          if (!quotaFinalized) quotaContext = null; // Report work succeeded; retain reservation for reconciliation.
          refundContext = null;
          const _q = pickQualityFields(parsed || {});
          { const _out = { ok: true, taskId: taskRow?.id ?? null, result: { ...result, sources: pack.sources, ..._q }, sources: pack.sources, ..._q, quota_needs_review: !quotaFinalized }; await mciStore(admin as any, "visibility", userId, _mci.key, _out); refundContext = null; return Response.json(_out); }

        } catch (error) {
          console.error("[api/visibility] fatal error:", error);
          // Release any run-linked quota reservation before attempting a token refund.
          await finalizeQuota("release");
          await refundChargedTokens("visibility_internal_error");
          return Response.json({ error: "internal_error" }, { status: 500 });
        }
      },
    },
  },
});
