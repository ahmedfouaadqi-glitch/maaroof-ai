// Deep account audit — pure rules (no I/O). Decides what must be audited and how,
// per link kind and account kind, across SEO / AEO / GEO / SGE / GSEO. Never invents results.
import type { AccountKind } from "@/lib/account-kinds";

export type Axis = "seo" | "aeo" | "geo" | "sge" | "gseo";
export const AXES: Axis[] = ["seo", "aeo", "geo", "sge", "gseo"];
export const MAX_AUDIT_TARGETS = 50;
export type TargetKind = "official" | "social" | "page" | "directory" | "commerce" | "app_store";
export type AuditTarget = { url: string; kind: TargetKind; platform: string | null; axes: Axis[] };

/** Normalize public web URLs. Invalid URLs and non-HTTP(S) schemes are deliberately ignored. */
function normalizeAuditUrl(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!["http:", "https:"].includes(u.protocol) || !u.hostname.includes(".") || u.username || u.password) return null;
    u.hostname = u.hostname.toLowerCase().replace(/^www\./i, "");
    u.hash = "";
    const pathname = u.pathname.replace(/\/+$/, "");
    return `${u.protocol}//${u.host}${pathname}${u.search}`;
  } catch {
    return null;
  }
}

/** Extract URLs only from the selected workspace identity; never borrow owner-wide profile links. */
export function workspaceAuditLinks(workspace: unknown): string[] {
  if (!workspace || typeof workspace !== "object") return [];
  const w = workspace as Record<string, any>;
  const card = w.entity_truth_card && typeof w.entity_truth_card === "object" ? w.entity_truth_card as Record<string, any> : {};
  const profile = w.profile && typeof w.profile === "object" ? w.profile as Record<string, any> : {};
  const candidates: unknown[] = [
    ...(Array.isArray(card.links) ? card.links : []),
    ...(Array.isArray(card.social_links) ? card.social_links : []),
    ...(Array.isArray(profile.entity_links) ? profile.entity_links : []),
    ...(Array.isArray(profile.links) ? profile.links : []),
    ...(Array.isArray(profile.social_links) ? profile.social_links : []),
    card.website_url,
    profile.website_url,
    w.brand_url,
  ];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of candidates) {
    const raw = typeof item === "string" ? item.trim() : item && typeof item === "object"
      ? String((item as Record<string, unknown>).url ?? (item as Record<string, unknown>).href ?? (item as Record<string, unknown>).link ?? "").trim()
      : "";
    const url = normalizeAuditUrl(raw);
    if (!url || seen.has(url.toLowerCase())) continue;
    seen.add(url.toLowerCase());
    out.push(url);
    if (out.length >= MAX_AUDIT_TARGETS) break;
  }
  return out;
}

type PlatformRule = { pattern: RegExp; platform: string; axes: Axis[] };

// Social/profile sources are routed to axes they can meaningfully inform, not technical site checks.
const SOCIAL: PlatformRule[] = [
  { pattern: /(^|\.)linkedin\.com$/i, platform: "linkedin", axes: ["geo", "gseo", "aeo"] },
  { pattern: /(^|\.)(x\.com|twitter\.com)$/i, platform: "x", axes: ["geo", "gseo", "sge"] },
  { pattern: /(^|\.)instagram\.com$/i, platform: "instagram", axes: ["geo", "gseo", "sge"] },
  { pattern: /(^|\.)(facebook\.com|fb\.com)$/i, platform: "facebook", axes: ["geo", "gseo", "aeo"] },
  { pattern: /(^|\.)(youtube\.com|youtu\.be)$/i, platform: "youtube", axes: ["geo", "gseo", "sge", "aeo"] },
  { pattern: /(^|\.)tiktok\.com$/i, platform: "tiktok", axes: ["geo", "gseo", "sge", "aeo"] },
  { pattern: /(^|\.)(t\.me|telegram\.me|telegram\.org)$/i, platform: "telegram", axes: ["geo", "gseo"] },
  { pattern: /(^|\.)snapchat\.com$/i, platform: "snapchat", axes: ["geo", "gseo", "sge"] },
  { pattern: /(^|\.)threads\.net$/i, platform: "threads", axes: ["geo", "gseo", "sge"] },
  { pattern: /(^|\.)pinterest\.com$/i, platform: "pinterest", axes: ["geo", "gseo", "sge", "aeo"] },
  { pattern: /(^|\.)reddit\.com$/i, platform: "reddit", axes: ["geo", "gseo", "sge", "aeo"] },
  { pattern: /(^|\.)(discord\.com|discord\.gg)$/i, platform: "discord", axes: ["geo", "gseo", "aeo"] },
  { pattern: /(^|\.)vimeo\.com$/i, platform: "vimeo", axes: ["geo", "gseo", "sge", "aeo"] },
  { pattern: /(^|\.)dailymotion\.com$/i, platform: "dailymotion", axes: ["geo", "gseo", "sge", "aeo"] },
];

const DIRECTORY_HOST = /(^|\.)(yelp\.com|trustpilot\.com|tripadvisor\.[a-z.]+|clutch\.co|g2\.com|capterra\.com|goodfirms\.co|yellowpages\.[a-z.]+|foursquare\.com|mapquest\.com)$/i;
const COMMERCE_HOST = /(^|\.)(amazon\.[a-z.]+|ebay\.[a-z.]+|etsy\.com|walmart\.com|myshopify\.com)$/i;

function host(u: string): string | null {
  try { return new URL(u).hostname.toLowerCase().replace(/^www\./, ""); } catch { return null; }
}
function path(u: string): string {
  try { return new URL(u).pathname.replace(/\/+$/, ""); } catch { return ""; }
}

/** Classify each source and route it only to useful axes. Dedupes normalized URLs and caps the work. */
export function auditTargets(links: unknown): AuditTarget[] {
  const list = (Array.isArray(links) ? links : []).map((s) => typeof s === "string" ? s : String(s || "")).filter(Boolean);
  const seen = new Set<string>();
  const out: AuditTarget[] = [];
  for (const raw of list) {
    const url = normalizeAuditUrl(raw);
    if (!url) continue;
    const key = url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const h = host(url);
    if (!h) continue;
    const p = path(url);
    const social = SOCIAL.find((rule) => rule.pattern.test(h));
    if (social) {
      out.push({ url, kind: "social", platform: social.platform, axes: [...social.axes] });
    } else if (h === "maps.google.com" || (h === "google.com" && /^\/maps(?:\/|$)/i.test(p)) || (h.startsWith("google.") && /^\/maps(?:\/|$)/i.test(p)) || DIRECTORY_HOST.test(h)) {
      out.push({ url, kind: "directory", platform: h.includes("google.") || h === "maps.google.com" ? "google_maps" : h, axes: ["geo", "gseo", "aeo"] });
    } else if ((h === "apps.apple.com" && /^\/[^/]+\/app\//i.test(p)) || (h === "play.google.com" && /^\/store\/apps(?:\/|$)/i.test(p))) {
      out.push({ url, kind: "app_store", platform: h === "apps.apple.com" ? "apple_app_store" : "google_play", axes: ["seo", "aeo", "geo", "gseo"] });
    } else if (COMMERCE_HOST.test(h)) {
      out.push({ url, kind: "commerce", platform: h, axes: ["seo", "aeo", "geo", "sge", "gseo"] });
    } else if (!p) {
      out.push({ url, kind: "official", platform: null, axes: [...AXES] });
    } else {
      out.push({ url, kind: "page", platform: null, axes: ["seo", "aeo", "geo", "sge"] });
    }
    if (out.length >= MAX_AUDIT_TARGETS) break;
  }
  return out;
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

// ---------- Evidence-based scoring (pure). Input is real fetched page content only. ----------
export type PageEvidence = { markdown?: string | null; title?: string | null; description?: string | null; html?: string | null; statusCode?: number | null };
export type AxisFinding = { axis: Axis; score: number | null; verdict: "good" | "weak" | "missing" | "unmeasured"; evidence: string[]; reason: string; next: string };

function words(s: string) { return s.split(/\s+/).filter(Boolean); }
const verdictOf = (s: number | null): AxisFinding["verdict"] => s == null ? "unmeasured" : s >= 70 ? "good" : s >= 40 ? "weak" : "missing";

/** Scores only axes this target requires, using only signals present in the evidence. No content -> every axis unmeasured. */
export function scoreTarget(t: AuditTarget, ev: PageEvidence | null, brand: string): AxisFinding[] {
  const md = String(ev?.markdown || "");
  const html = String(ev?.html || "");
  const title = String(ev?.title || "");
  const desc = String(ev?.description || "");
  const has = md.trim().length > 40;
  const b = brand.trim().toLowerCase();
  return t.axes.map((axis): AxisFinding => {
    if (!has) return { axis, score: null, verdict: "unmeasured", evidence: [], reason: "no_content", next: "retry_or_public" };
    const ev2: string[] = [];
    let s = 0;
    const first = words(md).slice(0, 150).join(" ");
    const facts = (first.match(/\d[\d.,%]*/g) || []).length;
    const brandIn = (x: string) => !!b && x.toLowerCase().includes(b);
    if (axis === "seo") {
      if (title) { s += 30; ev2.push(`title:${title.slice(0, 80)}`); }
      if (desc) { s += 30; ev2.push(`description:${desc.slice(0, 80)}`); }
      if (/^#\s/m.test(md)) { s += 20; ev2.push("h1"); }
      if (words(md).length > 300) { s += 20; ev2.push(`words:${words(md).length}`); }
    } else if (axis === "aeo") {
      const q = (md.match(/[?؟]/g) || []).length;
      if (q >= 3) { s += 40; ev2.push(`questions:${q}`); } else if (q) s += 15;
      if (/faq|الأسئلة|پرسیار/i.test(md + html)) { s += 30; ev2.push("faq"); }
      if (/^\s*[-*]\s/m.test(md)) { s += 30; ev2.push("lists"); }
    } else if (axis === "geo") {
      s += Math.min(50, facts * 10); if (facts) ev2.push(`facts_first_150:${facts}`);
      if (brandIn(first)) { s += 30; ev2.push("brand_in_opening"); }
      if (/application\/ld\+json|schema\.org/i.test(html)) { s += 20; ev2.push("structured_data"); }
    } else if (axis === "sge") {
      const fp = md.split(/\n{2,}/).find((p) => words(p).length > 15) || "";
      if (fp && words(fp).length <= 80) { s += 50; ev2.push("concise_lead"); } else if (fp) s += 20;
      if ((md.match(/^#{2,3}\s/gm) || []).length >= 2) { s += 50; ev2.push("sections"); }
    } else {
      if (brandIn(title) || brandIn(desc)) { s += 50; ev2.push("brand_in_profile"); }
      if (brandIn(md)) { s += 30; ev2.push("brand_mentioned"); }
      if (desc) { s += 20; ev2.push("bio"); }
    }
    s = Math.min(100, s);
    return { axis, score: s, verdict: verdictOf(s), evidence: ev2, reason: ev2.length ? "measured" : "no_signal", next: s >= 70 ? "keep" : `improve_${axis}` };
  });
}

/** Mean per axis across measured targets only. */
export function aggregateAxes(findings: AxisFinding[][]): Partial<Record<Axis, number | null>> {
  const out: Partial<Record<Axis, number | null>> = {};
  for (const a of AXES) {
    const vals = findings.flat().filter((f) => f.axis === a && typeof f.score === "number").map((f) => f.score as number);
    out[a] = vals.length ? Math.round(vals.reduce((x, y) => x + y, 0) / vals.length) : null;
  }
  return out;
}

/** Charge only for targets that produced content. Zero succeeded -> no charge. */
export function billableUnits(results: { ok: boolean }[]): number {
  return results.filter((r) => r.ok).length;
}
