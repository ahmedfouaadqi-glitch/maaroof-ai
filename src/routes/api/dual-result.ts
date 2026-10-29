import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { resolveAuthenticatedUserId } from "@/lib/api-auth.server";
import { resolveCompetitiveContext, inferCategoryFromVerifiedEvidence } from "@/lib/competitive-context";
import { deriveEvidenceState, hasChargeableMarketEvidence } from "@/lib/keyword-intelligence-flow";
import { evidenceCacheKey, getKeywordEvidence, putKeywordEvidence } from "@/lib/keyword-evidence-cache.server";

// Second result: competitor + GEO research per target market, returned as an export payload.
export const Route = createFileRoute("/api/dual-result")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
        const userId = await resolveAuthenticatedUserId(request, db);
        if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
        const b: any = await request.json().catch(() => ({}));
        const lang = ["ar", "en", "ku"].includes(b?.lang) ? b.lang : "ar";
        const requestedContentLanguage = ["ar", "en", "ku", "fr", "de", "es"].includes(b?.content_language) ? b.content_language : null;
        const id = String(b?.attachment_id || "");
        const hasFile = Boolean(id);
        if (hasFile && !/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "missing_input", need: ["attachment_id"] }, { status: 400 });

        const workspaceId = b?.workspace_id == null || b.workspace_id === "" ? null : String(b.workspace_id);
        let workspace: any = null;
        if (!workspaceId) {
          // Fail closed for accounts that have workspaces: do not silently run a workspace-scoped tool
          // against the account-level context when the caller forgot to select a workspace.
          const { count, error: workspaceCountError } = await db.from("workspaces")
            .select("id", { count: "exact", head: true })
            .eq("owner_id", userId);
          if (workspaceCountError) return Response.json({ error: "workspace_context_unavailable" }, { status: 503 });
          if ((count || 0) > 0) return Response.json({ error: "workspace_required" }, { status: 400 });
        }
        if (workspaceId) {
          if (!/^[0-9a-f-]{36}$/i.test(workspaceId)) return Response.json({ error: "invalid_workspace" }, { status: 400 });
          const { data: space } = await db.from("workspaces")
            .select("id, owner_id, name, brand_url, brand_summary, keywords, country, city, language, profile, entity_truth_card, onboarding, settings")
            .eq("id", workspaceId).eq("owner_id", userId).maybeSingle();
          if (!space) return Response.json({ error: "workspace_not_found" }, { status: 404 });
          workspace = space;
        }

        const contentLanguage = requestedContentLanguage || (["ar", "en", "ku"].includes(workspace?.language) ? workspace.language : "en");
        const liveSerpRequested = b?.live_search === true;
        const liveSearchLimit = Math.max(1, Math.min(50, Math.floor(Number(b?.live_search_limit) || 10)));

        // No file attached: keywords come from scanning the brand site (see below).
        let sheets: any[] = [];
        if (hasFile) {
          const { data: at } = await db.from("task_attachments")
            .select("id, path, name, mime, workspace_id")
            .eq("id", id).eq("user_id", userId).maybeSingle();
          if (!at) return Response.json({ error: "not_found" }, { status: 404 });
          if (((at as any).workspace_id || null) !== workspaceId) {
            return Response.json({ error: "attachment_workspace_mismatch" }, { status: 403 });
          }
          const { isSpreadsheetName } = await import("@/lib/spreadsheet-reader");
          const kind = isSpreadsheetName((at as any).name, (at as any).mime || "");
          if (!kind) return Response.json({ error: "not_spreadsheet" }, { status: 422 });
          const { data: file } = await db.storage.from("task-files").download((at as any).path);
          if (!file) return Response.json({ error: "file_unavailable" }, { status: 422 });
          const { readSpreadsheetBytes } = await import("@/lib/spreadsheet-reader.server");
          sheets = await readSpreadsheetBytes(await file.arrayBuffer(), kind, (at as any).name);
        }

        const { detectMarkets, marketByCode, GLOBAL_MARKET } = await import("@/lib/market-scope");
        const { keywordColumn } = await import("@/lib/operational-workbook");
        const requestText = String(b?.request_text || b?.text || "").trim().slice(0, 12000);
        const marketText = String(b?.target_market || b?.market_text || "").trim().slice(0, 240);
        const geo = b?.geo_scope && typeof b.geo_scope === "object" ? b.geo_scope : {};
        const geoMode = ["auto", "world", "country", "city"].includes(String(geo.mode)) ? String(geo.mode) : "auto";
        const geoCountry = typeof geo.country === "string" ? geo.country.trim().slice(0, 120) : "";
        const geoCity = typeof geo.city === "string" ? geo.city.trim().slice(0, 120) : "";

        // Use representative values from the workbook as context signals, not just worksheet headings.
        // This lets the existing category resolver handle brands whose sector appears in row data.
        const workbookValueSignals: string[] = [];
        for (const sheet of sheets) {
          const indices = new Set<number>();
          const detectedKeywordIndex = keywordColumn(sheet);
          if (detectedKeywordIndex >= 0) indices.add(detectedKeywordIndex);
          sheet.columns.forEach((column: string, index: number) => {
            if (/(product|service|category|industry|brand|title|name|search term|keyword|query|item|sku|description|product type|نوع المنتج|الخدمة|الفئة|الصناعة|اسم المنتج|الكلمة المفتاحية)/i.test(column)) indices.add(index);
          });
          for (const row of sheet.rows.slice(0, 30)) {
            for (const index of indices) {
              const value = String(row[index] ?? "").trim().replace(/\s+/g, " ");
              if (value.length >= 3 && value.length <= 140 && !/^https?:\/\//i.test(value) && !/^\d+(?:[.,]\d+)?$/.test(value)) {
                workbookValueSignals.push(value);
                if (workbookValueSignals.length >= 120) break;
              }
            }
            if (workbookValueSignals.length >= 120) break;
          }
          if (workbookValueSignals.length >= 120) break;
        }

        const resolved = resolveCompetitiveContext({
          explicitBrand: b?.brand,
          explicitSite: b?.site,
          explicitCategory: b?.category,
          workspace,
          requestText,
          workbookSignals: [...sheets.map((s) => s.name), ...sheets.flatMap((s) => s.columns), ...workbookValueSignals],
        });
        const brand = resolved.brand;
        const site = resolved.site || undefined;
        let category = resolved.category;
        let categorySource: string = resolved.categorySource;
        let officialBrandPageEvidence: { text: string | null; title: string | null; description: string | null } | undefined;
        let officialCategoryEvidence: ReturnType<typeof inferCategoryFromVerifiedEvidence> | null = null;
        let categoryCorrection: { previous: string; current: string; persisted: boolean; evidence: string[] } | null = null;
        if (!brand) return Response.json({ error: "brand_required", need: ["brand"] }, { status: 422 });

        // Read the official domain before discovering competitors, then reuse this evidence below.
        // Only high-confidence page evidence can override an inconsistent stored/user-prefilled sector.
        if (site) {
          const { readOfficialBrandEvidence } = await import("@/lib/competitive-geo.server");
          const officialPageScope = {
            userId, workspaceId, evidenceType: "official-brand-page",
            evidenceKey: await evidenceCacheKey({ site: site.toLowerCase().trim() }),
          };
          const cachedOfficialPage = await getKeywordEvidence<{ text: string | null; title: string | null; description: string | null }>(officialPageScope);
          if (cachedOfficialPage) {
            officialBrandPageEvidence = { ...cachedOfficialPage, cacheHit: true };
          } else {
            officialBrandPageEvidence = await readOfficialBrandEvidence(site, userId, workspaceId);
            if (officialBrandPageEvidence.text || officialBrandPageEvidence.title || officialBrandPageEvidence.description) {
              await putKeywordEvidence(officialPageScope, officialBrandPageEvidence);
            }
          }
          const websiteCategory = inferCategoryFromVerifiedEvidence(officialBrandPageEvidence);
          officialCategoryEvidence = websiteCategory;
          if (websiteCategory.confidence === "high" && websiteCategory.category && websiteCategory.category !== category) {
            const previous = category;
            category = websiteCategory.category;
            categorySource = "official_site_verified";
            const truth: any = workspace?.entity_truth_card || {};
            const profile: any = workspace?.profile || {};
            const storedValues = [
              workspace?.brand_summary, truth.sector, truth.industry, truth.category,
              profile.industry, profile.sector, profile.category, profile.specialty,
            ].map((value) => String(value || "").trim().toLocaleLowerCase()).filter(Boolean);
            const requestedCategory = String(b?.category || "").trim().toLocaleLowerCase();
            const valueWasWorkspaceDefault = !requestedCategory || storedValues.includes(requestedCategory);
            let persisted = false;
            if (workspaceId && valueWasWorkspaceDefault) {
              const verification = {
                status: "verified",
                source_url: site,
                page_title: officialBrandPageEvidence.title || "",
                previous_category: previous,
                verified_category: category,
                confidence: websiteCategory.confidence,
                evidence_sources: websiteCategory.sources,
                checked_at: new Date().toISOString(),
              };
              const updatedTruth = { ...truth, sector: category, category_verification: verification };
              const { error: updateError } = await db.from("workspaces").update({
                brand_summary: category,
                entity_truth_card: updatedTruth,
              }).eq("id", workspaceId).eq("owner_id", userId);
              persisted = !updateError;
              if (persisted) workspace = { ...workspace, brand_summary: category, entity_truth_card: updatedTruth };
            }
            categoryCorrection = { previous, current: category, persisted, evidence: websiteCategory.sources };
          }
        }
        if (!category) return Response.json({ error: "category_required", need: ["category"] }, { status: 422 });

        const chosen = (Array.isArray(b?.markets) ? b.markets : []).map((m: any) => marketByCode(String(m))).filter(Boolean);
        // An explicit target market replaces the workspace default; do not silently add both markets.
        const marketHints = marketText ? [marketText] : [String(workspace?.country || "")].filter(Boolean);
        const userMarkets = detectMarkets(marketHints);
        const scopedMarkets = (geoMode === "country" || geoMode === "city") ? detectMarkets([geoCountry, geoCity]) : [];
        const marketColumnSignals = sheets.flatMap((sheet: any) => {
          const signals: string[] = [];
          sheet.columns.forEach((column: string, index: number) => {
            if (!/(market|country|region|location|geograph|السوق|الدولة|البلد|المنطقة|الموقع|الجغراف)/i.test(column)) return;
            for (const row of sheet.rows.slice(0, 1500)) {
              const value = String(row[index] ?? "").trim();
              if (value) signals.push(value);
            }
          });
          return signals;
        });
        const workbookMarkets = detectMarkets([
          ...sheets.map((sheet: any) => sheet.name),
          ...marketColumnSignals,
          requestText,
        ]);
        const mergedMarkets = geoMode === "world"
          ? [GLOBAL_MARKET]
          : [...chosen, ...userMarkets, ...scopedMarkets, ...workbookMarkets];
        const markets = [...new Map(mergedMarkets.map((market: any) => [market.code, market])).values()].slice(0, 5);
        if (!markets.length) return Response.json({
          error: "no_market",
          need: ["market"],
          sheets: sheets.map((s) => s.name),
          detected_category: category,
        }, { status: 422 });
        const marketSource = geoMode === "world" ? "geographic_scope"
          : [chosen.length, userMarkets.length, scopedMarkets.length, workbookMarkets.length].filter(Boolean).length > 1 ? "merged_user_and_workbook"
          : chosen.length ? "explicit"
          : userMarkets.length ? "user_input"
          : scopedMarkets.length ? "geographic_scope"
          : "workbook_or_request";

        const { sheetsForMarket: sheetsForTargetMarket } = await import("@/lib/market-scope");
        const keywordSamplesByMarket: Record<string, string[]> = {};
        for (const market of markets.slice(0, 5)) {
          const targetSheets = sheetsForTargetMarket(sheets, markets, market).filter((sheet: any) => !/negative|سلبي/i.test(sheet.name));
          const orderedSheets = [
            ...targetSheets.filter((sheet: any) => /winner|winning|رابح|رابحة/i.test(sheet.name)),
            ...targetSheets.filter((sheet: any) => !/winner|winning|رابح|رابحة/i.test(sheet.name)),
          ];
          const seen = new Set<string>();
          const candidates: string[] = [];
          for (const sheet of orderedSheets) {
            const index = keywordColumn(sheet);
            if (index < 0) continue;
            for (const row of sheet.rows) {
              const keyword = String(row[index] ?? "").trim();
              const normalized = keyword.toLocaleLowerCase();
              if (keyword.length < 3 || seen.has(normalized)) continue;
              seen.add(normalized);
              candidates.push(keyword.slice(0, 180));
              if (candidates.length >= 8) break;
            }
            if (candidates.length >= 8) break;
          }
          if (!hasFile && !candidates.length) {
            const wk = Array.isArray(workspace?.keywords) ? workspace.keywords : String(workspace?.keywords || "").split(/[,،\n]/);
            for (const k of wk.map((x: any) => String(x).trim()).filter((x: string) => x.length >= 3).slice(0, 8)) candidates.push(k.slice(0, 180));
          }
          keywordSamplesByMarket[market.code] = candidates;
        }

        // Stratified sample: only these keywords are measured live in this run (others read "out of sample").
        const { stratifiedSample, sheetStrata, DEFAULT_SAMPLE_PER_MARKET } = await import("@/lib/keyword-discovery");
        const defaultSampleLimit = liveSerpRequested ? Math.max(DEFAULT_SAMPLE_PER_MARKET, liveSearchLimit * Math.min(markets.length, 5)) : DEFAULT_SAMPLE_PER_MARKET;
        const skipKeywordPairs = Array.isArray(b?.skip_keyword_pairs) ? b.skip_keyword_pairs.map((x: any) => String(x)).slice(0, 10000) : [];
        const skipKeywords = skipKeywordPairs.length ? [] : (Array.isArray(b?.skip_keywords) ? b.skip_keywords.map((x: any) => String(x)).slice(0, 5000) : []);
        const priorMeasuredPairCount = new Set(skipKeywordPairs.map((pair: string) => {
          const separator = pair.indexOf("|");
          return separator < 0 ? "" : pair.slice(0, separator) + "|" + pair.slice(separator + 1).toLocaleLowerCase().replace(/\s+/g, " ").trim();
        }).filter(Boolean)).size;
        const requestedSampleLimit = Math.floor(Number(b?.sample_limit) || 0);
        const baseSampleLimit = requestedSampleLimit > 0 ? requestedSampleLimit : defaultSampleLimit;
        // As the user expands, scan beyond the original first sample instead of repeatedly hitting it.
        const expansionSampleFloor = priorMeasuredPairCount > 0 ? defaultSampleLimit + priorMeasuredPairCount : baseSampleLimit;
        const sampleLimit = Math.max(10, Math.min(500, Math.max(baseSampleLimit, expansionSampleFloor)));
        const totalKeywords = sheetStrata(sheets, keywordColumn).flat().length;
        const sampleKeywords = hasFile ? stratifiedSample(sheetStrata(sheets, keywordColumn), sampleLimit, skipKeywords) : [];
        const clusterLimitEstimate = Math.max(0, Math.min(10, Number(b?.cluster_limit ?? 3) || 0));
        if (b?.estimate_only === true) {
          // No calls and no charge: count questions and price them against the balance.
          const { resolveToolCost, isUnlimitedAccount } = await import("@/lib/tokens.server");
          const m = Math.min(markets.length, 5);
          const price = async (key: string) => (await resolveToolCost(userId, key)).tokens || 0;
          const [pm, pc, pd] = await Promise.all([price("competitive_geo.market"), price("competitive_geo.cluster"), price("keyword_intelligence.discovery")]);
          const clustersPlanned = m * clusterLimitEstimate;
          const serpChecks = liveSerpRequested ? m * liveSearchLimit : 0;
          const keywordProbeQuestions = liveSerpRequested ? serpChecks * 10 : 0;
          const newKeywordChecks = liveSerpRequested ? m * Math.floor(liveSearchLimit / 2) : 0;
          const unlimited = await isUnlimitedAccount(userId);
          const { data: bal } = await db.from("profiles").select("tokens_balance").eq("id", userId).maybeSingle();
          return Response.json({
            estimate: {
              total_keywords: totalKeywords,
              sample_keywords: liveSerpRequested ? serpChecks : (hasFile ? sampleKeywords.length : null),
              new_keyword_checks: newKeywordChecks,
              skipped_already_measured: skipKeywordPairs.length || skipKeywords.length,
              markets: m,
              engine_questions: m * 10 + clustersPlanned * 10 + m * 10 + keywordProbeQuestions,
              live_search_checks: serpChecks,
              estimated_tokens: pm * m + pc * clustersPlanned + pd * (m * 10 + keywordProbeQuestions),
              cache_note: "An existing workspace evidence cache can reduce fresh calls and charges.",
              balance: unlimited ? null : Number((bal as any)?.tokens_balance || 0), unlimited,
            },
          });
        }

        const competitors = (Array.isArray(b?.competitors) ? b.competitors : String(b?.competitors || "").split(/[,،\n]/))
          .map((x: any) => String(x).trim()).filter(Boolean).slice(0, 4);
        const { gatherParties, askEnginesPerMarket, gatherSocial } = await import("@/lib/competitive-geo.server");
        const analysisScopeKey = await evidenceCacheKey({
          brand, site: site || "", category, markets: markets.map((market: any) => market.code),
          contentLanguage, attachmentId: id || null, keywordSamplesByMarket,
        });
        const marketStageScope = { userId, workspaceId, evidenceType: "market-stage", evidenceKey: analysisScopeKey };
        const cachedMarketStage = await getKeywordEvidence<{ parties: any[]; engineAnswers: any[] }>(marketStageScope);
        const marketStageCacheHit = Boolean(cachedMarketStage);
        let parties: any[];
        let engineAnswers: any[];
        if (cachedMarketStage) {
          parties = cachedMarketStage.parties.map((party) => ({ ...party, cacheHit: true }));
          engineAnswers = cachedMarketStage.engineAnswers.map((answer) => ({ ...answer, cacheHit: true }));
        } else {
          [parties, engineAnswers] = await Promise.all([
            gatherParties({ brand, site, competitors, category, markets: markets.slice(0, 5), userId, workspaceId, brandPageEvidence: officialBrandPageEvidence }),
            askEnginesPerMarket(category, markets.slice(0, 5), keywordSamplesByMarket, contentLanguage),
          ]);
          const reusableEvidence = parties.some((party) => Boolean(party.pageText)) || engineAnswers.some((answer) => answer.status === "answered");
          if (reusableEvidence) {
            await putKeywordEvidence(marketStageScope, {
              parties: parties.map(({ cacheHit, ...party }) => party),
              engineAnswers: engineAnswers.map(({ cacheHit, ...answer }) => answer),
            });
          }
        }
        if (!hasFile) {
          // No file: current keywords are the ones the brand's own page actually uses.
          const { extractSiteKeywords, siteKeywordSheet } = await import("@/lib/site-keyword-extractor");
          const bp = parties.find((p) => p.role === "brand");
          const list = extractSiteKeywords({ text: bp?.pageText, title: bp?.title, description: bp?.description }, 60);
          if (list.length) sheets = [siteKeywordSheet(list, lang === "ar" ? "كلمات الموقع" : "Site keywords")];
        }
        // Validate competitor entities against the same verified sector evidence where available.
        // Ambiguous pages are retained; only high-confidence, clearly unrelated sectors are excluded.
        type CompetitorValidation = { name: string; url: string | null; category: string; status: "verified" | "sector_mismatch" | "insufficient_evidence" };
        let competitorValidation: CompetitorValidation[] = [];
        let excludedCompetitors: CompetitorValidation[] = [];
        const brandSector = officialCategoryEvidence?.confidence === "high" ? officialCategoryEvidence.category : "";
        const sectorFamily = (value: string) => {
          const normalized = value.trim().toLocaleLowerCase();
          if (normalized === "luxury fashion & couture" || normalized === "fashion & apparel") return "fashion";
          return normalized;
        };
        const validateCompetitors = (items: typeof parties): { keep: typeof parties; checks: CompetitorValidation[]; excluded: CompetitorValidation[] } => {
          const keep: typeof parties = [];
          const checks: CompetitorValidation[] = [];
          const excluded: CompetitorValidation[] = [];
          for (const party of items) {
            if (party.role !== "competitor") { keep.push(party); continue; }
            const observed = inferCategoryFromVerifiedEvidence({ title: party.title, description: party.description, pageText: party.pageText });
            const mismatched = Boolean(brandSector && observed.confidence === "high" && observed.category &&
              sectorFamily(observed.category) !== sectorFamily(brandSector));
            const check: CompetitorValidation = {
              name: party.name,
              url: party.url || null,
              category: observed.category || "",
              status: mismatched ? "sector_mismatch" : observed.confidence === "high" ? "verified" : "insufficient_evidence",
            };
            checks.push(check);
            if (mismatched) excluded.push(check);
            else keep.push(party);
          }
          return { keep, checks, excluded };
        };
        if (brandSector) {
          const firstValidation = validateCompetitors(parties);
          excludedCompetitors = firstValidation.excluded;
          if (excludedCompetitors.length) {
            const trustedNames = firstValidation.keep.filter((party) => party.role === "competitor").map((party) => party.name);
            // Re-discover the vacancies against the verified brand sector instead of retaining unrelated entities.
            const refreshed = await gatherParties({ brand, site, competitors: trustedNames, category, markets: markets.slice(0, 5), userId, workspaceId, brandPageEvidence: officialBrandPageEvidence });
            const secondValidation = validateCompetitors(refreshed);
            parties = secondValidation.keep;
            excludedCompetitors = [...excludedCompetitors, ...secondValidation.excluded];
            competitorValidation = [...secondValidation.checks.filter((item) => item.status !== "sector_mismatch"), ...excludedCompetitors];
          } else {
            parties = firstValidation.keep;
            competitorValidation = firstValidation.checks;
          }

          if (workspaceId) {
            const previousTruth: any = workspace?.entity_truth_card || {};
            const verifiedCompetitors = parties.filter((party) => party.role === "competitor").map((party) => {
              const check = competitorValidation.find((item) => item.name === party.name && item.status !== "sector_mismatch");
              return { name: party.name, url: party.url || null, category: check?.category || "", verification_status: check?.status || "insufficient_evidence" };
            });
            const updatedTruth = {
              ...previousTruth,
              competitors: verifiedCompetitors,
              competitor_verification: {
                target_markets: markets.map((market: any) => market.code),
                brand_sector: brandSector,
                checked_at: new Date().toISOString(),
                excluded_count: excludedCompetitors.length,
              },
            };
            const { error: competitorSaveError } = await db.from("workspaces").update({
              entity_truth_card: updatedTruth,
            }).eq("id", workspaceId).eq("owner_id", userId);
            if (!competitorSaveError) workspace = { ...workspace, entity_truth_card: updatedTruth };
          }
        } else {
          competitorValidation = parties.filter((party) => party.role === "competitor").map((party) => ({
            name: party.name, url: party.url || null, category: "", status: "insufficient_evidence" as const,
          }));
        }

        // The user must explicitly opt in to direct search-result checks. No SERP calls are made by default.
        const liveSearchEvidence: Array<{
          keyword: string; market: string; query: string; status: "measured" | "unavailable";
          provider?: string; results: Array<{ url: string; title: string }>;
          answerBoxChecked: boolean; answerBoxCitations: string[];
          aiOverviewChecked: boolean; aiOverviewCitations: string[]; error?: string; cacheHit?: boolean;
        }> = [];


        const answeredMarkets = new Set(engineAnswers.filter((a) => a.status === "answered").map((a) => a.market)).size;
        const anyPage = parties.some((p) => p.pageText);
        const marketEvidenceAvailable = hasChargeableMarketEvidence(answeredMarkets, anyPage);
        if (!marketEvidenceAvailable) {
          // Preserve source data and explain initial probe failures without triggering further paid
          // cluster/social/structured-data requests when market probes and page reads yielded no evidence.
          const { buildOperationalPayload, shareOfVoice } = await import("@/lib/operational-workbook");
          const skippedSourceNote = "Skipped because the initial market probes and page reads returned no usable external evidence; no additional source requests were made.";
          const partialAlexandria = { connected: false, note: skippedSourceNote };
          const payload = buildOperationalPayload({
            brand, lang, markets, sheets, parties, engineAnswers,
            social: [], alexandria: partialAlexandria, clusterAnswers: [],
          });
          payload.subtitle = [lang === "ar" ? "المجال المتحقق: " : "Verified sector: ", category, " · ", lang === "ar" ? "مصدر المجال: " : "Sector source: ", categorySource, " · ", lang === "ar" ? "لغة المحتوى: " : "Content language: ", contentLanguage, " · ", lang === "ar" ? "السوق المستهدف: " : "Target market: ", markets.map((m: any) => lang === "ar" ? m.ar : m.en).join(", "), " · ", lang === "ar" ? "فحص نتائج البحث المباشر: " : "Live search check: ", liveSerpRequested ? (lang === "ar" ? "مطلوب" : "requested") : (lang === "ar" ? "لم يُطلب" : "not requested")].join("");
          const { buildKeywordIntelligenceSections } = await import("@/lib/keyword-intelligence");
          payload.sections = buildKeywordIntelligenceSections({ brand, lang, markets, sheets, parties, engineAnswers, social: [], clusterAnswers: [], hasFile, liveSearchEvidence, liveSerpRequested, contentLanguage, competitorValidation });
          payload.excelLayout = "six_sheets";
          const summary = markets.map((m: any) => ({
            market: m.code,
            label: lang === "ar" ? m.ar : m.en,
            voice: parties.map((p) => ({ name: p.name, ...shareOfVoice(engineAnswers.filter((a) => a.market === m.code), p.name) })),
          }));
          const summarizeStatuses = (items: Array<{ status: string; provider_path?: string }>) => ({
            asked: items.length,
            answered: items.filter((item) => item.status === "answered").length,
            fallback_answered: items.filter((item) => item.status === "answered" && item.provider_path === "fallback").length,
            no_answer: items.filter((item) => item.status === "no_answer").length,
            empty: items.filter((item) => item.status === "empty").length,
            timeout: items.filter((item) => item.status === "timeout").length,
            http_error: items.filter((item) => item.status === "http_error").length,
            error: items.filter((item) => item.status === "error").length,
          });
          const urls = parties.filter((party) => Boolean(party.url));
          const diagnostics = {
            market_probes: summarizeStatuses(engineAnswers),
            cluster_probes: summarizeStatuses([]),
            pages: { urls: urls.length, read: 0, unread: urls.length },
            social: { searched_parties: 0, parties_with_results: 0, results: 0 },
            alexandria: partialAlexandria,
          };
          return Response.json({
            payload, summary, diagnostics, evidence_state: "none" as const,
            evidence_note: "No external evidence was retrieved. The workbook still preserves the original rows, actual market queries, and failed/no-answer statuses. Additional paid research stages were skipped.",
            parties: parties.map((p) => ({ name: p.name, role: p.role, url: p.url, read: !!p.pageText })),
            competitor_validation: competitorValidation,
            context: { brand, site: site || "", category, categorySource, marketSource, contentLanguage, targetMarket: marketText, liveSerpRequested, categoryCorrection, competitorValidation },
            charged: 0,
            clusters: { asked: 0, answered: 0, billable_answered: 0, probes_asked: 0, probes_answered: 0, probes_fallback_answered: 0 },
            negatives: (payload.sections.find((x: any) => x.table && x.heading.match(/سلبي|Negative|نەرێنی/))?.table?.data || []).map((r: any) => r[0]),
            alexandria: partialAlexandria,
          });
        }
        // Do not charge for a market probe when it produced no usable answer and no page was read.
        // Still continue building a partial workbook so the user receives source data and failure diagnostics.
        let totalCharged = 0;
        if (marketEvidenceAvailable && !marketStageCacheHit) {
          const { chargeTokens, chargeFailureBody } = await import("@/lib/tokens.server");
          const units = Math.max(1, answeredMarkets);
          let charge: any = await chargeTokens({ userId, toolKey: "competitive_geo.market", units, meta: { attachment_id: id, markets: markets.map((m: any) => m.code) } });
          if (!charge.ok && charge.reason === "unpriced") charge = await chargeTokens({ userId, toolKey: "compare", units, meta: { attachment_id: id, sub: "competitive_geo.market" } });
          if (!charge.ok) return Response.json(chargeFailureBody(charge.reason, charge.left), { status: 402 });
          totalCharged += Number(charge.tokens || 0);
        }
        // Per-cluster questions (limit chosen by the user, 0-10 per market).
        const { buildClusters, answeredClusterCount, billableClusterCount } = await import("@/lib/keyword-clusters");
        const clusterLimit = Math.max(0, Math.min(10, Number(b?.cluster_limit ?? 3) || 0));
        const winners = new Set<string>();
        const kwOf = (s: any) => { const i = keywordColumn(s); return i < 0 ? [] : s.rows.map((r: any) => String(r[i] ?? "")); };
        for (const s of sheets.filter((x) => /winner|رابح/i.test(x.name))) for (const k of kwOf(s)) winners.add(k.trim().toLowerCase());
        const { sheetsForMarket } = await import("@/lib/market-scope");
        const clusters = markets.slice(0, 5).flatMap((m: any) => buildClusters(m.code, sheetsForMarket(sheets, markets, m).filter((s: any) => !/negative|سلبي/i.test(s.name)).flatMap(kwOf), winners, clusterLimit));
        const { askEnginesPerCluster } = await import("@/lib/competitive-geo.server");
        const clusterScope = {
          userId, workspaceId, evidenceType: "cluster-answers",
          evidenceKey: await evidenceCacheKey({ analysisScopeKey, clusters, contentLanguage }),
        };
        const cachedClusters = await getKeywordEvidence<any[]>(clusterScope);
        const clusterAnswers = cachedClusters
          ? cachedClusters.map((answer: any) => ({ ...answer, cacheHit: true }))
          : (clusters.length ? await askEnginesPerCluster(clusters, (code) => {
              const market = markets.find((item: any) => item.code === code) as any;
              return contentLanguage === "ar" || contentLanguage === "ku" ? (market?.ar || code) : (market?.en || code);
            }, contentLanguage) : []);
        if (!cachedClusters && clusterAnswers.some((answer: any) => answer.status === "answered")) {
          await putKeywordEvidence(clusterScope, clusterAnswers.map(({ cacheHit, ...answer }: any) => answer));
        }
        const answeredClusters = answeredClusterCount(clusterAnswers);
        const billableClusters = billableClusterCount(clusterAnswers.filter((answer: any) => !answer.cacheHit));
        if (billableClusters) {
          const { chargeTokens: ct } = await import("@/lib/tokens.server");
          let cc: any = await ct({ userId, toolKey: "competitive_geo.cluster", units: billableClusters, meta: { attachment_id: id } });
          if (!cc.ok && cc.reason === "unpriced") cc = await ct({ userId, toolKey: "compare", units: billableClusters, meta: { attachment_id: id, sub: "competitive_geo.cluster" } });
          if (!cc.ok) return Response.json({ error: "insufficient_balance_clusters", left: cc.left }, { status: 402 });
          totalCharged += Number(cc.tokens || 0);
        }

        // New keywords: real discovery questions to the ten engines, charged per successful answer only.
        const { askEnginesForDiscovery } = await import("@/lib/competitive-geo.server");
        const { discoveryConsensus } = await import("@/lib/keyword-discovery");
        const discoveryCompetitors = parties.filter((p) => p.role === "competitor").map((p) => p.name);
        const discoveryScope = {
          userId, workspaceId, evidenceType: "discovery-answers",
          evidenceKey: await evidenceCacheKey({ analysisScopeKey, category, markets: markets.map((m: any) => m.code), competitors: discoveryCompetitors, contentLanguage }),
        };
        const cachedDiscovery = await getKeywordEvidence<any[]>(discoveryScope);
        const discoveryAnswers = cachedDiscovery
          ? cachedDiscovery.map((answer: any) => ({ ...answer, cacheHit: true }))
          : await askEnginesForDiscovery({
              brand, category, markets: markets.slice(0, 5),
              competitors: discoveryCompetitors, contentLanguage: contentLanguage as any,
            });
        if (!cachedDiscovery && discoveryAnswers.some((answer: any) => answer.status === "answered")) {
          await putKeywordEvidence(discoveryScope, discoveryAnswers.map(({ cacheHit, ...answer }: any) => answer));
        }
        const { allKeywords: allKeywordsFn } = await import("@/lib/operational-workbook");
        const knownKeywords = allKeywordsFn(sheets);
        const discovered = discoveryConsensus(discoveryAnswers, knownKeywords, knownKeywords).slice(0, Math.min(400, 80 * Math.min(markets.length, 5)));
        const discoveryAnswered = discoveryAnswers.filter((a: any) => a.status === "answered" && !a.cacheHit).length;
        if (discoveryAnswered) {
          const { chargeTokens: ct } = await import("@/lib/tokens.server");
          let dc: any = await ct({ userId, toolKey: "keyword_intelligence.discovery", units: discoveryAnswered, meta: { attachment_id: id } });
          if (!dc.ok && dc.reason === "unpriced") dc = await ct({ userId, toolKey: "compare", units: discoveryAnswered, meta: { attachment_id: id, sub: "keyword_intelligence.discovery" } });
          if (dc.ok) totalCharged += Number(dc.tokens || 0);
        }

        const liveSampledPairs: Array<{ market: string; keyword: string }> = [];
        const liveSampledKeywordsByMarket: Record<string, string[]> = {};
        const newlySampledKeywordsByMarket: Record<string, string[]> = {};
        const liveMeasurementKeywords: string[] = [];
        const keywordProbeAnswers: any[] = [];
        if (liveSerpRequested) {
          const { allKeywords } = await import("@/lib/operational-workbook");
          const { fcSearch } = await import("@/lib/firecrawl");
          const { askEnginesForKeywordVisibility } = await import("@/lib/competitive-geo.server");
          const normalizeKeyword = (value: string) => String(value || "").toLocaleLowerCase().replace(/\s+/g, " ").trim();
          const filePoolSet = new Set(sampleKeywords.map((keyword: string) => normalizeKeyword(keyword)));
          const seenPairKeys = new Set<string>();
          const priorPairsByMarket: Record<string, string[]> = {};

          // Restore all previously sampled pairs into this report, using cache-only reads.
          // Expired/missing evidence is explicitly marked unavailable; it is never silently re-fetched.
          for (const market of markets.slice(0, 5)) {
            const seenPrior = new Set<string>();
            const priorKeywords = skipKeywordPairs
              .filter((pair: string) => pair.startsWith(market.code + "|"))
              .map((pair: string) => pair.slice(market.code.length + 1).trim())
              .filter((keyword: string) => {
                const key = normalizeKeyword(keyword);
                if (!key || seenPrior.has(key)) return false;
                seenPrior.add(key);
                return true;
              });
            priorPairsByMarket[market.code] = priorKeywords;
            liveSampledKeywordsByMarket[market.code] = [...priorKeywords];
            for (const keyword of priorKeywords) {
              const pairKey = market.code + "|" + normalizeKeyword(keyword);
              seenPairKeys.add(pairKey);
              liveSampledPairs.push({ market: market.code, keyword });
              if (!liveMeasurementKeywords.some((existing) => normalizeKeyword(existing) === normalizeKeyword(keyword))) liveMeasurementKeywords.push(keyword);
              const marketQueryLabel = contentLanguage === "ar" || contentLanguage === "ku" ? market.ar : market.en;
              const query = [keyword, marketQueryLabel].filter(Boolean).join(" ");
              const cacheScope = {
                userId, workspaceId, evidenceType: "serp",
                evidenceKey: await evidenceCacheKey({ analysisScopeKey, market: market.code, keyword, query, lang: contentLanguage }),
              };
              const cached = await getKeywordEvidence<any>(cacheScope);
              if (cached && Array.isArray(cached.results) && cached.results.length) {
                liveSearchEvidence.push({ ...cached, cacheHit: true });
              } else {
                liveSearchEvidence.push({
                  keyword, market: market.code, query, status: "unavailable", results: [],
                  answerBoxChecked: false, answerBoxCitations: [], aiOverviewChecked: false, aiOverviewCitations: [],
                  error: "cached_evidence_expired_or_unavailable_not_requeried", cacheHit: true,
                });
              }
            }
          }

          for (const market of markets.slice(0, 5)) {
            const targetSheets = sheetsForTargetMarket(sheets, markets, market).filter((sheet: any) => !/negative|سلبي/i.test(sheet.name));
            const pool = allKeywords(targetSheets, Number.POSITIVE_INFINITY);
            const skipSet = new Set((priorPairsByMarket[market.code] || []).map(normalizeKeyword));
            const currentCandidates = pool.filter((keyword: string) =>
              (!hasFile || filePoolSet.has(normalizeKeyword(keyword))) &&
              !skipSet.has(normalizeKeyword(keyword))
            );
            const newCandidates = discovered.filter((item: any) =>
              item.market === market.code && !item.inFile &&
              !skipSet.has(normalizeKeyword(String(item.keyword)))
            ).map((item: any) => String(item.keyword).trim());
            const halfFile = Math.ceil(liveSearchLimit / 2);
            const halfNew = Math.floor(liveSearchLimit / 2);
            let selected = [...currentCandidates.slice(0, halfFile), ...newCandidates.slice(0, halfNew)];
            const chosenKeys = new Set(selected.map((keyword) => normalizeKeyword(keyword)));
            // If one pool is short, fill unused slots from the other pool without duplicates.
            for (const keyword of [...currentCandidates.slice(halfFile), ...newCandidates.slice(halfNew)]) {
              if (selected.length >= liveSearchLimit) break;
              const key = normalizeKeyword(keyword);
              if (!chosenKeys.has(key)) { selected.push(keyword); chosenKeys.add(key); }
            }
            const pairs = selected.slice(0, liveSearchLimit);
            newlySampledKeywordsByMarket[market.code] = [];
            for (const keyword of pairs) {
              const pairKey = market.code + "|" + normalizeKeyword(keyword);
              if (seenPairKeys.has(pairKey)) continue;
              seenPairKeys.add(pairKey);
              liveSampledPairs.push({ market: market.code, keyword });
              newlySampledKeywordsByMarket[market.code].push(keyword);
              const combined = liveSampledKeywordsByMarket[market.code] || [];
              if (!combined.some((existing) => normalizeKeyword(existing) === normalizeKeyword(keyword))) combined.push(keyword);
              liveSampledKeywordsByMarket[market.code] = combined;
              if (!liveMeasurementKeywords.some((existing) => normalizeKeyword(existing) === normalizeKeyword(keyword))) liveMeasurementKeywords.push(keyword);
              const combined = liveSampledKeywordsByMarket[market.code] || [];
              if (!combined.some((existing) => normalizeKeyword(existing) === normalizeKeyword(keyword))) combined.push(keyword);
              const marketQueryLabel = contentLanguage === "ar" || contentLanguage === "ku" ? market.ar : market.en;
              const query = [keyword, marketQueryLabel].filter(Boolean).join(" ");
              const cacheScope = {
                userId, workspaceId, evidenceType: "serp",
                evidenceKey: await evidenceCacheKey({ analysisScopeKey, market: market.code, keyword, query, lang: contentLanguage }),
              };
              const cached = await getKeywordEvidence<any>(cacheScope);
              if (cached && Array.isArray(cached.results) && cached.results.length) {
                liveSearchEvidence.push({ ...cached, cacheHit: true });
              } else {
                try {
                  const found: any = await fcSearch(query, {
                    limit: 10, lang: contentLanguage, location: market.en,
                  }, { userId, toolKey: "keyword_intelligence.serp" });
                  const raw = (found?.data?.web || found?.data || found?.web || []) as any[];
                  const results = raw.filter((item) => /^https?:\/\//i.test(String(item?.url || "")))
                    .slice(0, 10)
                    .map((item) => ({ url: String(item.url), title: String(item.title || item.description || "") }));
                  const observation = {
                    keyword, market: market.code, query, status: results.length ? "measured" : "unavailable",
                    provider: String(found?.fetch_source || "available_search_provider"), results,
                    answerBoxChecked: false, answerBoxCitations: [],
                    aiOverviewChecked: false, aiOverviewCitations: [],
                    ...(!results.length ? { error: "live_search_unavailable" } : {}),
                  };
                  liveSearchEvidence.push({ ...observation, cacheHit: false });
                  if (results.length) await putKeywordEvidence(cacheScope, observation);
                } catch (error: any) {
                  liveSearchEvidence.push({
                    keyword, market: market.code, query, status: "unavailable", results: [],
                    answerBoxChecked: false, answerBoxCitations: [], aiOverviewChecked: false, aiOverviewCitations: [],
                    error: String(error?.scope || error?.code || "live_search_unavailable").slice(0, 100), cacheHit: false,
                  });
                }
              }
            }
          }

          // Prior pairs only read cached model answers. New pairs may call providers when not cached.
          const priorProbeAnswers = await askEnginesForKeywordVisibility({
            category, markets: markets.slice(0, 5), keywordsByMarket: priorPairsByMarket,
            contentLanguage: contentLanguage as any, userId, workspaceId, cacheOnly: true,
          });
          keywordProbeAnswers.push(...priorProbeAnswers);
          const currentProbeAnswers = await askEnginesForKeywordVisibility({
            category, markets: markets.slice(0, 5), keywordsByMarket: newlySampledKeywordsByMarket,
            contentLanguage: contentLanguage as any, userId, workspaceId,
          });
          keywordProbeAnswers.push(...currentProbeAnswers);
          const newlyAnsweredProbes = currentProbeAnswers.filter((answer: any) => answer.status === "answered" && !answer.cacheHit).length;
          if (newlyAnsweredProbes) {
            const { chargeTokens: ct } = await import("@/lib/tokens.server");
            let probeCharge: any = await ct({
              userId, toolKey: "keyword_intelligence.discovery", units: newlyAnsweredProbes,
              meta: { attachment_id: id, sub: "keyword_live_probes", sampled_pairs: liveSampledPairs.length },
            });
            if (!probeCharge.ok && probeCharge.reason === "unpriced") {
              probeCharge = await ct({
                userId, toolKey: "compare", units: newlyAnsweredProbes,
                meta: { attachment_id: id, sub: "keyword_live_probes" },
              });
            }
            if (!probeCharge.ok) return Response.json({ error: "insufficient_balance_keyword_probes", left: probeCharge.left }, { status: 402 });
            totalCharged += Number(probeCharge.tokens || 0);
          }
        }

        const social = await gatherSocial(parties.map((p) => p.name), userId);
        const { data: prof } = await db.from("profiles").select("onboarding").eq("id", userId).maybeSingle();
        const { buildPack } = await import("@/lib/machine-pack");
        const brandParty = parties.find((p) => p.role === "brand");
        const pack = buildPack({ brand, site: brandParty?.url || site, summary: undefined, siteDescription: brandParty?.description || null, siteText: brandParty?.pageText || null, markets: markets.map((m: any) => (lang === "ar" ? m.ar : m.en)), lang, onboarding: ((prof as any)?.onboarding || {}) as any });
        const { gatherAlexandria } = await import("@/lib/competitive-geo.server");
        const alex = await gatherAlexandria(`${brand} ${category} ${markets.map((m: any) => m.en).join(", ")}`);
        const alexandria = { connected: alex.connected, note: alex.note };
        const { buildOperationalPayload, shareOfVoice } = await import("@/lib/operational-workbook");
        const payload = buildOperationalPayload({ brand, lang, markets, sheets, parties, engineAnswers, social, alexandria, llms: pack.llms, clusterAnswers });
        payload.subtitle = [lang === "ar" ? "لغة المحتوى: " : "Content language: ", contentLanguage, lang === "ar" ? "السوق المستهدف: " : " · Target market: ", markets.map((m: any) => lang === "ar" ? m.ar : m.en).join(", "), lang === "ar" ? "فحص نتائج البحث المباشر: " : " · Live search check: ", liveSerpRequested ? (lang === "ar" ? "مطلوب" : "requested") : (lang === "ar" ? "لم يُطلب" : "not requested")].join("");
        const { buildKeywordIntelligenceSections } = await import("@/lib/keyword-intelligence");
        payload.sections = buildKeywordIntelligenceSections({
          brand, lang, markets, sheets, parties,
          engineAnswers: [...engineAnswers, ...keywordProbeAnswers],
          social, clusterAnswers, hasFile, liveSearchEvidence, liveSerpRequested, contentLanguage,
          competitorValidation, discovered, sampleKeywords: liveMeasurementKeywords,
          sampledMarketKeywords: liveSampledPairs, totalKeywords: totalKeywords + discovered.filter((item: any) => !item.inFile).length,
          charged: totalCharged,
        });
        payload.excelLayout = "six_sheets";
        if (alex.connected) payload.sections.push({ heading: lang === "ar" ? "أدلة البيانات المهيكلة الموثقة" : "Verified structured data evidence", kind: "table", table: { columns: ["URL", lang === "ar" ? "النص" : "Text"], data: alex.evidence.slice(0, 50).map((e) => [e.url, e.text.slice(0, 800)]) } } as any);
        if (pack.llmsFull && pack.llmsFull !== pack.llms) payload.sections.push({ heading: "llms-full.txt", kind: "text", text: pack.llmsFull });
        if (pack.llms) payload.sections.push({ heading: "llms.txt", kind: "text", text: pack.llms });
        if (pack.orgJsonld) payload.sections.push({ heading: "Organization JSON-LD", kind: "text", text: pack.orgJsonld });
        const summary = markets.map((m: any) => ({ market: m.code, label: lang === "ar" ? m.ar : m.en, voice: parties.map((p) => ({ name: p.name, ...shareOfVoice(engineAnswers.filter((a) => a.market === m.code), p.name) })) }));
        const summarizeStatuses = (items: Array<{ status: string; provider_path?: string }>) => ({
            asked: items.length,
            answered: items.filter((item) => item.status === "answered").length,
            fallback_answered: items.filter((item) => item.status === "answered" && item.provider_path === "fallback").length,
            no_answer: items.filter((item) => item.status === "no_answer").length,
            empty: items.filter((item) => item.status === "empty").length,
            timeout: items.filter((item) => item.status === "timeout").length,
            http_error: items.filter((item) => item.status === "http_error").length,
            error: items.filter((item) => item.status === "error").length,
          });
        const pageUrls = parties.filter((party) => Boolean(party.url));
        const socialPartiesWithResults = new Set(social.map((item) => item.party)).size;
        const diagnostics = {
          market_probes: summarizeStatuses(engineAnswers),
          cluster_probes: summarizeStatuses(clusterAnswers),
          pages: { urls: pageUrls.length, read: pageUrls.filter((party) => Boolean(party.pageText)).length, unread: pageUrls.filter((party) => !party.pageText).length },
          social: { searched_parties: Math.min(parties.length, 5), parties_with_results: socialPartiesWithResults, results: social.length },
          alexandria: { connected: alexandria.connected, note: alexandria.note || "" },
        };
        const proxyAnswerCalls = engineAnswers.filter((answer) => answer.status === "answered" && answer.provider_path === "fallback").length
          + clusterAnswers.filter((answer) => answer.status === "answered" && answer.provider_path === "fallback").length;
        const evidenceState = deriveEvidenceState({
          answeredMarketCalls: engineAnswers.filter((answer) => answer.status === "answered").length,
          answeredClusterCalls: clusterAnswers.filter((answer) => answer.status === "answered").length,
          proxyAnswerCalls,
          readablePages: parties.filter((party) => Boolean(party.pageText)).length,
          socialResults: social.length,
          structuredEvidence: alex.evidence.length,
          failedProbes: engineAnswers.filter((answer) => answer.status !== "answered").length
            + clusterAnswers.filter((answer) => answer.status !== "answered").length,
        });
        const evidenceNote = evidenceState === "none"
          ? "No external evidence was retrieved. This workbook still contains source rows, execution statuses, exact queries, and failure reasons; it contains no measured visibility result."
          : evidenceState === "partial"
            ? proxyAnswerCalls
              ? "All successful engine answers are counted. Review the per-engine status and evidence sources."
              : "Evidence is incomplete. Review per-engine failures and source-read statuses before treating findings as representative."
            : "Some external evidence was retrieved. Results still need contextual validation and are not a ranking guarantee.";
        const measuredPairs = [...new Set([
          ...skipKeywordPairs,
          ...liveSampledPairs.map((item) => item.market + "|" + item.keyword),
        ])];
        return Response.json({ measured_keywords: [...skipKeywords, ...sampleKeywords], measured_pairs: measuredPairs, payload, summary, diagnostics, evidence_state: evidenceState, evidence_note: evidenceNote, parties: parties.map((p) => ({ name: p.name, role: p.role, url: p.url, read: !!p.pageText })), competitor_validation: competitorValidation, context: { brand, site: site || "", category, categorySource, marketSource, contentLanguage, targetMarket: marketText, liveSerpRequested, categoryCorrection, competitorValidation }, charged: totalCharged, llms: pack.llms, llms_full: pack.llmsFull, missing_fields: pack.missing, clusters: { asked: clusters.length, answered: answeredClusters, billable_answered: billableClusters, probes_asked: clusterAnswers.length, probes_answered: clusterAnswers.filter((item) => item.status === "answered").length, probes_fallback_answered: clusterAnswers.filter((item) => item.status === "answered" && item.provider_path === "fallback").length }, negatives: (payload.sections.find((x: any) => x.table && x.heading.match(/سلبي|Negative|نەرێنی/))?.table?.data || []).map((r: any) => r[0]), alexandria });
      },
    },
  },
});
