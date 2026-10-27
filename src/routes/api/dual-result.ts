import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { resolveAuthenticatedUserId } from "@/lib/api-auth.server";

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
        const brand = String(b?.brand || "").trim().slice(0, 120);
        const category = String(b?.category || "").trim().slice(0, 200);
        const id = String(b?.attachment_id || "");
        if (!brand || !category || !/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "missing_input", need: ["brand", "category", "attachment_id"].filter((k) => !b?.[k]) }, { status: 400 });

        const { data: at } = await db.from("task_attachments").select("id, path, name, mime").eq("id", id).eq("user_id", userId).maybeSingle();
        if (!at) return Response.json({ error: "not_found" }, { status: 404 });
        const { isSpreadsheetName } = await import("@/lib/spreadsheet-reader");
        const kind = isSpreadsheetName((at as any).name, (at as any).mime || "");
        if (!kind) return Response.json({ error: "not_spreadsheet" }, { status: 422 });
        const { data: file } = await db.storage.from("task-files").download((at as any).path);
        if (!file) return Response.json({ error: "file_unavailable" }, { status: 422 });
        const { readSpreadsheetBytes } = await import("@/lib/spreadsheet-reader.server");
        const sheets = await readSpreadsheetBytes(await file.arrayBuffer(), kind, (at as any).name);

        const { detectMarkets, marketByCode } = await import("@/lib/market-scope");
        const chosen = (Array.isArray(b?.markets) ? b.markets : []).map(marketByCode).filter(Boolean);
        const markets = chosen.length ? chosen : detectMarkets([...sheets.map((s) => s.name), String(b?.text || "")]);
        if (!markets.length) return Response.json({ error: "no_market", sheets: sheets.map((s) => s.name) }, { status: 422 });

        const competitors = (Array.isArray(b?.competitors) ? b.competitors : String(b?.competitors || "").split(/[,،\n]/)).map((x: any) => String(x).trim()).filter(Boolean).slice(0, 4);
        const site = /^https?:\/\//i.test(String(b?.site || "")) ? String(b.site) : undefined;
        const { gatherParties, askEnginesPerMarket, gatherSocial } = await import("@/lib/competitive-geo.server");
        const [parties, engineAnswers] = await Promise.all([
          gatherParties({ brand, site, competitors, category, markets: markets.slice(0, 5), userId }),
          askEnginesPerMarket(category, markets.slice(0, 5)),
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
        const { keywordColumn } = await import("@/lib/operational-workbook");
        const kwOf = (s: any) => { const i = keywordColumn(s); return i < 0 ? [] : s.rows.map((r: any) => String(r[i] ?? "")); };
        for (const s of sheets.filter((x) => /winner|رابح/i.test(x.name))) for (const k of kwOf(s)) winners.add(k.trim().toLowerCase());
        const { sheetMatchesMarket } = await import("@/lib/market-scope");
        const clusters = markets.slice(0, 5).flatMap((m: any) => buildClusters(m.code, sheets.filter((s) => sheetMatchesMarket(s.name, m)).flatMap(kwOf), winners, clusterLimit));
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
        if (alex.connected) payload.sections.push({ heading: lang === "ar" ? "أدلة الإسكندرية" : "Alexandria evidence", kind: "table", table: { columns: ["URL", lang === "ar" ? "النص" : "Text"], data: alex.evidence.slice(0, 50).map((e) => [e.url, e.text.slice(0, 800)]) } } as any);
        if (pack.llmsFull && pack.llmsFull !== pack.llms) payload.sections.push({ heading: "llms-full.txt", kind: "text", text: pack.llmsFull });
        if (pack.llms) payload.sections.push({ heading: "llms.txt", kind: "text", text: pack.llms });
        if (pack.orgJsonld) payload.sections.push({ heading: "Organization JSON-LD", kind: "text", text: pack.orgJsonld });
        const summary = markets.map((m: any) => ({ market: m.code, label: lang === "ar" ? m.ar : m.en, voice: parties.map((p) => ({ name: p.name, ...shareOfVoice(engineAnswers.filter((a) => a.market === m.code), p.name) })) }));
        return Response.json({ payload, summary, parties: parties.map((p) => ({ name: p.name, role: p.role, url: p.url, read: !!p.pageText })), charged: charge.tokens || 0, llms: pack.llms, llms_full: pack.llmsFull, missing_fields: pack.missing, clusters: { asked: clusters.length, answered: answeredClusters }, negatives: (payload.sections.find((x: any) => x.table && x.heading.match(/سلبي|Negative|نەرێنی/))?.table?.data || []).map((r: any) => r[0]), alexandria });
      },
    },
  },
});
