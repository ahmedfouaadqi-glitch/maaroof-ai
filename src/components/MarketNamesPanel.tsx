// Names per target market, each with a real evidence link or owner confirmation.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { COUNTRY_NAMES } from "@/lib/entity-consistency";
import { marketStatus, nameConsistency, type MarketName } from "@/lib/market-names";

type L3 = "ar" | "en" | "ku";
const TX = {
  ar: { h: "اسمك في كل سوق", name: "الاسم في هذا السوق", ev: "رابط الدليل (اختياري)", add: "إضافة", own: "أؤكد أنا هذا السوق", ec: "مؤكد بدليل", oc: "مؤكد من المالك", un: "غير مؤكد", diff: "تنبيه: كتابة الاسم تختلف بين الأسواق", none: "اختر الأسواق أولاً." },
  en: { h: "Your name in each market", name: "Name in this market", ev: "Evidence link (optional)", add: "Add", own: "I confirm this market", ec: "Confirmed by evidence", oc: "Confirmed by owner", un: "Not confirmed", diff: "Warning: the name is spelled differently across markets", none: "Choose markets first." },
  ku: { h: "ناوت لە هەر بازاڕێک", name: "ناو لەم بازاڕەدا", ev: "بەستەری بەڵگە (ئارەزوومەندانە)", add: "زیادکردن", own: "من ئەم بازاڕە پشتڕاست دەکەمەوە", ec: "پشتڕاستکراو بە بەڵگە", oc: "پشتڕاستکراو لەلایەن خاوەن", un: "پشتڕاست نەکراو", diff: "ئاگاداری: ناوەکە جیاواز دەنووسرێت", none: "سەرەتا بازاڕەکان هەڵبژێرە." },
};

export function MarketNamesPanel({ markets, lang }: { markets: string[]; lang: L3 }) {
  const T = TX[lang];
  const [rows, setRows] = useState<(MarketName & { id: string })[]>([]);
  const [draft, setDraft] = useState<Record<string, { name: string; ev: string }>>({});
  const load = async () => {
    const { data } = await supabase.from("entity_market_names").select("id, country_code, name, lang, status, evidence_url").order("created_at");
    setRows((data as any) || []);
  };
  useEffect(() => { load(); }, []);
  const add = async (c: string, ownerConfirm = false) => {
    const d = draft[c]; const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const name = d?.name?.trim() || rows.find((r) => r.country_code === c)?.name;
    if (!name) return;
    const ev = d?.ev?.trim(); const url = ev && /^https?:\/\//i.test(ev) ? ev : null;
    await supabase.from("entity_market_names").upsert({ user_id: u.user.id, country_code: c, name, lang, evidence_url: url, status: ownerConfirm ? "owner_confirmed" : "unconfirmed" }, { onConflict: "user_id,country_code,lang,name" });
    setDraft((p) => ({ ...p, [c]: { name: "", ev: "" } })); load();
  };
  const variants = nameConsistency(rows);
  if (!markets.length) return <div className="text-xs text-muted-foreground">{T.none}</div>;
  return (
    <div className="rounded-lg border border-border p-3 text-xs space-y-2">
      <div className="font-semibold">{T.h}</div>
      {variants.length > 0 && <div className="text-destructive">{T.diff}: {variants.map((v) => v.variants.join(" / ")).join(" · ")}</div>}
      {markets.map((c) => {
        const st = marketStatus(rows, c);
        const mine = rows.filter((r) => r.country_code === c);
        return (
          <div key={c} className="rounded-md bg-muted/40 p-2 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{COUNTRY_NAMES[c]?.[lang] || c}</span>
              <span className={st === "unconfirmed" ? "text-muted-foreground" : "text-primary"}>{st === "evidence_confirmed" ? T.ec : st === "owner_confirmed" ? T.oc : T.un}</span>
            </div>
            {mine.map((r) => <div key={r.id} className="flex gap-2"><span>{r.name}</span>{r.evidence_url && <a href={r.evidence_url} target="_blank" rel="noreferrer" className="text-primary underline" dir="ltr">↗</a>}</div>)}
            <div className="flex flex-wrap gap-1">
              <input placeholder={T.name} value={draft[c]?.name || ""} onChange={(e) => setDraft((p) => ({ ...p, [c]: { ...p[c], name: e.target.value, ev: p[c]?.ev || "" } }))} className="flex-1 min-w-24 rounded border border-border bg-background px-2 py-1" />
              <input placeholder={T.ev} dir="ltr" value={draft[c]?.ev || ""} onChange={(e) => setDraft((p) => ({ ...p, [c]: { name: p[c]?.name || "", ev: e.target.value } }))} className="flex-1 min-w-24 rounded border border-border bg-background px-2 py-1" />
              <button type="button" onClick={() => add(c)} className="rounded border border-primary px-2 text-primary">{T.add}</button>
              {st === "unconfirmed" && <button type="button" onClick={() => add(c, true)} className="rounded bg-primary px-2 text-primary-foreground">{T.own}</button>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
