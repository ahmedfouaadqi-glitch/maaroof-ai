import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { AuthProvider, useAuth } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Users, Activity, Bell, Crown, Check, X, ShieldPlus, ShieldMinus, Bot } from "lucide-react";

export const Route = createFileRoute("/admin")({
  component: () => (
    <I18nProvider>
      <AuthProvider>
        <AdminPage />
      </AuthProvider>
    </I18nProvider>
  ),
});

type Tab = "overview" | "users" | "requests" | "plans" | "agent";

function AdminPage() {
  const { t } = useI18n();
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { mode: "signin", redirect: "/admin" } });
  }, [loading, user, navigate]);

  if (loading || !user) return <Center><Loader2 className="size-8 animate-spin text-primary" /></Center>;
  if (!isAdmin) return (
    <div className="min-h-screen">
      <SiteHeader />
      <Center>
        <div className="text-center">
          <h1 className="font-display text-2xl font-bold">403</h1>
          <p className="mt-2 text-muted-foreground">Admins only.</p>
          <Link to="/" className="mt-4 inline-block text-primary hover:underline">← {t("back_home")}</Link>
        </div>
      </Center>
    </div>
  );

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        <h1 className="mb-6 font-display text-3xl font-bold text-gradient">{t("admin_title")}</h1>

        <div className="mb-6 flex flex-wrap gap-2 rounded-full border border-border bg-card/60 p-1">
          {(["overview","users","requests","plans","agent"] as Tab[]).map((k) => (
            <button key={k} onClick={() => setTab(k)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                tab === k ? "bg-gradient-to-r from-primary to-accent text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}>
              {k === "agent" ? "🤖 الوكيل" : t(`admin_${k}` as any)}
            </button>
          ))}
        </div>

        {tab === "overview" && <Overview />}
        {tab === "users" && <UsersTab />}
        {tab === "requests" && <RequestsTab />}
        {tab === "plans" && <PlansTab />}
        {tab === "agent" && <AgentTab />}
      </div>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[60vh] items-center justify-center">{children}</div>;
}

function Overview() {
  const { t } = useI18n();
  const [stats, setStats] = useState({ users: 0, analyses: 0, pending: 0, suggestions: 0 });
  useEffect(() => {
    Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("analyses").select("id", { count: "exact", head: true }),
      supabase.from("subscription_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("suggestions").select("id", { count: "exact", head: true }),
    ]).then(([u, a, p, s]) => setStats({ users: u.count || 0, analyses: a.count || 0, pending: p.count || 0, suggestions: s.count || 0 }));
  }, []);
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <StatCard icon={<Users />} label={t("admin_total_users")} value={stats.users} />
      <StatCard icon={<Activity />} label={t("admin_total_analyses")} value={stats.analyses} />
      <StatCard icon={<Crown />} label="Suggestions" value={stats.suggestions} />
      <StatCard icon={<Bell />} label={t("admin_pending")} value={stats.pending} />
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card/70 p-5 backdrop-blur">
      <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
        <span className="text-primary">{icon}</span> {label}
      </div>
      <div className="font-display text-3xl font-bold text-gradient">{value}</div>
    </div>
  );
}

function UsersTab() {
  const { t } = useI18n();
  const [rows, setRows] = useState<any[]>([]);
  const [admins, setAdmins] = useState<Set<string>>(new Set());
  const [plans, setPlans] = useState<any[]>([]);
  const [picker, setPicker] = useState<string | null>(null);

  const load = async () => {
    const [{ data: ps }, { data: rs }, { data: pl }] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("user_roles").select("user_id, role").eq("role", "admin"),
      supabase.from("subscription_plans").select("*").eq("active", true).gt("price_iqd", 0).order("sort_order"),
    ]);
    setRows(ps || []);
    setAdmins(new Set((rs || []).map((r: any) => r.user_id)));
    setPlans(pl || []);
  };
  useEffect(() => { load(); }, []);

  const toggleAdmin = async (uid: string) => {
    if (admins.has(uid)) {
      await supabase.from("user_roles").delete().eq("user_id", uid).eq("role", "admin");
    } else {
      await supabase.from("user_roles").insert({ user_id: uid, role: "admin" });
    }
    load();
  };

  const subscribe = async (uid: string, plan: any) => {
    const expires = new Date(Date.now() + plan.duration_days * 86400000).toISOString();
    await supabase.from("profiles").update({
      is_subscribed: true,
      subscription_tier: plan.name,
      subscription_expires_at: expires,
      monthly_analyses_used: 0,
      monthly_suggestions_used: 0,
      usage_period_start: new Date().toISOString(),
    }).eq("id", uid);
    setPicker(null);
    load();
  };

  const unsubscribe = async (uid: string) => {
    await supabase.from("profiles").update({
      is_subscribed: false,
      subscription_tier: null,
      subscription_expires_at: null,
    }).eq("id", uid);
    load();
  };

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card/70 backdrop-blur">
      <table className="w-full min-w-[700px] text-sm">
        <thead className="bg-background/40 text-xs uppercase text-muted-foreground">
          <tr><th className="p-3 text-start">Email</th><th className="p-3 text-start">Subscription</th><th className="p-3 text-start">Used</th><th className="p-3 text-start">Joined</th><th className="p-3"></th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-border align-top">
              <td className="p-3">{r.email}{admins.has(r.id) && <span className="ms-2 rounded bg-accent/20 px-1.5 py-0.5 text-[10px] text-accent">ADMIN</span>}</td>
              <td className="p-3">
                {r.is_subscribed ? (
                  <span className="inline-flex items-center gap-1 rounded bg-success/15 px-2 py-0.5 text-xs text-success">{r.subscription_tier || "Pro"}</span>
                ) : <span className="text-muted-foreground">—</span>}
                {r.subscription_expires_at && <div className="mt-0.5 text-[10px] text-muted-foreground">{new Date(r.subscription_expires_at).toLocaleDateString()}</div>}
              </td>
              <td className="p-3">{r.monthly_analyses_used}A · {r.monthly_suggestions_used}S</td>
              <td className="p-3 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
              <td className="p-3 text-end">
                <div className="flex flex-wrap justify-end gap-1.5">
                  {picker === r.id ? (
                    <div className="flex flex-wrap gap-1">
                      {plans.map((p) => (
                        <button key={p.id} onClick={() => subscribe(r.id, p)}
                          className="rounded-full bg-gradient-to-r from-success to-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground hover:scale-105">
                          {p.name} · {p.duration_days}d
                        </button>
                      ))}
                      <button onClick={() => setPicker(null)} className="rounded-full border border-border px-2 py-1 text-[11px]">×</button>
                    </div>
                  ) : (
                    <>
                      {r.is_subscribed ? (
                        <button onClick={() => unsubscribe(r.id)}
                          className="rounded-full border border-destructive/40 px-3 py-1 text-xs text-destructive hover:bg-destructive/10">
                          Unsubscribe
                        </button>
                      ) : (
                        <button onClick={() => setPicker(r.id)}
                          className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-success to-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                          <Crown className="size-3" /> Subscribe
                        </button>
                      )}
                      <button onClick={() => toggleAdmin(r.id)}
                        className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs hover:border-primary">
                        {admins.has(r.id) ? <><ShieldMinus className="size-3" />{t("admin_demote")}</> : <><ShieldPlus className="size-3" />{t("admin_promote")}</>}
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RequestsTab() {
  const { t } = useI18n();
  const [rows, setRows] = useState<any[]>([]);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [kind, setKind] = useState<"all" | "plan" | "agent">("all");

  const load = async () => {
    const { data } = await supabase
      .from("subscription_requests")
      .select("*, subscription_plans(name, duration_days, monthly_analyses, monthly_suggestions), agent_addons(name, price_iqd, monthly_tasks, max_targets)")
      .order("created_at", { ascending: false }).limit(200);
    const list = data || [];
    setRows(list);
    const ids = Array.from(new Set(list.map((r: any) => r.user_id)));
    if (ids.length) {
      const { data: ps } = await supabase.from("profiles").select("id, email").in("id", ids);
      const map: Record<string, string> = {};
      (ps || []).forEach((p: any) => { map[p.id] = p.email; });
      setEmails(map);
    }
  };
  useEffect(() => { load(); }, []);

  const decide = async (r: any, status: "approved" | "rejected") => {
    await supabase.from("subscription_requests").update({
      status, reviewed_at: new Date().toISOString(),
    }).eq("id", r.id);
    if (status === "approved") {
      if (r.request_type === "plan" && r.subscription_plans) {
        const expires = new Date(Date.now() + r.subscription_plans.duration_days * 86400000).toISOString();
        await supabase.from("profiles").update({
          is_subscribed: true,
          subscription_tier: r.subscription_plans.name,
          subscription_expires_at: expires,
          monthly_analyses_used: 0,
          monthly_suggestions_used: 0,
          usage_period_start: new Date().toISOString(),
        }).eq("id", r.user_id);
      } else if (r.request_type === "agent" && r.agent_addon_id) {
        const expires = new Date(Date.now() + 30 * 86400000).toISOString();
        await supabase.from("user_agent_subscriptions").insert({
          user_id: r.user_id, addon_id: r.agent_addon_id, status: "active",
          expires_at: expires, period_start: new Date().toISOString(),
        });
      }
    }
    load();
  };

  const filtered = rows.filter((r) =>
    (filter === "all" || r.status === filter) && (kind === "all" || r.request_type === kind)
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <div className="flex gap-1 rounded-full border border-border bg-card/60 p-1 text-xs">
          {(["pending","approved","rejected","all"] as const).map((s) => (
            <button key={s} onClick={() => setFilter(s)}
              className={`rounded-full px-3 py-1 ${filter === s ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{s}</button>
          ))}
        </div>
        <div className="flex gap-1 rounded-full border border-border bg-card/60 p-1 text-xs">
          {(["all","plan","agent"] as const).map((s) => (
            <button key={s} onClick={() => setKind(s)}
              className={`rounded-full px-3 py-1 ${kind === s ? "bg-accent text-primary-foreground" : "text-muted-foreground"}`}>{s}</button>
          ))}
        </div>
      </div>
      {filtered.length === 0 && <p className="text-sm text-muted-foreground">No requests.</p>}
      {filtered.map((r) => {
        const item = r.request_type === "agent" ? r.agent_addons : r.subscription_plans;
        return (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/70 p-4">
            <div>
              <div className="font-mono text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</div>
              <div className="font-medium">
                <span className={`me-2 rounded px-1.5 py-0.5 text-[10px] ${r.request_type === "agent" ? "bg-accent/20 text-accent" : "bg-primary/20 text-primary"}`}>{r.request_type}</span>
                {emails[r.user_id] || r.user_id.slice(0,8)+"…"} · {item?.name || "—"}
              </div>
              <div className="text-xs text-muted-foreground">
                Status: <span className={r.status === "pending" ? "text-yellow-400" : r.status === "approved" ? "text-success" : "text-destructive"}>{r.status}</span>
                {item?.price_iqd != null && <> · {item.price_iqd.toLocaleString()} IQD</>}
              </div>
            </div>
            {r.status === "pending" && (
              <div className="flex gap-2">
                <button onClick={() => decide(r, "approved")} className="inline-flex items-center gap-1 rounded-full bg-success/20 px-3 py-1.5 text-xs text-success hover:bg-success/30"><Check className="size-3" />{t("admin_approve")}</button>
                <button onClick={() => decide(r, "rejected")} className="inline-flex items-center gap-1 rounded-full bg-destructive/20 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/30"><X className="size-3" />{t("admin_reject")}</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PlansTab() {
  const [rows, setRows] = useState<any[]>([]);
  const load = async () => {
    const { data } = await supabase.from("subscription_plans").select("*").order("sort_order");
    setRows(data || []);
  };
  useEffect(() => { load(); }, []);

  const toggle = async (p: any) => {
    await supabase.from("subscription_plans").update({ active: !p.active }).eq("id", p.id);
    load();
  };
  const updatePrice = async (p: any, price: number) => {
    await supabase.from("subscription_plans").update({ price_iqd: price }).eq("id", p.id);
    load();
  };

  return (
    <div className="space-y-3">
      {rows.map((p) => (
        <div key={p.id} className="rounded-xl border border-border bg-card/70 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-display text-lg font-semibold">{p.name}</div>
              <div className="text-xs text-muted-foreground">{p.description}</div>
            </div>
            <button onClick={() => toggle(p)} className={`rounded-full px-3 py-1 text-xs ${p.active ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"}`}>
              {p.active ? "Active" : "Inactive"}
            </button>
          </div>
          <div className="mt-3 flex items-center gap-3 text-sm">
            <label className="flex items-center gap-2">Price (IQD):
              <input type="number" defaultValue={p.price_iqd} onBlur={(e) => updatePrice(p, parseInt(e.target.value, 10) || 0)}
                className="w-32 rounded-md border border-border bg-background/60 px-2 py-1" />
            </label>
            <span className="text-muted-foreground">· {p.duration_days}d · {p.monthly_analyses}A/{p.monthly_suggestions}S</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function AgentTab() {
  const [subs, setSubs] = useState<any[]>([]);
  const [addons, setAddons] = useState<any[]>([]);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [globalOn, setGlobalOn] = useState<boolean>(true);
  const [recentTasks, setRecentTasks] = useState<any[]>([]);

  const load = async () => {
    const [{ data: sb }, { data: ad }, { data: st }, { data: tk }] = await Promise.all([
      supabase.from("user_agent_subscriptions").select("*, agent_addons(name, monthly_tasks)").order("created_at", { ascending: false }).limit(200),
      supabase.from("agent_addons").select("*").order("sort_order"),
      supabase.from("app_settings").select("value").eq("key", "agent_enabled_global").maybeSingle(),
      supabase.from("agent_tasks").select("*").order("created_at", { ascending: false }).limit(20),
    ]);
    setSubs(sb || []);
    setAddons(ad || []);
    setRecentTasks(tk || []);
    setGlobalOn(st?.value !== false);
    const ids = Array.from(new Set((sb || []).map((s: any) => s.user_id)));
    if (ids.length) {
      const { data: ps } = await supabase.from("profiles").select("id, email").in("id", ids);
      const m: Record<string, string> = {};
      (ps || []).forEach((p: any) => { m[p.id] = p.email; });
      setEmails(m);
    }
  };
  useEffect(() => { load(); }, []);

  const toggleGlobal = async () => {
    const next = !globalOn;
    await supabase.from("app_settings").upsert({ key: "agent_enabled_global", value: next as any, updated_at: new Date().toISOString() });
    setGlobalOn(next);
  };

  const extend = async (s: any, days: number) => {
    const base = s.expires_at && new Date(s.expires_at) > new Date() ? new Date(s.expires_at) : new Date();
    const exp = new Date(base.getTime() + days * 86400000).toISOString();
    await supabase.from("user_agent_subscriptions").update({ expires_at: exp, status: "active" }).eq("id", s.id);
    load();
  };
  const resetUsage = async (s: any) => {
    await supabase.from("user_agent_subscriptions").update({ tasks_used: 0, tasks_used_today: 0, period_start: new Date().toISOString() }).eq("id", s.id);
    load();
  };
  const setStatus = async (s: any, status: string) => {
    await supabase.from("user_agent_subscriptions").update({ status }).eq("id", s.id);
    load();
  };
  const changeAddon = async (s: any, addonId: string) => {
    await supabase.from("user_agent_subscriptions").update({ addon_id: addonId }).eq("id", s.id);
    load();
  };

  const toggleAddon = async (a: any) => {
    await supabase.from("agent_addons").update({ active: !a.active }).eq("id", a.id);
    load();
  };
  const updateAddon = async (a: any, patch: any) => {
    await supabase.from("agent_addons").update(patch).eq("id", a.id);
    load();
  };
  const createAddon = async () => {
    const name = prompt("Addon name?");
    if (!name) return;
    await supabase.from("agent_addons").insert({ name, description: "", price_iqd: 0, monthly_tasks: 50, daily_task_cap: 10, max_targets: 1, active: false, sort_order: 99, features: [] });
    load();
  };
  const deleteAddon = async (a: any) => {
    if (!confirm(`Delete addon "${a.name}"?`)) return;
    await supabase.from("agent_addons").delete().eq("id", a.id);
    load();
  };

  return (
    <div className="space-y-8">
      {/* Global control */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/70 p-5">
        <div className="flex items-center gap-3">
          <Bot className="size-5 text-accent" />
          <div>
            <div className="font-display font-semibold">التحكم العام بالوكيل الذكي</div>
            <div className="text-xs text-muted-foreground">إيقاف/تشغيل الوكيل لكل المستخدمين فوراً عبر الموقع.</div>
          </div>
        </div>
        <button onClick={toggleGlobal}
          className={`rounded-full px-4 py-2 text-sm font-semibold ${globalOn ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"}`}>
          {globalOn ? "● مُفعّل" : "○ متوقف"}
        </button>
      </div>

      {/* Active subscriptions with full controls */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold">
          <Bot className="size-4 text-accent" /> اشتراكات الوكيل ({subs.length})
        </h2>
        <div className="overflow-x-auto rounded-2xl border border-border bg-card/70">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-background/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3 text-start">User</th><th className="p-3 text-start">Addon</th>
                <th className="p-3 text-start">Status</th><th className="p-3 text-start">Used</th>
                <th className="p-3 text-start">Expires</th><th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {subs.map((s) => (
                <tr key={s.id} className="border-t border-border align-top">
                  <td className="p-3 text-xs">{emails[s.user_id] || s.user_id.slice(0,8)+"…"}</td>
                  <td className="p-3">
                    <select value={s.addon_id || ""} onChange={(e) => changeAddon(s, e.target.value)}
                      className="rounded border border-border bg-background/60 px-2 py-1 text-xs">
                      {addons.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </td>
                  <td className="p-3">
                    <span className={`rounded px-2 py-0.5 text-[10px] ${
                      s.status === "active" ? "bg-success/20 text-success" :
                      s.status === "pending" ? "bg-yellow-500/20 text-yellow-500" :
                      "bg-muted text-muted-foreground"
                    }`}>{s.status}</span>
                  </td>
                  <td className="p-3 text-xs">{s.tasks_used}/{s.agent_addons?.monthly_tasks || "?"}</td>
                  <td className="p-3 text-xs text-muted-foreground">{s.expires_at ? new Date(s.expires_at).toLocaleDateString() : "—"}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <button onClick={() => extend(s, 30)} className="rounded-full bg-primary/20 px-2.5 py-1 text-[11px] text-primary hover:bg-primary/30">+30 يوم</button>
                      <button onClick={() => extend(s, 7)} className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] text-primary">+7</button>
                      <button onClick={() => resetUsage(s)} className="rounded-full border border-border px-2.5 py-1 text-[11px]">صفّر الاستخدام</button>
                      {s.status === "active"
                        ? <button onClick={() => setStatus(s, "expired")} className="rounded-full border border-destructive/40 px-2.5 py-1 text-[11px] text-destructive">إيقاف</button>
                        : <button onClick={() => setStatus(s, "active")} className="rounded-full bg-success/20 px-2.5 py-1 text-[11px] text-success">تفعيل</button>}
                    </div>
                  </td>
                </tr>
              ))}
              {subs.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-xs text-muted-foreground">لا توجد اشتراكات.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Addons CRUD */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold">باقات الوكيل</h2>
          <button onClick={createAddon} className="rounded-full bg-gradient-to-r from-primary to-accent px-3 py-1.5 text-xs font-semibold text-primary-foreground">+ باقة جديدة</button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {addons.map((a) => (
            <div key={a.id} className="rounded-xl border border-border bg-card/70 p-4">
              <div className="flex items-center justify-between">
                <input defaultValue={a.name} onBlur={(e) => updateAddon(a, { name: e.target.value })}
                  className="bg-transparent font-display font-semibold outline-none" />
                <div className="flex gap-1">
                  <button onClick={() => toggleAddon(a)} className={`rounded-full px-2 py-0.5 text-[10px] ${a.active ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"}`}>{a.active ? "Active" : "Inactive"}</button>
                  <button onClick={() => deleteAddon(a)} className="rounded-full bg-destructive/20 px-2 py-0.5 text-[10px] text-destructive">×</button>
                </div>
              </div>
              <textarea defaultValue={a.description || ""} onBlur={(e) => updateAddon(a, { description: e.target.value })}
                className="mt-2 w-full resize-none rounded border border-border bg-background/40 px-2 py-1 text-xs" rows={2} />
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <label>السعر (IQD)
                  <input type="number" defaultValue={a.price_iqd} onBlur={(e) => updateAddon(a, { price_iqd: parseInt(e.target.value, 10) || 0 })}
                    className="mt-0.5 w-full rounded border border-border bg-background/60 px-2 py-1" />
                </label>
                <label>مهام/شهر
                  <input type="number" defaultValue={a.monthly_tasks} onBlur={(e) => updateAddon(a, { monthly_tasks: parseInt(e.target.value, 10) || 0 })}
                    className="mt-0.5 w-full rounded border border-border bg-background/60 px-2 py-1" />
                </label>
                <label>حد يومي
                  <input type="number" defaultValue={a.daily_task_cap} onBlur={(e) => updateAddon(a, { daily_task_cap: parseInt(e.target.value, 10) || 0 })}
                    className="mt-0.5 w-full rounded border border-border bg-background/60 px-2 py-1" />
                </label>
                <label>عدد المواقع
                  <input type="number" defaultValue={a.max_targets} onBlur={(e) => updateAddon(a, { max_targets: parseInt(e.target.value, 10) || 0 })}
                    className="mt-0.5 w-full rounded border border-border bg-background/60 px-2 py-1" />
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent tasks */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold">
          <Activity className="size-4 text-accent" /> آخر مهام الوكيل
        </h2>
        <div className="overflow-x-auto rounded-2xl border border-border bg-card/70">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="bg-background/40 text-xs uppercase text-muted-foreground">
              <tr><th className="p-3 text-start">Time</th><th className="p-3 text-start">User</th><th className="p-3 text-start">Type</th><th className="p-3 text-start">Status</th></tr>
            </thead>
            <tbody>
              {recentTasks.map((t) => (
                <tr key={t.id} className="border-t border-border">
                  <td className="p-3 text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()}</td>
                  <td className="p-3 text-xs font-mono">{t.user_id.slice(0,8)}…</td>
                  <td className="p-3 text-xs">{t.task_type}</td>
                  <td className="p-3 text-xs">{t.status}</td>
                </tr>
              ))}
              {recentTasks.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-xs text-muted-foreground">لا مهام بعد.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
