import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";

const T = {
  ar: { title: "طبقة السياق الذكي (MCI)", on: "مفعّلة", off: "متوقفة", runs: "تشغيلات جديدة", reused: "نتائج أُعيد استخدامها", llm: "استدعاءات ذكاء اصطناعي وُفّرت", fc: "عمليات بحث ويب وُفّرت", hint: "آخر 30 يوماً. الأرقام مقاسة فعلياً وليست تقديراً." },
  en: { title: "Context Intelligence layer (MCI)", on: "Enabled", off: "Disabled", runs: "Fresh runs", reused: "Reused results", llm: "AI calls saved", fc: "Web searches saved", hint: "Last 30 days. Measured, not estimated." },
  ku: { title: "چینی زیرەکی سیاق (MCI)", on: "چالاک", off: "ناچالاک", runs: "کارپێکردنی نوێ", reused: "ئەنجامی دووبارە بەکارهاتوو", llm: "بانگکردنی AI پاشەکەوتکراو", fc: "گەڕانی وێب پاشەکەوتکراو", hint: "٣٠ ڕۆژی ڕابردوو. پێوانەکراو." },
};

export function MciPanel() {
  const { lang } = useI18n();
  const L = T[(lang as "ar" | "en" | "ku")] || T.ar;
  const [enabled, setEnabled] = useState(true);
  const [st, setSt] = useState({ runs: 0, reused: 0, llm: 0, fc: 0 });

  useEffect(() => {
    supabase.from("app_settings").select("value").eq("key", "mci").maybeSingle().then(({ data }) => setEnabled((data as any)?.value?.enabled !== false));
    const since = new Date(Date.now() - 30 * 86400_000).toISOString();
    supabase.from("mci_decisions" as any).select("decision, llm_calls_saved, firecrawl_calls_saved").gte("created_at", since).limit(5000).then(({ data }) => {
      const rows = (data || []) as any[];
      setSt({
        runs: rows.filter((r) => r.decision === "execute").length,
        reused: rows.filter((r) => r.decision === "reuse").length,
        llm: rows.reduce((s, r) => s + (r.llm_calls_saved || 0), 0),
        fc: rows.reduce((s, r) => s + (r.firecrawl_calls_saved || 0), 0),
      });
    });
  }, []);

  const toggle = async () => {
    const v = !enabled; setEnabled(v);
    await supabase.from("app_settings").upsert({ key: "mci", value: { enabled: v } as any });
  };

  return (
    <div className="rounded-xl border border-border bg-card/50 p-4">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-sm font-semibold">{L.title}</h3>
        <button onClick={toggle} className={`ms-auto rounded-full px-3 py-1 text-xs ${enabled ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{enabled ? L.on : L.off}</button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {([["runs", st.runs], ["reused", st.reused], ["llm", st.llm], ["fc", st.fc]] as const).map(([k, v]) => (
          <div key={k} className="rounded-lg border border-border p-2 text-center"><div className="text-lg font-bold text-primary">{v}</div><div className="text-[11px] text-muted-foreground">{(L as any)[k]}</div></div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">{L.hint}</p>
    </div>
  );
}
