// Shared helper for TanStack server-route handlers.
// Authenticates the request via Bearer token, charges tokens for the tool,
// and returns either { ok:true, userId } or a Response (402/401) to short-circuit.
import { createClient } from "@supabase/supabase-js";
import { chargeTokens, chargeFailureBody, type ChargeResult } from "@/lib/tokens.server";

export async function authAndCharge(opts: {
  request: Request;
  toolKey: string;
  runId?: string;
  meta?: Record<string, any>;
}): Promise<{ ok: true; userId: string; charge: ChargeResult } | { ok: false; response: Response }> {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) {
    return { ok: false, response: Response.json({ error: "server_not_configured" }, { status: 500 }) };
  }
  const auth = opts.request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return { ok: false, response: Response.json({ error: "auth_required" }, { status: 401 }) };
  }
  const admin = createClient(url, key, { auth: { persistSession: false } });
  const { data } = await admin.auth.getUser(auth.slice(7));
  const userId = data.user?.id;
  if (!userId) {
    return { ok: false, response: Response.json({ error: "auth_required" }, { status: 401 }) };
  }

  const charge = await chargeTokens({ userId, toolKey: opts.toolKey, runId: opts.runId, meta: opts.meta });
  if (!charge.ok) {
    return {
      ok: false,
      response: Response.json(chargeFailureBody(charge.reason as any, charge.left), { status: 402 }),
    };
  }
  return { ok: true, userId, charge };
}
