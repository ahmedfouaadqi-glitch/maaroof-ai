// Central server-side cost recorder.
// Computes real USD cost from provider_rates, charges tokens (existing system),
// and writes a rich `meta` payload to token_ledger for the admin ProviderCost view.
import { createClient } from "@supabase/supabase-js";
import { chargeTokens, type ChargeResult } from "./tokens.server";

let _admin: any = null;
function admin() {
  if (_admin) return _admin;
  _admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  return _admin;
}

type RateRow = { provider: string; model: string | null; unit: string; usd_per_unit: number };
let _rates: { at: number; rows: RateRow[] } | null = null;

async function getRates(): Promise<RateRow[]> {
  if (_rates && Date.now() - _rates.at < 60_000) return _rates.rows;
  try {
    const { data } = await admin().from("provider_rates").select("provider, model, unit, usd_per_unit");
    const rows = (data || []) as RateRow[];
    _rates = { at: Date.now(), rows };
    return rows;
  } catch { return []; }
}

function rateFor(rows: RateRow[], provider: string, unit: string, model?: string | null): number {
  const exact = rows.find((r) => r.provider === provider && r.unit === unit && (model ? r.model === model : !r.model));
  if (exact) return Number(exact.usd_per_unit) || 0;
  const anyModel = rows.find((r) => r.provider === provider && r.unit === unit);
  return anyModel ? Number(anyModel.usd_per_unit) || 0 : 0;
}

export type SpendInput = {
  userId: string;
  toolKey: string;
  runId?: string;
  endpoint?: string;
  provider?: "lovable_ai" | "firecrawl" | "semrush" | string;
  model?: string | null;
  inputTokens?: number;
  outputTokens?: number;
  firecrawlUnits?: number;
  semrushCalls?: number;
  latencyMs?: number;
};

export type SpendResult = {
  charge: ChargeResult;
  usdCost: number;
  breakdown: { ai: number; firecrawl: number; semrush: number };
};

/**
 * Charge the user via the existing token system AND log real provider USD cost.
 */
export async function recordSpend(input: SpendInput): Promise<SpendResult> {
  const rates = await getRates();
  const inT = Math.max(0, Math.round(input.inputTokens || 0));
  const outT = Math.max(0, Math.round(input.outputTokens || 0));
  const fcU = Math.max(0, Math.round(input.firecrawlUnits || 0));
  const smC = Math.max(0, Math.round(input.semrushCalls || 0));

  const aiRate = input.provider === "lovable_ai" || input.model
    ? rateFor(rates, "lovable_ai", "per_1m_tokens", input.model || null) : 0;
  const ai = ((inT + outT) / 1_000_000) * aiRate;
  const firecrawl = fcU * rateFor(rates, "firecrawl", "per_credit");
  const semrush = smC * rateFor(rates, "semrush", "per_call");
  const usdCost = Number((ai + firecrawl + semrush).toFixed(6));

  const meta = {
    provider: input.provider || (input.model ? "lovable_ai" : "mixed"),
    model: input.model || null,
    input_tokens: inT,
    output_tokens: outT,
    firecrawl_units: fcU,
    semrush_calls: smC,
    latency_ms: input.latencyMs ?? null,
    endpoint: input.endpoint || null,
    request_id: input.runId || null,
    real_usd_cost: usdCost,
    breakdown: { ai, firecrawl, semrush },
  };

  const charge = await chargeTokens({
    userId: input.userId,
    toolKey: input.toolKey,
    runId: input.runId,
    meta,
  });

  return { charge, usdCost, breakdown: { ai, firecrawl, semrush } };
}

/**
 * Log a Firecrawl-only spend (no token charge — used to enrich monitoring with USD).
 */
export async function logFirecrawlSpend(opts: {
  userId?: string | null; toolKey?: string | null; units: number; latencyMs?: number; endpoint?: string;
}) {
  if (!opts.userId || !opts.units) return;
  const rates = await getRates();
  const usd = opts.units * rateFor(rates, "firecrawl", "per_credit");
  try {
    await admin().from("token_ledger").insert({
      user_id: opts.userId,
      tool_key: opts.toolKey || "firecrawl",
      tokens: 0,
      usd_cost: usd,
      meta: {
        provider: "firecrawl",
        firecrawl_units: opts.units,
        latency_ms: opts.latencyMs ?? null,
        endpoint: opts.endpoint || null,
        real_usd_cost: usd,
      },
    });
  } catch {}
}
