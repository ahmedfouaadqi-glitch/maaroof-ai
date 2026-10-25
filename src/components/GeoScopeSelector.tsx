import { useEffect, useMemo, useState } from "react";
import { Globe2, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { NAMES, getCountryInfo } from "@/lib/countries";

export type GeoScopeMode = "auto" | "world" | "country" | "region" | "province" | "city";
export type GeoScope = {
  scope: GeoScopeMode;
  country?: string;
  region?: string;
  city?: string;
  /** Set when an "auto" scope was resolved from IP/GPS. */
  resolved_from?: "ip" | "gps";
};

const STORAGE_KEY = "maaroof:country";

/** Country code detected earlier by CountryProvider (IP or GPS), if any. */
function detectedCountry(): { code: string; source: "ip" | "gps" | "manual" } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as { code?: string; source?: "ip" | "gps" | "manual" };
    if (!p?.code) return null;
    return { code: String(p.code).toUpperCase(), source: p.source || "ip" };
  } catch {
    return null;
  }
}

/**
 * Resolve the scope a tool should actually run with.
 * "auto" becomes the detected country (IP/GPS) when known, otherwise world.
 */
export function getEffectiveScope(profile: any, toolKey?: string): GeoScope {
  const overrides = (profile?.tool_geo_scopes || {}) as Record<string, GeoScope>;
  const raw: GeoScope =
    (toolKey && overrides[toolKey]) || profile?.geo_scope || { scope: "auto" };
  if (raw.scope !== "auto") return raw;
  const det = detectedCountry();
  // Keep the scope automatic when the visitor's country is unknown. The server
  // can resolve it from trusted request headers; never invent a country.
  if (!det) return { scope: "auto" };
  const info = getCountryInfo(det.code);
  return {
    scope: "country",
    country: info.name_en || det.code,
    resolved_from: det.source === "gps" ? "gps" : "ip",
  };
}

/** Human label of the scope currently in effect, for the "working on" strip. */
export function scopeLabel(scope: GeoScope, lang: "en" | "ar" | "ku"): string {
  const world = lang === "ar" ? "العالم" : lang === "ku" ? "جیهان" : "Worldwide";
  if (scope.scope === "world") return world;
  if (scope.scope === "auto") {
    return lang === "ar" ? "تلقائي — موقع الزائر" : lang === "ku" ? "خۆکار — شوێنی سەردانکەر" : "Automatic — visitor location";
  }
  const parts = [scope.city, scope.region, scope.country].filter(Boolean);
  if (parts.length) return parts.join(", ");
  return lang === "ar" ? "حدّد الموقع الجغرافي" : lang === "ku" ? "شوێنی جوگرافی دیاری بکە" : "Choose a geographic location";
}

const COUNTRY_CODES = Object.keys(NAMES);

export type ServerGeoScope = { mode: "auto" | "world" | "country" | "city"; country?: string; city?: string };

/** Require the fields needed by the selected scope before any chat/task is sent. */
export function isGeoScopeConfigured(scope?: GeoScope | null): boolean {
  if (!scope || scope.scope === "auto" || scope.scope === "world") return true;
  if (!String(scope.country || "").trim()) return false;
  if (scope.scope === "city") return !!String(scope.city || "").trim();
  if (scope.scope === "region" || scope.scope === "province") return !!String(scope.region || "").trim();
  return true;
}

/** Convert the UI selector into the server's geography contract without guessing a country. */
export function toServerGeoScope(scope?: GeoScope | null): ServerGeoScope {
  const value = scope || { scope: "auto" as const };
  if (value.scope === "world") return { mode: "world" };
  if (value.scope === "auto") return { mode: "auto" };
  const country = String(value.country || "").trim() || undefined;
  if (value.scope === "country") return country ? { mode: "country", country } : { mode: "auto" };
  if (value.scope === "city") return { mode: "city", country, city: String(value.city || "").trim() || undefined };
  const place = [value.city, value.region].map((x) => String(x || "").trim()).filter(Boolean).join(", ");
  if (place) return { mode: "city", country, city: place };
  return country ? { mode: "country", country } : { mode: "auto" };
}

export function GeoScopeSelector({ compact = false, toolKey, value, onChange }: { compact?: boolean; toolKey?: string; value?: GeoScope; onChange?: (scope: GeoScope) => void }) {
  const { t, lang } = useI18n();
  const { user, profile, refreshProfile } = useAuth();
  const overrides = ((profile as any)?.tool_geo_scopes || {}) as Record<string, GeoScope>;
  const hasOverride = !!(toolKey && overrides[toolKey]);
  const stored: GeoScope =
    (toolKey && overrides[toolKey]) || (profile as any)?.geo_scope || { scope: "auto" };
  const [val, setVal] = useState<GeoScope>(stored);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const next: GeoScope = value ||
      (toolKey && overrides[toolKey]) || (profile as any)?.geo_scope || { scope: "auto" };
    setVal(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(stored), JSON.stringify(value), toolKey]);

  const effective = useMemo(() => getEffectiveScope({ ...(profile || {}), geo_scope: val }, toolKey), [profile, toolKey, val]);

  const countryOptions = useMemo(
    () =>
      COUNTRY_CODES.map((code) => {
        const i = getCountryInfo(code);
        return { code, label: `${i.flag} ${lang === "ar" ? i.name_ar : lang === "ku" ? i.name_ku : i.name_en}`, en: i.name_en };
      }).sort((a, b) => a.label.localeCompare(b.label)),
    [lang],
  );

  const save = async (next: GeoScope) => {
    setVal(next);
    onChange?.(next);
    if (!user) return;
    setSaving(true);
    try {
      if (toolKey) {
        const merged = { ...overrides, [toolKey]: next };
        await supabase.from("profiles").update({ tool_geo_scopes: merged as any }).eq("id", user.id);
      } else {
        await supabase.from("profiles").update({ geo_scope: next as any }).eq("id", user.id);
      }
      await refreshProfile();
    } finally {
      setSaving(false);
    }
  };

  const clearOverride = async () => {
    if (!user || !toolKey) return;
    setSaving(true);
    const next = { ...overrides };
    delete next[toolKey];
    await supabase.from("profiles").update({ tool_geo_scopes: next as any }).eq("id", user.id);
    const inherited: GeoScope = (profile as any)?.geo_scope || { scope: "auto" };
    setVal(inherited);
    onChange?.(inherited);
    await refreshProfile();
    setSaving(false);
  };

  const needsCountry = val.scope === "country" || val.scope === "province" || val.scope === "city";
  const needsRegion = val.scope === "region" || val.scope === "province";
  const needsCity = val.scope === "city";

  return (
    <div className={`rounded-xl border border-border bg-card/60 p-3 ${compact ? "" : "p-4"}`}>
      <div className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold text-muted-foreground">
        <div className="flex items-center gap-2">
          <Globe2 className="size-4 text-primary" /> {t("geo_scope_title")}
          {toolKey && (
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${hasOverride ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
              {hasOverride ? t("geo_scope_per_tool") : t("geo_scope_global_inherit")}
            </span>
          )}
        </div>
        {toolKey && hasOverride && (
          <button onClick={clearOverride} className="text-[10px] underline text-muted-foreground hover:text-foreground">
            {t("geo_scope_use_global")}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {(["auto", "world", "country", "region", "province", "city"] as const).map((s) => (
          <button
            key={s}
            onClick={() => save({ ...val, scope: s })}
            className={`rounded-full px-3 py-1 text-xs font-semibold border ${val.scope === s ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground/80"}`}
          >
            {t(`geo_scope_${s}`)}
          </button>
        ))}
      </div>

      {val.scope === "auto" && (
        <p className="mt-2 text-[11px] text-muted-foreground">{t("geo_scope_auto_hint")}</p>
      )}

      {needsCountry && (
        <select
          value={val.country || ""}
          onChange={(e) => save({ ...val, country: e.target.value })}
          className="mt-2 w-full rounded-lg border border-border bg-background/60 px-3 py-1.5 text-sm"
        >
          <option value="">{t("geo_country_ph")}</option>
          {countryOptions.map((c) => (
            <option key={c.code} value={c.en}>
              {c.label}
            </option>
          ))}
        </select>
      )}

      {needsRegion && (
        <input
          value={val.region || ""}
          onChange={(e) => setVal({ ...val, region: e.target.value })}
          onBlur={() => save(val)}
          placeholder={t("geo_region_ph")}
          className="mt-2 w-full rounded-lg border border-border bg-background/60 px-3 py-1.5 text-sm"
        />
      )}

      {needsCity && (
        <input
          value={val.city || ""}
          onChange={(e) => setVal({ ...val, city: e.target.value })}
          onBlur={() => save(val)}
          placeholder={t("geo_city_ph")}
          className="mt-2 w-full rounded-lg border border-border bg-background/60 px-3 py-1.5 text-sm"
        />
      )}

      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-foreground/80">
        <MapPin className="size-3 text-primary" />
        <span className="font-semibold">{t("geo_scope_now")}</span>
        <span>{scopeLabel(effective, lang as "en" | "ar" | "ku")}</span>
      </div>

      {saving && <div className="mt-1 text-[10px] text-muted-foreground">…</div>}
    </div>
  );
}
