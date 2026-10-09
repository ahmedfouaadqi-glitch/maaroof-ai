// Entity Truth Card fields inside the existing profile page.
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ShieldCheck, Lock } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { COUNTRY_NAMES } from "@/lib/entity-consistency";
import { verifyEntityCard } from "@/lib/entity.functions";

const TX = {
  ar: { h: "هوية علامتك (بطاقة الحقيقة)", hint: "تُستخدم في كل الأدوات لتنبيهك عند تعارض النص مع هويتك. الروابط اختيارية ولا نطلب تعديل البايو.", type: "نوع الكيان", org: "منشأة / شركة", person: "شخص / صانع محتوى", hq: "المقر الرئيسي", mk: "الأسواق التي تخدمها", sp: "التخصص ونطاق الخدمات", links: "روابط الموقع أو الحسابات (سطر لكل رابط)", save: "حفظ الهوية", verify: "توثيق وتثبيت (مرة واحدة، يُخصم من رصيدك)", locked: "البطاقة موثّقة ومقفلة — لتعديلها اطلب إعادة فتح من الإدارة.", ok: "تم التوثيق", conf: "مؤكد من المصدر", unconf: "غير مؤكد", incomplete: "أكمل اسم العلامة والمقر أولاً", none: "—" },
  en: { h: "Your brand identity (truth card)", hint: "Used by every tool to warn you when a text conflicts with your identity. Links are optional; no bio change needed.", type: "Entity type", org: "Organization / company", person: "Person / creator", hq: "Headquarters", mk: "Markets you serve", sp: "Specialty & service scope", links: "Website or profile links (one per line)", save: "Save identity", verify: "Verify & lock (once, charged to your balance)", locked: "Card verified and locked — ask the admin to reopen it for edits.", ok: "Verified", conf: "Confirmed by source", unconf: "Not confirmed", incomplete: "Fill brand name and HQ first", none: "—" },
  ku: { h: "ناسنامەی براندەکەت", hint: "لە هەموو ئامرازەکاندا بەکاردێت بۆ ئاگادارکردنەوە. بەستەرەکان ئارەزوومەندانەن.", type: "جۆری کیان", org: "دامەزراوە / کۆمپانیا", person: "کەس / دروستکەری ناوەڕۆک", hq: "بارەگای سەرەکی", mk: "ئەو بازاڕانەی خزمەتیان دەکەیت", sp: "پسپۆڕی و بواری خزمەتگوزاری", links: "بەستەرەکان (هەر یەکە لە دێڕێک)", save: "پاشەکەوت", verify: "پشتڕاستکردنەوە و قوفڵکردن", locked: "کارتەکە پشتڕاستکراوە و قوفڵە.", ok: "پشتڕاستکرا", conf: "پشتڕاستکراو", unconf: "پشتڕاست نەکراو", incomplete: "سەرەتا ناو و بارەگا پڕبکەوە", none: "—" },
};

export function EntityFields({ profile, userId, onSaved }: { profile: any; userId: string; onSaved: () => Promise<void> | void }) {
  const { lang } = useI18n();
  const L = (lang === "en" || lang === "ku" ? lang : "ar") as "ar" | "en" | "ku";
  const T = TX[L];
  const verifyFn = useServerFn(verifyEntityCard);
  const [type, setType] = useState("organization");
  const [hq, setHq] = useState("");
  const [mk, setMk] = useState<string[]>([]);
  const [sp, setSp] = useState("");
  const [links, setLinks] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!profile) return;
    setType(profile.entity_type || "organization");
    setHq(profile.hq_country || "");
    setMk(profile.target_markets || []);
    setSp(profile.specialty_scope || "");
    setLinks((Array.isArray(profile.entity_links) ? profile.entity_links : []).join("\n"));
  }, [profile]);

  const locked = !!profile?.entity_locked;
  const facts = profile?.entity_facts || {};

  async function save() {
    setBusy(true); setMsg("");
    const { error } = await supabase.from("profiles").update({
      entity_type: type, hq_country: hq || null, target_markets: mk, specialty_scope: sp.slice(0, 400) || null,
      entity_links: links.split(/\n+/).map((s) => s.trim()).filter(Boolean).slice(0, 10),
    } as any).eq("id", userId);
    setMsg(error ? error.message : "✓");
    await onSaved(); setBusy(false);
  }

  async function verify() {
    setBusy(true); setMsg("");
    try {
      await save();
      const r: any = await verifyFn();
      setMsg(r.ok ? T.ok : r.error === "incomplete" ? T.incomplete : String(r.error));
      await onSaved();
    } catch (e: any) { setMsg(String(e?.message || e)); } finally { setBusy(false); }
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
          <select value={type} disabled={locked} onChange={(e) => setType(e.target.value)} className={cls}>
            <option value="organization">{T.org}</option><option value="person">{T.person}</option>
          </select>
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
          <button type="button" onClick={save} disabled={busy} className="rounded-lg border border-border px-3 py-1.5 text-xs">{T.save}</button>
          <button type="button" onClick={verify} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50">
            {busy && <Loader2 className="size-3.5 animate-spin" />} {T.verify}
          </button>
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
