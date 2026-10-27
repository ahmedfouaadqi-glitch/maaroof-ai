import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { resolveAuthenticatedUserId } from "@/lib/api-auth.server";
import { resolveCompetitiveContext } from "@/lib/competitive-context";

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
        const id = String(b?.attachment_id || "");
        if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "missing_input", need: ["attachment_id"] }, { status: 400 });

        const workspaceId = b?.workspace_id == null || b.workspace_id === "" ? null : String(b.workspace_id);
        let workspace: any = null;
        if (workspaceId) {
          if (!/^[0-9a-f-]{36}$/i.test(workspaceId)) return Response.json({ error: "invalid_workspace" }, { status: 400 });
          const { data: space } = await db.from("workspaces")
            .select("id, owner_id, name, brand_url, brand_summary, keywords, country, city, profile, entity_truth_card, onboarding, settings")
            .eq("id", workspaceId).eq("owner_id", userId).maybeSingle();
          if (!space) return Response.json({ error: "workspace_not_found" }, { status: 404 });
          workspace = space;
        }

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
        const sheets = await readSpreadsheetBytes(await file.arrayBuffer(), kind, (at as any).name);

        const { detectMarkets, marketByCode } = await import("@/lib/market-scope");
        const { keywordColumn } = await import("@/lib/operational-workbook");
        const requestText = String(b?.request_text || b?.text || "").trim().slice(0, 12000);
        const marketText = String(b?.market_text || "").trim().slice(0, 240);
        const geo = b?.geo_scope && typeof b.geo_scope === "object" ? b.geo_scope : {};
        const geoMode = ["auto", "world", "country", "city"].includes(String(geo.mode)) ? String(geo.mode) : "auto";
        const geoCountry = typeof geo.country === "string" ? geo.country.trim().slice(0, 120) : "";
        const geoCity = typeof geo.city === "string" ? geo.city.trim().slice(0, 120) : "";

        const resolved = resolveCompetitiveContext({
          explicitBrand: b?.brand,
          explicitSite: b?.site,
          explicitCategory: b?.category,
          workspace,
          requestText,
          workbookSignals: [...sheets.map((s) => s.name), ...sheets.flatMap((s) => s.columns)],
        });
        const brand = resolved.brand;
        const site = resolved.site || undefined;
        const category = resolved.category;
        if (!brand) return Response.json({ error: "brand_required", need: ["brand"] }, { status: 422 });
        if (!category) return Response.json({ error: "category_required", need: ["category"] }, { status: 422 });

        const chosen = (Array.isArray(b?.markets) ? b.markets : []).map((m: any) => marketByCode(String(m))).filter(Boolean);
        const userMarkets = detectMarkets([marketText]);
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
        const markets = chosen.length ? chosen
          : userMarkets.length ? userMarkets
          : scopedMarkets.length ? scopedMarkets
          : workbookMarkets;
        if (!markets.length) return Response.json({
          error: "no_market",
          need: ["market"],
          sheets: sheets.map((s) => s.name),
          detected_category: category,
        }, { status: 422 });
        const marketSource = chosen.length ? "explicit"
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
          keywordSamplesByMarket[market.code] = candidates;
        }

        const competitors = (Array.isArray(b?.competitors) ? b.competitors : String(b?.competitors || "").split(/[,،\n]/))
          .map((x: any) => String(x).trim()).filter(Boolean).slice(0, 4);
        const { gatherParties, askEnginesPerMarket, gatherSocial } = await import("@/lib/competitive-geo.server");
        const [parties, engineAnswers] = await Promise.all([
          gatherParties({ brand, site, competitors, category, markets: markets.slice(0, 5), userId }),
          askEnginesPerMarket(category, markets.slice(0, 5), keywordSamplesByMarket),
        ]);
        const answeredMarkets = new Set(engineAnswers.filter((a) => a.status === "answered").map((a) => a.market)).size;
        const anyPage = parties.some((p) => p.pageText);
        if (!answeredMarkets && !anyPage) return Response.json({ error: "no_evidence" }, { status: 502 });

        // Charge only successful markets; fall back to the parent tool price.
        const { chargeTokens, chargeFailureBody } = await import("@/lib/tokens.server");
        const units = Math.max(1, answeredMarkets);
        let charge: any = await chargeTokens({ userId, toolKey: "competitive_geo.market", units, meta: { attachment_id: id, markets: markets.map((m: any) => m.code) } });
        if (!charge.ok && charge.reason === "unpriced") charge = await chargeTokens({ userId, toolKey: "compare", units, meta: { attachment_id: id, sub: "competitive_geo.market" } });
        if (!charge.ok) return Response.json(chargeFailureBody(charge.reason, charge.left), { status: 402 });
        // Per-cluster questions (limit chosen by the user, 0-10 per market).
        const { buildClusters, answeredClusterCount } = await import("@/lib/keyword-clusters");
        const clusterLimit = Math.max(0, Math.min(10, Number(b?.cluster_limit ?? 3) || 0));
        const winners = new Set<string>();
        const kwOf = (s: any) => { const i = keywordColumn(s); return i < 0 ? [] : s.rows.map((r: any) => String(r[i] ?? "")); };
        for (const s of sheets.filter((x) => /winner|رابح/i.test(x.name))) for (const k of kwOf(s)) winners.add(k.trim().toLowerCase());
        const { sheetsForMarket } = await import("@/lib/market-scope");
        const clusters = markets.slice(0, 5).flatMap((m: any) => buildClusters(m.code, sheetsForMarket(sheets, markets, m).filter((s: any) => !/negative|سلبي/i.test(s.name)).flatMap(kwOf), winners, clusterLimit));
        const { askEnginesPerCluster } = await import("@/lib/competitive-geo.server");
        const clusterAnswers = clusters.length ? await askEnginesPerCluster(clusters, (c) => (markets.find((m: any) => m.code === c) as any)?.en || c) : [];
        const answeredClusters = answeredClusterCount(clusterAnswers);
        if (answeredClusters) {
          const { chargeTokens: ct } = await import("@/lib/tokens.server");
          let cc: any = await ct({ userId, toolKey: "competitive_geo.cluster", units: answeredClusters, meta: { attachment_id: id } });
          if (!cc.ok && cc.reason === "unpriced") cc = await ct({ userId, toolKey: "compare", units: answeredClusters, meta: { attachment_id: id, sub: "competitive_geo.cluster" } });
          if (!cc.ok) return Response.json({ error: "insufficient_balance_clusters", left: cc.left }, { status: 402 });
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
        if (alex.connected) payload.sections.push({ heading: lang === "ar" ? "أدلة البيانات المهيكلة الموثقة" : "Verified structured data evidence", kind: "table", table: { columns: ["URL", lang === "ar" ? "النص" : "Text"], data: alex.evidence.slice(0, 50).map((e) => [e.url, e.text.slice(0, 800)]) } } as any);
        if (pack.llmsFull && pack.llmsFull !== pack.llms) payload.sections.push({ heading: "llms-full.txt", kind: "text", text: pack.llmsFull });
        if (pack.llms) payload.sections.push({ heading: "llms.txt", kind: "text", text: pack.llms });
        if (pack.orgJsonld) payload.sections.push({ heading: "Organization JSON-LD", kind: "text", text: pack.orgJsonld });
        const summary = markets.map((m: any) => ({ market: m.code, label: lang === "ar" ? m.ar : m.en, voice: parties.map((p) => ({ name: p.name, ...shareOfVoice(engineAnswers.filter((a) => a.market === m.code), p.name) })) }));
        const summarizeStatuses = (items: Array<{ status: string }>) => ({
          asked: items.length,
          answered: items.filter((item) => item.status === "answered").length,
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
        return Response.json({ payload, summary, diagnostics, parties: parties.map((p) => ({ name: p.name, role: p.role, url: p.url, read: !!p.pageText })), context: { brand, site: site || "", category, categorySource: resolved.categorySource, marketSource }, charged: charge.tokens || 0, llms: pack.llms, llms_full: pack.llmsFull, missing_fields: pack.missing, clusters: { asked: clusters.length, answered: answeredClusters, probes_asked: clusterAnswers.length, probes_answered: clusterAnswers.filter((item) => item.status === "answered").length }, negatives: (payload.sections.find((x: any) => x.table && x.heading.match(/سلبي|Negative|نەرێنی/))?.table?.data || []).map((r: any) => r[0]), alexandria });
      },
    },
  },
});
