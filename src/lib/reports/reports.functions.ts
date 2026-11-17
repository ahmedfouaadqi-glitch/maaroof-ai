import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildPayloadReportHtml } from "./payload-report-html";
import { transitionReport, type ReportStatus } from "./report-approval";

const Lang = z.enum(["ar", "en", "ku"]);
const SHARE_DAYS = 30;

async function sha256Hex(v: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}
function newToken() {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export const isValidShareToken = (t: string) => /^[A-Za-z0-9_-]{40,60}$/.test(t);

async function brandingFor(supabase: any, workspaceId: string) {
  const { data } = await supabase.from("report_branding").select("company_name, logo_url, brand_color, contact").eq("workspace_id", workspaceId).maybeSingle();
  return data ? { companyName: data.company_name, logoUrl: data.logo_url, brandColor: data.brand_color, contact: data.contact } : {};
}

export const saveExecutiveReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    workspaceId: z.string().uuid(), toolKey: z.string().max(60).optional(), lang: Lang,
    payload: z.object({ title: z.string().min(1).max(300), subtitle: z.string().max(500).optional(), sections: z.array(z.any()).max(400) }).passthrough(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const branding = await brandingFor(supabase, data.workspaceId);
    const html = buildPayloadReportHtml(data.payload as any, branding, data.lang);
    const { data: row, error } = await supabase.from("reports").insert({
      user_id: userId, workspace_id: data.workspaceId, tool_key: data.toolKey ?? null, title: data.payload.title,
      kind: "client", status: "Review Required", lang: data.lang, payload: data.payload as any, html,
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const listReports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ workspaceId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.from("reports")
      .select("id, workspace_id, title, kind, status, version, created_at, updated_at")
      .eq("workspace_id", data.workspaceId).order("updated_at", { ascending: false }).limit(200);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({ reportId: r.id, workspaceId: r.workspace_id, title: r.title, kind: r.kind, status: r.status, version: r.version, createdAt: r.created_at, updatedAt: r.updated_at }));
  });

export const getReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: r, error } = await context.supabase.from("reports").select("id, title, html, payload").eq("id", data.id).maybeSingle();
    if (error || !r) throw new Error("report_not_found");
    return { id: r.id as string, title: r.title as string, html: r.html as string, payload: r.payload as any };
  });

/** Approve = Review Required -> Approved -> Released, recorded through the pure lifecycle rules. */
export const approveReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: r } = await supabase.from("reports").select("status, kind").eq("id", data.id).maybeSingle();
    if (!r) throw new Error("report_not_found");
    const now = new Date().toISOString();
    let lc = { status: r.status as ReportStatus, kind: r.kind as "client" | "technical", policy: { requireApproval: true, allowTechnicalClientRelease: false }, events: [] as any[] };
    for (const next of ["Approved", "Released"] as ReportStatus[]) {
      const res = transitionReport(lc, next, userId, now);
      if (!res.ok) throw new Error(res.reason);
      lc = res.lifecycle;
    }
    const { error } = await supabase.from("reports").update({ status: lc.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { status: lc.status };
  });

export const createShareLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: r } = await supabase.from("reports").select("status, kind").eq("id", data.id).maybeSingle();
    if (!r || r.kind !== "client" || r.status !== "Released") throw new Error("report_not_released");
    const token = newToken();
    const expires = new Date(Date.now() + SHARE_DAYS * 864e5).toISOString();
    const { error } = await supabase.from("report_share_grants").insert({ report_id: data.id, user_id: userId, token_hash: await sha256Hex(token), expires_at: expires });
    if (error) throw new Error(error.message);
    return { token, expiresAt: expires };
  });

export const revokeShareLinks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("report_share_grants").update({ revoked_at: new Date().toISOString() }).eq("report_id", data.id).is("revoked_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getReportBranding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ workspaceId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => brandingFor(context.supabase, data.workspaceId) as Promise<any>);

export const saveReportBranding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    workspaceId: z.string().uuid(), companyName: z.string().trim().min(1).max(120),
    logoUrl: z.string().max(500).refine((v) => !v || /^https:\/\//i.test(v)), brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("report_branding").upsert({
      workspace_id: data.workspaceId, user_id: context.userId, company_name: data.companyName, logo_url: data.logoUrl || null, brand_color: data.brandColor,
    }, { onConflict: "workspace_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Public: returns a client report only for a valid, unexpired, unrevoked token. */
export const getSharedReport = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ token: z.string().max(80) }).parse(d))
  .handler(async ({ data }) => {
    if (!isValidShareToken(data.token)) return null;
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const sb = createClient(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => { const h = new Headers(init?.headers); if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization"); h.set("apikey", key); return fetch(input, { ...init, headers: h }); } },
    });
    const { data: rows } = await sb.rpc("get_shared_report" as any, { _token_hash: await sha256Hex(data.token) });
    const r = Array.isArray(rows) ? rows[0] : null;
    return r ? { title: r.title as string, lang: r.lang as string, html: r.html as string } : null;
  });
