// Tiny i18n helper for admin tabs. Keeps strings local & avoids global i18n bloat.
import { useI18n } from "@/lib/i18n";

export type AdminLang = "ar" | "en" | "ku";

export function useAdminL<T extends Record<string, { ar: string; en: string; ku: string }>>(dict: T) {
  const { lang } = useI18n();
  const l = (lang as AdminLang) || "ar";
  const out = {} as Record<keyof T, string>;
  for (const k of Object.keys(dict) as (keyof T)[]) out[k] = dict[k][l] || dict[k].ar;
  return out;
}
