import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { detectBot } from "@/lib/crawler-bots";

/**
 * Public per-user page — readable by AI crawlers (GPTBot, PerplexityBot, etc.)
 * URL: https://geoiraq.com/u/{username}
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
          .select("id, username, full_name, brand_name, brand_keywords")
          .eq("username", raw)
          .maybeSingle();

        if (!profile) return new Response("user not found", { status: 404 });

        const { data: packs } = await admin
          .from("brand_authority_packs")
          .select("brand_slug, brand_name, summary, updated_at")
          .eq("user_id", (profile as any).id)
          .order("updated_at", { ascending: false })
          .limit(50);

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
          "@type": brand ? "Organization" : "Person",
          name: brand || displayName,
          url: canonical,
          identifier: raw,
        };
        if (kw) jsonLd.knowsAbout = kw.split(/[,،]/).map((s) => s.trim()).filter(Boolean).slice(0, 20);
        if (brand && displayName && brand !== displayName) jsonLd.alternateName = displayName;

        const packsHtml = (packs && packs.length > 0)
          ? `<section><h2>Brand Authority Cards</h2><ul>${packs.map((p: any) => {
              const href = `${url.origin}/api/public/brand/${escapeHtml(p.brand_slug)}`;
              return `<li><a href="${href}" rel="noopener"><strong>${escapeHtml(p.brand_name || p.brand_slug)}</strong></a>${p.summary ? ` — ${escapeHtml(String(p.summary).slice(0, 200))}` : ""}</li>`;
            }).join("")}</ul></section>`
          : "";

        const description = brand
          ? `${displayName} — ${brand}${kw ? ` (${kw})` : ""}`.slice(0, 280)
          : `${displayName} on MAAROOF Ai.`.slice(0, 280);

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
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body>
<header>
<h1>${escapeHtml(displayName)}</h1>
${brand ? `<p><strong>${escapeHtml(brand)}</strong></p>` : ""}
${kw ? `<p>${escapeHtml(kw)}</p>` : ""}
</header>
<main>
${packsHtml}
</main>
<footer><small>Public profile on <a href="${escapeHtml(url.origin)}/" rel="noopener">MAAROOF Ai</a></small></footer>
</body>
</html>`;

        return new Response(html, {
          status: 200,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "public, max-age=300, s-maxage=600",
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
