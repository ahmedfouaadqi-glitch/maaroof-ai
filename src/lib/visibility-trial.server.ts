import { createHmac } from "node:crypto";

export type TrialEntityType = "person" | "organization" | "unknown";
export type IpRisk = { verified: true; vpn: boolean; proxy: boolean; tor: boolean; risk: "low" | "medium" | "high" };

function secret() {
  const value = process.env.TRIAL_IDENTITY_SECRET;
  if (!value || value.length < 32) throw new Error("trial_identity_secret_missing");
  return value;
}

export function hashTrialSignal(value: string, purpose: string): string {
  if (!value) throw new Error("trial_signal_missing");
  return createHmac("sha256", secret()).update(purpose + ":" + value).digest("hex");
}

export function normalizeTrialEntityName(input: string): string {
  return String(input || "").normalize("NFKC").toLocaleLowerCase("und")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآ]/g, "ا").replace(/ى/g, "ي")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ").slice(0, 180);
}

export function trialEntityFingerprint(name: string, type: TrialEntityType): string {
  const canonical = normalizeTrialEntityName(name);
  if (canonical.length < 2) throw new Error("entity_name_invalid");
  void type;
  return hashTrialSignal(canonical, "entity");
}

/**
 * Uses a server-configured IP intelligence adapter. The adapter contract is:
 * POST {ip} with Bearer token; JSON response {vpn:boolean,proxy:boolean,tor:boolean,risk:"low"|"medium"|"high"}.
 * Missing or malformed intelligence is deliberately fail-closed.
 */
export async function verifyTrialIpRisk(ip: string): Promise<IpRisk> {
  const endpoint = process.env.IP_RISK_CHECK_URL;
  const token = process.env.IP_RISK_CHECK_TOKEN;
  if (!endpoint || !token) throw new Error("ip_risk_service_not_configured");
  let url: URL;
  try { url = new URL(endpoint); } catch { throw new Error("ip_risk_service_invalid"); }
  if (url.protocol !== "https:" || url.hostname === "localhost" || url.hostname.endsWith(".local")) {
    throw new Error("ip_risk_service_invalid");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({ ip }),
      signal: controller.signal,
      cache: "no-store",\n      redirect: "error",
    });
    if (!response.ok) throw new Error("ip_risk_service_unavailable");
    const value: any = await response.json();
    if (typeof value?.vpn !== "boolean" || typeof value?.proxy !== "boolean" ||
        typeof value?.tor !== "boolean" || !["low", "medium", "high"].includes(value?.risk)) {
      throw new Error("ip_risk_service_invalid_response");
    }
    return { verified: true, vpn: value.vpn, proxy: value.proxy, tor: value.tor, risk: value.risk };
  } finally {
    clearTimeout(timer);
  }
}

export function getTrustedClientIp(request: Request): string | null {
  const candidate = request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip");
  if (!candidate) return null;
  const ip = candidate.trim();
  if (ip.length > 64 || /[,\s]/.test(ip)) return null;
  return ip;
}

export function classifyEntityType(input: unknown, text: string): TrialEntityType {
  if (input === "person" || input === "organization") return input;
  if (input !== "auto" && input !== "unknown") return "unknown";
  // Conservative deterministic hints only. Ambiguous cases stay unknown and are labelled as such.
  const value = String(text || "").toLowerCase();
  const personHints = /\b(mr|mrs|ms|dr|professor|founder|author|artist|athlete|consultant)\b|الدكتور|الدكتورة|السيد|السيدة|شخصية|كاتب|فنان|مؤسس|\bperson\b|\bindividual\b/.test(value);
  const orgHints = /\b(inc|llc|ltd|company|corporation|agency|foundation|university|hospital|brand|organization)\b|شركة|مؤسسة|وكالة|جامعة|مستشفى|منظمة|علامة تجارية/.test(value);
  if (personHints && !orgHints) return "person";
  if (orgHints && !personHints) return "organization";
  return "unknown";
}
