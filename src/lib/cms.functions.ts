// Admin server functions for the Content Studio: site_content, custom_pages,
// auto-translate, and bulk i18n bootstrap.

import { createServerFn, createMiddleware } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { LOVABLE_AI_CHAT_COMPLETIONS_URL, lovableAiHeaders } from "@/lib/lovable-ai";

const requireAdmin = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const { supabase, userId } = context as any;
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (error) throw new Response("Auth check failed", { status: 500 });
    if (!data) throw new Response("Forbidden: admin only", { status: 403 });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return next({ context: { supabaseAdmin, userId } as any });
  });

const LANG = z.enum(["ar", "en", "ku"]);
const LANG_NAME: Record<string, string> = {
  ar: "Modern Standard Arabic",
  en: "English",
  ku: "Central Kurdish (Sorani, Arabic script)",
};

// ---------- site_content ----------
export const adminListContent = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = context as any;
    const { data, error } = await supabaseAdmin
      .from("site_content")
      .select("key, namespace, ar, en, ku, notes, updated_at")
      .order("namespace", { ascending: true })
      .order("key", { ascending: true })
      .limit(5000);
    if (error) throw new Response(error.message, { status: 400 });
    return { rows: data || [] };
  });

export const adminUpsertContent = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: any) =>
    z.object({
      rows: z.array(z.object({
        key: z.string().min(1).max(200),
        namespace: z.string().min(1).max(100).optional(),
        ar: z.string().nullable().optional(),
        en: z.string().nullable().optional(),
        ku: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
      })).min(1).max(500),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, userId } = context as any;
    const payload = data.rows.map((r) => ({
      key: r.key,
      namespace: r.namespace || "misc",
      ar: r.ar ?? null,
      en: r.en ?? null,
      ku: r.ku ?? null,
      notes: r.notes ?? null,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabaseAdmin.from("site_content").upsert(payload, { onConflict: "key" });
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true, count: payload.length };
  });

export const adminDeleteContent = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: any) => z.object({ key: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = context as any;
    const { error } = await supabaseAdmin.from("site_content").delete().eq("key", data.key);
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true };
  });

// ---------- auto-translate (admin, no user quota) ----------
async function translateOne(text: string, from: string, to: string): Promise<string> {
  if (from === to || !text.trim()) return text;
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Response("Missing LOVABLE_API_KEY", { status: 500 });
  const res = await fetch(LOVABLE_AI_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: lovableAiHeaders(apiKey),
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: `Translate from ${LANG_NAME[from]} to ${LANG_NAME[to]}. Preserve placeholders {n}, HTML, brand names (MAAROOF, ChatGPT, Gemini, Claude, Perplexity, Copilot, Grok, Mistral, DeepSeek, Kimi). Output ONLY the translation.` },
        { role: "user", content: text },
      ],
      temperature: 0.2,
    }),
  });
  if (!res.ok) throw new Response(`AI gateway ${res.status}`, { status: 502 });
  const json = await res.json();
  return String(json?.choices?.[0]?.message?.content ?? "").trim() || text;
}

export const adminAutoTranslate = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: any) =>
    z.object({
      text: z.string().min(1).max(8000),
      sourceLang: LANG,
      targetLangs: z.array(LANG).min(1).max(3),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const out: Record<string, string> = {};
    for (const t of data.targetLangs) {
      out[t] = await translateOne(data.text, data.sourceLang, t);
    }
    return { translations: out };
  });

// Translate many rows at once: fill missing languages.
export const adminBulkAutoFill = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: any) =>
    z.object({ keys: z.array(z.string().min(1)).min(1).max(50) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, userId } = context as any;
    const { data: rows, error } = await supabaseAdmin
      .from("site_content").select("key, namespace, ar, en, ku").in("key", data.keys);
    if (error) throw new Response(error.message, { status: 400 });
    const updated: any[] = [];
    const failed: { key: string; error: string }[] = [];
    for (const r of rows || []) {
      try {
        const ar = (r.ar || "").trim();
        const en = (r.en || "").trim();
        const ku = (r.ku || "").trim();
        const source: "ar" | "en" | "ku" | null = en ? "en" : ar ? "ar" : ku ? "ku" : null;
        if (!source) { failed.push({ key: r.key, error: "all_empty" }); continue; }
        const text = (r as any)[source] as string;
        const out: any = { ...r, updated_by: userId, updated_at: new Date().toISOString() };
        for (const lang of ["ar", "en", "ku"] as const) {
          if (lang === source) continue;
          if (((r as any)[lang] || "").trim()) continue;
          try {
            out[lang] = await translateOne(text, source, lang);
          } catch (e: any) {
            failed.push({ key: r.key, error: `${lang}: ${e?.message || "translate_failed"}` });
          }
        }
        updated.push(out);
      } catch (e: any) {
        failed.push({ key: r.key, error: e?.message || "row_failed" });
      }
    }
    if (updated.length) {
      const { error: upErr } = await supabaseAdmin.from("site_content").upsert(updated, { onConflict: "key" });
      if (upErr) throw new Response(upErr.message, { status: 400 });
    }
    return { ok: true, count: updated.length, failed };
  });

// ---------- custom_pages ----------
const slugRx = /^[a-z0-9](?:[a-z0-9-]{0,80}[a-z0-9])?$/;

export const adminListPages = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = context as any;
    const { data, error } = await supabaseAdmin
      .from("custom_pages").select("*").order("created_at", { ascending: false });
    if (error) throw new Response(error.message, { status: 400 });
    return { pages: data || [] };
  });

export const adminUpsertPage = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: any) =>
    z.object({
      id: z.string().uuid().optional(),
      slug: z.string().regex(slugRx),
      title_ar: z.string().nullable().optional(),
      title_en: z.string().nullable().optional(),
      title_ku: z.string().nullable().optional(),
      body_ar: z.string().nullable().optional(),
      body_en: z.string().nullable().optional(),
      body_ku: z.string().nullable().optional(),
      meta_description_ar: z.string().max(300).nullable().optional(),
      meta_description_en: z.string().max(300).nullable().optional(),
      meta_description_ku: z.string().max(300).nullable().optional(),
      published: z.boolean().optional(),
      auto_translate: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, userId } = context as any;
    const payload: any = { ...data, created_by: userId, updated_at: new Date().toISOString() };
    delete payload.auto_translate;

    if (data.auto_translate) {
      const tSrc: "ar" | "en" | "ku" | null = data.title_ar ? "ar" : data.title_en ? "en" : data.title_ku ? "ku" : null;
      if (tSrc) {
        for (const l of ["ar", "en", "ku"] as const) {
          if (l !== tSrc && !(payload as any)[`title_${l}`]) {
            payload[`title_${l}`] = await translateOne((payload as any)[`title_${tSrc}`], tSrc, l);
          }
        }
      }
      const bSrc: "ar" | "en" | "ku" | null = data.body_ar ? "ar" : data.body_en ? "en" : data.body_ku ? "ku" : null;
      if (bSrc) {
        for (const l of ["ar", "en", "ku"] as const) {
          if (l !== bSrc && !(payload as any)[`body_${l}`]) {
            payload[`body_${l}`] = await translateOne((payload as any)[`body_${bSrc}`], bSrc, l);
          }
        }
      }
    }

    const { error } = await supabaseAdmin.from("custom_pages").upsert(payload, { onConflict: "slug" });
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true };
  });

export const adminDeletePage = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: any) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = context as any;
    const { error } = await supabaseAdmin.from("custom_pages").delete().eq("id", data.id);
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true };
  });
