import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { detectBot } from "@/lib/crawler-bots";

/**
 * Public Brand endpoint — read by AI crawlers (GPTBot, PerplexityBot, etc.)
 * Returns crawler-friendly HTML with JSON-LD embedded + the Markdown brand card.
 * Logs every crawler hit to `crawler_hits`.
 *
 * Security: read-only. No PII. RLS-bypassing admin client only used here.
 */
export const Route = createFileRoute("/api/public/brand/$slug")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!SUPABASE_URL || !SERVICE) return new Response("internal_error", { status: 500 });

        const slug = String(params.slug || "").toLowerCase().slice(0, 80);
        if (!slug) return new Response("not found", { status: 404 });

        const admin = createClient(SUPABASE_URL, SERVICE);
        const { data: pack } = await admin
          .from("brand_authority_packs")
          .select("user_id, brand_name, brand_keywords, json_ld, markdown, html, summary, updated_at")
          .eq("brand_slug", slug)
          .maybeSingle();

        if (!pack) return new Response("brand not found", { status: 404 });

        // Log crawler hit (fire-and-forget; never block response)
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
          brand_slug: slug,
          user_id: (pack as any).user_id,
          user_agent: ua.slice(0, 500),
          bot_name: bot,
          path: url.pathname,
          ip_hash: ipHash,
        }).then(() => {}, () => {});

        const jsonLd = (pack as any).json_ld || {};
        const md = String((pack as any).markdown || "");
        const summary = String((pack as any).summary || "");
        const brand = String((pack as any).brand_name || slug);
        const kw = String((pack as any).brand_keywords || "");

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(brand)} — Brand Authority Card</title>
<meta name="description" content="${escapeHtml(summary.slice(0, 280))}" />
<meta name="keywords" content="${escapeHtml(kw)}" />
<meta name="robots" content="index,follow" />
<link rel="canonical" href="${escapeHtml(url.origin + url.pathname)}" />
<script type="application/ld+json">${safeJsonLd(jsonLd)}</script>
</head>
<body>
<header><h1>${escapeHtml(brand)}</h1>${summary ? `<p>${escapeHtml(summary)}</p>` : ""}</header>
<main>
<article>${mdToBasicHtml(md)}</article>
</main>
<footer><small>Last updated: ${escapeHtml(String((pack as any).updated_at || ""))}</small></footer>
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

// Tiny markdown → html (headings, paragraphs, lists, bold). Enough for crawlers.
function mdToBasicHtml(md: string): string {
  if (!md) return "";
  const lines = md.split(/\r?\n/);
  let out = "";
  let inUl = false;
  const flush = () => { if (inUl) { out += "</ul>"; inUl = false; } };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) { flush(); out += `<h${h[1].length}>${escapeHtml(h[2])}</h${h[1].length}>`; continue; }
    if (line.startsWith("- ") || line.startsWith("* ")) {
      if (!inUl) { out += "<ul>"; inUl = true; }
      out += `<li>${inlineMd(line.slice(2))}</li>`;
      continue;
    }
    flush();
    out += `<p>${inlineMd(line)}</p>`;
  }
  flush();
  return out;
}
function inlineMd(s: string): string {
  return escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[(.+?)\]\((https?:[^)]+)\)/g, '<a href="$2" rel="noopener">$1</a>');
}
