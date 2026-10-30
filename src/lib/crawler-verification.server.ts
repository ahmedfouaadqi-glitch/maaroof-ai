export type CrawlerVerificationStatus =
  | "verified"
  | "user_agent_only"
  | "source_ip_unavailable"
  | "unverified_ip"
  | "verification_unavailable";

export type CrawlerVerification = {
  verification_status: CrawlerVerificationStatus;
  verified_hostname: string | null;
  verification_method: string;
  verified_at: string | null;
};

function normalizeIp(value: string): string | null {
  const input = String(value || "").trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(input)) {
    const parts = input.split(".").map(Number);
    if (parts.some((n) => n < 0 || n > 255)) return null;
    return parts.join(".");
  }
  if (!input.includes(":") || !/^[0-9a-f:]+$/.test(input)) return null;
  const pieces = input.split("::");
  if (pieces.length > 2) return null;
  const left = pieces[0] ? pieces[0].split(":") : [];
  const right = pieces.length === 2 && pieces[1] ? pieces[1].split(":") : [];
  if ([...left, ...right].some((part) => part.length > 4 || !/^[0-9a-f]+$/.test(part))) return null;
  const missing = 8 - left.length - right.length;
  if ((pieces.length === 1 && missing !== 0) || (pieces.length === 2 && missing < 1)) return null;
  const groups = [...left, ...Array(missing).fill("0"), ...right].map((part) => part.padStart(4, "0"));
  return groups.length === 8 ? groups.join(":") : null;
}

function reverseDnsName(ip: string): string | null {
  if (ip.includes(".")) return ip.split(".").reverse().join(".") + ".in-addr.arpa";
  const hex = ip.replace(/:/g, "");
  return hex.split("").reverse().join(".") + ".ip6.arpa";
}

function hostnameMatches(hostname: string, suffix: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return host === suffix || host.endsWith("." + suffix);
}

function timeoutSignal(ms: number): AbortSignal {
  return AbortSignal.timeout(ms);
}

async function dnsQuery(name: string, type: "PTR" | "A" | "AAAA"): Promise<string[]> {
  const url = "https://dns.google/resolve?name=" + encodeURIComponent(name) + "&type=" + type;
  const response = await fetch(url, {
    headers: { Accept: "application/dns-json" },
    signal: timeoutSignal(2200),
  });
  if (!response.ok) throw new Error("dns_http_" + response.status);
  const payload: any = await response.json();
  if (Number(payload?.Status) !== 0) return [];
  return Array.isArray(payload?.Answer)
    ? payload.Answer.map((answer: any) => String(answer?.data || "").replace(/\.$/, "").trim()).filter(Boolean)
    : [];
}

async function resolvePtr(ip: string): Promise<string | null> {
  const ptrName = reverseDnsName(ip);
  if (!ptrName) return null;
  const answers = await dnsQuery(ptrName, "PTR");
  return answers[0] || null;
}

async function forwardConfirms(hostname: string, sourceIp: string): Promise<boolean> {
  const [a, aaaa] = await Promise.all([
    dnsQuery(hostname, "A").catch(() => []),
    dnsQuery(hostname, "AAAA").catch(() => []),
  ]);
  return [...a, ...aaaa].some((answer) => normalizeIp(answer) === sourceIp);
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Only use an ingress header explicitly configured as trusted by the deployment proxy. */
export function trustedClientIp(request: Request): string | null {
  const headerName = String(process.env.MAAROOF_TRUSTED_CLIENT_IP_HEADER || "").trim();
  if (!headerName || !/^[a-z0-9-]+$/i.test(headerName)) return null;
  const raw = request.headers.get(headerName) || "";
  // A trusted client-IP header must contain one address, not a user-controlled proxy chain.
  if (!raw || raw.includes(",")) return null;
  return normalizeIp(raw);
}

/**
 * DNS-based identity checks are deliberately limited to Googlebot and Bingbot.
 * Other User-Agent labels remain unverified claims until their provider publishes
 * and the application implements an authoritative verification method.
 */
export async function verifyCrawlerIdentity(
  admin: any,
  botName: string | null,
  sourceIp: string | null,
): Promise<CrawlerVerification> {
  const now = new Date();
  const base = {
    verified_hostname: null,
    verified_at: null,
  };
  if (!botName || !["Googlebot", "Bingbot"].includes(botName)) {
    return { ...base, verification_status: "user_agent_only", verification_method: "user_agent_classification" };
  }
  if (!sourceIp) {
    return { ...base, verification_status: "source_ip_unavailable", verification_method: "trusted_ingress_header_not_configured" };
  }
  const ip = normalizeIp(sourceIp);
  if (!ip) {
    return { ...base, verification_status: "source_ip_unavailable", verification_method: "invalid_or_untrusted_source_ip" };
  }

  const ipHash = await sha256(ip);
  try {
    const { data: cached } = await admin.from("crawler_ip_verifications")
      .select("verification_status, verified_hostname, verification_method, checked_at")
      .eq("ip_hash", ipHash).eq("bot_name", botName).gt("expires_at", now.toISOString()).maybeSingle();
    if (cached) {
      return {
        verification_status: cached.verification_status,
        verified_hostname: cached.verified_hostname || null,
        verification_method: cached.verification_method || "ptr_forward_confirm",
        verified_at: cached.checked_at || null,
      };
    }
  } catch {
    // A cache read failure must not become a successful identity assertion.
  }

  let status: CrawlerVerificationStatus = "verification_unavailable";
  let hostname: string | null = null;
  let method = "ptr_forward_confirm";
  try {
    hostname = await resolvePtr(ip);
    const suffixes = botName === "Googlebot"
      ? ["googlebot.com", "google.com", "googleusercontent.com"]
      : ["search.msn.com"];
    const suffixAllowed = Boolean(hostname && suffixes.some((suffix) => hostnameMatches(hostname!, suffix)));
    if (!hostname || !suffixAllowed) {
      status = "unverified_ip";
      method = "ptr_suffix_mismatch";
    } else if (await forwardConfirms(hostname, ip)) {
      status = "verified";
    } else {
      status = "unverified_ip";
      method = "forward_dns_did_not_match_source_ip";
    }
  } catch {
    status = "verification_unavailable";
    method = "dns_lookup_failed_or_timed_out";
  }

  const checkedAt = now.toISOString();
  const ttlMs = status === "verified" ? 24 * 60 * 60 * 1000 : 15 * 60 * 1000;
  try {
    await admin.from("crawler_ip_verifications").upsert({
      ip_hash: ipHash, bot_name: botName, verification_status: status,
      verified_hostname: status === "verified" ? hostname : null,
      verification_method: method, checked_at: checkedAt,
      expires_at: new Date(now.getTime() + ttlMs).toISOString(),
    }, { onConflict: "ip_hash,bot_name" });
  } catch {
    // The public response must not depend on an optional verification cache write.
  }
  return {
    verification_status: status,
    verified_hostname: status === "verified" ? hostname : null,
    verification_method: method,
    verified_at: checkedAt,
  };
}
