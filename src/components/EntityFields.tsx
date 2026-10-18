// Entity Truth Card fields inside the existing profile page.
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ShieldCheck, Lock } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { COUNTRY_NAMES, normalizeUrl } from "@/lib/entity-consistency";
import { verifyEntityCard, requestEntityUnlock, getEntityPrices } from "@/lib/entity.functions";
import { CostBadge } from "@/components/CostBadge";
import { useEffect } from "react";

const TX = {
  ar: {
    unlock: "فتح للتعديل (يُخصم من رصيدك)",
    nobal: "رصيدك غير كافٍ",
    err: "حدث خطأ، حاول مجدداً",
    unlocked: "تم فتح البطاقة للتعديل. بعد التعديل اضغط «توثيق وتثبيت».",
    h: "هوية الكيان (بطاقة الحقيقة)",
    hint: "تُستخدم في الأدوات لتحديد الكيان الصحيح. الروابط اختيارية؛ لا تحفظ معلومات غير مؤكدة كحقائق.",
    type: "نوع الكيان",
    types: {
      product_company: "شركة تبيع منتجاتها أو خدماتها",
      marketing_company: "شركة تسويق",
      news_agency: "وكالة إخبارية",
      content_creator: "صانع محتوى",
      public_figure: "شخصية عامة",
      individual: "فرد",
      multi_client_agency: "وكالة تسويق متعددة العملاء",
    },
    hq: "المقر الرئيسي",
    mk: "الأسواق التي تخدمها",
    sp: "التخصص ونطاق الخدمات",
    links: "روابط الموقع أو الحسابات الرسمية (سطر لكل رابط)",
    save: "حفظ الهوية",
    verify: "توثيق وتثبيت (مرة واحدة، يُخصم من رصيدك)",
    locked: "البطاقة موثّقة ومقفلة. لتعديلها استخدم «فتح للتعديل» بالكلفة الظاهرة.",
    ok: "تم التوثيق",
    conf: "مؤكد من المصدر",
    unconf: "غير مؤكد",
    incomplete: "أكمل اسم العلامة والمقر أولاً",
    none: "—",
  },
  en: {
    unlock: "Unlock for editing (charged to your balance)",
    nobal: "Insufficient balance",
    err: "Something went wrong, try again",
    unlocked: "Card unlocked. After editing, press “Verify & lock”.",
    h: "Entity identity (truth card)",
    hint: "Used by tools to resolve entity identity. Links are optional; do not save unconfirmed information as fact.",
    type: "Entity type",
    types: {
      product_company: "Company selling its own products or services",
      marketing_company: "Marketing company",
      news_agency: "News agency",
      content_creator: "Content creator",
      public_figure: "Public figure",
      individual: "Individual",
      multi_client_agency: "Marketing agency serving multiple clients",
    },
    hq: "Headquarters",
    mk: "Markets you serve",
    sp: "Specialty & service scope",
    links: "Official website or account links (one per line)",
    save: "Save identity",
    verify: "Verify & lock (once, charged to your balance)",
    locked: "Card verified and locked. To edit, use “Unlock for editing” at the shown cost.",
    ok: "Verified",
    conf: "Confirmed by source",
    unconf: "Not confirmed",
    incomplete: "Fill brand name and HQ first",
    none: "—",
  },
  ku: {
    unlock: "کردنەوە بۆ دەستکاری (لە باڵانسەکەت دەبڕدرێت)",
    nobal: "باڵانس بەس نییە",
    err: "هەڵەیەک ڕوویدا",
    unlocked: "کارتەکە کرایەوە. دوای دەستکاری «پشتڕاستکردنەوە» بکە.",
    h: "ناسنامەی کیان (کارتی ڕاستی)",
    hint: "ئامرازەکان بۆ ناسینەوەی کیانی دروست بەکاری دەهێنن. بەستەرەکان ئارەزوومەندانەن؛ زانیاری پشتڕاستنەکراو وەک ڕاستی مەپارێزە.",
    type: "جۆری کیان",
    types: {
      product_company: "کۆمپانیا کە بەرهەم یان خزمەتگوزاریی خۆی دەفرۆشێت",
      marketing_company: "کۆمپانیای بازاڕکردن",
      news_agency: "ئاژانسی هەواڵ",
      content_creator: "دروستکەری ناوەڕۆک",
      public_figure: "کەسایەتی گشتی",
      individual: "تاک",
      multi_client_agency: "ئاژانسی بازاڕکردن بۆ چەند کڕیار",
    },
    hq: "بارەگای سەرەکی",
    mk: "ئەو بازاڕانەی خزمەتیان دەکەیت",
    sp: "پسپۆڕی و بواری خزمەتگوزاری",
    links: "بەستەری فەرمی ماڵپەڕ یان هەژمارەکان (هەر یەک لە دێڕێک)",
    save: "پاشەکەوتکردنی ناسنامە",
    verify: "پشتڕاستکردنەوە و قوفڵکردن",
    locked: "کارتەکە پشتڕاستکراوە و قوفڵە.",
    ok: "پشتڕاستکرا",
    conf: "لە سەرچاوە پشتڕاستکرا",
    unconf: "پشتڕاست نەکراو",
    incomplete: "سەرەتا ناو و بارەگا پڕبکەوە",
    none: "—",
  },
};

const SOCIAL = /(instagram|tiktok|facebook|fb\.com|x\.com|twitter|youtube|youtu\.be|linkedin|snapchat|threads|telegram|t\.me)/i;
export const ENTITY_TYPES = [
  "product_company",
  "marketing_company",
  "news_agency",
  "content_creator",
  "public_figure",
  "individual",
  "multi_client_agency",
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export function normalizeEntityType(value: unknown): EntityType {
  const type = String(value || "").trim().toLowerCase();
  if ((ENTITY_TYPES as readonly string[]).includes(type)) return type as EntityType;
  if (type === "person" || type === "creator") return "content_creator";
  if (type === "agency" || type === "marketing_agency") return "multi_client_agency";
  if (type === "marketing" || type === "marketing_company") return "marketing_company";
  if (type === "news" || type === "publisher") return "news_agency";
  if (type === "public_person" || type === "public-figure") return "public_figure";
  if (type === "individual") return "individual";
  return "product_company";
}

/** Suggest only broad types inferable from links; never infer news, agency, or public status. */
export function suggestEntityType(links: string): EntityType {
  const values = String(links || "").split(/\n+/).map((s) => s.trim()).filter(Boolean);
  if (!values.length) return "individual";
  return values.every((url) => SOCIAL.test(url)) ? "content_creator" : "product_company";
}

export type EntityDraft = {
  type: EntityType;
  hq: string;
  mk: string[];
  sp: string;
  links: string;
};

export function entityDraftFrom(profile: any): EntityDraft {
  const links = Array.isArray(profile?.entity_links) ? profile.entity_links : [];
  const legacyType = profile?.entity_type;
  const type = legacyType === "organization"
    ? suggestEntityType(links.join("\n")) === "individual" ? "product_company" : suggestEntityType(links.join("\n"))
    : normalizeEntityType(legacyType);
  return {
    type,
    hq: profile?.hq_country || "",
    mk: Array.isArray(profile?.target_markets) ? profile.target_markets : [],
    sp: profile?.specialty_scope || "",
    links: links.join("\n"),
  };
}

export function entityUpdateFrom(d: EntityDraft) {
  return {
    entity_type: normalizeEntityType(d.type),
    hq_country: d.hq || null,
    target_markets: d.mk,
    specialty_scope: d.sp.slice(0, 400) || null,
    entity_links: Array.from(
      new Set(d.links.split(/\n+/).map((s) => normalizeUrl(s)).filter(Boolean) as string[]),
    ).slice(0, 10),
  };
}

export function EntityFields({ profile, value, onChange, onSaveAll, onSaved }: { profile: any; value: EntityDraft; onChange: (d: EntityDraft) => void; onSaveAll: () => Promise<boolean>; onSaved: () => Promise<void> | void }) {
  const { lang } = useI18n();
  const L = (lang === "en" || lang === "ku" ? lang : "ar") as "ar" | "en" | "ku";
  const T = TX[L];
  const verifyFn = useServerFn(verifyEntityCard);
  const { type, hq, mk, sp, links } = value;
  const set = (patch: Partial<EntityDraft>) => onChange({ ...value, ...patch });
  const setType = (v: EntityType) => set({ type: v });
  const setHq = (v: string) => set({ hq: v });
  const setMk = (f: (p: string[]) => string[]) => set({ mk: f(mk) });
  const setSp = (v: string) => set({ sp: v });
  const setLinks = (v: string) => set({ links: v });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const unlockFn = useServerFn(requestEntityUnlock);
  const pricesFn = useServerFn(getEntityPrices);
  const [prices, setPrices] = useState<{ verify: { tokens: number; usd: number }; unlock: { tokens: number; usd: number } } | null>(null);
  useEffect(() => { pricesFn().then(setPrices).catch(() => {}); }, []);
  const errText = (e: string) => /balance|insufficient|limit/i.test(e) ? T.nobal : e === "incomplete" ? T.incomplete : T.err;
  async function unlock() {
    setBusy(true); setMsg("");
    try {
      const r: any = await unlockFn();
      setMsg(r.ok ? T.unlocked : errText(String(r.error)));
      await onSaved();
    } catch { setMsg(T.err); } finally { setBusy(false); }
  }

  const locked = !!profile?.entity_locked;
  const facts = profile?.entity_facts || {};

  async function verify() {
    setBusy(true); setMsg("");
    try {
      if (!(await onSaveAll())) return;
      const r: any = await verifyFn();
      setMsg(r.ok ? T.ok : errText(String(r.error)));
      await onSaved();
    } catch { setMsg(T.err); } finally { setBusy(false); }
  }

  const label = (k: string) => k.startsWith("market:") ? `${T.mk}: ${COUNTRY_NAMES[k.slice(7)]?.[L] || k.slice(7)}` : k === "brand_name" ? "Brand" : k === "hq_country" ? T.hq : k;
  const cls = "w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm disabled:opacity-60";

  return (
    <div className="space-y-3 rounded-xl border border-primary/20 bg-background/30 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-primary">
        {locked ? <Lock className="size-4" /> : <ShieldCheck className="size-4" />} {T.h}
      </div>
      <p className="text-xs text-muted-foreground">{locked ? T.locked : T.hint}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs">{T.type}
          <select value={type} disabled={locked} onChange={(e) => setType(e.target.value as EntityType)} className={cls}>
            {ENTITY_TYPES.map((entityType) => (
              <option key={entityType} value={entityType}>{T.types[entityType]}</option>
            ))}
          </select>
          {!locked && (() => {
            const suggested = suggestEntityType(links);
            return suggested !== type ? (
              <button type="button" onClick={() => setType(suggested)} className="mt-1 block text-[11px] text-primary underline">
                {(L === "en" ? "Suggested from your links: " : L === "ku" ? "پێشنیار لە بەستەرەکانت: " : "مقترح من روابطك: ") + T.types[suggested]}
              </button>
            ) : null;
          })()}
        </label>
        <label className="text-xs">{T.hq}
          <select value={hq} disabled={locked} onChange={(e) => setHq(e.target.value)} className={cls}>
            <option value="">{T.none}</option>
            {Object.keys(COUNTRY_NAMES).map((c) => <option key={c} value={c}>{COUNTRY_NAMES[c][L]}</option>)}
          </select>
        </label>
      </div>
      <div className="text-xs">{T.mk}
        <div className="mt-1 flex flex-wrap gap-1.5">
          {Object.keys(COUNTRY_NAMES).map((c) => {
            const on = mk.includes(c);
            return <button key={c} type="button" disabled={locked} onClick={() => setMk((p) => on ? p.filter((x) => x !== c) : [...p, c])}
              className={`rounded-md border px-2 py-0.5 ${on ? "border-primary bg-primary/10" : "border-border"} disabled:opacity-60`}>{COUNTRY_NAMES[c][L]}</button>;
          })}
        </div>
      </div>
      <label className="block text-xs">{T.sp}<input value={sp} disabled={locked} onChange={(e) => setSp(e.target.value)} className={cls} /></label>
      <label className="block text-xs">{T.links}<textarea rows={3} value={links} disabled={locked} onChange={(e) => setLinks(e.target.value)} className={cls} /></label>
      {!locked && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={verify} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50">
            {busy && <Loader2 className="size-3.5 animate-spin" />} {T.verify}
          </button>
          {prices && !profile?.entity_unlock_granted && <CostBadge tokens={prices.verify.tokens} usd={prices.verify.usd} compact />}
        </div>
      )}
      {locked && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={unlock} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-primary px-3 py-1.5 text-xs font-semibold text-primary disabled:opacity-50">
            {busy && <Loader2 className="size-3.5 animate-spin" />} {T.unlock}
          </button>
          {prices && <CostBadge tokens={prices.unlock.tokens} usd={prices.unlock.usd} compact />}
        </div>
      )}
      {msg && <div className="text-xs text-muted-foreground">{msg}</div>}
      {profile?.entity_verified_at && (
        <div className="text-xs space-y-0.5">
          {(facts.confirmed || []).map((k: string) => <div key={k} className="text-primary">✓ {T.conf}: {label(k)}</div>)}
          {(facts.unconfirmed || []).map((k: string) => <div key={k} className="text-muted-foreground">○ {T.unconf}: {label(k)}</div>)}
        </div>
      )}
    </div>
  );
}
