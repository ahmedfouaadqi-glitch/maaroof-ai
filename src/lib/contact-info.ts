import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ContactInfo = {
  whatsapp_number: string;   // digits only, e.g. 9647733570130
  phone_display: string;     // human-readable, e.g. "+964 773 357 0130"
  email: string;
  address_ar: string;
  address_en: string;
  address_ku: string;
  hours_ar: string;
  hours_en: string;
  hours_ku: string;
  facebook: string;
  instagram: string;
  twitter: string;
  linkedin: string;
  telegram: string;
};

export const DEFAULT_CONTACT_INFO: ContactInfo = {
  whatsapp_number: "9613421964",
  phone_display: "+9613421964",
  email: "mark@jointmediahouse.agency",
  address_ar: "بيروت، لبنان",
  address_en: "Beirut, Lebanon",
  address_ku: "بەیروت، لوبنان",
  hours_ar: "السبت – الخميس · 9 ص – 6 م",
  hours_en: "Saturday – Thursday · 9 AM – 6 PM",
  hours_ku: "شەممە – پێنجشەممە · ٩ی بەیانی – ٦ی ئێوارە",
  facebook: "",
  instagram: "",
  twitter: "",
  linkedin: "",
  telegram: "",
};

const CACHE_KEY = "geo-contact-info";
let memoryCache: ContactInfo | null = null;

function merge(raw: any): ContactInfo {
  if (!raw || typeof raw !== "object") return DEFAULT_CONTACT_INFO;
  const out: any = { ...DEFAULT_CONTACT_INFO };
  for (const k of Object.keys(DEFAULT_CONTACT_INFO) as (keyof ContactInfo)[]) {
    if (typeof raw[k] === "string") out[k] = raw[k];
  }
  return out as ContactInfo;
}

function readCache(): ContactInfo {
  if (memoryCache) return memoryCache;
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(CACHE_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      memoryCache = merge(parsed);
      return memoryCache;
    }
  } catch {}
  return DEFAULT_CONTACT_INFO;
}

export function whatsappLinkFromInfo(info: ContactInfo, message: string): string {
  return `https://wa.me/${info.whatsapp_number}?text=${encodeURIComponent(message)}`;
}

export function useContactInfo() {
  const [info, setInfo] = useState<ContactInfo>(() => readCache());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "contact_info")
        .maybeSingle();
      if (cancelled) return;
      if (data?.value) {
        const next = merge(data.value);
        memoryCache = next;
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(next)); } catch {}
        setInfo(next);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return info;
}
