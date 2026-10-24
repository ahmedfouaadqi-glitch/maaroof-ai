import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { en } from "./en";
import { ar } from "./ar";
import { ku } from "./ku";
import type { Dict, Lang } from "./types";

export type { Lang, Dict };

const dicts: Record<Lang, Dict> = { en, ar, ku };
export const SITE_DICTS = dicts;
export type SiteTextKey = keyof typeof en;

export const PLAN_KEY_BY_NAME: Record<string, string> = {
  Free: "free", Starter: "starter", Pro: "pro", Business: "business", "Pro Yearly": "yearly",
};
export const ADDON_KEY_BY_NAME: Record<string, string> = {
  "Agent Lite": "lite", "Agent Pro": "pro", "Agent Business": "biz",
};

export function normalizeLang(v: unknown): Lang {
  return v === "en" || v === "ku" ? v : "ar";
}

/** Framework-free lookup usable on the server (API routes, exports, notifications). */
export function serverT(lang: unknown, key: string): string {
  const l = normalizeLang(lang);
  return dicts[l][key] ?? en[key] ?? key;
}

/** Direction for a language. */
export function dirOf(lang: Lang): "ltr" | "rtl" {
  return lang === "en" ? "ltr" : "rtl";
}

const warned = new Set<string>();
function warnMissing(lang: Lang, key: string) {
  if (!import.meta.env?.DEV) return;
  const id = `${lang}:${key}`;
  if (warned.has(id)) return;
  warned.add(id);
  console.warn(`[i18n] missing translation for "${key}" in "${lang}"`);
}

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: keyof typeof en) => string;
  dir: "ltr" | "rtl";
};
const I18nCtx = createContext<Ctx | null>(null);

type Overrides = Partial<Record<Lang, Record<string, string>>>;

export function I18nProvider({ children }: { children: ReactNode }) {
  // SSR and the first client render MUST agree, so always start from the
  // default language and adopt the stored preference after hydration.
  const [lang, setLangState] = useState<Lang>("ar");
  const [overrides, setOverrides] = useState<Overrides>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem("geo-lang") as Lang | null;
      if (saved === "en" || saved === "ar" || saved === "ku") setLangState(saved);
    } catch { /* storage unavailable */ }
    try {
      setOverrides(JSON.parse(localStorage.getItem("geo-site-text") || "{}"));
    } catch { /* ignore */ }
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") localStorage.setItem("geo-lang", l);
  };
  const dir = dirOf(lang);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
      document.documentElement.dir = dir;
    }
  }, [lang, dir]);

  // Load admin text overrides from app_settings (cheap public select; no auth required for read)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data } = await supabase.from("app_settings").select("value").eq("key", "site_text").maybeSingle();
        const v = (data as any)?.value;
        if (!cancelled && v && typeof v === "object") {
          setOverrides(v as Overrides);
          if (typeof window !== "undefined") localStorage.setItem("geo-site-text", JSON.stringify(v));
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  const t = (k: keyof typeof en) => {
    const key = k as string;
    const ov = overrides[lang]?.[key];
    if (ov) return ov;
    const hit = dicts[lang][key];
    if (hit !== undefined) return hit;
    warnMissing(lang, key);
    return en[key] ?? key;
  };
  return <I18nCtx.Provider value={{ lang, setLang, t, dir }}>{children}</I18nCtx.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nCtx);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
