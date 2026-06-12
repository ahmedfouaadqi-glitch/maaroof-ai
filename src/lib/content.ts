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
export type ExportConfig = {
  mode: ExportMode;
  per_tool_enabled: Record<string, boolean>;
};
export const DEFAULT_EXPORT_CONFIG: ExportConfig = {
  mode: "both",
  per_tool_enabled: {},
};

const EXPORT_KEY = "geo-export-config-v1";
let EXPORT_CACHE: ExportConfig | null = null;

function mergeExport(raw: any): ExportConfig {
  if (!raw || typeof raw !== "object") return DEFAULT_EXPORT_CONFIG;
  const mode: ExportMode = raw.mode === "per_tool" || raw.mode === "report_only" ? raw.mode : "both";
  return { mode, per_tool_enabled: (raw.per_tool_enabled && typeof raw.per_tool_enabled === "object") ? raw.per_tool_enabled : {} };
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

export function isToolExportEnabled(cfg: ExportConfig, toolKey: string): boolean {
  if (cfg.mode === "report_only") return false;
  // mode === "per_tool" or "both": default to enabled unless explicitly false
  const v = cfg.per_tool_enabled[toolKey];
  return v !== false;
}
