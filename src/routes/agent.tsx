import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { I18nProvider, useI18n, type Lang } from "@/lib/i18n";
import { ToolLangSelect } from "@/components/ToolLangSelect";
import { AuthProvider, useAuth } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { supabase } from "@/integrations/supabase/client";
import { runAgentNow, runAgentCommand, publishToChannel } from "@/lib/agent.functions";

import type { ExportPayload } from "@/lib/exports";
import { apiFetch } from "@/lib/api-client";
import { Loader2, Bot, Plus, Trash2, ExternalLink, Activity, Globe, Lightbulb, AlertTriangle, ShieldCheck, Play, Send, Sparkles, Eye, Send as SendIcon, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/agent")({
  head: () => ({
    meta: [
      { title: "Autonomous Brand Agent · MAAROOF Ai" },
      { name: "description", content: "Run the MAAROOF Ai autonomous agent: schedule visibility scans, publish to social channels, and monitor your brand across AI engines." },
      { name: "robots", content: "noindex,follow" },
      { property: "og:title", content: "Autonomous Brand Agent · MAAROOF Ai" },
      { property: "og:description", content: "Run the MAAROOF Ai autonomous agent: schedule visibility scans, publish to social channels, and monitor your brand across AI engines." },
    ],
  }),
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
  const { t, lang } = useI18n();
  const { user, isAdmin, loading } = useAuth();
  const [outLang, setOutLang] = useState<Lang>(lang);
  const navigate = useNavigate();
  const [sub, setSub] = useState<any | null>(null);
  const [addon, setAddon] = useState<any | null>(null);
  const [targets, setTargets] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [newUrl, setNewUrl] = useState("");
  const [newTopic, setNewTopic] = useState("");
  const [pageLoading, setPageLoading] = useState(true);
  const [runningId, setRunningId] = useState<string | "all" | null>(null);
  const [runMsg, setRunMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [cmd, setCmd] = useState("");
  const [cmdBusy, setCmdBusy] = useState(false);
  const [cmdMsg, setCmdMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // Visibility
  const [brand, setBrand] = useState("");
  const [keywords, setKeywords] = useState("");
  const [agentScope, setAgentScope] = useState<any>(null);
  const [visBusy, setVisBusy] = useState(false);
  const [visMsg, setVisMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // Channels
  const [channels, setChannels] = useState<any[]>([]);
  const [chKind] = useState<"telegram">("telegram");
  const [chLabel, setChLabel] = useState("");
  const [chBotToken, setChBotToken] = useState("");
  const [chChatId, setChChatId] = useState("");
  const [publishingTask, setPublishingTask] = useState<string | null>(null);
  const runNowFn = useServerFn(runAgentNow);
  const runCmdFn = useServerFn(runAgentCommand);
  const publishFn = useServerFn(publishToChannel);

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
    // Auto-provision Trial subscription for any signed-in user without an active sub
    if (!effectiveSub && !isAdmin) {
      try {
        await supabase.rpc("ensure_trial_subscription");
        const { data: trial } = await supabase
          .from("user_agent_subscriptions")
          .select("*, agent_addons:addon_id(*)")
          .eq("user_id", user.id)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (trial) effectiveSub = trial as any;
      } catch (e) { console.warn("[agent] trial provisioning failed", e); }
    }
    setSub(effectiveSub);
    setAddon(effectiveSub?.agent_addons || null);

    const { data: tg } = await supabase.from("agent_targets").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setTargets(tg || []);

    const { data: tk } = await supabase.from("agent_tasks").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20);
    setTasks(tk || []);

    const { data: ch } = await supabase.from("publish_channels").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setChannels(ch || []);

    const { data: prof } = await supabase.from("profiles").select("brand_name, brand_keywords, geo_scope").eq("id", user.id).maybeSingle();
    if (prof) {
      if (!brand && prof.brand_name) setBrand(prof.brand_name);
      if (!keywords && prof.brand_keywords) setKeywords(prof.brand_keywords);
      if ((prof as any).geo_scope) setAgentScope((prof as any).geo_scope);
    }
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

  const errMap: Record<string, string> = {
    auth_required: t("auth_required"),
    no_targets: t("ag_err_no_targets"),
    no_active_subscription: t("ag_err_no_sub"),
    no_addon: t("ag_err_no_sub"),
    subscription_expired: t("ag_err_expired"),
    monthly_cap_reached: t("ag_err_monthly_cap"),
    daily_cap_reached: t("ag_err_daily_cap"),
    rate_limited: t("ag_err_rate"),
    credits_exhausted: t("ag_err_credits"),
  };
  const tx = (code?: string) => (code && errMap[code]) || code || "";

  const runNow = async (targetId?: string) => {
    setRunningId(targetId || "all");
    setRunMsg(null);
    try {
      const res: any = await runNowFn({ data: { targetId, lang: outLang } });
      if (res?.ok) {
        setRunMsg({ ok: true, text: `${t("ag_run_done")} (${res.done || 0})` });
      } else {
        setRunMsg({ ok: false, text: `${t("ag_run_failed")} ${tx(res?.error)}` });
      }
    } catch (e: any) {
      setRunMsg({ ok: false, text: `${t("ag_run_failed")} ${e?.message || ""}` });
    } finally {
      setRunningId(null);
      load();
    }
  };

  const sendCommand = async () => {
    if (!cmd.trim() || cmdBusy) return;
    setCmdBusy(true); setCmdMsg(null);
    try {
      const res: any = await runCmdFn({ data: { command: cmd, lang: outLang } });
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

  const runVisibility = async () => {
    if (!brand.trim() || visBusy) return;
    setVisBusy(true); setVisMsg(null);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const session = (await supabase.auth.getSession()).data.session;
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

      const response = await apiFetch("/api/visibility", {
        method: "POST",
        headers,
        body: JSON.stringify({ brand, keywords, lang: outLang, scope: agentScope || undefined }),
      });

      const res: any = await response.json().catch(() => ({}));

      if (response.status === 401) {
        setVisMsg({ ok: false, text: `${t("ag_vis_fail")} ${tx("auth_required")}` });
      } else if (response.ok && res?.ok) {
        setVisMsg({ ok: true, text: t("ag_vis_ok") });
      } else {
        setVisMsg({ ok: false, text: `${t("ag_vis_fail")} ${tx(res?.error)}` });
      }
    } catch (e: any) {
      const msg = e?.message || e?.toString?.() || "unknown error";
      console.error("[runVisibility] error:", e);
      setVisMsg({ ok: false, text: `${t("ag_vis_fail")} ${msg}` });
    } finally {
      setVisBusy(false);
      load();
    }
  };

  const addChannel = async () => {
    if (!user) return;
    if (chKind !== "telegram") {
      alert(t("ag_ch_soon"));
      return;
    }
    if (!chBotToken.trim() || !chChatId.trim()) {
      alert(t("ag_ch_required"));
      return;
    }
    await supabase.from("publish_channels").insert({
      user_id: user.id, kind: chKind, label: chLabel || null,
      config: { bot_token: chBotToken.trim(), chat_id: chChatId.trim() },
    });
    setChLabel(""); setChBotToken(""); setChChatId("");
    load();
  };

  const addLinkedInChannel = async () => {
    if (!user) return;
    if (channels.some((c) => c.kind === "linkedin")) return;
    await supabase.from("publish_channels").insert({
      user_id: user.id, kind: "linkedin", label: "LinkedIn", config: {},
    });
    load();
  };

  const removeChannel = async (id: string) => {
    await supabase.from("publish_channels").delete().eq("id", id);
    load();
  };

  const publishTask = async (taskId: string, text: string, channelId: string) => {
    setPublishingTask(taskId);
    try {
      const res: any = await publishFn({ data: { taskId, text, channelId } });
      if (res?.ok) alert(t("ag_pub_ok"));
      else alert(`${t("ag_pub_fail")} ${tx(res?.error)}`);
    } catch (e: any) {
      alert(`${t("ag_pub_fail")} ${e?.message || ""}`);
    } finally {
      setPublishingTask(null);
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
          <div className="mt-3 flex justify-end">
            <ToolLangSelect value={outLang} onChange={setOutLang} />
          </div>
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
              {runMsg && (
                <div className={`mt-2 text-xs ${runMsg.ok ? "text-success" : "text-destructive"}`}>{runMsg.text}</div>
              )}
            </div>
          </div>
        </div>

        {/* AI Visibility moved to dashboard tools — link out */}
        <div className="mt-8 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5 p-5">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-gradient">
            <Eye className="size-5 text-primary" /> {t("ag_vis_title")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("ag_vis_desc")}</p>
          <Link to="/dashboard" className="mt-3 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-accent px-4 py-2 text-sm font-semibold text-primary-foreground">
            <Eye className="size-4" /> {t("ag_vis_run")}
          </Link>
        </div>

        {/* Publishing Channels — Telegram (more channels via per-task share links) */}
        <div className="mt-8 rounded-2xl border border-accent/30 bg-card/70 p-5">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold">
            <SendIcon className="size-5 text-accent" /> {t("ag_ch_title")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("ag_ch_desc")}</p>

          <div className="mt-3 grid gap-2 md:grid-cols-3">
            <input value={chLabel} onChange={(e) => setChLabel(e.target.value)}
              placeholder={t("ag_ch_label_ph")}
              className="rounded-lg border border-border bg-background/60 px-3 py-2 text-sm" />
            <input value={chBotToken} onChange={(e) => setChBotToken(e.target.value)}
              placeholder={t("ag_ch_token_ph")} type="password"
              className="rounded-lg border border-border bg-background/60 px-3 py-2 text-sm" />
            <input value={chChatId} onChange={(e) => setChChatId(e.target.value)}
              placeholder={t("ag_ch_chatid_ph")}
              className="rounded-lg border border-border bg-background/60 px-3 py-2 text-sm" />
          </div>

          <div className="mt-2 flex items-center justify-between gap-2">
            <a href="https://core.telegram.org/bots#how-do-i-create-a-bot" target="_blank" rel="noreferrer"
              className="text-xs text-primary underline">{t("ag_ch_help")}</a>
            <button onClick={addChannel} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground">
              <Plus className="size-4" /> {t("ag_ch_add")}
            </button>
          </div>

          {channels.length > 0 && (
            <ul className="mt-4 divide-y divide-border/60 rounded-lg border border-border bg-background/40">
              {channels.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="size-4 text-accent" />
                    <span className="font-semibold">{c.label || c.kind}</span>
                    <span className="text-xs text-muted-foreground">({c.kind})</span>
                  </div>
                  <button onClick={() => removeChannel(c.id)} className="text-destructive hover:opacity-80">
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
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
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold">
              <Activity className="size-4 text-accent" /> {t("ag_tasks_title")}
            </h2>
            {null}
          </div>
          <div className="space-y-2">
            {tasks.length === 0 && (
              <div className="rounded-2xl border border-border bg-card/70 p-6 text-center text-sm text-muted-foreground">
                {t("ag_no_tasks")}
              </div>
            )}
            {tasks.map((tk) => (
              <div key={tk.id} className="rounded-xl border border-border bg-card/70 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm">
                    {tk.task_type === "suggest_post" ? <Lightbulb className="size-4 text-accent" /> : tk.task_type === "command" ? <Sparkles className="size-4 text-accent" /> : tk.task_type === "ai_visibility" ? <Eye className="size-4 text-primary" /> : <Activity className="size-4 text-primary" />}
                    <span className="font-semibold">{tk.task_type === "suggest_post" ? t("ag_task_suggest") : tk.task_type === "analyze_url" ? t("ag_task_analyze") : tk.task_type === "command" ? t("ag_task_command") : tk.task_type === "ai_visibility" ? t("ag_task_visibility") : tk.task_type}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] ${
                      tk.status === "done" ? "bg-success/20 text-success" :
                      tk.status === "failed" ? "bg-destructive/20 text-destructive" :
                      "bg-muted text-muted-foreground"
                    }`}>{tk.status}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-muted-foreground">{new Date(tk.created_at).toLocaleString()}</div>
                    <button
                      onClick={async () => {
                        if (!confirm(t("hist_confirm_delete"))) return;
                        await supabase.from("agent_tasks").delete().eq("id", tk.id);
                        setTasks((cur) => cur.filter((x) => x.id !== tk.id));
                      }}
                      title={t("hist_delete")}
                      className="inline-flex items-center justify-center rounded-full border border-destructive/40 bg-destructive/10 p-1.5 text-destructive hover:bg-destructive/20"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
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
                {tk.task_type === "ai_visibility" && tk.result?.visibility_percent != null && (
                  <div className="mt-3 space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs">
                    <div>{t("ag_vis_score")}: <b className="text-primary">{tk.result.visibility_percent}%</b> · {t("ag_vis_sentiment")}: <b>{tk.result.sentiment}</b></div>
                    {tk.result.appearance_summary && <p>{tk.result.appearance_summary}</p>}
                    {tk.result.strengths?.length > 0 && <div>✅ {tk.result.strengths.join(" · ")}</div>}
                    {tk.result.weaknesses?.length > 0 && <div>⚠️ {tk.result.weaknesses.join(" · ")}</div>}
                    {tk.result.recommendations?.length > 0 && (
                      <ol className="ms-4 list-decimal space-y-0.5">{tk.result.recommendations.map((r: string, i: number) => <li key={i}>{r}</li>)}</ol>
                    )}
                    {Array.isArray(tk.result.platforms) && tk.result.platforms.length > 0 && (
                      <div className="mt-2 space-y-1.5 border-t border-primary/20 pt-2">
                        <div className="text-[11px] font-semibold uppercase tracking-widest text-primary/80">{t("ag_vis_platforms")}</div>
                        <div className="grid gap-1.5 md:grid-cols-2">
                          {tk.result.platforms.map((p: any, i: number) => (
                            <div key={i} className="rounded border border-border bg-background/40 p-2">
                              <div className="flex items-center justify-between">
                                <b>{p.name}</b>
                                <span className="font-mono text-primary">{p.score}/100</span>
                              </div>
                              <div className="mt-0.5 text-[10px] text-muted-foreground">{t("ag_vis_citation")}: <b className={p.citation_likelihood === "high" ? "text-success" : p.citation_likelihood === "low" ? "text-destructive" : "text-accent"}>{p.citation_likelihood}</b> · {t("ag_vis_trust")}: {p.trust_signal}</div>
                              {p.citation_method && <div className="mt-0.5 text-[10px] text-primary/80">⚙ {p.citation_method}</div>}
                              {p.evidence_basis && <div className="mt-0.5 text-[11px] text-foreground/70">📊 {p.evidence_basis}</div>}
                              {Array.isArray(p.authority_factors) && p.authority_factors.length > 0 && (
                                <div className="mt-1 flex flex-wrap gap-1">{p.authority_factors.map((f: string, j: number) => <span key={j} className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">{f}</span>)}</div>
                              )}
                              {p.why && <div className="mt-1 text-[11px] text-foreground/80">{p.why}</div>}
                              {p.action && <div className="mt-0.5 text-[11px] text-accent">▶ {p.action}{p.priority ? ` · ${p.priority}` : ""}</div>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {(tk.task_type === "suggest_post" || tk.task_type === "command") && tk.status === "done" && tk.result?.summary && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/50 pt-2">
                    <span className="text-xs text-muted-foreground">{t("ag_pub_to")}:</span>
                    {channels.filter((c) => c.active).map((c) => (
                      <button key={c.id} onClick={() => publishTask(tk.id, tk.result.summary, c.id)}
                        disabled={publishingTask === tk.id}
                        className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent hover:bg-accent/20 disabled:opacity-50">
                        {publishingTask === tk.id ? <Loader2 className="size-3 animate-spin" /> : <SendIcon className="size-3" />}
                        {c.label || c.kind}
                      </button>
                    ))}
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(tk.result.summary)}`}
                      target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-full border border-success/40 bg-success/10 px-3 py-1 text-xs font-semibold text-success hover:bg-success/20"
                    >
                      <MessageCircle className="size-3" /> WhatsApp
                    </a>
                    <a
                      href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(tk.result.summary)}`}
                      target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/20"
                    >
                      <SendIcon className="size-3" /> X / Twitter
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
