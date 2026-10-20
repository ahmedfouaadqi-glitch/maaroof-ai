import { ACCOUNT_KINDS, isAccountKind, kindToEntityType, presenceNotes } from "@/lib/account-kinds";
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
  ar: { unlock: "فتح للتعديل (يُخصم من رصيدك)", nobal: "رصيدك غير كافٍ", err: "حدث خطأ، حاول مجدداً", unlocked: "تم فتح البطاقة للتعديل. بعد التعديل اضغط «توثيق وتثبيت».", h: "هوية علامتك (بطاقة الحقيقة)", hint: "تُستخدم في كل الأدوات لتنبيهك عند تعارض النص مع هويتك. الروابط اختيارية ولا نطلب تعديل البايو.", type: "نوع الكيان", org: "منشأة / شركة", person: "شخص / صانع محتوى", hq: "المقر الرئيسي", mk: "الأسواق التي تخدمها", sp: "التخصص ونطاق الخدمات", links: "روابط الموقع أو الحسابات (سطر لكل رابط)", save: "حفظ الهوية", verify: "توثيق وتثبيت (مرة واحدة، يُخصم من رصيدك)", locked: "البطاقة موثّقة ومقفلة. لتعديلها استخدم «فتح للتعديل» بالكلفة الظاهرة.", ok: "تم التوثيق", conf: "مؤكد من المصدر", unconf: "غير مؤكد", incomplete: "أكمل اسم العلامة والمقر أولاً", none: "—" },
  en: { unlock: "Unlock for editing (charged to your balance)", nobal: "Insufficient balance", err: "Something went wrong, try again", unlocked: "Card unlocked. After editing, press “Verify & lock”.", h: "Your brand identity (truth card)", hint: "Used by every tool to warn you when a text conflicts with your identity. Links are optional; no bio change needed.", type: "Entity type", org: "Organization / company", person: "Person / creator", hq: "Headquarters", mk: "Markets you serve", sp: "Specialty & service scope", links: "Website or profile links (one per line)", save: "Save identity", verify: "Verify & lock (once, charged to your balance)", locked: "Card verified and locked. To edit, use “Unlock for editing” at the shown cost.", ok: "Verified", conf: "Confirmed by source", unconf: "Not confirmed", incomplete: "Fill brand name and HQ first", none: "—" },
  ku: { unlock: "کردنەوە بۆ دەستکاری (لە باڵانسەکەت دەبڕدرێت)", nobal: "باڵانس بەس نییە", err: "هەڵەیەک ڕوویدا", unlocked: "کارتەکە کرایەوە. دوای دەستکاری «پشتڕاستکردنەوە» بکە.", h: "ناسنامەی براندەکەت", hint: "لە هەموو ئامرازەکاندا بەکاردێت بۆ ئاگادارکردنەوە. بەستەرەکان ئارەزوومەندانەن.", type: "جۆری کیان", org: "دامەزراوە / کۆمپانیا", person: "کەس / دروستکەری ناوەڕۆک", hq: "بارەگای سەرەکی", mk: "ئەو بازاڕانەی خزمەتیان دەکەیت", sp: "پسپۆڕی و بواری خزمەتگوزاری", links: "بەستەرەکان (هەر یەکە لە دێڕێک)", save: "پاشەکەوت", verify: "پشتڕاستکردنەوە و قوفڵکردن", locked: "کارتەکە پشتڕاستکراوە و قوفڵە.", ok: "پشتڕاستکرا", conf: "پشتڕاستکراو", unconf: "پشتڕاست نەکراو", incomplete: "سەرەتا ناو و بارەگا پڕبکەوە", none: "—" },
};

const SOCIAL = /(instagram|tiktok|facebook|fb\.com|x\.com|twitter|youtube|youtu\.be|linkedin|snapchat|threads|telegram|t\.me)/i;
/** No links -> individual; only social links -> creator; any website -> organization. */
export function suggestEntityType(links: string): "organization" | "person" | "individual" {
  const l = String(links || "").split(/\n+/).map((s) => s.trim()).filter(Boolean);
  if (!l.length) return "individual";
  return l.every((u) => SOCIAL.test(u)) ? "person" : "organization";
}
export type EntityDraft = { kind?: string; type: string; hq: string; mk: string[]; sp: string; links: string };
export function entityDraftFrom(profile: any): EntityDraft {
  return {
    kind: profile?.account_kind || "", type: profile?.entity_type || "organization", hq: profile?.hq_country || "", mk: profile?.target_markets || [],
    sp: profile?.specialty_scope || "", links: (Array.isArray(profile?.entity_links) ? profile.entity_links : []).join("\n"),
  };
}
export function entityUpdateFrom(d: EntityDraft) {
  return {
    ...(isAccountKind(d.kind) ? { account_kind: d.kind } : {}), entity_type: d.type, hq_country: d.hq || null, target_markets: d.mk, specialty_scope: d.sp.slice(0, 400) || null,
    entity_links: Array.from(new Set(d.links.split(/\n+/).map((s) => normalizeUrl(s)).filter(Boolean) as string[])).slice(0, 10),
  };
}

export function EntityFields({ profile, value, onChange, onSaveAll, onSaved }: { profile: any; value: EntityDraft; onChange: (d: EntityDraft) => void; onSaveAll: () => Promise<boolean>; onSaved: () => Promise<void> | void }) {
  const { lang } = useI18n();
  const L = (lang === "en" || lang === "ku" ? lang : "ar") as "ar" | "en" | "ku";
  const T = TX[L];
  const verifyFn = useServerFn(verifyEntityCard);
  const { type, hq, mk, sp, links } = value;
  const set = (patch: Partial<EntityDraft>) => onChange({ ...value, ...patch });
  const setType = (v: string) => set({ type: v });
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
        <label className="text-xs sm:col-span-2">{L === "en" ? "Account type" : L === "ku" ? "جۆری هەژمار" : "نوع الحساب"}
          <select value={value.kind || ""} disabled={locked} onChange={(e) => { const k = e.target.value; set(isAccountKind(k) ? { kind: k, type: kindToEntityType(k) } : { kind: "" }); }} className={cls}>
            <option value="">{T.none}</option>
            {ACCOUNT_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label[L]}</option>)}
          </select>
          {presenceNotes(links.split(/\n+/), isAccountKind(value.kind) ? value.kind : null, L).map((n) => (
            <span key={n} className="mt-1 block text-[11px] text-warning">{n}</span>
          ))}
        </label>
        <label className="text-xs">{T.type}
          <select value={type} disabled={locked} onChange={(e) => setType(e.target.value)} className={cls}>
            <option value="organization">{T.org}</option><option value="person">{T.person}</option><option value="individual">{L === "en" ? "Individual — no website or accounts" : L === "ku" ? "تاک — بێ ماڵپەڕ و هەژمار" : "فرد — بلا موقع ولا حسابات"}</option>
          </select>
          {!locked && (() => { const sug = suggestEntityType(links); return sug !== type ? (
            <button type="button" onClick={() => setType(sug)} className="mt-1 block text-[11px] text-primary underline">
              {(L === "en" ? "Suggested from your links: " : L === "ku" ? "پێشنیار لە بەستەرەکانت: " : "مقترح من روابطك: ") + (sug === "organization" ? T.org : sug === "person" ? T.person : (L === "en" ? "Individual" : L === "ku" ? "تاک" : "فرد بلا موقع"))}
            </button>) : null; })()}
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
