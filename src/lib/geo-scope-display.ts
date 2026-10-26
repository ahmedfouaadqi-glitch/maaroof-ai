import { getCountryInfo, NAMES } from "@/lib/countries";

export type GeoDisplayLocale = "ar" | "en" | "ku";
export type GeoScopeDisplayInput = {
  scope: "auto" | "world" | "country" | "region" | "province" | "city";
  country?: string;
  region?: string;
  city?: string;
};
export type CompactGeoScopeDisplay = {
  label: string;
  code?: string;
  flag?: string;
  place?: string;
};

/** Resolve the saved country name/code to a consistent localized summary. */
export function getCompactGeoScopeDisplay(
  scope: GeoScopeDisplayInput,
  lang: GeoDisplayLocale,
): CompactGeoScopeDisplay {
  if (scope.scope === "world") {
    return { label: lang === "ar" ? "العالم" : lang === "ku" ? "جیهان" : "Worldwide" };
  }
  if (scope.scope === "auto") {
    return {
      label: lang === "ar"
        ? "تلقائي — موقع الزائر"
        : lang === "ku"
          ? "خۆکار — شوێنی سەردانکەر"
          : "Automatic — visitor location",
    };
  }

  const rawCountry = String(scope.country || "").trim();
  const code = Object.keys(NAMES).find((candidate) => {
    const info = getCountryInfo(candidate);
    const normalized = rawCountry.toLocaleLowerCase();
    return candidate.toLowerCase() === normalized
      || info.name_en.toLocaleLowerCase() === normalized
      || info.name_ar.toLocaleLowerCase() === normalized
      || info.name_ku.toLocaleLowerCase() === normalized;
  });
  const place = String(scope.city || scope.region || "").trim() || undefined;

  if (!code) {
    return {
      label: rawCountry || (lang === "ar" ? "موقع غير محدد" : lang === "ku" ? "شوێن دیاری نەکراوە" : "Location not specified"),
      place,
    };
  }

  const info = getCountryInfo(code);
  return {
    label: lang === "en" ? info.name_en : lang === "ku" ? info.name_ku : info.name_ar,
    code: info.code,
    flag: info.flag,
    place,
  };
}
