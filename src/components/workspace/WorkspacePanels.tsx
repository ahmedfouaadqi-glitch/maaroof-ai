import { formatDuration } from "@/lib/maaroof/pipeline-cards";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Coins, History, LoaderCircle, Play, RotateCcw, TrendingDown, Wallet, Brain, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ExportButtons } from "@/components/ExportButtons";
import { summarizeLedger, knowledgeCompletion, type LedgerRow } from "@/lib/workspace-panels";

type L = "ar" | "en" | "ku";
const tr = (l: L, ar: string, en: string, ku: string) => (l === "en" ? en : l === "ku" ? ku : ar);
const card = "rounded-2xl border border-border bg-card p-4 shadow-sm md:p-5";

async function token() {
  return (await supabase.auth.getSession()).data.session?.access_token || "";
}

const STATUS: Record<string, { ar: string; en: string; ku: string; cls: string }> = {
  completed: { ar: "اكتملت", en: "Completed", ku: "تەواو", cls: "bg-success/15 text-success" },
  failed: { ar: "فشلت", en: "Failed", ku: "شکستی هێنا", cls: "bg-destructive/15 text-destructive" },
  cancelled: { ar: "أُلغيت", en: "Cancelled", ku: "هەڵوەشێنرایەوە", cls: "bg-muted text-muted-foreground" },
  running: { ar: "جارٍ", en: "Running", ku: "بەردەوامە", cls: "bg-primary/15 text-primary" },
  queued: { ar: "بالانتظار", en: "Queued", ku: "چاوەڕێ", cls: "bg-warning/15 text-warning" },
  dispatching: { ar: "جارٍ", en: "Running", ku: "بەردەوامە", cls: "bg-primary/15 text-primary" },
};

export type PastJob = { id: string; goal: string; mode: string; status: string; error: string | null; created_at: string; updated_at?: string | null; workspace_id?: string | null; request_payload: any };

export function HistoryPanel({ lang, workspaceId, onOpen, onContinue }: { lang: L; workspaceId: string | null; onOpen: (j: PastJob) => void; onContinue: (j: PastJob) => void }) {
  const [jobs, setJobs] = useState<PastJob[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  useEffect(() => {
    let active = true;
    setJobs(null);
    setLoadError(false);
    (async () => {
      const t = await token();
      const query = new URLSearchParams({ workspace_id: workspaceId ?? "" });
      const r = await fetch("/api/maaroof-jobs?" + query.toString(), { headers: { Authorization: "Bearer " + t }, cache: "no-store" });
      const b = r.ok ? await r.json() : { jobs: [] };
      if (!active) return;
      setLoadError(!r.ok || b?.degraded === true);
      setJobs(Array.isArray(b.jobs) ? b.jobs : []);
    })().catch(() => { if (active) { setJobs([]); setLoadError(true); } });
    return () => { active = false; };
  }, [workspaceId]);

  const buildExport = (j: PastJob) => async () => {
    const t = await token();
    const query = new URLSearchParams({ id: j.id, after: "0", workspace_id: workspaceId ?? "" });
    const r = await fetch("/api/maaroof-jobs?" + query.toString(), { headers: { Authorization: "Bearer " + t }, cache: "no-store" });
    const b = r.ok ? await r.json() : { events: [] };
    const evs: any[] = b.events || [];
    const fin = [...evs].reverse().find((e) => e.event_type === "final");
    const text = String(fin?.payload?.summary || fin?.payload?.text || fin?.payload?.answer || "");
    return {
      title: j.goal || tr(lang, "مهمة", "Task", "ئەرک"),
      subtitle: new Date(j.created_at).toLocaleString(),
      sections: [
        { heading: tr(lang, "الحالة", "Status", "دۆخ"), kind: "kv" as const, rows: [[tr(lang, "الحالة", "Status", "دۆخ"), STATUS[j.status]?.[lang] || j.status] as [string, string]] },
        ...(text ? [{ heading: tr(lang, "النتيجة", "Result", "ئەنجام"), kind: "text" as const, text }] : []),
        { heading: tr(lang, "سجل العمل", "Activity", "تۆمار"), kind: "list" as const, list: evs.map((e) => `${new Date(e.created_at).toLocaleTimeString()} · ${e.event_type}`) },
      ],
    };
  };

  return (
    <section className={card}>
      <h2 className="mb-4 flex items-center gap-2 font-semibold"><History className="size-5 text-primary" />{tr(lang, "المهام السابقة", "Previous tasks", "ئەرکە پێشووەکان")}</h2>
      {loadError ? <p role="alert" className="text-sm text-destructive">{tr(lang, "تعذر تحميل المهام ضمن نطاق مساحة العمل الحالية. تحقق من قاعدة البيانات ثم أعد المحاولة.", "Could not load tasks for the current workspace. Check the database migration and retry.", "نەتوانرا ئەرکەکانی شوێنی کاری ئێستا بخوێندرێنەوە.")}</p> : jobs === null ? <LoaderCircle className="size-5 animate-spin text-muted-foreground" /> : jobs.length === 0 ? (
        <p className="text-sm text-muted-foreground">{tr(lang, "لا توجد مهام سابقة بعد.", "No previous tasks yet.", "هێشتا هیچ ئەرکێک نییە.")}</p>
      ) : (
        <ul className="space-y-3">
          {jobs.map((j) => {
            const s = STATUS[j.status] || { ar: j.status, en: j.status, ku: j.status, cls: "bg-muted text-muted-foreground" };
            return (
              <li key={j.id} className="rounded-xl border border-border bg-background p-3 transition hover:border-primary/40">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="min-w-0 flex-1 text-sm font-medium line-clamp-2">{j.goal || "—"}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.cls}`}>{s[lang]}</span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">{new Date(j.created_at).toLocaleString(lang === "en" ? "en" : "ar")}{["completed", "failed", "cancelled"].includes(j.status) && j.updated_at && <span className="ms-2 tabular-nums">· {tr(lang, "المدة", "Duration", "ماوە")}: {formatDuration(new Date(j.updated_at).getTime() - new Date(j.created_at).getTime(), lang === "en" || lang === "ku" ? lang : "ar")}</span>}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => onOpen(j)} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs hover:bg-muted"><Play className="size-3" />{tr(lang, "فتح", "Open", "کردنەوە")}</button>
                  <button type="button" onClick={() => onContinue(j)} className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"><RotateCcw className="size-3" />{tr(lang, "استكمال كمهمة جديدة", "Continue as new task", "بەردەوامبوون")}</button>
                  {j.status === "completed" && <ExportButtons size="xs" build={buildExport(j)} />}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function BalancePanel({ lang }: { lang: L }) {
  const { user } = useAuth();
  const [bal, setBal] = useState<number | null>(null);
  const [rows, setRows] = useState<(LedgerRow & { id: string })[]>([]);
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("tokens_balance").eq("id", user.id).maybeSingle().then(({ data }) => setBal(Number((data as any)?.tokens_balance ?? 0)));
    supabase.from("token_ledger").select("id,tokens,tool_key,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(500)
      .then(({ data }) => setRows((data as any) || []));
  }, [user?.id]);
  const s = summarizeLedger(rows);
  const n = (v: number) => v.toLocaleString(lang === "en" ? "en" : "ar-EG");
  const stat = (icon: any, label: string, value: string, tone: string) => {
    const I = icon;
    return (
      <div className={`${card} relative overflow-hidden`}>
        <div className={`mb-3 inline-flex size-10 items-center justify-center rounded-xl ${tone}`}><I className="size-5" /></div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 font-display text-2xl font-bold tabular-nums">{value}</p>
      </div>
    );
  };
  return (
    <section className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        {stat(Wallet, tr(lang, "الرصيد المتبقي", "Remaining balance", "باڵانسی ماوە"), bal === null ? "…" : n(bal), "bg-primary/15 text-primary")}
        {stat(TrendingDown, tr(lang, "المستهلك هذا الشهر", "Used this month", "بەکارهاتوو ئەم مانگە"), n(s.month), "bg-warning/15 text-warning")}
        {stat(Coins, tr(lang, "إجمالي المستهلك", "Total used", "کۆی بەکارهاتوو"), n(s.total), "bg-success/15 text-success")}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className={card}>
          <h3 className="mb-3 font-semibold">{tr(lang, "الأكثر استهلاكاً", "Top usage", "زۆرترین بەکارهێنان")}</h3>
          {s.top.length === 0 ? <p className="text-sm text-muted-foreground">—</p> : s.top.map((t) => (
            <div key={t.tool} className="mb-2">
              <div className="flex justify-between text-xs"><span>{t.tool}</span><span className="tabular-nums">{n(t.tokens)}</span></div>
              <div className="mt-1 h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.round((t.tokens / (s.top[0].tokens || 1)) * 100)}%` }} /></div>
            </div>
          ))}
        </div>
        <div className={card}>
          <h3 className="mb-3 font-semibold">{tr(lang, "آخر العمليات", "Recent charges", "دوایین کردارەکان")}</h3>
          <ul className="space-y-2 text-xs">
            {rows.slice(0, 8).map((r) => (
              <li key={r.id} className="flex justify-between gap-2 border-b border-border/60 pb-1"><span>{r.tool_key}</span><span className="text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span><span className="font-semibold tabular-nums">-{n(r.tokens)}</span></li>
            ))}
            {rows.length === 0 && <li className="text-muted-foreground">—</li>}
          </ul>
        </div>
      </div>
      <Link to="/pricing" className="inline-block text-xs text-primary underline-offset-4 hover:underline">{tr(lang, "عرض الأسعار والخطط", "View pricing", "نرخەکان")}</Link>
    </section>
  );
}

type Ks = { id: string; name: string; workspace_id: string | null; nodes_count: number; asked: number; answered: number; kind: string };

export function KnowledgePanel({ lang }: { lang: L }) {
  const { user } = useAuth();
  const [items, setItems] = useState<Ks[] | null>(null);
  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: spaces }, { data: iv }, { data: ws }] = await Promise.all([
        supabase.from("knowledge_spaces").select("id,name,workspace_id,nodes_count").eq("user_id", user.id),
        supabase.from("knowledge_space_interviews").select("space_id,answer").eq("user_id", user.id),
        supabase.from("workspaces").select("id,space_kind").eq("owner_id", user.id),
      ]);
      const kinds = new Map((ws || []).map((w: any) => [w.id, w.space_kind]));
      setItems((spaces || []).map((s: any) => {
        const q = (iv || []).filter((x: any) => x.space_id === s.id);
        return { ...s, asked: q.length, answered: q.filter((x: any) => x.answer).length, kind: s.workspace_id ? String(kinds.get(s.workspace_id) || "company") : "account" };
      }));
    })().catch(() => setItems([]));
  }, [user?.id]);
  const kindLabel = (k: string) => ({ account: tr(lang, "الحساب", "Account", "هەژمار"), company: tr(lang, "شركة", "Company", "کۆمپانیا"), product: tr(lang, "منتج", "Product", "بەرهەم"), client: tr(lang, "عميل", "Client", "کڕیار") } as Record<string, string>)[k] || k;
  return (
    <section className={card}>
      <h2 className="mb-4 flex items-center gap-2 font-semibold"><Brain className="size-5 text-primary" />{tr(lang, "مساحة المعرفة", "Knowledge space", "شوێنی زانیاری")}</h2>
      {items === null ? <LoaderCircle className="size-5 animate-spin text-muted-foreground" /> : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{tr(lang, "لا توجد معرفة محفوظة بعد. ابدأ المقابلة لبنائها.", "No saved knowledge yet. Start the interview.", "هێشتا زانیاری نییە.")}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((s) => {
            const pct = knowledgeCompletion(s.answered, s.asked, s.nodes_count);
            return (
              <div key={s.id} className="rounded-xl border border-border bg-background p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-sm font-medium"><Building2 className="size-4 text-muted-foreground" />{s.name}</p>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">{kindLabel(s.kind)}</span>
                </div>
                <div className="mt-3 flex justify-between text-[11px] text-muted-foreground"><span>{s.answered}/{s.asked} · {s.nodes_count} {tr(lang, "حقيقة", "facts", "ڕاستی")}</span><span className="font-semibold text-foreground">{pct}%</span></div>
                <div className="mt-1 h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} /></div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
