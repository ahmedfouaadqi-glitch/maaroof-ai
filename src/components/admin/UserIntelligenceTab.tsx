import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RefreshCw, Brain, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getUserIntelligence, refreshUserIntent } from "@/lib/cognition.functions";
import { adminSetAppSetting } from "@/lib/admin.functions";
import { useAdminL } from "./admin-i18n";
import { SpecialtyRequestsPanel } from "./SpecialtyRequestsPanel";

export function UserIntelligenceTab() {
  const L = useAdminL({
    title: { ar: "طبقة الإدراك", en: "Cognitive layer", ku: "چینی تێگەیشتن" },
    toggleOn: { ar: "مُفعَّل", en: "Enabled", ku: "چالاکە" },
    toggleOff: { ar: "مُعطَّل", en: "Disabled", ku: "ناچالاکە" },
    toggleHelp: { ar: "كشف النوايا بعد كل تشغيل أداة.", en: "(intent detection after each tool run)", ku: "" },
    searchPh: { ar: "بحث بالبريد / التخصص / الملخّص", en: "Search email / specialty / summary", ku: "گەڕان" },
    allGoals: { ar: "كل الأهداف", en: "All goals", ku: "هەموو ئامانجەکان" },
    allUrgency: { ar: "كل درجات الإلحاح", en: "All urgency", ku: "هەموو" },
    reload: { ar: "إعادة تحميل", en: "Reload", ku: "نوێکردنەوە" },
    empty: { ar: "لا توجد ملفّات نوايا بعد. تظهر بعد تشغيل المستخدمين للأدوات.", en: "No intent profiles yet. They appear after users run tools.", ku: "" },
    email: { ar: "البريد", en: "Email", ku: "ئیمەیڵ" },
    specialty: { ar: "التخصص", en: "Specialty", ku: "بوار" },
    goal: { ar: "الهدف", en: "Goal", ku: "ئامانج" },
    urgency: { ar: "الإلحاح", en: "Urgency", ku: "پەلە" },
    audience: { ar: "الجمهور", en: "Audience", ku: "ئامادەبووان" },
    gap: { ar: "الفجوة", en: "Gap", ku: "بۆشایی" },
    opportunity: { ar: "الفرصة", en: "Opportunity", ku: "دەرفەت" },
    signals: { ar: "الإشارات", en: "Signals", ku: "نیشانە" },
    reset: { ar: "تصفير", en: "Reset", ku: "ڕێسیت" },
    resetTitle: { ar: "تصفير ملف النوايا", en: "Reset intent", ku: "ڕێسیت" },
  });
  const callList = useServerFn(getUserIntelligence);
  const callRefresh = useServerFn(refreshUserIntent);
  const setSetting = useServerFn(adminSetAppSetting);

  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filterGoal, setFilterGoal] = useState<string>("");
  const [filterUrgency, setFilterUrgency] = useState<string>("");
  const [enabled, setEnabled] = useState(true);
  const [savingToggle, setSavingToggle] = useState(false);

  const load = async () => {
    setLoading(true);
    try { const r = await callList(); setRows((r as any).rows || []); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    (async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "cognition_enabled").maybeSingle();
      if (data?.value && (data.value as any).enabled === false) setEnabled(false);
    })();
  }, []);

  const toggle = async (v: boolean) => {
    setEnabled(v); setSavingToggle(true);
    try { await setSetting({ data: { key: "cognition_enabled", value: { enabled: v } as any } }); }
    finally { setSavingToggle(false); }
  };

  const filtered = rows.filter((r) => {
    if (q && !(`${r.email || ""} ${r.specialty || ""} ${r.context_summary || ""}`.toLowerCase().includes(q.toLowerCase()))) return false;
    if (filterGoal && r.detected_intent?.primary_goal !== filterGoal) return false;
    if (filterUrgency && r.detected_intent?.urgency !== filterUrgency) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-border bg-card/60 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Brain className="size-5 text-primary" />
            <h3 className="font-semibold">{L.title}</h3>
          </div>
          <label className="inline-flex items-center gap-2 text-xs">
            <input type="checkbox" checked={enabled} onChange={(e) => toggle(e.target.checked)} disabled={savingToggle} />
            <span>{enabled ? L.toggleOn : L.toggleOff} {L.toggleHelp}</span>
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card/60 p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute start-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={L.searchPh}
              className="rounded-lg border border-border bg-background/60 ps-7 pe-3 py-1.5 text-xs" />
          </div>
          <select value={filterGoal} onChange={(e) => setFilterGoal(e.target.value)} className="rounded-lg border border-border bg-background/60 px-2 py-1.5 text-xs">
            <option value="">{L.allGoals}</option>
            {["growth","crisis","competitor","launch","retention","exploration"].map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          <select value={filterUrgency} onChange={(e) => setFilterUrgency(e.target.value)} className="rounded-lg border border-border bg-background/60 px-2 py-1.5 text-xs">
            <option value="">{L.allUrgency}</option>
            {["low","medium","high"].map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          <button onClick={load} className="ms-auto inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs">
            <RefreshCw className="size-3.5" /> {L.reload}
          </button>
        </div>

        {loading ? (
          <div className="grid h-40 place-items-center"><Loader2 className="size-6 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-6">{L.empty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr className="border-b border-border/60">
                  <th className="px-2 py-2 text-start">{L.email}</th>
                  <th className="px-2 py-2 text-start">{L.specialty}</th>
                  <th className="px-2 py-2 text-start">{L.goal}</th>
                  <th className="px-2 py-2 text-start">{L.urgency}</th>
                  <th className="px-2 py-2 text-start">{L.audience}</th>
                  <th className="px-2 py-2 text-start">{L.gap}</th>
                  <th className="px-2 py-2 text-start">{L.opportunity}</th>
                  <th className="px-2 py-2 text-end">{L.signals}</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const i = r.detected_intent || {};
                  return (
                    <tr key={r.user_id} className="border-b border-border/40 align-top">
                      <td className="px-2 py-2 font-mono text-[10px]">{r.email || r.user_id.slice(0, 8)}</td>
                      <td className="px-2 py-2">{r.specialty || "—"}</td>
                      <td className="px-2 py-2"><span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">{i.primary_goal || "—"}</span></td>
                      <td className="px-2 py-2">{i.urgency || "—"}</td>
                      <td className="px-2 py-2 max-w-[140px] truncate" title={i.audience}>{i.audience || "—"}</td>
                      <td className="px-2 py-2 max-w-[180px] truncate" title={i.gap}>{i.gap || "—"}</td>
                      <td className="px-2 py-2 max-w-[180px] truncate" title={i.opportunity}>{i.opportunity || "—"}</td>
                      <td className="px-2 py-2 text-end font-mono">{r.signal_count}</td>
                      <td className="px-2 py-2">
                        <button onClick={async () => { await callRefresh({ data: { userId: r.user_id } }); await load(); }}
                          className="rounded-md border border-border px-2 py-1 text-[10px]" title={L.resetTitle}>{L.reset}</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
