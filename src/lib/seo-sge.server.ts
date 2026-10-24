// Analyze a scraped page for SEO health and SGE (Search Generative Experience) readiness.
// Returns deterministic, evidence-based scores (no LLM, no randomness).

export type SeoSgeReport = {
  url: string;
  seo_score: number;          // 0-100
  sge_score: number;          // 0-100
  signals: {
    has_title: boolean;
    title_length_ok: boolean;
    has_meta_description: boolean;
    description_length_ok: boolean;
    has_h1: boolean;
    has_canonical: boolean;
    has_lang: boolean;
    has_viewport: boolean;
    has_og: boolean;
    has_twitter: boolean;
    has_favicon: boolean;
    has_jsonld: boolean;
    jsonld_types: string[];
    has_faq_schema: boolean;
    has_article_schema: boolean;
    has_org_schema: boolean;
    word_count: number;
    h2_count: number;
    h3_count: number;
    internal_links: number;
    external_links: number;
    image_count: number;
    images_with_alt: number;
  };
  issues: string[];           // prioritized fixes (in REPORT language is up to caller; we keep keys)
  platform_tips: Record<string, string>; // one short tip per AI platform
};

function getStr(html: string, regex: RegExp): string | null {
  const m = html.match(regex);
  return m ? (m[1] || "").trim() : null;
}

function countMatches(html: string, regex: RegExp): number {
  const m = html.match(regex);
  return m ? m.length : 0;
}

export function analyzeSeoSge(input: {
  url: string;
  html?: string;
  markdown?: string;
  links?: string[];
  metadata?: any;
}): SeoSgeReport {
  const html = String(input.html || "");
  const markdown = String(input.markdown || "");
  const meta = input.metadata || {};
  const links = Array.isArray(input.links) ? input.links : [];

  // Title / description
  const title = String(meta.title || getStr(html, /<title[^>]*>([^<]+)<\/title>/i) || "").trim();
  const description = String(
    meta.description ||
      getStr(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
      ""
  ).trim();

  const has_title = title.length > 0;
  const title_length_ok = title.length >= 20 && title.length <= 70;
  const has_meta_description = description.length > 0;
  const description_length_ok = description.length >= 70 && description.length <= 170;

  // Headings
  const h1_count = countMatches(html, /<h1\b/gi);
  const h2_count = countMatches(html, /<h2\b/gi);
  const h3_count = countMatches(html, /<h3\b/gi);
  const has_h1 = h1_count > 0;

  // Document head signals
  const has_canonical = /<link[^>]+rel=["']canonical["']/i.test(html);
  const has_lang = /<html[^>]+lang=/i.test(html);
  const has_viewport = /<meta[^>]+name=["']viewport["']/i.test(html);
  const has_og = /<meta[^>]+property=["']og:(title|description|image)/i.test(html);
  const has_twitter = /<meta[^>]+name=["']twitter:(card|title)/i.test(html);
  const has_favicon = /<link[^>]+rel=["'](?:shortcut )?icon["']/i.test(html);

  // JSON-LD schema.org
  const jsonldBlocks = Array.from(
    html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  ).map((m) => m[1]);
  const jsonld_types: string[] = [];
  for (const raw of jsonldBlocks) {
    try {
      const parsed = JSON.parse(raw.trim());
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const it of items) {
        const types = Array.isArray(it["@type"]) ? it["@type"] : [it["@type"]];
        for (const t of types) if (t) jsonld_types.push(String(t));
        // @graph
        if (Array.isArray(it["@graph"])) {
          for (const g of it["@graph"]) {
            const gt = Array.isArray(g?.["@type"]) ? g["@type"] : [g?.["@type"]];
            for (const t of gt) if (t) jsonld_types.push(String(t));
          }
        }
      }
    } catch {
      /* ignore malformed */
    }
  }
  const typesLower = jsonld_types.map((s) => s.toLowerCase());
  const has_jsonld = jsonld_types.length > 0;
  const has_faq_schema = typesLower.some((t) => t.includes("faqpage") || t.includes("question"));
  const has_article_schema = typesLower.some((t) =>
    ["article", "newsarticle", "blogposting"].some((k) => t.includes(k))
  );
  const has_org_schema = typesLower.some((t) =>
    ["organization", "localbusiness", "corporation"].some((k) => t.includes(k))
  );

  // Content depth
  const word_count = markdown
    ? markdown.split(/\s+/).filter(Boolean).length
    : html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;

  // Links
  let internal_links = 0;
  let external_links = 0;
  try {
    const host = new URL(input.url).hostname.replace(/^www\./, "");
    for (const l of links) {
      try {
        const h = new URL(l).hostname.replace(/^www\./, "");
        if (h === host) internal_links++;
        else external_links++;
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }

  // Images & alt
  const imgTags = html.match(/<img\b[^>]*>/gi) || [];
  const image_count = imgTags.length;
  const images_with_alt = imgTags.filter((t) => /\balt=["'][^"']+["']/i.test(t)).length;

  // ---- Scoring ----
  let seo = 0;
  if (has_title) seo += 10;
  if (title_length_ok) seo += 5;
  if (has_meta_description) seo += 10;
  if (description_length_ok) seo += 5;
  if (has_h1) seo += 10;
  if (has_canonical) seo += 8;
  if (has_lang) seo += 5;
  if (has_viewport) seo += 5;
  if (has_og) seo += 8;
  if (has_twitter) seo += 4;
  if (has_favicon) seo += 3;
  if (word_count >= 300) seo += 8;
  if (word_count >= 800) seo += 4;
  if (h2_count >= 2) seo += 5;
  if (image_count > 0 && images_with_alt / Math.max(1, image_count) >= 0.7) seo += 5;
  if (internal_links >= 5) seo += 5;
  seo = Math.min(100, Math.max(0, seo));

  let sge = 0;
  if (has_jsonld) sge += 15;
  if (has_org_schema) sge += 15;
  if (has_article_schema) sge += 10;
  if (has_faq_schema) sge += 15;
  if (word_count >= 600) sge += 10;
  if (word_count >= 1200) sge += 5;
  if (h2_count + h3_count >= 4) sge += 10;
  if (has_og) sge += 5;
  if (external_links >= 3) sge += 5;        // citing external sources helps SGE
  if (internal_links >= 5) sge += 5;
  if (has_lang) sge += 5;
  sge = Math.min(100, Math.max(0, sge));

  // ---- Issues (highest-impact first) ----
  const issues: string[] = [];
  if (!has_title) issues.push("missing_title");
  else if (!title_length_ok) issues.push("title_length");
  if (!has_meta_description) issues.push("missing_description");
  else if (!description_length_ok) issues.push("description_length");
  if (!has_h1) issues.push("missing_h1");
  if (!has_og) issues.push("missing_og");
  if (!has_canonical) issues.push("missing_canonical");
  if (!has_jsonld) issues.push("missing_jsonld");
  if (!has_org_schema) issues.push("missing_org_schema");
  if (!has_faq_schema) issues.push("missing_faq_schema");
  if (word_count < 300) issues.push("thin_content");
  if (image_count > 0 && images_with_alt / Math.max(1, image_count) < 0.5) issues.push("missing_alt");
  if (internal_links < 5) issues.push("few_internal_links");
  if (!has_lang) issues.push("missing_lang");
  if (!has_viewport) issues.push("missing_viewport");
  if (!has_favicon) issues.push("missing_favicon");

  // ---- Per-platform tips (mapped to each engine's bias) ----
  const platform_tips: Record<string, string> = {
    chatgpt: !has_og
      ? "platform_tip_chatgpt_og"
      : word_count < 800
      ? "platform_tip_chatgpt_depth"
      : "platform_tip_chatgpt_news",
    gemini: !has_jsonld
      ? "platform_tip_gemini_schema"
      : !has_org_schema
      ? "platform_tip_gemini_org"
      : "platform_tip_gemini_gbp",
    claude: word_count < 1200
      ? "platform_tip_claude_longform"
      : external_links < 3
      ? "platform_tip_claude_sources"
      : "platform_tip_claude_authority",
    perplexity: !has_article_schema
      ? "platform_tip_perplexity_article"
      : external_links < 5
      ? "platform_tip_perplexity_citations"
      : "platform_tip_perplexity_freshness",
    copilot: "platform_tip_copilot_linkedin",
    grok: "platform_tip_grok_x",
    mistral: !has_lang ? "platform_tip_mistral_lang" : "platform_tip_mistral_multilingual",
    deepseek: !has_jsonld ? "platform_tip_deepseek_structured" : "platform_tip_deepseek_technical",
  };

  return {
    url: input.url,
    seo_score: seo,
    sge_score: sge,
    signals: {
      has_title,
      title_length_ok,
      has_meta_description,
      description_length_ok,
      has_h1,
      has_canonical,
      has_lang,
      has_viewport,
      has_og,
      has_twitter,
      has_favicon,
      has_jsonld,
      jsonld_types,
      has_faq_schema,
      has_article_schema,
      has_org_schema,
      word_count,
      h2_count,
      h3_count,
      internal_links,
      external_links,
      image_count,
      images_with_alt,
    },
    issues,
    platform_tips,
  };
}

// Derive REAL per-platform presence scores (0-100) from web evidence + on-site signals.
// Returns the same 8 keys used in the UI.
export function derivePlatformPresence(args: {
  evidenceByKind: Record<string, number>;  // counts of sources by `kind` for this brand
  totalEvidence: number;                    // total sources for this brand
  seo?: SeoSgeReport | null;
}): Record<string, number> {
  const ev = args.evidenceByKind || {};
  const total = Math.max(1, args.totalEvidence);
  const s = args.seo?.signals;

  // Base from share of evidence (40 floor when there are sources, else 5)
  const base = Math.round(15 + Math.min(50, (total / 8) * 50)); // more sources = higher base, capped

  const news = ev.news || 0;
  const reviews = ev.reviews || 0;
  const official = ev.official || 0;
  const geo = ev.geo || 0;
  const general = ev.general || 0;

  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

  // Weighted per engine
  const chatgpt = clamp(
    base +
      news * 4 +
      official * 3 +
      (s?.has_og ? 6 : -4) +
      (s && s.word_count >= 800 ? 4 : 0)
  );
  const gemini = clamp(
    base +
      official * 4 +
      reviews * 3 +
      geo * 3 +
      (s?.has_jsonld ? 10 : -6) +
      (s?.has_org_schema ? 6 : 0)
  );
  const claude = clamp(
    base +
      official * 2 +
      news * 2 +
      (s && s.word_count >= 1200 ? 8 : -4) +
      (s && s.external_links >= 3 ? 4 : 0)
  );
  const perplexity = clamp(
    base +
      news * 5 +
      reviews * 3 +
      (s?.has_article_schema ? 6 : 0) +
      (s && s.external_links >= 5 ? 4 : 0)
  );
  const copilot = clamp(base + news * 2 + official * 2 + general * 1);
  const grok = clamp(base + news * 3 + reviews * 2 - 5);
  const mistral = clamp(
    base + general * 2 + (s?.has_lang ? 5 : -3) + official * 2
  );
  const deepseek = clamp(
    base + (s?.has_jsonld ? 6 : -2) + (s && s.h2_count + s.h3_count >= 4 ? 4 : 0) + official * 2
  );

  return { chatgpt, gemini, claude, perplexity, copilot, grok, mistral, deepseek };
}

// Derive REAL strengths/weaknesses from gathered signals.
// Returns i18n keys (prefixed `sw_`) so the UI can localize.
export function deriveStrengthsWeaknesses(args: {
  seo?: SeoSgeReport | null;
  evidenceByKind?: Record<string, number>;
  totalEvidence?: number;
  hasOfficialSite?: boolean;
  platformMeasured?: { gemini?: number | null; chatgpt?: number | null };
}): { strengths: string[]; weaknesses: string[] } {
  const s = args.seo?.signals;
  const ev = args.evidenceByKind || {};
  const total = args.totalEvidence || 0;
  const pm = args.platformMeasured || {};

  type Item = { key: string; weight: number };
  const strong: Item[] = [];
  const weak: Item[] = [];

  // Official site
  if (args.hasOfficialSite) strong.push({ key: "sw_strong_official_site", weight: 9 });
  else weak.push({ key: "sw_weak_no_official_site", weight: 10 });

  if (s) {
    // Structured data
    if (s.has_jsonld && s.has_org_schema) strong.push({ key: "sw_strong_schema", weight: 9 });
    else if (!s.has_jsonld) weak.push({ key: "sw_weak_no_jsonld", weight: 9 });
    else if (!s.has_org_schema) weak.push({ key: "sw_weak_no_org_schema", weight: 7 });

    if (s.has_faq_schema) strong.push({ key: "sw_strong_faq_schema", weight: 7 });
    else weak.push({ key: "sw_weak_no_faq_schema", weight: 6 });

    if (s.has_article_schema) strong.push({ key: "sw_strong_article_schema", weight: 5 });

    // Content depth
    if (s.word_count >= 1200) strong.push({ key: "sw_strong_deep_content", weight: 8 });
    else if (s.word_count >= 800) strong.push({ key: "sw_strong_good_content", weight: 6 });
    else if (s.word_count < 300) weak.push({ key: "sw_weak_thin_content", weight: 9 });

    // OG / Twitter
    if (s.has_og && s.has_twitter) strong.push({ key: "sw_strong_social_meta", weight: 5 });
    else if (!s.has_og) weak.push({ key: "sw_weak_no_og", weight: 7 });

    // Alt text
    if (s.image_count > 0) {
      const altRatio = s.images_with_alt / s.image_count;
      if (altRatio >= 0.7) strong.push({ key: "sw_strong_alt", weight: 4 });
      else if (altRatio < 0.4) weak.push({ key: "sw_weak_alt", weight: 5 });
    }

    // Links
    if (s.internal_links >= 10) strong.push({ key: "sw_strong_internal_links", weight: 4 });
    else if (s.internal_links < 3) weak.push({ key: "sw_weak_internal_links", weight: 5 });

    if (s.external_links >= 5) strong.push({ key: "sw_strong_external_citations", weight: 5 });
    else if (s.external_links < 2) weak.push({ key: "sw_weak_no_citations", weight: 5 });

    // Technical
    if (s.has_canonical && s.has_lang && s.has_viewport) strong.push({ key: "sw_strong_tech_basics", weight: 4 });
    else {
      if (!s.has_canonical) weak.push({ key: "sw_weak_no_canonical", weight: 4 });
      if (!s.has_lang) weak.push({ key: "sw_weak_no_lang", weight: 3 });
    }

    if (!s.has_h1) weak.push({ key: "sw_weak_no_h1", weight: 6 });
  }

  // Evidence signals (Firecrawl)
  if ((ev.news || 0) >= 3) strong.push({ key: "sw_strong_news", weight: 8 });
  else if ((ev.news || 0) === 0 && total > 0) weak.push({ key: "sw_weak_no_news", weight: 7 });

  if ((ev.reviews || 0) >= 3) strong.push({ key: "sw_strong_reviews", weight: 7 });
  else if ((ev.reviews || 0) === 0 && total > 0) weak.push({ key: "sw_weak_no_reviews", weight: 6 });

  if ((ev.geo || 0) >= 2) strong.push({ key: "sw_strong_geo", weight: 7 });
  else if ((ev.geo || 0) === 0 && total > 0) weak.push({ key: "sw_weak_no_geo", weight: 6 });

  if (total === 0) weak.push({ key: "sw_weak_no_evidence", weight: 10 });

  // Measured platforms
  if (typeof pm.gemini === "number") {
    if (pm.gemini >= 60) strong.push({ key: "sw_strong_gemini_recall", weight: 8 });
    else if (pm.gemini <= 20) weak.push({ key: "sw_weak_gemini_recall", weight: 8 });
  }
  if (typeof pm.chatgpt === "number") {
    if (pm.chatgpt >= 60) strong.push({ key: "sw_strong_chatgpt_recall", weight: 8 });
    else if (pm.chatgpt <= 20) weak.push({ key: "sw_weak_chatgpt_recall", weight: 8 });
  }

  const pick = (arr: Item[]) =>
    arr.sort((a, b) => b.weight - a.weight).slice(0, 4).map((x) => x.key);

  return { strengths: pick(strong), weaknesses: pick(weak) };
}

