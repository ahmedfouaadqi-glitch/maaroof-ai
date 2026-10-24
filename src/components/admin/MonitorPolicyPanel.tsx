import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Bell, Save, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { adminGetMonitorPolicy, adminSetMonitorPolicy, adminSetUserMonitorOverride } from "@/lib/admin.functions";
import { DEFAULT_MONITOR_POLICY, type MonitorPolicy } from "@/lib/monitor-policy";

const TX = {
  ar: { title: "سياسة مراقبة المنافسين", hint: "المراقبة اختيار للمستخدم وتُخصم من حصته حسب سعر أداة «مراقبة المنافسين» في خطته. هنا تحدد الحدود العامة واستثناءات كل مستخدم.", enabled: "المراقبة مفعّلة", watches: "أقصى عدد مراقبات نشطة", comps: "أقصى عدد منافسين في المراقبة الواحدة", freq: "أقل تكرار مسموح (ساعات)", save: "حفظ", saved: "تم الحفظ", users: "استثناءات المستخدمين", email: "بريد المستخدم", add: "حفظ الاستثناء", remove: "إزالة", none: "لا توجد استثناءات." },
  en: { title: "Competitor monitoring policy", hint: "Monitoring is the user's choice and is charged from their quota at the Competitor Monitor price of their plan. Set global limits and per-user exceptions here.", enabled: "Monitoring enabled", watches: "Max active watches", comps: "Max competitors per watch", freq: "Minimum frequency (hours)", save: "Save", saved: "Saved", users: "Per-user exceptions", email: "User email", add: "Save exception", remove: "Remove", none: "No exceptions." },
  ku: { title: "سیاسەتی چاودێری ڕکابەران", hint: "چاودێری هەڵبژاردەی بەکارهێنەرە و لە بەشەکەی دەبڕدرێت. سنووری گشتی و ئاوارتەی هەر بەکارهێنەرێک لێرە دیاری بکە.", enabled: "چاودێری چالاکە", watches: "زۆرترین چاودێری چالاک", comps: "زۆرترین ڕکابەر بۆ هەر چاودێرییەک", freq: "کەمترین دووبارەبوونەوە (کاتژمێر)", save: "پاشەکەوت", saved: "پاشەکەوت کرا", users: "ئاوارتەی بەکارهێنەران", email: "ئیمەیڵی بەکارهێنەر", add: "پاشەکەوتی ئاوارتە", remove: "لابردن", none: "هیچ ئاوارتەیەک نییە." },
};

function Fields({ v, set, L }: { v: MonitorPolicy; set: (p: MonitorPolicy) => void; L: typeof TX.ar }) {
  const num = (k: keyof MonitorPolicy, label: string) => (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <input type="number" min={0} value={Number(v[k])} onChange={(e) => set({ ...v, [k]: Number(e.target.value) })} className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm" />
    </label>
  );
  return (
    <div className="grid gap-3 sm:grid-cols-4">
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={v.enabled} onChange={(e) => set({ ...v, enabled: e.target.checked })} /> {L.enabled}</label>
      {num("max_watches", L.watches)}
      {num("max_competitors", L.comps)}
      {num("min_frequency_hours", L.freq)}
    </div>
  );
}

export function MonitorPolicyPanel() {
  const { lang } = useI18n();
  const L = TX[(lang as "ar" | "en" | "ku") || "ar"] || TX.ar;
  const getFn = useServerFn(adminGetMonitorPolicy);
  const setFn = useServerFn(adminSetMonitorPolicy);
  const setUserFn = useServerFn(adminSetUserMonitorOverride);
  const [g, setG] = useState<MonitorPolicy>(DEFAULT_MONITOR_POLICY);
  const [users, setUsers] = useState<any[]>([]);
  const [email, setEmail] = useState("");
  const [u, setU] = useState<MonitorPolicy>(DEFAULT_MONITOR_POLICY);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = async () => {
    const r: any = await getFn();
    setG({ ...DEFAULT_MONITOR_POLICY, ...(r.global || {}) });
    setUsers(r.users || []);
  };
  useEffect(() => { load().catch(() => {}); }, []);

  const saveGlobal = async () => {
    setBusy(true); setMsg("");
    try { await setFn({ data: g }); setMsg(L.saved); } catch (e: any) { setMsg(e?.message || "error"); } finally { setBusy(false); }
  };
  const saveUser = async (em: string, monitor: MonitorPolicy | null) => {
    setBusy(true); setMsg("");
    try { await setUserFn({ data: { email: em, monitor } }); setMsg(L.saved); setEmail(""); await load(); } catch (e: any) { setMsg(e?.message || "error"); } finally { setBusy(false); }
  };

  return (
    <section className="mt-6 space-y-4 rounded-2xl border border-border bg-card/60 p-5">
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><Bell className="size-5 text-primary" /> {L.title}</h2>
      <p className="text-xs text-muted-foreground">{L.hint}</p>
      <Fields v={g} set={setG} L={L} />
      <button onClick={saveGlobal} disabled={busy} className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} {L.save}
      </button>

      <div className="border-t border-border pt-4">
        <h3 className="mb-2 text-sm font-semibold">{L.users}</h3>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={L.email} className="mb-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm sm:w-80" />
        <Fields v={u} set={setU} L={L} />
        <button onClick={() => email && saveUser(email.trim(), u)} disabled={busy || !email} className="mt-2 inline-flex items-center gap-1 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary disabled:opacity-50">
          <Save className="size-4" /> {L.add}
        </button>
        <div className="mt-3 space-y-2">
          {users.length === 0 ? <p className="text-xs text-muted-foreground">{L.none}</p> : users.map((x) => (
            <div key={x.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-background/40 px-3 py-2 text-xs">
              <span className="font-medium">{x.email || x.name}</span>
              <span className="text-muted-foreground">
                {x.monitor?.enabled === false ? "⛔" : "✓"} · {L.watches}: {x.monitor?.max_watches ?? "—"} · {L.comps}: {x.monitor?.max_competitors ?? "—"} · {L.freq}: {x.monitor?.min_frequency_hours ?? "—"}
              </span>
              <button onClick={() => saveUser(x.email, null)} className="text-destructive hover:opacity-70"><Trash2 className="size-4" /></button>
            </div>
          ))}
        </div>
      </div>
      {msg && <p className="text-xs text-primary">{msg}</p>}
    </section>
  );
}
