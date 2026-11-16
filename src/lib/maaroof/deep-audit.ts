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
export type AxisFinding = { axis: Axis; score: number | null; verdict: "good" | "weak" | "missing" | "unmeasured"; evidence: string[]; evidence_refs: Array<{ source_url: string; signals: string[] }>; reason: string; next: string };

function words(s: string) { return s.split(/\s+/).filter(Boolean); }
const verdictOf = (s: number | null): AxisFinding["verdict"] => s == null ? "unmeasured" : s >= 70 ? "good" : s >= 40 ? "weak" : "missing";
const capped = (value: number, maximum: number) => Math.max(0, Math.min(maximum, value));

/**
 * Scores on-page readiness only. A page scrape cannot prove Google indexing,
 * organic ranking, citations, or actual AI-engine visibility. The deliberate
 * axis caps prevent a content heuristic from being presented as 100% visibility.
 */
export function scoreTarget(t: AuditTarget, ev: PageEvidence | null, brand: string): AxisFinding[] {
  const md = String(ev?.markdown || "").trim();
  const html = String(ev?.html || "");
  const title = String(ev?.title || "").trim();
  const desc = String(ev?.description || "").trim();
  const hasBody = md.length > 40;
  const hasMetadata = title.length >= 3 && desc.length >= 20;
  const combined = [title, desc, md].join("\n");
  const blocked = /(challenge_required|verify (?:that )?you(?:'re| are) human|sorry, this page isn't available|access denied)/i.test(combined);
  const loginShell = /(log in or sign up to view|sign in to view|log in to see|sign in to see)/i.test(combined);
  const statusOk = ev?.statusCode == null || (ev.statusCode >= 200 && ev.statusCode < 400);
  const has = statusOk && !blocked && !loginShell && (hasBody || hasMetadata);
  const normalizedBrand = brand.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const normalizeMatch = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const brandIn = (s: string) => !!normalizedBrand && normalizeMatch(s).includes(normalizedBrand);
  const bodyWords = words(md);
  const first = (hasBody ? bodyWords.slice(0, 150).join(" ") : [title, desc].filter(Boolean).join(" ")).trim();
  const firstFacts = (first.match(/\b\d[\d,.%]*/g) || []).length;
  const schemaBlocks = html.match(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) || [];
  const schemaText = schemaBlocks.join("\n");
  const hasOrgSchema = /"@type"\s*:\s*"(?:Organization|LocalBusiness|Store|Corporation)"/i.test(schemaText);
  const hasProductSchema = /"@type"\s*:\s*"(?:Product|Offer)"/i.test(schemaText);
  const hasFaqSchema = /"@type"\s*:\s*"FAQPage"/i.test(schemaText);
  const hasCanonical = /<link\b[^>]*rel\s*=\s*["']canonical["']/i.test(html);
  const hasRobots = /<meta\b[^>]*name\s*=\s*["']robots["']/i.test(html);
  const hasH1 = /^#\s/m.test(md) || /<h1\b/i.test(html);
  const hasH2 = /^#{2,3}\s/m.test(md) || /<h2\b/i.test(html);
  const hasCitedSource = /https?:\/\//i.test(md);
  const directAnswers = (md.match(/(?:^|\n)\s*(?:answer|الإجابة|الجواب)\s*[:：-]/gim) || []).length;
  const qaPairs = (md.match(/(?:^|\n)\s*(?:#{1,6}\s*)?[^\n?؟]{3,120}[?؟]\s*\n+[^#\n][^\n]{20,}/g) || []).length;
  const paragraphs = md.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const lead = paragraphs.find((p) => words(p).length >= 15) || "";
  const headings = (md.match(/^#{2,3}\s/gm) || []).length;
  const normalized = normalizeMatch(combined);

  return t.axes.map((axis): AxisFinding => {
    if (!has) return { axis, score: null, verdict: "unmeasured", evidence: [], evidence_refs: [], reason: ev?.statusCode && ev.statusCode >= 400 ? "http_error" : blocked ? "blocked_or_challenge" : "no_public_content", next: "retry_or_public" };
    if (!hasBody && ["aeo", "sge"].includes(axis)) {
      return { axis, score: null, verdict: "unmeasured", evidence: ["metadata_only"], evidence_refs: [{ source_url: t.url, signals: ["metadata_only"] }], reason: "insufficient_content_for_axis", next: "needs_full_page_content" };
    }
    const evidence: string[] = [];
    let raw = 0;
    if (axis === "seo") {
      if (title) { raw += 20; evidence.push("title_present"); }
      if (desc) { raw += 15; evidence.push("meta_description_present"); }
      if (hasH1) { raw += 15; evidence.push("h1_present"); }
      if (hasH2) { raw += 10; evidence.push("section_headings_present"); }
      if (hasCanonical) { raw += 10; evidence.push("canonical_present"); }
      if (hasRobots) { raw += 5; evidence.push("robots_directive_present"); }
      if (bodyWords.length >= 150) { raw += 10; evidence.push("substantive_body"); }
      if (t.kind === "commerce" || hasProductSchema) {
        if (hasProductSchema) { raw += 10; evidence.push("product_schema_present"); }
      }
      // Crawl and index status are not established by a page fetch.
    } else if (axis === "aeo") {
      if (directAnswers > 0) { raw += Math.min(30, directAnswers * 15); evidence.push("explicit_answer_blocks"); }
      if (qaPairs > 0) { raw += Math.min(25, qaPairs * 10); evidence.push("question_answer_pairs"); }
      if (hasFaqSchema) { raw += 15; evidence.push("faqpage_schema"); }
      if (/^#{1,3}\s.*(?:faq|frequently asked|الأسئلة الشائعة)/im.test(md)) { raw += 5; evidence.push("faq_section_heading"); }
      if (hasBody && bodyWords.length >= 250) { raw += 5; evidence.push("answer_context_depth"); }
    } else if (axis === "geo") {
      if (brandIn(first)) { raw += 20; evidence.push("brand_in_opening"); }
      if (firstFacts >= 2) { raw += 15; evidence.push(`verifiable_numeric_claims_first_150:${firstFacts}`); }
      if (hasOrgSchema) { raw += 20; evidence.push("organization_schema"); }
      if (hasProductSchema) { raw += 10; evidence.push("product_schema"); }
      if (/"sameAs"\s*:/i.test(schemaText)) { raw += 10; evidence.push("sameas_entity_links"); }
      if (hasCitedSource) { raw += 10; evidence.push("source_urls_in_content"); }
      if (desc) { raw += 5; evidence.push("descriptive_metadata"); }
    } else if (axis === "sge") {
      const leadWords = words(lead).length;
      if (leadWords >= 15 && leadWords <= 80) { raw += 25; evidence.push("concise_lead_15_80_words"); }
      if (headings >= 2) { raw += 20; evidence.push(`structured_sections:${headings}`); }
      if (/^\s*[-*]\s/m.test(md)) { raw += 10; evidence.push("structured_list"); }
      if (/^\|.+\|$/m.test(md)) { raw += 10; evidence.push("comparison_table"); }
      if (hasCitedSource) { raw += 10; evidence.push("source_urls_in_content"); }
      if (bodyWords.length >= 250) { raw += 5; evidence.push("supporting_context"); }
    } else {
      if (brandIn(title)) { raw += 20; evidence.push("brand_in_title"); }
      if (brandIn(desc)) { raw += 15; evidence.push("brand_in_description"); }
      if (brandIn(md)) { raw += 15; evidence.push("brand_in_body"); }
      if (hasOrgSchema) { raw += 10; evidence.push("organization_schema"); }
      if (/"sameAs"\s*:/i.test(schemaText)) { raw += 10; evidence.push("sameas_entity_links"); }
    }
    // Score = share of this axis's observable evidence points found on the page (no artificial ceiling).
    const axisMax = axis === "seo" ? (t.kind === "commerce" ? 95 : 85) : axis === "aeo" ? 80 : axis === "geo" ? 90 : axis === "sge" ? 80 : 70;
    const score = capped(Math.round((raw * 100) / axisMax), 100);
    const reason = evidence.length ? "measured_on_page_readiness_only" : "no_signal";
    return { axis, score, verdict: verdictOf(score), evidence, evidence_refs: evidence.length ? [{ source_url: t.url, signals: [...evidence] }] : [], reason, next: score >= 70 ? "keep_on_page_readiness" : `improve_${axis}` };
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
