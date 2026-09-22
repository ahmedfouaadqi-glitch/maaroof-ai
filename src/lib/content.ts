// Content/Header/Export configuration hooks.
// useContent(key, fallback)  -> CMS string for current language with fallback to i18n.
// useHeaderConfig()          -> dynamic header toggles + extra links + extra phones.
// useExportConfig()          -> whether per-tool exports are enabled.

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n, type Lang } from "@/lib/i18n";

// ---------- site_content ----------
type Row = { key: string; ar: string | null; en: string | null; ku: string | null };
const CONTENT_CACHE_KEY = "geo-site-content-v1";
let CONTENT_MAP: Record<string, Row> | null = null;
const subscribers = new Set<() => void>();

function notify() { for (const fn of subscribers) fn(); }

function readContentCache(): Record<string, Row> {
  if (CONTENT_MAP) return CONTENT_MAP;
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(CONTENT_CACHE_KEY) : null;
    if (raw) { CONTENT_MAP = JSON.parse(raw); return CONTENT_MAP!; }
  } catch {}
  CONTENT_MAP = {};
  return CONTENT_MAP;
}

async function refreshContent() {
  const { data } = await supabase.from("site_content").select("key, ar, en, ku");
  if (!data) return;
  const map: Record<string, Row> = {};
  for (const r of data as Row[]) map[r.key] = r;
  CONTENT_MAP = map;
  try { localStorage.setItem(CONTENT_CACHE_KEY, JSON.stringify(map)); } catch {}
  notify();
}

let loaded = false;
function ensureLoaded() {
  if (loaded) return;
  loaded = true;
  refreshContent();
}

export function invalidateContent() {
  loaded = false;
  CONTENT_MAP = null;
  try { localStorage.removeItem(CONTENT_CACHE_KEY); } catch {}
  ensureLoaded();
}

export function useContent(key: string, fallback?: string): string {
  const { lang } = useI18n();
  const [, force] = useState(0);
  useEffect(() => {
    ensureLoaded();
    const fn = () => force((n) => n + 1);
    subscribers.add(fn);
    return () => { subscribers.delete(fn); };
  }, []);
  const map = readContentCache();
  const row = map[key];
  if (row) {
    const v = (row as any)[lang] || row.en || row.ar || row.ku;
    if (v) return v;
  }
  return fallback ?? key;
}

export function pickContent(row: Partial<Row> | null | undefined, lang: Lang, fallback = ""): string {
  if (!row) return fallback;
  return ((row as any)[lang] || row.en || row.ar || row.ku || fallback) as string;
}

// ---------- header_config ----------
export type ExtraLink = { href: string; label_ar: string; label_en: string; label_ku: string };
export type ExtraPhone = { number: string; display: string; desc_ar: string; desc_en: string; desc_ku: string };
export type HeaderConfig = {
  show_agent: boolean;
  show_pricing: boolean;
  show_dashboard: boolean;
  show_profile: boolean;
  show_guide: boolean;
  show_contact: boolean;
  show_maaroof: boolean;
  extra_links: ExtraLink[];
  extra_phones: ExtraPhone[];
};
export const DEFAULT_HEADER_CONFIG: HeaderConfig = {
  show_agent: true,
  show_pricing: true,
  show_dashboard: true,
  show_profile: true,
  show_guide: true,
  show_contact: true,
  show_maaroof: true,
  extra_links: [],
  extra_phones: [],
};

const HEADER_KEY = "geo-header-config-v1";
let HEADER_CACHE: HeaderConfig | null = null;

function mergeHeader(raw: any): HeaderConfig {
  if (!raw || typeof raw !== "object") return DEFAULT_HEADER_CONFIG;
  return {
    ...DEFAULT_HEADER_CONFIG,
    ...raw,
    extra_links: Array.isArray(raw.extra_links) ? raw.extra_links : [],
    extra_phones: Array.isArray(raw.extra_phones) ? raw.extra_phones : [],
  };
}

export function useHeaderConfig(): HeaderConfig {
  const [cfg, setCfg] = useState<HeaderConfig>(() => {
    if (HEADER_CACHE) return HEADER_CACHE;
    try {
      const raw = typeof localStorage !== "undefined" ? localStorage.getItem(HEADER_KEY) : null;
      if (raw) { HEADER_CACHE = mergeHeader(JSON.parse(raw)); return HEADER_CACHE; }
    } catch {}
    return DEFAULT_HEADER_CONFIG;
  });
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "header_config").maybeSingle();
      if (cancelled || !data?.value) return;
      const next = mergeHeader(data.value);
      HEADER_CACHE = next;
      try { localStorage.setItem(HEADER_KEY, JSON.stringify(next)); } catch {}
      setCfg(next);
    })();
    return () => { cancelled = true; };
  }, []);
  return cfg;
}

// ---------- export_config ----------
export type ExportMode = "per_tool" | "report_only" | "both";
export type ExportFormat = "pdf" | "xlsx" | "csv" | "docx" | "pptx" | "md" | "json";
export const ALL_EXPORT_FORMATS: ExportFormat[] = ["pdf", "xlsx", "csv", "docx", "pptx", "md", "json"];
export type EmailPrivacyMode = "mask" | "code" | "hide";

export type ExportConfig = {
  mode: ExportMode;
  per_tool_enabled: Record<string, boolean>;
  /** Which formats users may download. Empty/missing = all formats. */
  formats_enabled: Record<string, boolean>;
  footer: {
    show_user_name: boolean;
    email_privacy: EmailPrivacyMode;
    show_logo: boolean;
  };
};

export const DEFAULT_EXPORT_CONFIG: ExportConfig = {
  mode: "both",
  per_tool_enabled: {},
  formats_enabled: {},
  footer: { show_user_name: true, email_privacy: "mask", show_logo: true },
};

const EXPORT_KEY = "geo-export-config-v2";
let EXPORT_CACHE: ExportConfig | null = null;

function mergeExport(raw: any): ExportConfig {
  if (!raw || typeof raw !== "object") return DEFAULT_EXPORT_CONFIG;
  const mode: ExportMode = raw.mode === "per_tool" || raw.mode === "report_only" ? raw.mode : "both";
  const f = raw.footer && typeof raw.footer === "object" ? raw.footer : {};
  const privacy: EmailPrivacyMode = f.email_privacy === "code" || f.email_privacy === "hide" ? f.email_privacy : "mask";
  return {
    mode,
    per_tool_enabled: (raw.per_tool_enabled && typeof raw.per_tool_enabled === "object") ? raw.per_tool_enabled : {},
    formats_enabled: (raw.formats_enabled && typeof raw.formats_enabled === "object") ? raw.formats_enabled : {},
    footer: {
      show_user_name: f.show_user_name !== false,
      email_privacy: privacy,
      show_logo: f.show_logo !== false,
    },
  };
}

export function useExportConfig(): ExportConfig {
  const [cfg, setCfg] = useState<ExportConfig>(() => {
    if (EXPORT_CACHE) return EXPORT_CACHE;
    try {
      const raw = typeof localStorage !== "undefined" ? localStorage.getItem(EXPORT_KEY) : null;
      if (raw) { EXPORT_CACHE = mergeExport(JSON.parse(raw)); return EXPORT_CACHE; }
    } catch {}
    return DEFAULT_EXPORT_CONFIG;
  });
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "export_config").maybeSingle();
      if (cancelled || !data?.value) return;
      const next = mergeExport(data.value);
      EXPORT_CACHE = next;
      try { localStorage.setItem(EXPORT_KEY, JSON.stringify(next)); } catch {}
      setCfg(next);
    })();
    return () => { cancelled = true; };
  }, []);
  return cfg;
}

// ---------- per-user export override ----------
export type ExportOverride = {
  exports_enabled: boolean;
  allowed_formats: string[];
  allowed_tools: string[];
  show_user_name: boolean | null;
  email_privacy: EmailPrivacyMode | null;
  show_logo: boolean | null;
};

/** Reads the signed-in user's export override row (admins manage these). */
export function useExportOverride(): ExportOverride | null {
  const [row, setRow] = useState<ExportOverride | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: auth } = await supabase.auth.getSession();
      const uid = auth.session?.user?.id;
      if (!uid) return;
      const { data } = await supabase
        .from("user_export_overrides")
        .select("exports_enabled, allowed_formats, allowed_tools, show_user_name, email_privacy, show_logo")
        .eq("user_id", uid)
        .maybeSingle();
      if (cancelled || !data) return;
      setRow({
        exports_enabled: data.exports_enabled !== false,
        allowed_formats: Array.isArray(data.allowed_formats) ? (data.allowed_formats as any[]).map(String) : [],
        allowed_tools: Array.isArray(data.allowed_tools) ? (data.allowed_tools as any[]).map(String) : [],
        show_user_name: typeof data.show_user_name === "boolean" ? data.show_user_name : null,
        email_privacy: (data.email_privacy === "mask" || data.email_privacy === "code" || data.email_privacy === "hide") ? data.email_privacy : null,
        show_logo: typeof data.show_logo === "boolean" ? data.show_logo : null,
      });
    })();
    return () => { cancelled = true; };
  }, []);
  return row;
}

export function isToolExportEnabled(cfg: ExportConfig, toolKey: string, override?: ExportOverride | null): boolean {
  if (override) {
    if (!override.exports_enabled) return false;
    if (override.allowed_tools.length) return override.allowed_tools.includes(toolKey);
  }
  if (cfg.mode === "report_only") return false;
  // mode === "per_tool" or "both": default to enabled unless explicitly false
  const v = cfg.per_tool_enabled[toolKey];
  return v !== false;
}

/** Formats the user may actually download, after global policy + per-user override. */
export function allowedExportFormats(cfg: ExportConfig, override?: ExportOverride | null): ExportFormat[] {
  let list = ALL_EXPORT_FORMATS.filter((f) => cfg.formats_enabled[f] !== false);
  if (override?.allowed_formats.length) list = list.filter((f) => override.allowed_formats.includes(f));
  return list;
}

