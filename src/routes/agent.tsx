import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { AuthProvider, useAuth } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { supabase } from "@/integrations/supabase/client";
import { runAgentNow, runAgentCommand } from "@/lib/agent.functions";
import { Loader2, Bot, Plus, Trash2, ExternalLink, Activity, Globe, Lightbulb, AlertTriangle, ShieldCheck, Play, Send, Sparkles } from "lucide-react";

export const Route = createFileRoute("/agent")({
  component: () => (
    <I18nProvider>
      <AuthProvider>
        <AgentPage />
      </AuthProvider>
    </I18nProvider>
  ),
});

// Admin pseudo-subscription (unlimited)
const ADMIN_SUB = {
  id: "admin",
  status: "active",
  expires_at: null,
  tasks_used: 0,
  tasks_used_today: 0,
  last_run_date: null,
  agent_addons: { name: "Admin", description: "Unlimited admin access", monthly_tasks: 99999, daily_task_cap: 9999, max_targets: 999 },
};

function AgentPage() {
  const { t } = useI18n();
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [sub, setSub] = useState<any | null>(null);
  const [addon, setAddon] = useState<any | null>(null);
  const [targets, setTargets] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [newUrl, setNewUrl] = useState("");
  const [newTopic, setNewTopic] = useState("");
  const [pageLoading, setPageLoading] = useState(true);
  const [runningId, setRunningId] = useState<string | "all" | null>(null);
  const [cmd, setCmd] = useState("");
  const [cmdBusy, setCmdBusy] = useState(false);
  const [cmdMsg, setCmdMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const runNowFn = useServerFn(runAgentNow);
  const runCmdFn = useServerFn(runAgentCommand);

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

    let effectiveSub = subData;
    if (!effectiveSub && isAdmin) effectiveSub = ADMIN_SUB as any;
    setSub(effectiveSub);
    setAddon(effectiveSub?.agent_addons || null);

    const { data: tg } = await supabase.from("agent_targets").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setTargets(tg || []);

    const { data: tk } = await supabase.from("agent_tasks").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20);
    setTasks(tk || []);
    setPageLoading(false);
  };

  useEffect(() => { if (user) load(); }, [user, isAdmin]);

  const addTarget = async () => {
    if (!user || (!newUrl && !newTopic)) return;
    if (addon && !isAdmin && targets.length >= addon.max_targets) {
      alert(`${t("ag_max_alert")} ${addon.max_targets}`);
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

  const runNow = async (targetId?: string) => {
    setRunningId(targetId || "all");
    try {
      const res: any = await runNowFn({ data: { targetId } });
      if (!res?.ok && res?.error) alert(res.error);
    } catch (e: any) {
      alert(e?.message || "error");
    } finally {
      setRunningId(null);
      load();
    }
  };

  const sendCommand = async () => {
    if (!cmd.trim() || cmdBusy) return;
    setCmdBusy(true); setCmdMsg(null);
    try {
      const res: any = await runCmdFn({ data: { command: cmd } });
      if (res?.ok) {
        setCmdMsg({ ok: true, text: t("ag_cmd_ok") });
        setCmd("");
      } else {
        setCmdMsg({ ok: false, text: `${t("ag_cmd_fail")} ${res?.error || ""}` });
      }
    } catch (e: any) {
      setCmdMsg({ ok: false, text: `${t("ag_cmd_fail")} ${e?.message || ""}` });
    } finally {
      setCmdBusy(false);
      load();
    }
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
        <h1 className="mt-6 font-display text-3xl font-bold text-gradient">{t("ag_no_sub_title")}</h1>
        <p className="mt-3 text-muted-foreground">{t("ag_no_sub_desc")}</p>
        <Link to="/pricing"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-accent to-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)]">
          <Bot className="size-4" /> {t("ag_no_sub_cta")}
        </Link>
      </div>
    </div>
  );

  const isAdminSub = sub.id === "admin";
  const usagePct = addon && !isAdminSub ? Math.min(100, (sub.tasks_used / addon.monthly_tasks) * 100) : 0;
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
              <h1 className="font-display text-2xl font-bold text-gradient">{addon?.name || t("ag_no_sub_title")}</h1>
              {isAdminSub && (
                <span className="inline-flex items-center gap-1 rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-semibold text-accent">
                  <ShieldCheck className="size-3" /> {t("ag_admin_mode")}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{addon?.description}</p>
          </div>
          {!isAdminSub && (
            <div className="rounded-xl border border-border bg-card/70 px-4 py-2 text-xs">
              {t("ag_expires")}: {sub.expires_at ? new Date(sub.expires_at).toLocaleDateString() : "—"}
            </div>
          )}
        </div>

        {/* Usage */}
        {!isAdminSub && (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card/70 p-5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{t("ag_monthly")}</span>
                <span className="font-mono">{sub.tasks_used} / {addon?.monthly_tasks}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-background/60">
                <div className="h-full bg-gradient-to-r from-accent to-primary transition-all" style={{ width: `${usagePct}%` }} />
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card/70 p-5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{t("ag_daily")}</span>
                <span className="font-mono">{dailyUsed} / {dailyLimit}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-background/60">
                <div className="h-full bg-success transition-all" style={{ width: `${(dailyUsed / dailyLimit) * 100}%` }} />
              </div>
            </div>
          </div>
        )}

        {/* Command box — give the agent an order */}
        <div className="mt-8 rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/5 to-primary/5 p-5">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-gradient">
            <Sparkles className="size-5 text-accent" /> {t("ag_cmd_title")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("ag_cmd_desc")}</p>
          <textarea
            value={cmd}
            onChange={(e) => setCmd(e.target.value)}
            placeholder={t("ag_cmd_ph")}
            rows={3}
            className="mt-3 w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            {cmdMsg && (
              <span className={`text-xs ${cmdMsg.ok ? "text-success" : "text-destructive"}`}>{cmdMsg.text}</span>
            )}
            <button
              onClick={sendCommand}
              disabled={cmdBusy || !cmd.trim()}
              className="ms-auto inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-accent to-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {cmdBusy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {cmdBusy ? t("ag_running") : t("ag_cmd_send")}
            </button>
          </div>
        </div>

        {/* Autonomy explainer */}
        <div className="mt-6 rounded-2xl border border-border/60 bg-card/50 p-4">
          <div className="flex items-start gap-3">
            <Bot className="mt-0.5 size-5 text-accent shrink-0" />
            <div>
              <h3 className="font-display font-bold">{t("ag_autonomy_title")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t("ag_autonomy_desc")}</p>
              {targets.length > 0 && (
                <button
                  onClick={() => runNow()}
                  disabled={runningId !== null}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/20 disabled:opacity-50"
                >
                  {runningId === "all" ? <Loader2 className="size-3 animate-spin" /> : <Play className="size-3" />}
                  {runningId === "all" ? t("ag_running") : t("ag_run_all")}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold">
            <Globe className="size-4 text-accent" /> {t("ag_targets_title")}
          </h2>
          <div className="rounded-2xl border border-border bg-card/70 p-4">
            <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
              <input value={newUrl} onChange={(e) => setNewUrl(e.target.value)}
                placeholder={t("ag_url_ph")}
                className="rounded-lg border border-border bg-background/60 px-3 py-2 text-sm" />
              <input value={newTopic} onChange={(e) => setNewTopic(e.target.value)}
                placeholder={t("ag_topic_ph")}
                className="rounded-lg border border-border bg-background/60 px-3 py-2 text-sm" />
              <button onClick={addTarget}
                className="inline-flex items-center justify-center gap-1 rounded-lg bg-gradient-to-r from-accent to-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                <Plus className="size-4" /> {t("ag_add")}
              </button>
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              {t("ag_max")}: {isAdminSub ? "∞" : addon?.max_targets} · {t("ag_current")}: {targets.length}
            </div>

            <div className="mt-4 space-y-2">
              {targets.length === 0 && <p className="text-sm text-muted-foreground">{t("ag_no_targets")}</p>}
              {targets.map((tg) => (
                <div key={tg.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-sm">
                  <div>
                    {tg.url && <a href={tg.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline"><ExternalLink className="size-3" />{tg.url}</a>}
                    {tg.topic && <div className="text-muted-foreground">📌 {tg.topic}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => runNow(tg.id)}
                      disabled={runningId !== null}
                      className="inline-flex items-center gap-1 rounded-md border border-accent/40 bg-accent/10 px-2 py-1 text-xs font-semibold text-accent hover:bg-accent/20 disabled:opacity-50"
                    >
                      {runningId === tg.id ? <Loader2 className="size-3 animate-spin" /> : <Play className="size-3" />}
                      {runningId === tg.id ? t("ag_running") : t("ag_run_now")}
                    </button>
                    <button onClick={() => removeTarget(tg.id)} className="text-destructive hover:text-destructive/70"><Trash2 className="size-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tasks */}
        <div className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold">
            <Activity className="size-4 text-accent" /> {t("ag_tasks_title")}
          </h2>
          <div className="space-y-2">
            {tasks.length === 0 && (
              <div className="rounded-2xl border border-border bg-card/70 p-6 text-center text-sm text-muted-foreground">
                {t("ag_no_tasks")}
              </div>
            )}
            {tasks.map((tk) => (
              <div key={tk.id} className="rounded-xl border border-border bg-card/70 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    {tk.task_type === "suggest_post" ? <Lightbulb className="size-4 text-accent" /> : <Activity className="size-4 text-primary" />}
                    <span className="font-semibold">{tk.task_type === "suggest_post" ? t("ag_task_suggest") : tk.task_type === "analyze_url" ? t("ag_task_analyze") : tk.task_type}</span>
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
