import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { I18nProvider } from "@/lib/i18n";
import { AuthProvider, useAuth } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Bot, Plus, Trash2, ExternalLink, Activity, Globe, Lightbulb, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/agent")({
  component: () => (
    <I18nProvider>
      <AuthProvider>
        <AgentPage />
      </AuthProvider>
    </I18nProvider>
  ),
});

function AgentPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [sub, setSub] = useState<any | null>(null);
  const [addon, setAddon] = useState<any | null>(null);
  const [targets, setTargets] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [newUrl, setNewUrl] = useState("");
  const [newTopic, setNewTopic] = useState("");
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { mode: "signin", redirect: "/agent" } });
  }, [loading, user, navigate]);

  const load = async () => {
    if (!user) return;
    const { data: subData } = await supabase
      .from("user_agent_subscriptions")
      .select("*, agent_addons(*)")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setSub(subData);
    setAddon(subData?.agent_addons || null);

    const { data: tg } = await supabase.from("agent_targets").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setTargets(tg || []);

    const { data: tk } = await supabase.from("agent_tasks").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20);
    setTasks(tk || []);
    setPageLoading(false);
  };

  useEffect(() => { if (user) load(); }, [user]);

  const addTarget = async () => {
    if (!user || (!newUrl && !newTopic)) return;
    if (addon && targets.length >= addon.max_targets) {
      alert(`الحد الأقصى للمواقع في باقتك: ${addon.max_targets}`);
      return;
    }
    await supabase.from("agent_targets").insert({
      user_id: user.id, url: newUrl || null, topic: newTopic || null,
    });
    setNewUrl(""); setNewTopic("");
    load();
  };

  const removeTarget = async (id: string) => {
    await supabase.from("agent_targets").delete().eq("id", id);
    load();
  };

  if (loading || pageLoading) return (
    <div className="min-h-screen"><SiteHeader />
      <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>
    </div>
  );

  if (!sub) return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="grid mx-auto size-16 place-items-center rounded-2xl bg-gradient-to-br from-accent to-primary shadow-[var(--shadow-glow)]">
          <Bot className="size-8 text-primary-foreground" />
        </div>
        <h1 className="mt-6 font-display text-3xl font-bold text-gradient">الوكيل الذكي</h1>
        <p className="mt-3 text-muted-foreground">
          ليس لديك اشتراك نشط بالوكيل بعد. الوكيل يعمل نيابة عنك يومياً — يحلّل صفحاتك،
          يقترح منشورات تلقائياً، ويراقب ظهورك في محركات البحث التوليدية.
        </p>
        <Link to="/pricing"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-accent to-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)]">
          <Bot className="size-4" /> اختر باقة وكيل
        </Link>
      </div>
    </div>
  );

  const usagePct = addon ? Math.min(100, (sub.tasks_used / addon.monthly_tasks) * 100) : 0;
  const dailyLimit = addon?.daily_task_cap ?? 10;
  const dailyUsed = sub.last_run_date === new Date().toISOString().slice(0, 10) ? sub.tasks_used_today : 0;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-5xl px-4 py-10 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Bot className="size-6 text-accent" />
              <h1 className="font-display text-2xl font-bold text-gradient">{addon?.name || "الوكيل الذكي"}</h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{addon?.description}</p>
          </div>
          <div className="rounded-xl border border-border bg-card/70 px-4 py-2 text-xs">
            ينتهي: {sub.expires_at ? new Date(sub.expires_at).toLocaleDateString() : "—"}
          </div>
        </div>

        {/* Usage */}
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card/70 p-5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>الاستهلاك الشهري</span>
              <span className="font-mono">{sub.tasks_used} / {addon?.monthly_tasks}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-background/60">
              <div className="h-full bg-gradient-to-r from-accent to-primary transition-all" style={{ width: `${usagePct}%` }} />
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card/70 p-5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>الاستهلاك اليومي</span>
              <span className="font-mono">{dailyUsed} / {dailyLimit}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-background/60">
              <div className="h-full bg-success transition-all" style={{ width: `${(dailyUsed / dailyLimit) * 100}%` }} />
            </div>
          </div>
        </div>

        {/* Targets */}
        <div className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold">
            <Globe className="size-4 text-accent" /> المواقع/المواضيع المراقَبة
          </h2>
          <div className="rounded-2xl border border-border bg-card/70 p-4">
            <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
              <input value={newUrl} onChange={(e) => setNewUrl(e.target.value)}
                placeholder="رابط الموقع/الصفحة (URL)"
                className="rounded-lg border border-border bg-background/60 px-3 py-2 text-sm" />
              <input value={newTopic} onChange={(e) => setNewTopic(e.target.value)}
                placeholder="أو موضوع/كلمة مفتاحية"
                className="rounded-lg border border-border bg-background/60 px-3 py-2 text-sm" />
              <button onClick={addTarget}
                className="inline-flex items-center justify-center gap-1 rounded-lg bg-gradient-to-r from-accent to-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                <Plus className="size-4" /> إضافة
              </button>
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              الحد الأقصى: {addon?.max_targets} · الحالي: {targets.length}
            </div>

            <div className="mt-4 space-y-2">
              {targets.length === 0 && <p className="text-sm text-muted-foreground">لا توجد مواقع مراقبة بعد.</p>}
              {targets.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-sm">
                  <div>
                    {t.url && <a href={t.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline"><ExternalLink className="size-3" />{t.url}</a>}
                    {t.topic && <div className="text-muted-foreground">📌 {t.topic}</div>}
                  </div>
                  <button onClick={() => removeTarget(t.id)} className="text-destructive hover:text-destructive/70"><Trash2 className="size-4" /></button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tasks */}
        <div className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold">
            <Activity className="size-4 text-accent" /> آخر مهام الوكيل
          </h2>
          <div className="space-y-2">
            {tasks.length === 0 && (
              <div className="rounded-2xl border border-border bg-card/70 p-6 text-center text-sm text-muted-foreground">
                لم ينفّذ الوكيل أي مهمة بعد. أضف موقعاً أو موضوعاً وسيبدأ تلقائياً في الجولة القادمة.
              </div>
            )}
            {tasks.map((tk) => (
              <div key={tk.id} className="rounded-xl border border-border bg-card/70 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    {tk.task_type === "suggest_post" ? <Lightbulb className="size-4 text-accent" /> : <Activity className="size-4 text-primary" />}
                    <span className="font-semibold">{tk.task_type === "suggest_post" ? "اقتراح منشور" : tk.task_type === "analyze_url" ? "تحليل GEO" : tk.task_type}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] ${
                      tk.status === "done" ? "bg-success/20 text-success" :
                      tk.status === "failed" ? "bg-destructive/20 text-destructive" :
                      "bg-muted text-muted-foreground"
                    }`}>{tk.status}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{new Date(tk.created_at).toLocaleString()}</div>
                </div>
                {tk.input && <div className="mt-2 text-xs text-muted-foreground">📍 {tk.input}</div>}
                {tk.error && (
                  <div className="mt-2 inline-flex items-start gap-1 text-xs text-destructive">
                    <AlertTriangle className="size-3 shrink-0 mt-0.5" /> {tk.error}
                  </div>
                )}
                {tk.result?.summary && (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/90">{tk.result.summary}</p>
                )}
                {tk.result?.score != null && (
                  <div className="mt-2 text-xs">GEO Score: <b className="text-accent">{tk.result.score}/100</b></div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
