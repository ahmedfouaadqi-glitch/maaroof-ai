// Deep account audit — pure rules (no I/O). Decides what must be audited and how,
// per link kind and account kind, across SEO / AEO / GEO / SGE / GSEO. Never invents results.
import type { AccountKind } from "@/lib/account-kinds";

export type Axis = "seo" | "aeo" | "geo" | "sge" | "gseo";
export const AXES: Axis[] = ["seo", "aeo", "geo", "sge", "gseo"];
export type TargetKind = "official" | "social" | "page";
export type AuditTarget = { url: string; kind: TargetKind; platform: string | null; axes: Axis[] };

/** Extract URLs from one workspace's identity only; never borrow the owner's profile links. */
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
  const urls = candidates.map((item) => {
    if (typeof item === "string") return item.trim();
    if (item && typeof item === "object") {
      const row = item as Record<string, unknown>;
      const value = row.url ?? row.href ?? row.link;
      return typeof value === "string" ? value.trim() : "";
    }
    return "";
  }).filter(Boolean);
  return [...new Set(urls)].slice(0, 15);
}

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
