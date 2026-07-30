// Parts 9-11 admin panels — Expert Academy, Learning Budget, Knowledge Observatory.
// Rendered inside the existing Intelligence Center shell (no new dashboard page).
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { GraduationCap, RefreshCw, Coins, Network, Play, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  listExpertAcademy,
  runExpertLearning,
  getLearningBudget,
  getKnowledgeObservatory,
  syncKnowledgeLayers,
} from "@/lib/maaroof-experts.functions";

function Bar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-muted/50">
      <div
        className="h-1.5 rounded-full bg-primary transition-all"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

/** Part 9 — Expert Academy: what Maaroof understands about each engine. */
export function ExpertAcademySection() {
  const load = useServerFn(listExpertAcademy);
  const learn = useServerFn(runExpertLearning);
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      setData(await load());
    } catch (e: any) {
      toast.error(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void refresh(); }, []);

  const runOne = async (key: string, force = false) => {
    setBusy(key);
    try {
      const r: any = await learn({ data: { expertKey: key, force } });
      if (!r?.ok) toast.error(`تعذّر التعلّم: ${r?.error || "unknown"}`);
      else if (r.zero_cost_reason) toast.success(`لا تغيير في تعريف الخبير — أُعيد استخدام اللقطة (بلا تكلفة)`);
      else toast.success(`تم التعلّم — نسخة ${r.version}، الفهم ${r.understanding_score}%، $${Number(r.usd || 0).toFixed(4)}`);
      await refresh();
    } catch (e: any) {
      toast.error(String(e?.message || e));
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <div className="p-6 text-sm text-muted-foreground">جارٍ التحميل…</div>;
  const s = data?.summary || {};

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <GraduationCap className="size-4 text-primary" /> أكاديمية الخبراء
        </h3>
        <button onClick={() => void refresh()} className="rounded-lg border border-border/60 px-2.5 py-1 text-xs hover:bg-muted/40">
          <RefreshCw className="me-1 inline size-3" /> تحديث
        </button>
      </header>

      <p className="text-xs text-muted-foreground">
        معروف لا يستخدم الأداة فقط — بل يجري معها مقابلة إدراكية ويحفظ فهمه عنها كلقطة معتمدة. تكلفة التعلّم تُحمَّل على
        ميزانية التعلّم الداخلية ولا تمس رصيد أي مستخدم.
      </p>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="إجمالي الخبراء" value={s.total ?? 0} />
        <Stat label="تم تعلّمهم" value={s.learned ?? 0} />
        <Stat label="متوسط الفهم" value={`${s.avg_understanding ?? 0}%`} />
        <Stat label="تكلفة التعلّم" value={`$${Number(s.total_usd || 0).toFixed(4)}`} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/60">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="p-2 text-start">الخبير</th>
              <th className="p-2 text-start">الحالة</th>
              <th className="p-2 text-start">الفهم</th>
              <th className="p-2 text-start">التغطية</th>
              <th className="p-2 text-start">الجلسات</th>
              <th className="p-2 text-start">التكلفة</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {(data?.experts || []).map((e: any) => (
              <tr key={e.key} className="border-t border-border/40">
                <td className="p-2">
                  <div className="font-medium">{e.label}</div>
                  <div className="text-[10px] text-muted-foreground">{e.key}</div>
                </td>
                <td className="p-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] ${e.learned ? "bg-primary/15 text-primary" : "bg-muted/60 text-muted-foreground"}`}>
                    {e.learned ? `v${e.version}` : "لم يُتعلَّم"}
                  </span>
                </td>
                <td className="p-2 w-28">
                  <div className="mb-1">{e.understanding_score}%</div>
                  <Bar value={e.understanding_score} />
                </td>
                <td className="p-2 text-[10px] text-muted-foreground">
                  معرفة {e.coverage.knowledge}% · قدرة {e.coverage.capability}% · استدلال {e.coverage.reasoning}% · قرار {e.coverage.decision}%
                </td>
                <td className="p-2">{e.sessions}</td>
                <td className="p-2">${Number(e.usd || 0).toFixed(4)}</td>
                <td className="p-2 text-end">
                  <button
                    disabled={busy === e.key}
                    onClick={() => void runOne(e.key, e.learned)}
                    className="rounded-lg border border-primary/40 bg-primary/10 px-2 py-1 text-[11px] text-primary hover:bg-primary/20 disabled:opacity-50"
                  >
                    {busy === e.key ? <Loader2 className="size-3 animate-spin" /> : <><Play className="me-1 inline size-3" />{e.learned ? "إعادة تعلّم" : "تعلّم"}</>}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h4 className="mb-2 text-xs font-semibold">آخر جلسات التعلّم</h4>
        <div className="space-y-1">
          {(data?.sessions || []).slice(0, 10).map((x: any) => (
            <div key={x.id} className="flex items-center justify-between rounded-lg border border-border/40 px-2 py-1 text-[11px]">
              <span className="font-medium">{x.expert_key} <span className="text-muted-foreground">v{x.version}</span></span>
              <span className="text-muted-foreground">
                {x.status}{x.zero_cost_reason ? ` · ${x.zero_cost_reason}` : ""} · {x.tokens || 0} توكن · ${Number(x.usd || 0).toFixed(4)}
              </span>
            </div>
          ))}
          {!(data?.sessions || []).length && <div className="text-[11px] text-muted-foreground">لا جلسات بعد.</div>}
        </div>
      </div>
    </div>
  );
}

/** Part 10 — the learning budget, kept strictly apart from user spend. */
export function LearningBudgetSection() {
  const load = useServerFn(getLearningBudget);
  const [data, setData] = useState<any>(null);
  useEffect(() => { void load().then(setData).catch(() => {}); }, []);
  if (!data) return <div className="p-6 text-sm text-muted-foreground">جارٍ التحميل…</div>;
  return (
    <div className="space-y-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Coins className="size-4 text-primary" /> ميزانية التعلّم الداخلية
      </h3>
      <p className="text-xs text-muted-foreground">
        كل عملية تعلّم مسجّلة هنا — حتى المجانية منها مع سبب مجانيتها. هذه الميزانية منفصلة تماماً عن سجل توكنات المستخدمين.
      </p>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="إجمالي التكلفة" value={`$${Number(data.total_usd || 0).toFixed(4)}`} />
        <Stat label="إجمالي التوكنات" value={Number(data.total_tokens || 0).toLocaleString()} />
        <Stat label="عمليات مجانية" value={data.free_ops ?? 0} />
        <Stat label="أيام مسجّلة" value={(data.daily || []).length} />
      </div>
      <div className="overflow-x-auto rounded-xl border border-border/60">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="p-2 text-start">الوقت</th>
              <th className="p-2 text-start">الغرض</th>
              <th className="p-2 text-start">الخبير</th>
              <th className="p-2 text-start">النموذج</th>
              <th className="p-2 text-start">توكنات</th>
              <th className="p-2 text-start">التكلفة</th>
              <th className="p-2 text-start">ملاحظة</th>
            </tr>
          </thead>
          <tbody>
            {(data.recent || []).map((r: any) => (
              <tr key={r.id} className="border-t border-border/40">
                <td className="p-2 whitespace-nowrap">{new Date(r.created_at).toLocaleString("ar")}</td>
                <td className="p-2">{r.purpose}</td>
                <td className="p-2">{r.expert_key || "—"}</td>
                <td className="p-2">{r.model || "—"}</td>
                <td className="p-2">{r.tokens || 0}</td>
                <td className="p-2">${Number(r.usd || 0).toFixed(5)}</td>
                <td className="p-2 text-muted-foreground">{r.zero_cost_reason || (r.cache_hit ? "cache" : "—")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Part 11 — Knowledge Observatory: health of the living knowledge graph. */
export function KnowledgeObservatorySection() {
  const load = useServerFn(getKnowledgeObservatory);
  const sync = useServerFn(syncKnowledgeLayers);
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const refresh = async () => { try { setData(await load()); } catch {} };
  useEffect(() => { void refresh(); }, []);

  const doSync = async () => {
    setBusy(true);
    try {
      const r: any = await sync({});
      toast.success(`تمت مزامنة ${r?.synced ?? 0} عقدة معرفية من الخبراء`);
      await refresh();
    } catch (e: any) {
      toast.error(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  if (!data) return <div className="p-6 text-sm text-muted-foreground">جارٍ التحميل…</div>;
  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Network className="size-4 text-primary" /> مرصد المعرفة الحيّة
        </h3>
        <button onClick={() => void doSync()} disabled={busy} className="rounded-lg border border-border/60 px-2.5 py-1 text-xs hover:bg-muted/40 disabled:opacity-50">
          {busy ? <Loader2 className="size-3 animate-spin" /> : <><RefreshCw className="me-1 inline size-3" /> مزامنة طبقة الخبراء</>}
        </button>
      </header>
      <p className="text-xs text-muted-foreground">
        تسع طبقات معرفية بثقة وحداثة وموثوقية لكل عقدة. المعرفة تتقادم إن لم تُستخدم، وتتقوّى كلما أثبتت نفعها.
      </p>

      <div className="overflow-x-auto rounded-xl border border-border/60">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="p-2 text-start">الطبقة</th>
              <th className="p-2 text-start">العقد</th>
              <th className="p-2 text-start">الثقة</th>
              <th className="p-2 text-start">الموثوقية</th>
              <th className="p-2 text-start">الجودة</th>
              <th className="p-2 text-start">تعارضات</th>
              <th className="p-2 text-start">متقادمة</th>
            </tr>
          </thead>
          <tbody>
            {(data.health || []).map((h: any) => (
              <tr key={h.layer} className="border-t border-border/40">
                <td className="p-2 font-medium">{h.layer}</td>
                <td className="p-2">{h.nodes}</td>
                <td className="p-2">{h.avg_confidence}%</td>
                <td className="p-2">{h.avg_reliability}%</td>
                <td className="p-2">{h.avg_quality}%</td>
                <td className="p-2">{h.conflicts}</td>
                <td className="p-2">{h.stale}</td>
              </tr>
            ))}
            {!(data.health || []).length && (
              <tr><td colSpan={7} className="p-3 text-center text-muted-foreground">لا معرفة مسجّلة بعد.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div>
        <h4 className="mb-2 text-xs font-semibold">أقوى العقد المعرفية</h4>
        <div className="space-y-1">
          {(data.top || []).slice(0, 12).map((n: any) => (
            <div key={n.id} className="rounded-lg border border-border/40 px-2 py-1.5">
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="font-medium">[{n.layer}] {n.title}</span>
                <span className="text-muted-foreground">جودة {n.quality}% · ثقة {n.confidence}% · استُخدمت {n.usage_count}×</span>
              </div>
              {n.summary && <p className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground">{n.summary}</p>}
            </div>
          ))}
          {!(data.top || []).length && <div className="text-[11px] text-muted-foreground">لا عقد بعد.</div>}
        </div>
      </div>
    </div>
  );
}
