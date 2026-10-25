import { mciReuse, mciStore } from "@/lib/mci/resolver.server";
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { fcScrape, fcSearch } from "@/lib/firecrawl";
import { getUserContext, specialtyHint } from "@/lib/user-context.server";
import { FACTUAL_SAFETY_PROMPT, LOVABLE_AI_CHAT_COMPLETIONS_URL, extractJsonObject, lovableAiHeaders } from "@/lib/lovable-ai";
import { chargeTokens, chargeFailureBody } from "@/lib/tokens.server";
import { qualityShell, evidenceFromResults, pickQualityFields } from "@/lib/tool-quality.server";
import { resolveToolModel } from "@/lib/ai-engines.server";
import { planSourceRoute } from "@/lib/maaroof/source-intelligence";
import {
  discoverAlexandriaCapabilities,
  executeAlexandriaCapability,
  validateAlexandriaOptions,
  isAlexandriaTermsAccepted,
  SpecializedSourceGateError,
  decideSpecializedRunReplay,
} from "@/lib/maaroof/alexandria.server";
import { recordEvidence } from "@/lib/maaroof/evidence.server";


export const Route = createFileRoute("/api/research")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const reqBody = await request.json();

          const { query, lang = "en", scope, mode = "web" } = reqBody;
          if (!query || typeof query !== "string") return Response.json({ error: "query required" }, { status: 400 });
          const limited = String(query).slice(0, 300);
          const isCompany = mode === "company";
          const includeChannels = !!reqBody?.include_channels;
          const requestedChannelTypes: string[] = Array.isArray(reqBody?.channel_types) && reqBody.channel_types.length
            ? reqBody.channel_types.map((v: unknown) => String(v)).filter((v: string) => ["website", "linkedin", "twitter", "instagram", "facebook", "youtube", "telegram", "whatsapp", "email"].includes(v)).slice(0, 3)
            : ["website", "linkedin", "instagram"];
          const workspaceId = typeof reqBody?.workspace_id === "string" ? reqBody.workspace_id.trim() : null;

          // Mandatory auth — endpoint consumes paid Firecrawl + AI gateway credits
          const SUPABASE_URL = process.env.SUPABASE_URL;
          const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
          if (!SUPABASE_URL || !SERVICE) return Response.json({ error: "internal_error" }, { status: 500 });
          const admin = createClient(SUPABASE_URL, SERVICE);
          const authHeader = request.headers.get("authorization");
          if (!authHeader?.startsWith("Bearer ")) {
            return Response.json({ error: "auth_required" }, { status: 401 });
          }
          const { data: userData } = await admin.auth.getUser(authHeader.slice(7));
          const userId = userData?.user?.id;
          if (!userId) return Response.json({ error: "auth_required" }, { status: 401 });
          let workspaceContext: any = null;
          if (workspaceId) {
            if (!/^[0-9a-f-]{36}$/i.test(workspaceId)) return Response.json({ error: "invalid_workspace" }, { status: 400 });
            const { data: ownedWorkspace, error: workspaceError } = await admin.from("workspaces")
              .select("id, owner_id, name, brand_url, brand_summary, keywords, country, city, entity_truth_card, onboarding, settings")
              .eq("id", workspaceId).eq("owner_id", userId).maybeSingle();
            if (workspaceError || !ownedWorkspace) return Response.json({ error: "workspace_not_found" }, { status: 404 });
            workspaceContext = ownedWorkspace;
          }

          // Paid specialized source execution is a separate, explicit action. Normal research never invokes it.
          const specializedRun = reqBody?.specialized_execution;
          if (specializedRun != null) {
            if (!specializedRun || typeof specializedRun !== "object" || Array.isArray(specializedRun)) {
              return Response.json({ error: "invalid_specialized_request" }, { status: 400 });
            }
            if (specializedRun.confirm_paid_run !== true) {
              return Response.json({ error: "explicit_paid_confirmation_required" }, { status: 400 });
            }
            const requestId = String(specializedRun.request_id || "").trim();
            if (!/^[A-Za-z0-9._:-]{1,128}$/.test(requestId)) {
              return Response.json({ error: "specialized_request_id_required" }, { status: 400 });
            }
            const candidateId = String(specializedRun.candidate_id || "").trim();
            if (!/^[a-f0-9]{24}$/i.test(candidateId)) {
              return Response.json({ error: "specialized_candidate_required" }, { status: 400 });
            }

            // Check the durable idempotency ledger before any provider call or charge.
            const { data: priorRun, error: priorRunError } = await admin
              .from("specialized_source_runs")
              .select("candidate_id,status,response,error_code,workspace_id")
              .eq("user_id", userId)
              .eq("request_id", requestId)
              .maybeSingle();
            if (priorRunError) return Response.json({ error: "specialized_idempotency_unavailable", charged: false }, { status: 503 });
            const replay = decideSpecializedRunReplay(priorRun as any, candidateId, workspaceId);
            if (replay.action === "replay") return Response.json({ ...replay.response, replayed: true });
            if (replay.action === "block") {
              return Response.json({
                error: replay.reason,
                status: replay.status,
                request_id: requestId,
                new_request_required: replay.reason === "request_already_processed" && replay.status === "rejected",
                message: replay.status === "uncertain"
                  ? "The prior request outcome is uncertain. The source will not be invoked again with this request ID."
                  : "This request ID is already reserved or processed; it cannot trigger another source execution.",
              }, { status: 409 });
            }
            // A successful request can be replayed even if the source is later disabled in admin settings.
            if (process.env.MAAROOF_ALEXANDRIA_ENABLED !== "true" || !process.env.FIRECRAWL_API_KEY) {
              return Response.json({ error: "specialized_source_not_enabled" }, { status: 503 });
            }
            const hardCap = Number(process.env.MAAROOF_ALEXANDRIA_MAX_CREDITS);
            if (!Number.isFinite(hardCap) || hardCap < 0) {
              return Response.json({ error: "specialized_source_cost_cap_not_configured" }, { status: 503 });
            }
            const requestedCap = Number(specializedRun.max_credits);
            if (!Number.isFinite(requestedCap) || requestedCap < 0 || requestedCap > hardCap) {
              return Response.json({ error: "specialized_cost_cap_exceeded" }, { status: 400 });
            }
            const discovered = await discoverAlexandriaCapabilities({ query: limited, limit: 5 });
            if (!discovered.enabled) return Response.json({ error: "specialized_source_not_enabled" }, { status: 503 });
            const candidate = discovered.candidates.find((item) => item.candidateId === candidateId);
            if (!candidate) return Response.json({ error: "specialized_candidate_stale" }, { status: 409 });
            if (candidate.estimatedCredits == null) {
              return Response.json({ error: "specialized_source_cost_unknown" }, { status: 402 });
            }
            if (candidate.estimatedCredits > requestedCap) {
              return Response.json({ error: "specialized_source_cost_cap_exceeded", estimated_credits: candidate.estimatedCredits }, { status: 402 });
            }
            if (!isAlexandriaTermsAccepted(candidate.provider, candidate.capability)) {
              return Response.json({ error: "specialized_source_terms_not_accepted" }, { status: 403 });
            }
            const options = specializedRun.options;
            const optionCheck = validateAlexandriaOptions(candidate.optionsSchema, options);
            if (!optionCheck.valid) {
              return Response.json({ error: "specialized_options_invalid", reasons: optionCheck.errors }, { status: 400 });
            }

            // Claim the idempotency key before charging. A unique constraint resolves concurrent duplicate POSTs.
            const { error: reserveError } = await admin.from("specialized_source_runs").insert({
              user_id: userId,
              workspace_id: workspaceId,
              request_id: requestId,
              candidate_id: candidateId,
              status: "reserved",
              estimated_credits: candidate.estimatedCredits,
              charged_tokens: 0,
            });
            if (reserveError) {
              if (reserveError.code === "23505") {
                const { data: racedRun } = await admin.from("specialized_source_runs")
                  .select("candidate_id,status,response,error_code,workspace_id")
                  .eq("user_id", userId).eq("request_id", requestId).maybeSingle();
                const racedReplay = decideSpecializedRunReplay(racedRun as any, candidateId, workspaceId);
                if (racedReplay.action === "replay") return Response.json({ ...racedReplay.response, replayed: true });
                if (racedReplay.action === "block") {
                  return Response.json({ error: racedReplay.reason, status: racedReplay.status, request_id: requestId, new_request_required: racedReplay.status === "rejected" }, { status: 409 });
                }
              }
              return Response.json({ error: "specialized_idempotency_reservation_failed", charged: false }, { status: 503 });
            }

            const charge = await chargeTokens({
              userId,
              toolKey: "research",
              runId: requestId,
              meta: {
                endpoint: "/api/research#specialized",
                candidate_id: candidateId,
                estimated_credits: candidate.estimatedCredits,
                credit_cap: requestedCap,
                explicit_user_confirmation: true,
                workspace_id: workspaceId,
              },
            });
            if (!charge.ok) {
              await admin.from("specialized_source_runs").update({
                status: "rejected", error_code: String(charge.reason || "charge_failed"), updated_at: new Date().toISOString(),
              }).eq("user_id", userId).eq("request_id", requestId);
              return Response.json({ ...chargeFailureBody(charge.reason as any, charge.left), new_request_required: true }, { status: 402 });
            }
            const { error: startRunError } = await admin.from("specialized_source_runs").update({
              status: "running", charged_tokens: Number(charge.tokens || 0), updated_at: new Date().toISOString(),
            }).eq("user_id", userId).eq("request_id", requestId).eq("status", "reserved");
            if (startRunError) {
              try {
                await admin.rpc("charge_tokens", {
                  _user_id: userId, _tool_key: "research", _tokens: -Number(charge.tokens || 0), _usd: 0,
                  _run_id: requestId, _meta: { refund: true, idempotency_state_update_failed: true },
                } as any);
              } catch {}
              return Response.json({ error: "specialized_idempotency_state_update_failed", charged: false }, { status: 503 });
            }

            try {
              const executed = await executeAlexandriaCapability({
                provider: candidate.provider,
                capability: candidate.capability,
                options: options as Record<string, unknown>,
                estimatedCredits: candidate.estimatedCredits,
                maxCredits: requestedCap,
                userConfirmedPaidRun: true,
                requestId,
                adminTermsAccepted: true,
                userId,
                toolKey: "research",
              });
              const data = executed.result?.data ?? executed.result;
              const records = Array.isArray(data?.records) ? data.records
                : Array.isArray(data?.results) ? data.results
                : Array.isArray(data?.items) ? data.items
                : [];
              const retrievedAt = new Date().toISOString();
              await recordEvidence({
                userId,
                workspaceId,
                title: candidate.label,
                claim: "A user-approved specialized data request returned public data for the requested research query.",
                sourceKind: "external",
                sourceRef: null,
                evidenceType: "external",
                category: isCompany ? "market" : "market",
                collectionMethod: "explicit_specialized_source_run",
                provider: "specialized_data_source",
                capability: candidate.capability,
                retrievedAt,
                locale: String(lang),
                market: scope?.country ? String(scope.country) : null,
                measurementUnit: "source_response",
                sampleSize: records.length,
                realityKind: "observation",
                status: "success",
                limitation: executed.budgetOverrunDetected
                  ? "The source reported a final cost above the user-approved estimate cap; review billing before any further call."
                  : "A source response was retrieved; this is an observation, not automatically a verified market measurement.",
                sourceReliability: 65,
                relevanceScore: 75,
                businessImportance: 65,
                language: String(lang),
              });
              const responseBody = {
                ok: true,
                specialized_execution: {
                  label: candidate.label,
                  description: candidate.description,
                  result: data,
                  result_count: records.length,
                  estimated_credits: candidate.estimatedCredits,
                  reported_credits: executed.creditsCost,
                  budget_overrun_detected: executed.budgetOverrunDetected,
                  request_id: requestId,
                  retrieved_at: retrievedAt,
                  reality_kind: "observation",
                  limitation: "The result is source output. It is not a verified claim until independently checked.",
                },
              };
              const { error: completeRunError } = await admin.from("specialized_source_runs").update({
                status: "succeeded",
                response: responseBody,
                charged_tokens: Number(charge.tokens || 0),
                updated_at: new Date().toISOString(),
              }).eq("user_id", userId).eq("request_id", requestId).eq("status", "running");
              if (completeRunError) {
                console.error("[api/research] idempotency completion persistence failed", completeRunError.message);
              }
              return Response.json({ ...responseBody, idempotency_persistence_warning: !!completeRunError });
            } catch (error: any) {
              // For definitive HTTP/policy errors the provider reports that the action was not accepted.
              // Transport failures can be ambiguous; clients must retry with the same request ID only.
              if (error instanceof SpecializedSourceGateError) {
                try {
                  await admin.rpc("charge_tokens", {
                    _user_id: userId, _tool_key: "research", _tokens: -Number(charge.tokens || 0), _usd: 0,
                    _run_id: requestId, _meta: { refund: true, specialized_source_rejected: true, endpoint: "/api/research#specialized" },
                  } as any);
                } catch {}
                await admin.from("specialized_source_runs").update({
                  status: "rejected",
                  error_code: String(error.code || "specialized_source_rejected").slice(0, 120),
                  charged_tokens: 0,
                  updated_at: new Date().toISOString(),
                }).eq("user_id", userId).eq("request_id", requestId);
                return Response.json({
                  error: error.code === "specialized_source_access_required" ? "specialized_source_access_required"
                    : error.code === "specialized_source_rate_limited" ? "specialized_source_rate_limited"
                    : error.code === "provider_cost_exceeded_declared_cap" ? "specialized_source_cost_review_required"
                    : "specialized_source_not_completed",
                  request_id: requestId,
                  new_request_required: true,
                }, { status: 502 });
              }
              console.error("[api/research] specialized request outcome uncertain", String(error?.message || error).slice(0, 160));
              await admin.from("specialized_source_runs").update({
                status: "uncertain",
                error_code: "specialized_source_outcome_uncertain",
                charged_tokens: Number(charge.tokens || 0),
                updated_at: new Date().toISOString(),
              }).eq("user_id", userId).eq("request_id", requestId);
              return Response.json({
                error: "specialized_source_outcome_uncertain",
                request_id: requestId,
                retry_with_same_request_id: true,
                message: "The final source outcome could not be confirmed. The request ID is retained to prevent duplicate execution; the source will not be run again automatically.",
              }, { status: 503 });
            }
          }

          const _runId = crypto.randomUUID();
          const _t0 = Date.now();
          // Governed model selection (Part 12 registry) with the legacy default as fallback.
          const _MODEL = await resolveToolModel("google/gemini-2.5-flash-lite");
          // MCI (additive, fail-open): reuse a fresh identical result for this user — no charge.
          const _mci = await mciReuse(admin as any, "research", userId, [limited, lang, scope, mode, workspaceId], !!(reqBody as any)?.force);
          if (_mci.hit) return Response.json({ ..._mci.hit, mci: { reused: true, at: _mci.at } });
          const userCtx = await getUserContext(admin, userId);
          if (workspaceContext) {
            const card = workspaceContext.entity_truth_card && typeof workspaceContext.entity_truth_card === "object"
              ? workspaceContext.entity_truth_card : {};
            const answers = workspaceContext.onboarding?.answers && typeof workspaceContext.onboarding.answers === "object"
              ? workspaceContext.onboarding.answers : {};
            // The selected client identity takes precedence over the user's main profile.
            userCtx.brand_name = String(workspaceContext.name || card.brand_name || card.name || "").trim() || null;
            userCtx.brand_keywords = String(workspaceContext.keywords || card.brand_keywords || card.keywords || answers.brand_keywords || "").trim() || null;
            userCtx.specialty = String(card.specialty || card.industry || workspaceContext.brand_summary || "").trim() || null;
          }

          const geo = scope?.country ? ` ${scope.country}` : (workspaceContext?.country ? ` ${workspaceContext.country}` : "");
          const specBoost = userCtx.specialty ? ` ${userCtx.specialty}` : "";
          const channelTypes = requestedChannelTypes;
          const discoveryRequested = reqBody?.request_specialized_discovery === true;
          const plannedSearchCalls = 1 + (includeChannels ? channelTypes.length : 0);
          const routePlan = planSourceRoute({
            goal: limited,
            language: String(lang),
            market: scope?.country ? String(scope.country) : null,
            capability: undefined,
            available: { webSearch: true, directRead: true, alexandria: process.env.MAAROOF_ALEXANDRIA_ENABLED === "true" },
            requestSpecializedDiscovery: discoveryRequested,
            budget: { maxRequests: plannedSearchCalls + (discoveryRequested ? 1 : 0), maxEstimatedCredits: 10 * plannedSearchCalls },
          });

          // Search BEFORE charging: if live web search is unavailable, return a clear error and charge nothing.
          // The route plan is deterministic and constrains the number/type of retrieval calls.
          let sr: any;
          try {
            if (routePlan.primary === "url_read") {
              const url = limited.match(/https?:\/\/[^\s<>"'\])}]+/i)?.[0]?.replace(/[.,;!?]+$/, "");
              if (!url) return Response.json({ error: "public_url_required", charged: false }, { status: 400 });
              const page: any = await fcScrape(url, {}, { userId, toolKey: "research" });
              const pageData = page?.data ?? page ?? {};
              const metadata = pageData?.metadata ?? {};
              sr = {
                direct_read: true,
                fetch_source: page?.fetch_source || "direct_read",
                data: { web: [{
                  title: String(metadata.title || url).slice(0, 300),
                  url: String(metadata.sourceURL || url),
                  description: String(metadata.description || "").slice(0, 1000),
                  markdown: String(pageData.markdown || "").slice(0, 12000),
                  statusCode: metadata.statusCode ?? null,
                }] },
              };
            } else if (routePlan.primary === "none") {
              return Response.json({
                error: "source_budget_unavailable",
                charged: false,
                limitations: routePlan.limitations,
              }, { status: 402 });
            } else {
              sr = await fcSearch(limited + geo + specBoost, { limit: 8, lang, sources: routePlan.searchSources }, { userId, toolKey: "research" });
            }
          } catch (e: any) {
            console.error("[api/research] source retrieval unavailable", e?.status, e?.message);
            const directRead = routePlan.primary === "url_read";
            return Response.json({
              error: directRead ? "page_read_unavailable" : "search_unavailable",
              charged: false,
              message: lang === "en"
                ? (directRead ? "The public page could not be read. Nothing was charged." : "Live web search is temporarily unavailable. Nothing was charged.")
                : (directRead ? "تعذرت قراءة الصفحة العامة. لم يُخصم أي رصيد." : "البحث الحي على الويب غير متاح مؤقتاً. لم يُخصم أي رصيد."),
            }, { status: 503 });
          }
          let specializedDiscovery: any = { enabled: false, candidates: [], limitation: "not_requested" };
          if (discoveryRequested && routePlan.discoverSpecializedSources) {
            // Free catalogue lookup only. It never invokes a specialized provider capability.
            specializedDiscovery = await discoverAlexandriaCapabilities({ query: limited, limit: 3 });
          }
          const _chg = await chargeTokens({ userId, toolKey: "research", runId: _runId, meta: { provider: "lovable_ai", model: _MODEL, endpoint: "/api/research" } });
          if (!_chg.ok) return Response.json(chargeFailureBody(_chg.reason as any, _chg.left), { status: 402 });
          // Keep the result set aligned with the selected source profile. Only an explicit fallback may widen it.
          const pickArr = (v: any): any[] => {
            if (Array.isArray(v)) return v;
            if (!v || typeof v !== "object") return [];
            const selected = routePlan.searchSources.flatMap((source) => Array.isArray(v[source]) ? v[source] : []);
            if (selected.length) return selected;
            if (sr?.source_profile_warning === "selected_source_profile_unavailable_on_fallback") {
              return [...(Array.isArray(v.web) ? v.web : []), ...(Array.isArray(v.news) ? v.news : [])];
            }
            return [];
          };
          const rawList: any[] = sr?.direct_read && Array.isArray(sr?.data?.web)
            ? sr.data.web
            : pickArr(sr?.data).length ? pickArr(sr.data)
            : pickArr(sr?.web).length ? pickArr(sr.web)
            : Array.isArray(sr?.results) ? sr.results : [];
          const retrievedAt = new Date().toISOString();
          const results = rawList.slice(0, 8).map((r: any) => ({
            title: r.title || r.url,
            url: r.url,
            description: r.description || "",
            snippet: (r.markdown || "").slice(0, 600),
            domain: (() => { try { return new URL(r.url).hostname.replace(/^www\./, ""); } catch { return ""; } })(),
            evidence_kind: "external_observation",
            retrieved_at: retrievedAt,
            locale: String(lang),
            market: scope?.country ? String(scope.country) : null,
            sample_size: 1,
            limitation: "Public web result/snippet; not a direct measurement of AI-answer visibility.",
          }));
          const sourceProvider = sr?.direct_read
            ? "direct_public_page"
            : sr?.fetch_source === "apidirect" ? "alternate_web_search" : "web_search";
          await Promise.allSettled(results.map((item: any) => recordEvidence({
            userId,
            workspaceId,
            title: item.title,
            claim: item.snippet || item.description || item.title,
            sourceKind: "external",
            sourceRef: item.url,
            evidenceType: "external",
            category: isCompany ? "market" : "behavioral",
            collectionMethod: "source_intelligence_router",
            provider: sourceProvider,
            capability: routePlan.capability,
            retrievedAt,
            locale: String(lang),
            market: scope?.country ? String(scope.country) : null,
            measurementUnit: sr?.direct_read ? "public_page_read" : "search_result",
            sampleSize: 1,
            realityKind: "observation",
            status: item.snippet || item.description ? "success" : "empty",
            limitation: item.limitation,
            sourceReliability: 60,
            relevanceScore: 55,
            businessImportance: 50,
            language: String(lang),
          })));

          const lovableKey = process.env.LOVABLE_API_KEY;
          let answer = "";
          let key_findings: string[] = [];
          let sge_summary = "";
          let visibility_opportunities: string[] = [];
          let sources_used: number[] = [];
          let rarity_score: number | null = null;
          let uniqueness_notes = "";
          let evidence_missing = false;
          if (lovableKey) {
            const brandLine = userCtx.brand_name ? `\nUser brand to position: ${userCtx.brand_name}${userCtx.brand_keywords ? ` (${userCtx.brand_keywords})` : ""}` : "";
            const baseSys = `${FACTUAL_SAFETY_PROMPT}

You are a precise research assistant that mimics a Generative Search Experience (SGE). Write STRICTLY in language code: ${lang}.
${isCompany ? `MODE: COMPANY PROFILE. Treat the query as the name of a company/brand. Build a concise company profile from the supplied snippets only: what they do, sector, geography, official website if visible, products/services, target customers, public reputation signals. Do NOT fabricate revenue, headcount, dates, founders, awards, or contacts.\n` : ""}Rules:
- Cite EVERY non-trivial claim inline as [1], [2] matching the EVIDENCE_SOURCES list order.
- If sources contradict, say so explicitly.
- Never invent facts not present in the snippets.
- Output JSON with these keys EXACTLY:
  {
    "sge_summary": string (60-90 words, the kind of compact AI overview Google/Bing show on top of search; plain prose with [n] citations, no bullets),
    "answer": string (300-500 words, ${isCompany ? "structured company profile" : "deeper answer"} with [n] citations),
    "key_findings": string[] (3-6 short bullets, each with at least one [n]),
    "visibility_opportunities": string[] (3-5 concrete actions ${isCompany ? "to reach or partner with this company, or to position your brand against it" : "the user/brand can take to BE CITED by AI engines on this topic"} — content angles, missing entities, structured-data ideas, channels to publish on)
  }${specialtyHint(userCtx, lang as any)}${brandLine}`;
            const sys = qualityShell(baseSys);
            const pack = evidenceFromResults(limited, results, 8);
            const ai = await fetch(LOVABLE_AI_CHAT_COMPLETIONS_URL, {
              method: "POST",
              headers: lovableAiHeaders(lovableKey),
              body: JSON.stringify({
                model: _MODEL,
                messages: [
                  { role: "system", content: sys },
                  { role: "user", content: `Question: ${limited}\n\n${pack.context_block}\n\nReturn the JSON object now.` },
                ]
              }),
            });
            if (ai.ok) {
              const j: any = await ai.json();
          try {
            const _u: any = (j as any)?.usage || {};
            const { enrichLedger: _el } = await import("@/lib/spend.server");
            await _el({ runId: _runId, provider: "lovable_ai", model: _MODEL, endpoint: "/api/research", inputTokens: Number(_u.prompt_tokens)||0, outputTokens: Number(_u.completion_tokens)||0, latencyMs: Date.now() - _t0 });
          } catch {}
              const raw = j?.choices?.[0]?.message?.content || "{}";
              try {
                const p = extractJsonObject(raw) || {};
                sge_summary = String(p.sge_summary || "").slice(0, 1200);
                answer = String(p.answer || "").slice(0, 4000);
                key_findings = Array.isArray(p.key_findings) ? p.key_findings.slice(0, 6).map((s: any) => String(s).slice(0, 240)) : [];
                visibility_opportunities = Array.isArray(p.visibility_opportunities) ? p.visibility_opportunities.slice(0, 5).map((s: any) => String(s).slice(0, 280)) : [];
                const q = pickQualityFields(p);
                sources_used = q.sources_used;
                rarity_score = q.rarity_score;
                uniqueness_notes = q.uniqueness_notes;
                evidence_missing = q.evidence_missing;
              } catch { answer = raw; }
            }
          }


          // Optional: discover communication channels related to the topic
          let channels: Array<{ type: string; label: string; url: string; source?: string }> = [];
          if (includeChannels) {
            try {
              const domainMap: Record<string, string> = {
                linkedin: "linkedin.com", twitter: "x.com OR twitter.com", instagram: "instagram.com",
                facebook: "facebook.com", youtube: "youtube.com", telegram: "t.me", whatsapp: "wa.me OR whatsapp.com",
              };
              const queries: Array<{ type: string; q: string }> = [];
              for (const t of channelTypes) {
                if (t === "website") queries.push({ type: "website", q: `${limited}${specBoost} official website${geo}` });
                else if (t === "email") queries.push({ type: "email", q: `${limited}${specBoost} contact email${geo}` });
                else if (domainMap[t]) queries.push({ type: t, q: `${limited}${specBoost} site:${domainMap[t]}` });
              }
              const seen = new Set<string>();
              const allowedChannelQueries = queries.slice(0, Math.max(0, channelTypes.length));
              const settled = await Promise.allSettled(allowedChannelQueries.map((q) => fcSearch(q.q, { limit: 4, lang, sources: ["web"] }, { userId, toolKey: "research" })));
              settled.forEach((s, idx) => {
                if (s.status !== "fulfilled") return;
                const list = (() => {
                  const v: any = (s.value as any)?.data;
                  if (Array.isArray(v)) return v;
                  if (v && typeof v === "object") return [...(v.web || []), ...(v.news || [])];
                  return [];
                })();
                for (const r of list.slice(0, 3)) {
                  const url = r?.url; if (!url || seen.has(url)) continue; seen.add(url);
                  channels.push({ type: queries[idx].type, label: r.title || url, url, source: (() => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; } })() });
                }
              });
              // Extract emails from snippets if email channel requested
              if (channelTypes.includes("email")) {
                const blob = results.map((r: any) => r.snippet || "").join("\n");
                const emails = Array.from(new Set((blob.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []))).slice(0, 5);
                for (const e of emails) channels.push({ type: "email", label: e, url: `mailto:${e}` });
              }
            } catch { /* non-fatal */ }
          }

          {
            const _out = {
              query: limited, sge_summary, answer, key_findings, visibility_opportunities,
              sources: results, channels, specialty: userCtx.specialty, sources_used, rarity_score,
              uniqueness_notes, evidence_missing,
              source_plan: {
                capability: routePlan.capability,
                route: routePlan.primary,
                requested_search_sources: routePlan.searchSources,
                retrieved_source_profile: sr?.direct_read ? "direct_public_page" : sr?.source_profile_warning ? "general_web_fallback" : routePlan.searchSources.join("+"),
                request_budget: { max_calls: routePlan.maxRequests, planned_calls: plannedSearchCalls },
                sample_size: results.length,
                retrieved_at: retrievedAt,
                language: String(lang),
                market: scope?.country ? String(scope.country) : null,
                reality_kind: "external_observation",
                limitation: "Search observations and snippets are not direct AI-answer visibility measurements; failed probes are excluded from rates.",
              },
              specialized_source_options: {
                enabled: specializedDiscovery.enabled,
                candidates: (specializedDiscovery.candidates || []).map((candidate: any) => ({
                  candidate_id: candidate.candidateId,
                  label: candidate.label,
                  description: candidate.description,
                  estimated_credits: candidate.estimatedCredits,
                  terms_required: candidate.termsRequired,
                  options_schema: candidate.optionsSchema,
                  response_schema: candidate.responseSchema,
                  terms_configured: isAlexandriaTermsAccepted(candidate.provider, candidate.capability),
                  executable: candidate.estimatedCredits != null && !!candidate.optionsSchema && isAlexandriaTermsAccepted(candidate.provider, candidate.capability),
                  discovery_only: true,
                })),
                limitation: specializedDiscovery.limitation,
                execution_enabled_by_this_request: false,
                configured_max_credits: Number.isFinite(Number(process.env.MAAROOF_ALEXANDRIA_MAX_CREDITS)) ? Number(process.env.MAAROOF_ALEXANDRIA_MAX_CREDITS) : null,
              },
            };
            await mciStore(admin as any, "research", userId, _mci.key, _out);
            return Response.json(_out);
          }
        } catch (e) {
          console.error("[api/research] failed", e);
          return Response.json({ error: "internal_error" }, { status: 500 });
        }
      },
    },
  },
});
