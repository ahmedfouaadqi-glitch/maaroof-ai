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
        const { gatherParties, askEnginesPerMarket } = await import("@/lib/competitive-geo.server");
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

        const { buildOperationalPayload, shareOfVoice } = await import("@/lib/operational-workbook");
        const payload = buildOperationalPayload({ brand, lang, markets, sheets, parties, engineAnswers });
        const summary = markets.map((m: any) => ({ market: m.code, label: lang === "ar" ? m.ar : m.en, voice: parties.map((p) => ({ name: p.name, ...shareOfVoice(engineAnswers.filter((a) => a.market === m.code), p.name) })) }));
        return Response.json({ payload, summary, parties: parties.map((p) => ({ name: p.name, role: p.role, url: p.url, read: !!p.pageText })), charged: charge.tokens || 0 });
      },
    },
  },
});
