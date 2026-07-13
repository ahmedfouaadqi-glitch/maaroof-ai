// SchedulesPanel — list + create scheduled auto-runs for Maaroof.
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, Plus, Pause, Play, Trash2, Loader2 } from "lucide-react";
import {
  listSchedules,
  createSchedule,
  updateScheduleStatus,
  deleteSchedule,
} from "@/lib/maaroof-schedules.functions";

type Schedule = {
  id: string;
  workspace_id: string | null;
  name: string;
  prompt: string;
  cadence: "once" | "hourly" | "daily" | "weekly" | "custom_cron";
  next_run_at: string | null;
  last_run_at: string | null;
  runs_done: number;
  max_runs: number;
  approval_mode: "per_run" | "auto_within_quota" | "first_time_then_auto";
  status: "active" | "paused" | "exhausted" | "cancelled";
  created_at: string;
};

const CADENCE_LABEL: Record<Schedule["cadence"], string> = {
  once: "مرة واحدة",
  hourly: "كل ساعة",
  daily: "يومياً",
  weekly: "أسبوعياً",
  custom_cron: "مخصص",
};

const APPROVAL_LABEL: Record<Schedule["approval_mode"], string> = {
  per_run: "موافقة قبل كل مرة",
  auto_within_quota: "تلقائي ضمن الحصة",
  first_time_then_auto: "موافقة أول مرة ثم تلقائي",
};

export function SchedulesPanel({ workspaceId, defaultPrompt }: { workspaceId: string | null; defaultPrompt?: string }) {
  const list = useServerFn(listSchedules);
  const create = useServerFn(createSchedule);
  const setStatus = useServerFn(updateScheduleStatus);
  const del = useServerFn(deleteSchedule);
  const [items, setItems] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [cadence, setCadence] = useState<Schedule["cadence"]>("daily");
  const [approval, setApproval] = useState<Schedule["approval_mode"]>("per_run");
  const [maxRuns, setMaxRuns] = useState<number>(0);

  useEffect(() => { refresh(); }, []);
  useEffect(() => { if (defaultPrompt && !prompt) setPrompt(defaultPrompt); }, [defaultPrompt]);

  async function refresh() {
    setLoading(true);
    try {
      const res = await list();
      setItems((res.items as Schedule[]) || []);
    } finally { setLoading(false); }
  }

  async function submit() {
    if (!name.trim() || !prompt.trim()) return;
    setSaving(true);
    try {
      await create({ data: {
        workspace_id: workspaceId,
        name: name.trim(),
        prompt: prompt.trim(),
        language: "ar",
        force_tools: [],
        cadence,
        max_runs: maxRuns,
        approval_mode: approval,
      } });
      setName(""); setPrompt(""); setShowForm(false);
      await refresh();
    } finally { setSaving(false); }
  }

  async function toggle(s: Schedule) {
    const next = s.status === "active" ? "paused" : "active";
    await setStatus({ data: { id: s.id, status: next } });
    await refresh();
  }

  async function remove(id: string) {
    if (!confirm("حذف الجدولة؟")) return;
    await del({ data: { id } });
    await refresh();
  }

  const filtered = workspaceId ? items.filter((s) => s.workspace_id === workspaceId || !s.workspace_id) : items;

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2">
      <h2 className="flex items-center justify-between gap-2 font-semibold text-base m-0">
        <span className="flex items-center gap-2"><CalendarClock className="w-4 h-4" /> الجدولات التلقائية</span>
        <button onClick={() => setShowForm((v) => !v)} className="text-xs text-primary hover:underline flex items-center gap-1"><Plus className="w-3 h-3" /> جديدة</button>
      </h2>

      {showForm && (
        <div className="space-y-2 p-2 rounded border bg-background/50">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم مختصر (مثال: مراقبة منافس يومية)" className="w-full border rounded px-2 py-1 bg-background text-sm" />
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="البرومب الذي سيُنفَّذ في كل مرة" className="w-full min-h-[70px] border rounded px-2 py-1 bg-background text-sm resize-y" />
          <div className="grid grid-cols-2 gap-2 text-xs">
            <label className="space-y-1">
              <span>التكرار</span>
              <select value={cadence} onChange={(e) => setCadence(e.target.value as Schedule["cadence"])} className="w-full border rounded px-2 py-1 bg-background">
                {(Object.keys(CADENCE_LABEL) as Schedule["cadence"][]).map((k) => <option key={k} value={k}>{CADENCE_LABEL[k]}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span>الموافقة</span>
              <select value={approval} onChange={(e) => setApproval(e.target.value as Schedule["approval_mode"])} className="w-full border rounded px-2 py-1 bg-background">
                {(Object.keys(APPROVAL_LABEL) as Schedule["approval_mode"][]).map((k) => <option key={k} value={k}>{APPROVAL_LABEL[k]}</option>)}
              </select>
            </label>
            <label className="space-y-1 col-span-2">
              <span>حد أقصى للتشغيل (0 = بدون حد)</span>
              <input type="number" min={0} max={10000} value={maxRuns} onChange={(e) => setMaxRuns(Number(e.target.value) || 0)} className="w-full border rounded px-2 py-1 bg-background" />
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="text-xs px-2 py-1 rounded hover:bg-muted">إلغاء</button>
            <button onClick={submit} disabled={!name.trim() || !prompt.trim() || saving} className="text-xs px-3 py-1 rounded bg-primary text-primary-foreground disabled:opacity-50 flex items-center gap-1">
              {saving && <Loader2 className="w-3 h-3 animate-spin" />} إنشاء
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> جارٍ التحميل…</div>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-muted-foreground">لا جدولات بعد. استخدم زر «جديدة» لحفظ برومب يُنفَّذ تلقائياً على تردد ثابت (يعمل حسب حصتك حتى وأنت غير متصل).</p>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {filtered.map((s) => (
            <li key={s.id} className="p-2 rounded border bg-background/40 group">
              <div className="flex items-center gap-2">
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${s.status === "active" ? "bg-emerald-500" : s.status === "paused" ? "bg-amber-500" : "bg-muted-foreground"}`} />
                <span className="flex-1 truncate font-medium">{s.name}</span>
                <button onClick={() => toggle(s)} className="p-1 rounded hover:bg-muted" title={s.status === "active" ? "إيقاف مؤقت" : "استئناف"}>
                  {s.status === "active" ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                </button>
                <button onClick={() => remove(s.id)} className="p-1 rounded hover:bg-destructive/10 text-destructive" title="حذف"><Trash2 className="w-3 h-3" /></button>
              </div>
              <div className="text-[10px] text-muted-foreground mt-1 line-clamp-1">{s.prompt}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5 flex justify-between">
                <span>{CADENCE_LABEL[s.cadence]} · {APPROVAL_LABEL[s.approval_mode]}</span>
                <span>تشغيلات: {s.runs_done}{s.max_runs ? `/${s.max_runs}` : ""}</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="text-[10px] text-muted-foreground border-t pt-2 mt-2">
        ملاحظة: التنفيذ التلقائي على الخلفية يتطلب تشغيل مهمة pg_cron إدارية. الإدارة يمكنها إعداد ذلك من لوحة التحكم لاحقاً.
      </p>
    </div>
  );
}
