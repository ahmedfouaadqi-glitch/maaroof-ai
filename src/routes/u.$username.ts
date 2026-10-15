import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { detectBot } from "@/lib/crawler-bots";
import { normalizeUrl } from "@/lib/entity-consistency";

/**
 * Public per-user page — readable by AI crawlers (GPTBot, PerplexityBot, etc.)
 * URL: https://maaroofai.com/u/{username}
 * - Returns crawler-friendly HTML + JSON-LD (Person/Organization).
 * - Lists all brand authority packs the user has published, linking to /api/public/brand/{slug}.
 * - Logs every crawler hit to `crawler_hits` so Propagation Tracker can show it.
 * - Only exposes safe public columns (username, full_name, brand_name, brand_keywords). No PII.
 */
export const Route = createFileRoute("/u/$username")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!SUPABASE_URL || !SERVICE) return new Response("internal_error", { status: 500 });

        const raw = String(params.username || "").toLowerCase().slice(0, 32);
        if (!raw || !/^[a-z0-9_-]{3,32}$/.test(raw)) {
          return new Response("not found", { status: 404 });
        }

        const admin = createClient(SUPABASE_URL, SERVICE);
        const { data: profile } = await admin
          .from("profiles")
          .select("id, username, full_name, brand_name, brand_keywords, entity_type, hq_country, target_markets, specialty_scope, entity_links, entity_updated_at")
          .eq("username", raw)
          .maybeSingle();

        if (!profile) return new Response("user not found", { status: 404 });

        const { data: packs } = await admin
          .from("brand_authority_packs")
          .select("brand_slug, brand_name, summary, updated_at")
          .eq("user_id", (profile as any).id)
          .order("updated_at", { ascending: false })
          .limit(50);

        const { data: history } = await admin
          .from("entity_history")
          .select("field, old_value, changed_at")
          .eq("user_id", (profile as any).id)
          .order("changed_at", { ascending: false })
          .limit(10);

        // Log crawler hit (non-blocking)
        const ua = request.headers.get("user-agent") || "";
        const bot = detectBot(ua);
        const url = new URL(request.url);
        const ipRaw =
          request.headers.get("cf-connecting-ip") ||
          request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
          "";
        let ipHash = "";
        if (ipRaw) {
          try {
            const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ipRaw));
            ipHash = Array.from(new Uint8Array(buf)).slice(0, 8).map((b) => b.toString(16).padStart(2, "0")).join("");
          } catch {}
        }
        admin.from("crawler_hits").insert({
          brand_slug: `u:${raw}`,
          user_id: (profile as any).id,
          user_agent: ua.slice(0, 500),
          bot_name: bot,
          path: url.pathname,
          ip_hash: ipHash,
        }).then(() => {}, () => {});

        const displayName = String((profile as any).full_name || (profile as any).brand_name || raw);
        const brand = String((profile as any).brand_name || "");
        const kw = String((profile as any).brand_keywords || "");
        const canonical = `${url.origin}${url.pathname}`;

        const jsonLd: any = {
          "@context": "https://schema.org",
          "@type": ["person","individual","creator"].includes((profile as any).entity_type) ? "Person" : (profile as any).entity_type === "organization" ? "Organization" : (brand ? "Organization" : "Person"),
          name: brand || displayName,
          url: canonical,
          identifier: raw,
        };
        if (kw) jsonLd.knowsAbout = kw.split(/[,،]/).map((s) => s.trim()).filter(Boolean).slice(0, 20);
        if (brand && displayName && brand !== displayName) jsonLd.alternateName = displayName;
        const P: any = profile;
        const sameAs: string[] = (Array.isArray(P.entity_links) ? P.entity_links : []).map((x: any) => normalizeUrl(String(x))).filter(Boolean).slice(0, 10) as string[];
        const markets: string[] = Array.isArray(P.target_markets) ? P.target_markets.map(String) : [];
        const hq = P.hq_country ? String(P.hq_country) : "";
        const scopeTxt = P.specialty_scope ? String(P.specialty_scope) : "";
        if (sameAs.length) jsonLd.sameAs = sameAs;
        if (scopeTxt) jsonLd.description = scopeTxt;
        if (hq) jsonLd[jsonLd["@type"] === "Person" ? "homeLocation" : "address"] = jsonLd["@type"] === "Person" ? { "@type": "Place", address: { "@type": "PostalAddress", addressCountry: hq } } : { "@type": "PostalAddress", addressCountry: hq };
        if (markets.length) jsonLd.areaServed = markets.map((c) => ({ "@type": "Country", name: c }));
        const updatedAt = P.entity_updated_at ? String(P.entity_updated_at) : "";
        if (updatedAt) jsonLd.dateModified = updatedAt;
        const fieldLabel: Record<string, string> = { entity_type: "Type", hq_country: "HQ", target_markets: "Markets", specialty_scope: "Specialty", entity_links: "Links" };
        const fmtVal = (v: any) => v == null || (Array.isArray(v) && !v.length) || v === "" ? "—" : Array.isArray(v) ? v.join(", ") : String(v);
        const historyHtml = (history && history.length)
          ? `<section><h2>Previous information</h2><ul>${history.map((h: any) => `<li>${escapeHtml(fieldLabel[h.field] || h.field)}: ${escapeHtml(fmtVal(h.old_value))} <small>(changed ${escapeHtml(String(h.changed_at).slice(0, 10))})</small></li>`).join("")}</ul></section>`
          : "";
        const identityHtml = (updatedAt ? `<p><small>Last updated: <time datetime="${escapeHtml(updatedAt)}">${escapeHtml(updatedAt.slice(0, 10))}</time></small></p>` : "") + `${scopeTxt ? `<p>${escapeHtml(scopeTxt)}</p>` : ""}${hq ? `<p>HQ: ${escapeHtml(hq)}</p>` : ""}${markets.length ? `<p>Markets: ${escapeHtml(markets.join(", "))}</p>` : ""}${sameAs.length ? `<ul>${sameAs.map((l) => `<li><a href="${escapeHtml(l)}" rel="me noopener">${escapeHtml(l)}</a></li>`).join("")}</ul>` : ""}`;

        const packsHtml = (packs && packs.length > 0)
          ? `<section><h2>Brand Authority Cards</h2><ul>${packs.map((p: any) => {
              const href = `${url.origin}/api/public/brand/${escapeHtml(p.brand_slug)}`;
              return `<li><a href="${href}" rel="noopener"><strong>${escapeHtml(p.brand_name || p.brand_slug)}</strong></a>${p.summary ? ` — ${escapeHtml(String(p.summary).slice(0, 200))}` : ""}</li>`;
            }).join("")}</ul></section>`
          : "";

        const baseDescription = brand
          ? `${displayName} — ${brand}${kw ? ` (${kw})` : ""}`.slice(0, 280)
          : `${displayName} on MAAROOF Ai.`.slice(0, 280);
        const description = scopeTxt ? `${baseDescription} — ${scopeTxt}`.slice(0, 280) : baseDescription;

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(displayName)} — MAAROOF Ai</title>
<meta name="description" content="${escapeHtml(description)}" />
${kw ? `<meta name="keywords" content="${escapeHtml(kw)}" />` : ""}
<meta name="robots" content="index,follow" />
<meta property="og:title" content="${escapeHtml(displayName)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:url" content="${escapeHtml(canonical)}" />
<meta property="og:type" content="profile" />
<link rel="canonical" href="${escapeHtml(canonical)}" />
<script type="application/ld+json">${safeJsonLd(jsonLd)}</script>
</head>
<body>
<header>
<h1>${escapeHtml(displayName)}</h1>
${brand ? `<p><strong>${escapeHtml(brand)}</strong></p>` : ""}
${kw ? `<p>${escapeHtml(kw)}</p>` : ""}
${identityHtml}
</header>
<main>
${packsHtml}
${historyHtml}
</main>
<footer><small>Public profile on <a href="${escapeHtml(url.origin)}/" rel="noopener">MAAROOF Ai</a></small></footer>
</body>
</html>`;

        return new Response(html, {
          status: 200,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "public, max-age=30, s-maxage=60",
            "X-Robots-Tag": "index, follow",
            "Access-Control-Allow-Origin": "*",
          },
        });
      },
    },
  },
});

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function safeJsonLd(obj: unknown): string {
  return JSON.stringify(obj)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}
