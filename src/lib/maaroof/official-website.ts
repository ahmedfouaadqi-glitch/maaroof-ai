/**
 * Normalize an official website URL before passing it to an external retrieval provider.
 *
 * This rejects obvious local/private host forms, literal IP addresses, credentials,
 * non-HTTP schemes and non-standard ports. It is input validation, not a DNS or
 * redirect-chain firewall; the external provider must independently enforce those.
 */
export function normalizeOfficialWebsite(input: unknown): string | null {
  const raw = String(input ?? "").trim();
  if (!raw || raw.length > 500) return null;

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : "https://" + raw);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password || url.port) return null;

  const host = url.hostname.toLowerCase().replace(/^www\./i, "").replace(/\.$/, "");
  if (!host || !host.includes(".") || host.includes(":") || host.includes("[") || host.includes("]")) return null;
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(host)) return null;

  const labels = host.split(".");
  if (labels.some((label) => !label || label.length > 63 || label.startsWith("-") || label.endsWith("-"))) return null;

  const blockedSuffixes = [
    "localhost", "local", "internal", "test", "example", "invalid", "onion",
    "home.arpa", "lan", "intranet", "private",
    "nip.io", "sslip.io", "localtest.me", "vcap.me", "xip.io", "lvh.me", "traefik.me", "local.gd",
  ];
  if (blockedSuffixes.some((suffix) => host === suffix || host.endsWith("." + suffix))) return null;

  const tld = labels[labels.length - 1];
  if (!/^[a-z]{2,63}$/.test(tld) && !/^xn--[a-z0-9-]{2,59}$/.test(tld)) return null;

  return url.origin + url.pathname.replace(/\/$/, "");
}
