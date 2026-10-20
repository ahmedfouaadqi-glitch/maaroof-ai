// Deep account audit — pure rules (no I/O). Decides what must be audited and how,
// per link kind and account kind, across SEO / AEO / GEO / SGE / GSEO. Never invents results.
import type { AccountKind } from "@/lib/account-kinds";

export type Axis = "seo" | "aeo" | "geo" | "sge" | "gseo";
export const AXES: Axis[] = ["seo", "aeo", "geo", "sge", "gseo"];
export type TargetKind = "official" | "social" | "page";
export type AuditTarget = { url: string; kind: TargetKind; platform: string | null; axes: Axis[] };

const SOCIAL: [RegExp, string][] = [
  [/linkedin\.com/i, "linkedin"], [/(^|\.)x\.com|twitter\.com/i, "x"], [/instagram\.com/i, "instagram"],
  [/facebook\.com|fb\.com/i, "facebook"], [/youtube\.com|youtu\.be/i, "youtube"], [/tiktok\.com/i, "tiktok"],
  [/t\.me|telegram\./i, "telegram"], [/snapchat\.com/i, "snapchat"], [/threads\.net/i, "threads"],
];

function host(u: string): string | null {
  try { return new URL(/^https?:\/\//i.test(u) ? u : `https://${u}`).hostname.toLowerCase().replace(/^www\./, ""); } catch { return null; }
}
function path(u: string): string {
  try { return new URL(/^https?:\/\//i.test(u) ? u : `https://${u}`).pathname.replace(/\/+$/, ""); } catch { return ""; }
}

/** Classify each link: social platform, official site root, or an inner page. Deduped. */
export function auditTargets(links: unknown): AuditTarget[] {
  const list = (Array.isArray(links) ? links : []).map((s) => String(s || "").trim()).filter(Boolean);
  const seen = new Set<string>();
  const out: AuditTarget[] = [];
  for (const url of list) {
    const h = host(url);
    if (!h || !h.includes(".")) continue;
    const key = h + path(url);
    if (seen.has(key)) continue;
    seen.add(key);
    const soc = SOCIAL.find(([re]) => re.test(h));
    if (soc) out.push({ url, kind: "social", platform: soc[1], axes: ["gseo", "geo"] });
    else if (!path(url)) out.push({ url, kind: "official", platform: null, axes: [...AXES] });
    else out.push({ url, kind: "page", platform: null, axes: ["seo", "aeo", "geo", "sge"] });
  }
  return out.slice(0, 15);
}

/** Deep audit is mandatory whenever the account has at least one valid link. */
export function isDeepAuditRequired(links: unknown): boolean {
  return auditTargets(links).length > 0;
}

/** Axis priority weights per account kind (sum = 1). */
export function axisWeights(kind: AccountKind | null | undefined): Record<Axis, number> {
  const w: Record<string, Record<Axis, number>> = {
    product_company: { seo: 0.3, aeo: 0.3, geo: 0.15, sge: 0.1, gseo: 0.15 },
    marketing_company: { seo: 0.3, aeo: 0.3, geo: 0.15, sge: 0.1, gseo: 0.15 },
    agency_with_clients: { seo: 0.3, aeo: 0.3, geo: 0.15, sge: 0.1, gseo: 0.15 },
    news_agency: { seo: 0.15, aeo: 0.15, geo: 0.3, sge: 0.3, gseo: 0.1 },
    content_creator: { seo: 0.1, aeo: 0.15, geo: 0.2, sge: 0.1, gseo: 0.45 },
    public_figure: { seo: 0.1, aeo: 0.15, geo: 0.2, sge: 0.1, gseo: 0.45 },
    individual: { seo: 0.1, aeo: 0.15, geo: 0.2, sge: 0.1, gseo: 0.45 },
  };
  return w[kind || ""] || { seo: 0.2, aeo: 0.2, geo: 0.2, sge: 0.2, gseo: 0.2 };
}

/** Axes ordered by priority for this account kind. */
export function axisPriority(kind: AccountKind | null | undefined): Axis[] {
  const w = axisWeights(kind);
  return [...AXES].sort((a, b) => w[b] - w[a]);
}

/** Weighted overall score from measured axes only; unmeasured (null) axes are excluded, all-null -> null. */
export function weightedScore(scores: Partial<Record<Axis, number | null>>, kind: AccountKind | null | undefined): number | null {
  const w = axisWeights(kind);
  let sum = 0, wt = 0;
  for (const a of AXES) {
    const v = scores[a];
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    sum += v * w[a]; wt += w[a];
  }
  return wt > 0 ? Math.round(sum / wt) : null;
}
