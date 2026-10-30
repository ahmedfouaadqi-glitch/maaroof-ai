import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { detectBot } from "@/lib/crawler-bots";
import { trustedClientIp, verifyCrawlerIdentity } from "@/lib/crawler-verification.server";

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
          .select("user_id, workspace_id, brand_name, brand_keywords, json_ld, markdown, html, summary, updated_at")
          .eq("brand_slug", slug)
          .maybeSingle();

        if (!pack) return new Response("brand not found", { status: 404 });

        // Log crawler hit (fire-and-forget; never block response)
        const ua = request.headers.get("user-agent") || "";
        const bot = detectBot(ua);
        const url = new URL(request.url);
        const sourceIp = trustedClientIp(request);
        // Verification is done from trusted ingress IP + provider DNS records, never from User-Agent alone.
        const verification = await verifyCrawlerIdentity(admin, bot, sourceIp);
        let ipHash: string | null = null;
        if (sourceIp) {
          try {
            const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(sourceIp));
            ipHash = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
          } catch {}
        }
        const { error: hitInsertError } = await admin.from("crawler_hits").insert({
          brand_slug: slug,
          user_id: (pack as any).user_id,
          workspace_id: (pack as any).workspace_id || null,
          user_agent: ua.slice(0, 500),
          bot_name: bot,
          path: url.pathname,
          ip_hash: ipHash,
          verification_status: verification.verification_status,
          verified_hostname: verification.verified_hostname,
          verification_method: verification.verification_method,
          verified_at: verification.verified_at,
        });
        if (hitInsertError) console.warn("[public-brand] crawler hit insert failed", hitInsertError.message);

        const jsonLd = (pack as any).json_ld || {};
        let md = String((pack as any).markdown || "");
        try {
          const { broadcastSection } = await import("@/lib/knowledge-facts");
          let factsQuery = (admin as any).from("knowledge_facts")
            .select("fact, confidence, broadcast, expires_at")
            .eq("user_id", (pack as any).user_id)
            .eq("broadcast", true);
          factsQuery = (pack as any).workspace_id
            ? factsQuery.eq("workspace_id", (pack as any).workspace_id)
            : factsQuery.is("workspace_id", null);
          const { data: bf } = await factsQuery.limit(20);
          md += broadcastSection(bf || []);
        } catch {}
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
