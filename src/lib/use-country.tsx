import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { detectCountry } from "@/lib/geo-detect.functions";
import { getCountryInfo, type CountryInfo } from "@/lib/countries";

type CountryState = {
  info: CountryInfo | null;
  source: "ip" | "gps" | "manual" | "none";
  loading: boolean;
  requestPreciseLocation: () => Promise<void>;
};

const CountryContext = createContext<CountryState | null>(null);

const STORAGE_KEY = "maaroof:country";

type StoredCountry = { code: string; source: "ip" | "gps" | "manual"; ts: number };

function loadStored(): StoredCountry | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredCountry;
    // Stored value valid for 7 days
    if (!parsed?.code || Date.now() - (parsed.ts || 0) > 7 * 86400_000) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveStored(s: StoredCountry) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {}
}

export function CountryProvider({ children }: { children: ReactNode }) {
  const detect = useServerFn(detectCountry);
  const [info, setInfo] = useState<CountryInfo | null>(null);
  const [source, setSource] = useState<"ip" | "gps" | "manual" | "none">("none");
  const [loading, setLoading] = useState(true);

  // Initial load: prefer stored (gps/manual wins), else fetch IP from server.
  useEffect(() => {
    let cancelled = false;
    const stored = loadStored();
    if (stored && (stored.source === "gps" || stored.source === "manual")) {
      setInfo(getCountryInfo(stored.code));
      setSource(stored.source);
      setLoading(false);
      return;
    }
    detect()
      .then((r) => {
        if (cancelled) return;
        if (r?.country) {
          setInfo(getCountryInfo(r.country));
          setSource("ip");
          saveStored({ code: r.country, source: "ip", ts: Date.now() });
        } else if (stored) {
          // Fall back to any cached IP value if server returns empty (local dev)
          setInfo(getCountryInfo(stored.code));
          setSource(stored.source);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [detect]);

  const requestPreciseLocation = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    setLoading(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000, maximumAge: 86400_000 }),
      );
      const { latitude, longitude } = pos.coords;
      const res = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
      );
      const j = (await res.json()) as { countryCode?: string };
      const cc = String(j?.countryCode || "").toUpperCase();
      if (/^[A-Z]{2}$/.test(cc)) {
        setInfo(getCountryInfo(cc));
        setSource("gps");
        saveStored({ code: cc, source: "gps", ts: Date.now() });
      }
    } catch {
      // user denied or offline — silently keep IP value
    } finally {
      setLoading(false);
    }
  }, []);

  const value = useMemo<CountryState>(
    () => ({ info, source, loading, requestPreciseLocation }),
    [info, source, loading, requestPreciseLocation],
  );

  return <CountryContext.Provider value={value}>{children}</CountryContext.Provider>;
}

export function useCountry(): CountryState {
  const ctx = useContext(CountryContext);
  if (!ctx) {
    return { info: null, source: "none", loading: false, requestPreciseLocation: async () => {} };
  }
  return ctx;
}
