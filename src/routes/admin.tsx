import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { AuthProvider, useAuth } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Users, Activity, Bell, Crown, Check, X, ShieldPlus, ShieldMinus, Bot, KeyRound as Lock, Smartphone, Pencil, KeySquare } from "lucide-react";
import { TOOL_CATALOG, type ToolKey } from "@/lib/tool-catalog";
import { AdminTokensPanel } from "@/components/admin/AdminTokensPanel";
import { AdminPlanPricingPanel } from "@/components/admin/AdminPlanPricingPanel";
import { AdminPlansMatrixPanel } from "@/components/admin/AdminPlansMatrixPanel";
import { AdminLedgerPanel } from "@/components/admin/AdminLedgerPanel";
import { ContentStudioTab } from "@/components/admin/ContentStudioTab";
import { HeaderConfigTab } from "@/components/admin/HeaderConfigTab";
import { ExportConfigTab } from "@/components/admin/ExportConfigTab";
import {
  adminGrantRole, adminRevokeRole, adminPatchProfile,
  adminCreatePlan, adminUpdatePlan, adminDeletePlan,
  adminDecideSubscriptionRequest,
  adminPatchAgentSubscription, adminGrantAgentSubscription,
  adminCreateAddon, adminUpdateAddon, adminDeleteAddon,
  adminSetAppSetting, adminUpsertSingleToolPlanAccess,
} from "@/lib/admin.functions";
import { PricesEditor, type PricesValue } from "@/components/admin/PricesEditor";
import { normalizePrices, pickPrice, formatMoney } from "@/lib/currencies";
import { useCountry } from "@/lib/use-country";


export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Console · MAAROOF Ai" },
      { name: "description", content: "MAAROOF Ai admin console: manage users, subscription requests, plans, agent quotas, access policies, brand boost, and content." },
      { name: "robots", content: "noindex,nofollow" },
      { property: "og:title", content: "Admin Console · MAAROOF Ai" },
      { property: "og:description", content: "MAAROOF Ai admin console for managing users, plans, agent quotas, and content." },
    ],
  }),
  component: () => (
    <I18nProvider>
      <AuthProvider>
        <AdminPage />
      </AuthProvider>
    </I18nProvider>
  ),
});

type Tab = "overview" | "users_pricing" | "requests" | "boost" | "content" | "studio" | "header" | "exports" | "contact" | "ledger";
type UPSub = "users" | "tokens" | "pricing" | "plans" | "agent" | "access";

function AdminPage() {
  const { t, lang } = useI18n();
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("overview");
  const [upSub, setUpSub] = useState<UPSub>("users");

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

  const tabLabel = (k: Tab) => {
    if (k === "overview") return t("admin_overview" as any) || "Overview";
    if (k === "users_pricing") return lang === "ar" ? "المستخدمون والصلاحيات والأسعار" : lang === "ku" ? "بەکارهێنەران، دەسەڵات و نرخەکان" : "Users, Permissions & Pricing";
    if (k === "requests") return t("admin_requests" as any) || "Requests";
    if (k === "boost") return "Brand Boost";
    if (k === "content") return "Content";
    if (k === "studio") return lang === "ar" ? "محرر المحتوى" : lang === "ku" ? "ستۆدیۆی ناوەڕۆک" : "Content Studio";
    if (k === "header") return lang === "ar" ? "الهيدر والروابط" : lang === "ku" ? "هێدەر و بەستەرەکان" : "Header & Nav";
    if (k === "exports") return lang === "ar" ? "التصدير" : lang === "ku" ? "هەناردەکردن" : "Exports";
    if (k === "contact") return lang === "ar" ? "معلومات الاتصال" : lang === "ku" ? "زانیاری پەیوەندی" : "Contact Info";
    if (k === "ledger") return t("admin_ledger") || "Ledger";
    return k;
  };

  const subLabel = (k: UPSub) => {
    if (k === "users") return lang === "ar" ? "المستخدمون والتوكنات" : lang === "ku" ? "بەکارهێنەران و تۆکن" : "Users & Tokens";
    if (k === "tokens") return t("admin_tokens") || "Tokens";
    if (k === "pricing") return lang === "ar" ? "شبكة الخطط × الأدوات" : lang === "ku" ? "تۆڕی پلان × ئامراز" : "Plans × Tools Matrix";
    if (k === "plans") return t("admin_plans" as any) || "Plans";
    if (k === "agent") return t("nav_agent") || "Agent";
    if (k === "access") return t("admin_access") || "Access";
    return k;
  };

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-3xl font-bold text-gradient">{t("admin_title")}</h1>
        </div>


        <div className="mb-4 flex flex-wrap gap-2 rounded-full border border-border bg-card/60 p-1">
          {(["overview","users_pricing","requests","boost","content","studio","header","exports","contact","ledger"] as Tab[]).map((k) => (
            <button key={k} onClick={() => setTab(k)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                tab === k ? "bg-gradient-to-r from-primary to-accent text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}>
              {tabLabel(k)}
            </button>
          ))}
        </div>

        {tab === "users_pricing" && (
          <div className="mb-4 flex flex-wrap gap-1.5 rounded-lg border border-border/60 bg-background/40 p-1">
            {(["users","pricing","plans","agent","access"] as UPSub[]).map((k) => (
              <button key={k} onClick={() => setUpSub(k)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                  upSub === k ? "bg-primary/15 text-primary border border-primary/30" : "text-muted-foreground hover:text-foreground"
                }`}>
                {subLabel(k)}
              </button>
            ))}
          </div>
        )}

        {tab === "overview" && <Overview />}
        {tab === "users_pricing" && (upSub === "users" || upSub === "tokens") && <AdminTokensPanel />}
        {tab === "users_pricing" && upSub === "pricing" && <AdminPlansMatrixPanel />}
        {tab === "users_pricing" && upSub === "plans" && <PlansTab />}
        {tab === "users_pricing" && upSub === "agent" && <AgentTab />}
        {tab === "users_pricing" && upSub === "access" && <AccessTab />}
        {tab === "requests" && <RequestsTab />}
        {tab === "boost" && <BoostTab />}
        {tab === "content" && <ContentTab />}
        {tab === "studio" && <ContentStudioTab />}
        {tab === "header" && <HeaderConfigTab />}
        {tab === "exports" && <ExportConfigTab />}
        {tab === "contact" && <ContactInfoTab />}
        {tab === "ledger" && <AdminLedgerPanel />}
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
      await adminRevokeRole({ data: { userId: uid, role: "admin" } });
    } else {
      await adminGrantRole({ data: { userId: uid, role: "admin" } });
    }
    load();
  };

  const subscribe = async (uid: string, plan: any) => {
    const expires = new Date(Date.now() + plan.duration_days * 86400000).toISOString();
    await adminPatchProfile({ data: { userId: uid, patch: {
      is_subscribed: true,
      subscription_tier: plan.name,
      subscription_expires_at: expires,
      monthly_analyses_used: 0,
      monthly_suggestions_used: 0,
      usage_period_start: new Date().toISOString(),
    } } });
    setPicker(null);
    load();
  };

  const unsubscribe = async (uid: string) => {
    await adminPatchProfile({ data: { userId: uid, patch: {
      is_subscribed: false,
      subscription_tier: null,
      subscription_expires_at: null,
    } } });
    load();
  };

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card/70 backdrop-blur">
      <table className="w-full min-w-[700px] text-sm">
        <thead className="bg-background/40 text-xs uppercase text-muted-foreground">
          <tr><th className="p-3 text-start">Email</th><th className="p-3 text-start">{t("admin_subscription")}</th><th className="p-3 text-start" title={t("admin_used_help")}>{t("admin_used")}</th><th className="p-3 text-start">{t("admin_quota_override")}</th><th className="p-3 text-start">Devices</th><th className="p-3 text-start">{t("admin_joined")}</th><th className="p-3"></th></tr>
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
              <td className="p-3 whitespace-nowrap text-xs" title={t("admin_used_help")}>
                <span className="inline-flex items-center gap-1"><Activity className="size-3 text-primary" />{r.monthly_analyses_used} <span className="text-muted-foreground">{t("admin_analyses_short")}</span></span>
                <span className="mx-1 text-muted-foreground">·</span>
                <span className="inline-flex items-center gap-1"><Pencil className="size-3 text-accent" />{r.monthly_suggestions_used} <span className="text-muted-foreground">{t("admin_posts_short")}</span></span>
              </td>

              <td className="p-3">
                <div className="flex items-center gap-1.5">
                  <input
                    key={`qa-${r.id}-${(r.quota_overrides?.monthly_analyses) ?? ""}`}
                    type="number" min={0}
                    defaultValue={r.quota_overrides?.monthly_analyses ?? ""}
                    placeholder="A"
                    onBlur={async (e) => {
                      const v = e.target.value === "" ? null : Number(e.target.value);
                      const next = { ...(r.quota_overrides || {}) };
                      if (v == null) delete next.monthly_analyses; else next.monthly_analyses = v;
                      await adminPatchProfile({ data: { userId: r.id, patch: { quota_overrides: next } } });
                      load();
                    }}
                    className="w-16 rounded border border-border bg-background/60 px-1.5 py-0.5 text-xs"
                  />
                  <input
                    key={`qs-${r.id}-${(r.quota_overrides?.monthly_suggestions) ?? ""}`}
                    type="number" min={0}
                    defaultValue={r.quota_overrides?.monthly_suggestions ?? ""}
                    placeholder="S"
                    onBlur={async (e) => {
                      const v = e.target.value === "" ? null : Number(e.target.value);
                      const next = { ...(r.quota_overrides || {}) };
                      if (v == null) delete next.monthly_suggestions; else next.monthly_suggestions = v;
                      await adminPatchProfile({ data: { userId: r.id, patch: { quota_overrides: next } } });
                      load();
                    }}
                    className="w-16 rounded border border-border bg-background/60 px-1.5 py-0.5 text-xs"
                  />
                  {((r.quota_overrides?.monthly_analyses) || (r.quota_overrides?.monthly_suggestions)) && (
                    <button
                      onClick={async () => {
                        await adminPatchProfile({ data: { userId: r.id, patch: { monthly_analyses_used: 0, monthly_suggestions_used: 0, usage_period_start: new Date().toISOString() } } });
                        load();
                      }}
                      title={t("admin_reset_usage")}
                      className="rounded border border-border px-1.5 py-0.5 text-[10px] hover:border-primary"
                    >↺</button>
                  )}
                </div>
                {(() => {
                  const bb = String(r.quota_overrides?.brand_boost || "auto");
                  const next = bb === "auto" ? "on" : bb === "on" ? "off" : "auto";
                  const cls = bb === "on" ? "border-success text-success bg-success/10"
                    : bb === "off" ? "border-destructive text-destructive bg-destructive/10"
                    : "border-border text-muted-foreground";
                  return (
                    <button
                      title="Brand Boost access (auto / on / off)"
                      onClick={async () => {
                        const ov = { ...(r.quota_overrides || {}) };
                        if (next === "auto") delete ov.brand_boost; else ov.brand_boost = next;
                        await adminPatchProfile({ data: { userId: r.id, patch: { quota_overrides: ov } } });
                        load();
                      }}
                      className={`mt-1 rounded-full border px-2 py-0.5 text-[10px] ${cls}`}
                    >BB: {bb}</button>
                  );
                })()}
              </td>
              <td className="p-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1">
                    <input
                      key={`md-${r.id}-${r.max_devices ?? 1}`}
                      type="number" min={1} max={20}
                      defaultValue={r.max_devices ?? 1}
                      title="Max devices allowed"
                      onBlur={async (e) => {
                        const v = Math.max(1, Number(e.target.value || 1));
                        await adminPatchProfile({ data: { userId: r.id, patch: { max_devices: v } } });
                        load();
                      }}
                      className="w-12 rounded border border-border bg-background/60 px-1.5 py-0.5 text-xs"
                    />
                    <span className="text-[10px] text-muted-foreground">dev</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      key={`fee-${r.id}-${r.extra_device_fee_iqd ?? 0}`}
                      type="number" min={0} step={1000}
                      defaultValue={r.extra_device_fee_iqd ?? 0}
                      title="Extra fee per additional device (IQD)"
                      onBlur={async (e) => {
                        const v = Math.max(0, Number(e.target.value || 0));
                        await adminPatchProfile({ data: { userId: r.id, patch: { extra_device_fee_iqd: v } } });
                        load();
                      }}
                      className="w-20 rounded border border-border bg-background/60 px-1.5 py-0.5 text-xs"
                    />
                    <span className="text-[10px] text-muted-foreground">IQD</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {Array.isArray(r.device_fingerprints) ? r.device_fingerprints.length : (r.device_fingerprint ? 1 : 0)}/{r.max_devices ?? 1} used
                  </div>
                </div>
              </td>
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
                      <button onClick={async () => {
                        if (!r.email) return;
                        const { error } = await supabase.auth.resetPasswordForEmail(r.email, {
                          redirectTo: `${window.location.origin}/reset-password`,
                        });
                        alert(error ? error.message : t("admin_reset_sent"));
                      }} className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/5 px-3 py-1 text-xs text-accent hover:bg-accent/10">
                        <Lock className="size-3" /> {t("admin_send_reset")}
                      </button>
                      {(r.device_fingerprint || (Array.isArray(r.device_fingerprints) && r.device_fingerprints.length > 0)) && (
                        <button onClick={async () => {
                          if (!confirm(t("admin_reset_fp_confirm"))) return;
                          await adminPatchProfile({ data: { userId: r.id, patch: { device_fingerprint: null, device_locked_at: null, device_fingerprints: [] } } });
                          load();
                        }} className="inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning/5 px-3 py-1 text-xs text-warning hover:bg-warning/10">
                          <Smartphone className="size-3" /> {t("admin_reset_fp")}
                        </button>
                      )}
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
    await adminDecideSubscriptionRequest({ data: { requestId: r.id, status } });
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
    await adminUpdatePlan({ data: { planId: p.id, patch: { active: !p.active } } });
    load();
  };
  const save = async (p: any, patch: any) => {
    await adminUpdatePlan({ data: { planId: p.id, patch } });
    load();
  };
  const del = async (p: any) => {
    if (!confirm(`Delete plan "${p.name}"?`)) return;
    await adminDeletePlan({ data: { planId: p.id } });
    load();
  };
  const create = async () => {
    const name = prompt("Plan name?");
    if (!name) return;
    await adminCreatePlan({ data: { values: {
      name, description: "",
      prices: { USD: 0 }, default_currency: "USD",
      price_iqd: 0, duration_days: 30,
      monthly_analyses: 50, monthly_suggestions: 30, active: false, sort_order: 99, features: [],
    } } });
    load();
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={create} className="rounded-full bg-gradient-to-r from-primary to-accent px-3 py-1.5 text-xs font-semibold text-primary-foreground">+ New plan</button>
      </div>
      {rows.map((p) => (
        <PlanRow key={p.id} plan={p} onToggle={() => toggle(p)} onSave={(patch) => save(p, patch)} onDelete={() => del(p)} />
      ))}
    </div>
  );
}

function PlanRow({ plan, onToggle, onSave, onDelete }: { plan: any; onToggle: () => void; onSave: (patch: any) => void; onDelete: () => void }) {
  const { lang } = useI18n();
  const { info: country } = useCountry();
  const userCountry = country?.code || null;
  const [edit, setEdit] = useState(false);
  const initialPrices: PricesValue = {
    prices: (plan.prices && typeof plan.prices === "object" && Object.keys(plan.prices).length > 0)
      ? plan.prices
      : (plan.price_iqd
          ? { IQD: Number(plan.price_iqd) }
          : (plan.price_usd ? { USD: Number(plan.price_usd) } : { USD: 0 })),
    default_currency: plan.default_currency || (plan.price_iqd ? "IQD" : "USD"),
  };
  const [pv, setPv] = useState<PricesValue>(initialPrices);
  const [f, setF] = useState({
    name: plan.name, description: plan.description || "",
    duration_days: plan.duration_days,
    monthly_analyses: plan.monthly_analyses, monthly_suggestions: plan.monthly_suggestions,
    sort_order: plan.sort_order,
    features: Array.isArray(plan.features) ? plan.features.join("\n") : "",
    discount_badge_enabled: !!plan.discount_badge_enabled,
    discount_badge_text: plan.discount_badge_text || "",
  });
  const submit = () => {
    onSave({
      name: f.name, description: f.description,
      prices: normalizePrices(pv.prices),
      default_currency: pv.default_currency || "USD",
      duration_days: Number(f.duration_days) || 30,
      monthly_analyses: Number(f.monthly_analyses) || 0, monthly_suggestions: Number(f.monthly_suggestions) || 0,
      sort_order: Number(f.sort_order) || 0,
      features: f.features.split("\n").map((x: string) => x.trim()).filter(Boolean),
      discount_badge_enabled: f.discount_badge_enabled,
      discount_badge_text: f.discount_badge_enabled ? (f.discount_badge_text.trim() || null) : null,
    });
    setEdit(false);
  };
  const displayPrice = (() => {
    const picked = pickPrice(plan.prices, userCountry, plan.default_currency);
    if (picked) return formatMoney(picked.amount, picked.currency, lang as any);
    if (plan.price_usd) return formatMoney(Number(plan.price_usd), "USD", lang as any);
    if (plan.price_iqd) return formatMoney(Number(plan.price_iqd), "IQD", lang as any);
    return "—";
  })();
  return (
    <div className="rounded-xl border border-border bg-card/70 p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="font-display text-lg font-semibold">{plan.name}</div>
          <div className="text-xs text-muted-foreground">{plan.description}</div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onToggle} className={`rounded-full px-3 py-1 text-xs ${plan.active ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"}`}>{plan.active ? "Active" : "Inactive"}</button>
          <button onClick={() => setEdit((v) => !v)} className="rounded-full border border-border px-3 py-1 text-xs">{edit ? "Close" : "Edit"}</button>
          <button onClick={onDelete} className="rounded-full border border-destructive/40 px-3 py-1 text-xs text-destructive">Delete</button>
        </div>
      </div>
      {!edit ? (
        <div className="mt-2 text-sm text-muted-foreground" title="Monthly Analyses / Monthly Suggestions (posts)">
          {displayPrice} · {plan.duration_days}d ·{" "}
          <span className="inline-flex items-center gap-1" title="Monthly Analyses"><Activity className="size-3 text-primary" />{plan.monthly_analyses}</span>{" "}
          <span className="text-muted-foreground">·</span>{" "}
          <span className="inline-flex items-center gap-1" title="Monthly Suggestions / Posts"><Pencil className="size-3 text-accent" />{plan.monthly_suggestions}</span>
        </div>

      ) : (
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <Field label="Name"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inp} /></Field>
          <Field label="Sort order"><input type="number" value={f.sort_order} onChange={(e) => setF({ ...f, sort_order: e.target.value as any })} className={inp} /></Field>
          <Field label="Description" full><textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className={`${inp} h-20`} /></Field>
          <Field label="Prices (multi-currency)" full><PricesEditor value={pv} onChange={setPv} /></Field>
          <Field label="Duration (days)"><input type="number" value={f.duration_days} onChange={(e) => setF({ ...f, duration_days: e.target.value as any })} className={inp} /></Field>
          <Field label="Monthly analyses"><input type="number" value={f.monthly_analyses} onChange={(e) => setF({ ...f, monthly_analyses: e.target.value as any })} className={inp} /></Field>
          <Field label="Monthly suggestions"><input type="number" value={f.monthly_suggestions} onChange={(e) => setF({ ...f, monthly_suggestions: e.target.value as any })} className={inp} /></Field>
          <Field label="Features (one per line)" full><textarea value={f.features} onChange={(e) => setF({ ...f, features: e.target.value })} className={`${inp} h-24`} /></Field>
          <Field label="Discount badge">
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={f.discount_badge_enabled}
                onChange={(e) => setF({ ...f, discount_badge_enabled: e.target.checked })}
              />
              <span>Show discount badge on this plan</span>
            </label>
          </Field>
          <Field label="Discount badge text">
            <input
              type="text"
              value={f.discount_badge_text}
              onChange={(e) => setF({ ...f, discount_badge_text: e.target.value })}
              placeholder="e.g. Save 20% · وفّر 20%"
              disabled={!f.discount_badge_enabled}
              className={inp}
            />
          </Field>
          <div className="md:col-span-2 flex justify-end">
            <button onClick={submit} className="rounded-full bg-gradient-to-r from-success to-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground">Save</button>
          </div>
        </div>
      )}
    </div>
  );
}

const inp = "w-full rounded-md border border-border bg-background/60 px-2 py-1 text-sm";
function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <label className={`${full ? "md:col-span-2" : ""} block`}>
      <span className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function AgentTab() {
  const { t } = useI18n();
  const [subs, setSubs] = useState<any[]>([]);
  const [addons, setAddons] = useState<any[]>([]);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [globalOn, setGlobalOn] = useState<boolean>(true);
  const [recentTasks, setRecentTasks] = useState<any[]>([]);

  // Manual grant form state
  const [grantEmail, setGrantEmail] = useState("");
  const [grantAddonId, setGrantAddonId] = useState("");
  const [grantDays, setGrantDays] = useState<number>(30);
  const [grantMsg, setGrantMsg] = useState<string | null>(null);

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
    if (ad && ad.length && !grantAddonId) setGrantAddonId(ad[0].id);
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
    await adminSetAppSetting({ data: { key: "agent_enabled_global", value: { v: next } as any } });
    // Backward-compat: the prior stored "value" was a bare boolean; wrap so Zod record accepts it.
    setGlobalOn(next);
  };

  const grantManual = async () => {
    setGrantMsg(null);
    if (!grantEmail || !grantAddonId) return;
    try {
      await adminGrantAgentSubscription({ data: { email: grantEmail.trim().toLowerCase(), addonId: grantAddonId, days: grantDays || 30 } });
      setGrantMsg(t("ad_grant_ok"));
      setGrantEmail("");
      load();
    } catch (e: any) {
      setGrantMsg(t("ad_grant_no_user"));
    }
    setTimeout(() => setGrantMsg(null), 3000);
  };

  const extend = async (s: any, days: number) => {
    const base = s.expires_at && new Date(s.expires_at) > new Date() ? new Date(s.expires_at) : new Date();
    const exp = new Date(base.getTime() + days * 86400000).toISOString();
    await adminPatchAgentSubscription({ data: { id: s.id, patch: { expires_at: exp, status: "active" } } });
    load();
  };
  const resetUsage = async (s: any) => {
    await adminPatchAgentSubscription({ data: { id: s.id, patch: { tasks_used: 0, tasks_used_today: 0, period_start: new Date().toISOString() } } });
    load();
  };
  const setStatus = async (s: any, status: string) => {
    await adminPatchAgentSubscription({ data: { id: s.id, patch: { status: status as any } } });
    load();
  };
  const changeAddon = async (s: any, addonId: string) => {
    await adminPatchAgentSubscription({ data: { id: s.id, patch: { addon_id: addonId } } });
    load();
  };

  const toggleAddon = async (a: any) => {
    await adminUpdateAddon({ data: { id: a.id, patch: { active: !a.active } } });
    load();
  };
  const updateAddon = async (a: any, patch: any) => {
    await adminUpdateAddon({ data: { id: a.id, patch } });
    load();
  };
  const createAddon = async () => {
    const name = prompt("Addon name?");
    if (!name) return;
    await adminCreateAddon({ data: { values: { name, description: "", prices: { USD: 0 }, default_currency: "USD", price_iqd: 0, monthly_tasks: 50, daily_task_cap: 10, max_targets: 1, active: false, sort_order: 99, features: [] } } });
    load();
  };
  const deleteAddon = async (a: any) => {
    if (!confirm(`Delete addon "${a.name}"?`)) return;
    await adminDeleteAddon({ data: { id: a.id } });
    load();
  };

  return (
    <div className="space-y-8">
      {/* Global control */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/70 p-5">
        <div className="flex items-center gap-3">
          <Bot className="size-5 text-accent" />
          <div>
            <div className="font-display font-semibold">{t("ad_global_title")}</div>
            <div className="text-xs text-muted-foreground">{t("ad_global_desc")}</div>
          </div>
        </div>
        <button onClick={toggleGlobal}
          className={`rounded-full px-4 py-2 text-sm font-semibold ${globalOn ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"}`}>
          {globalOn ? t("ad_global_on") : t("ad_global_off")}
        </button>
      </div>

      {/* Manual grant */}
      <div className="rounded-2xl border border-accent/40 bg-card/70 p-5">
        <div className="mb-3 flex items-center gap-2">
          <Bot className="size-4 text-accent" />
          <h3 className="font-display font-semibold">{t("ad_grant_title")}</h3>
        </div>
        <div className="grid gap-2 md:grid-cols-[2fr_2fr_1fr_auto]">
          <input value={grantEmail} onChange={(e) => setGrantEmail(e.target.value)}
            placeholder={t("ad_grant_email")} type="email"
            className="rounded-lg border border-border bg-background/60 px-3 py-2 text-sm" />
          <select value={grantAddonId} onChange={(e) => setGrantAddonId(e.target.value)}
            className="rounded-lg border border-border bg-background/60 px-3 py-2 text-sm">
            {addons.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <input type="number" value={grantDays} onChange={(e) => setGrantDays(parseInt(e.target.value, 10) || 30)}
            placeholder={t("ad_grant_days")}
            className="rounded-lg border border-border bg-background/60 px-3 py-2 text-sm" />
          <button onClick={grantManual}
            className="rounded-lg bg-gradient-to-r from-accent to-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
            {t("ad_grant_btn")}
          </button>
        </div>
        {grantMsg && <div className={`mt-2 text-xs ${grantMsg === t("ad_grant_ok") ? "text-success" : "text-destructive"}`}>{grantMsg}</div>}
      </div>

      {/* Active subscriptions with full controls */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold">
          <Bot className="size-4 text-accent" /> {t("ad_subs_title")} ({subs.length})
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
                      <button onClick={() => extend(s, 30)} className="rounded-full bg-primary/20 px-2.5 py-1 text-[11px] text-primary hover:bg-primary/30">{t("ad_extend_30")}</button>
                      <button onClick={() => extend(s, 7)} className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] text-primary">{t("ad_extend_7")}</button>
                      <button onClick={() => resetUsage(s)} className="rounded-full border border-border px-2.5 py-1 text-[11px]">{t("ad_reset_usage")}</button>
                      {s.status === "active"
                        ? <button onClick={() => setStatus(s, "expired")} className="rounded-full border border-destructive/40 px-2.5 py-1 text-[11px] text-destructive">{t("ad_pause")}</button>
                        : <button onClick={() => setStatus(s, "active")} className="rounded-full bg-success/20 px-2.5 py-1 text-[11px] text-success">{t("ad_activate")}</button>}
                    </div>
                  </td>
                </tr>
              ))}
              {subs.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-xs text-muted-foreground">{t("ad_no_subs")}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Addons CRUD */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold">{t("ad_addons_title")}</h2>
          <button onClick={createAddon} className="rounded-full bg-gradient-to-r from-primary to-accent px-3 py-1.5 text-xs font-semibold text-primary-foreground">{t("ad_new_addon")}</button>
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
              <div className="mt-3">
                <div className="mb-1 text-xs text-muted-foreground">{t("ad_price")}</div>
                <AddonPricesEditor addon={a} onSave={(v) => updateAddon(a, { prices: normalizePrices(v.prices), default_currency: v.default_currency })} />
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                <label>{t("ad_monthly_tasks")}
                  <input type="number" defaultValue={a.monthly_tasks} onBlur={(e) => updateAddon(a, { monthly_tasks: parseInt(e.target.value, 10) || 0 })}
                    className="mt-0.5 w-full rounded border border-border bg-background/60 px-2 py-1" />
                </label>
                <label>{t("ad_daily_cap")}
                  <input type="number" defaultValue={a.daily_task_cap} onBlur={(e) => updateAddon(a, { daily_task_cap: parseInt(e.target.value, 10) || 0 })}
                    className="mt-0.5 w-full rounded border border-border bg-background/60 px-2 py-1" />
                </label>
                <label>{t("ad_max_targets")}
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
          <Activity className="size-4 text-accent" /> {t("ad_recent_tasks")}
        </h2>
        <div className="overflow-x-auto rounded-2xl border border-border bg-card/70">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="bg-background/40 text-xs uppercase text-muted-foreground">
              <tr><th className="p-3 text-start">Time</th><th className="p-3 text-start">User</th><th className="p-3 text-start">Type</th><th className="p-3 text-start">Status</th></tr>
            </thead>
            <tbody>
              {recentTasks.map((tk) => (
                <tr key={tk.id} className="border-t border-border">
                  <td className="p-3 text-xs text-muted-foreground">{new Date(tk.created_at).toLocaleString()}</td>
                  <td className="p-3 text-xs font-mono">{tk.user_id.slice(0,8)}…</td>
                  <td className="p-3 text-xs">{tk.task_type}</td>
                  <td className="p-3 text-xs">{tk.status}</td>
                </tr>
              ))}
              {recentTasks.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-xs text-muted-foreground">{t("ad_no_recent")}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AddonPricesEditor({ addon, onSave }: { addon: any; onSave: (v: PricesValue) => void }) {
  const initial: PricesValue = {
    prices: (addon.prices && typeof addon.prices === "object") ? addon.prices : (addon.price_iqd ? { IQD: addon.price_iqd } : { USD: 0 }),
    default_currency: addon.default_currency || (addon.price_iqd ? "IQD" : "USD"),
  };
  const [val, setVal] = useState<PricesValue>(initial);
  const [dirty, setDirty] = useState(false);
  return (
    <div className="space-y-2">
      <PricesEditor value={val} onChange={(v) => { setVal(v); setDirty(true); }} />
      {dirty && (
        <button
          onClick={() => { onSave(val); setDirty(false); }}
          className="rounded-full bg-primary/20 px-3 py-1 text-[11px] font-semibold text-primary hover:bg-primary/30"
        >
          حفظ الأسعار
        </button>
      )}
    </div>
  );
}



function AccessTab() {
  const { t, lang } = useI18n();
  const [plans, setPlans] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [activePlan, setActivePlan] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = async () => {
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from("subscription_plans").select("*").order("sort_order"),
      supabase.from("tool_plan_access").select("*"),
    ]);
    setPlans(p || []);
    setRows(r || []);
    if (p && p.length && !activePlan) setActivePlan(p[0].id);
  };
  useEffect(() => { load(); }, []);

  const get = (planId: string, toolKey: string) =>
    rows.find((r) => r.plan_id === planId && r.tool_key === toolKey);

  const upsert = async (planId: string, toolKey: string, patch: any) => {
    setBusy(true); setMsg("");
    const existing = get(planId, toolKey);
    const payload = {
      plan_id: planId,
      tool_key: toolKey,
      enabled: existing?.enabled ?? true,
      monthly_quota: existing?.monthly_quota ?? null,
      daily_quota: existing?.daily_quota ?? null,
      ...patch,
    };
    await adminUpsertSingleToolPlanAccess({ data: { planId, toolKey, patch: {
      enabled: payload.enabled,
      monthly_quota: payload.monthly_quota,
      daily_quota: payload.daily_quota,
      ...(typeof payload.tokens_per_use === "number" ? { tokens_per_use: payload.tokens_per_use } : {}),
      ...(typeof payload.usd_per_use === "number" ? { usd_per_use: payload.usd_per_use } : {}),
    } } });
    await load();
    setMsg(t("ad_access_saved"));
    setBusy(false);
    setTimeout(() => setMsg(""), 1500);
  };

  const enableAll = async (planId: string, on: boolean) => {
    for (const td of TOOL_CATALOG) await upsert(planId, td.key, { enabled: on });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card/70 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <KeySquare className="size-5 text-primary" />
          <h2 className="font-display text-lg font-semibold">{t("ad_access_title")}</h2>
          {msg && <span className="ms-auto text-xs text-success">{msg}</span>}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{t("ad_access_desc")}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {plans.map((p) => (
            <button key={p.id} onClick={() => setActivePlan(p.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold border ${
                activePlan === p.id ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"
              }`}>
              {p.name}
            </button>
          ))}
        </div>

        {activePlan && (
          <>
            <div className="mt-4 flex flex-wrap gap-2">
              <button disabled={busy} onClick={() => enableAll(activePlan, true)}
                className="rounded-md border border-success/40 bg-success/10 px-3 py-1 text-xs font-semibold text-success">
                {t("ad_access_enable_all")}
              </button>
              <button disabled={busy} onClick={() => enableAll(activePlan, false)}
                className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1 text-xs font-semibold text-destructive">
                {t("ad_access_disable_all")}
              </button>
            </div>

            {(["tools", "agent"] as const).map((grp) => (
              <div key={grp} className="mt-5">
                <h3 className="mb-2 text-xs font-bold uppercase text-muted-foreground">
                  {grp === "tools" ? t("ad_access_group_tools") : t("ad_access_group_agent")}
                </h3>
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-background/40 text-xs">
                      <tr>
                        <th className="p-2 text-start">{t("ad_access_tool")}</th>
                        <th className="p-2">{t("ad_access_cost")}</th>
                        <th className="p-2">{t("ad_access_enabled")}</th>
                        <th className="p-2">{t("ad_access_monthly")}</th>
                        <th className="p-2">{t("ad_access_daily")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {TOOL_CATALOG.filter((td) => td.group === grp).map((td) => {
                        const r = get(activePlan, td.key);
                        return (
                          <tr key={td.key} className="border-t border-border/60">
                            <td className="p-2 font-medium">{td.labels[lang as "ar"|"en"|"ku"] || td.labels.ar}</td>
                            <td className="p-2 text-center font-mono text-xs">{td.costPerRun}×</td>
                            <td className="p-2 text-center">
                              <input type="checkbox" checked={r?.enabled ?? false}
                                onChange={(e) => upsert(activePlan, td.key, { enabled: e.target.checked })} />
                            </td>
                            <td className="p-2">
                              <input
                                key={`m-${activePlan}-${td.key}-${r?.id || "new"}-${r?.monthly_quota ?? ""}`}
                                type="number"
                                min={0}
                                placeholder="—"
                                defaultValue={r?.monthly_quota ?? ""}
                                onBlur={(e) => upsert(activePlan, td.key, {
                                  monthly_quota: e.target.value === "" ? null : parseInt(e.target.value, 10),
                                })}
                                className="w-20 rounded border border-border bg-background/60 px-2 py-1 text-xs" />
                            </td>
                            <td className="p-2">
                              <input
                                key={`d-${activePlan}-${td.key}-${r?.id || "new"}-${r?.daily_quota ?? ""}`}
                                type="number"
                                min={0}
                                placeholder="—"
                                defaultValue={r?.daily_quota ?? ""}
                                onBlur={(e) => upsert(activePlan, td.key, {
                                  daily_quota: e.target.value === "" ? null : parseInt(e.target.value, 10),
                                })}
                                className="w-20 rounded border border-border bg-background/60 px-2 py-1 text-xs" />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

const ALL_PLATFORMS = ["chatgpt","gemini","claude","perplexity","copilot","grok","mistral","deepseek","kimi"] as const;

function BoostTab() {
  const [enabled, setEnabled] = useState<string[]>([...ALL_PLATFORMS]);
  const [probePrompt, setProbePrompt] = useState<string>("");
  const [probeSystem, setProbeSystem] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "brand_boost").maybeSingle();
      const v: any = data?.value || {};
      if (Array.isArray(v.enabled_platforms)) setEnabled(v.enabled_platforms);
      if (typeof v.probe_prompt === "string") setProbePrompt(v.probe_prompt);
      if (typeof v.probe_system === "string") setProbeSystem(v.probe_system);
    })();
  }, []);

  const toggle = (p: string) =>
    setEnabled((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  const save = async () => {
    setBusy(true); setMsg("");
    const value: any = { enabled_platforms: enabled };
    if (probePrompt.trim()) value.probe_prompt = probePrompt.trim();
    if (probeSystem.trim()) value.probe_system = probeSystem.trim();
    const { data: existing } = await supabase.from("app_settings").select("key").eq("key", "brand_boost").maybeSingle();
    if (existing) {
      await supabase.from("app_settings").update({ value, updated_at: new Date().toISOString() }).eq("key", "brand_boost");
    } else {
      await supabase.from("app_settings").insert({ key: "brand_boost", value });
    }
    setBusy(false);
    setMsg("✓ تم الحفظ");
    setTimeout(() => setMsg(""), 1500);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card/70 p-5">
        <div className="flex items-center gap-3">
          <Bot className="size-5 text-primary" />
          <h2 className="font-display text-lg font-semibold">إعدادات أداة تعزيز العلامة</h2>
          {msg && <span className="ms-auto text-xs text-success">{msg}</span>}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          تحكم بالمنصات المتاحة وصياغة الفحص (probe) المُرسل لكل منصة ذكاء.
        </p>

        <div className="mt-4">
          <h3 className="mb-2 text-xs font-bold uppercase text-muted-foreground">المنصات المُفعّلة</h3>
          <div className="flex flex-wrap gap-2">
            {ALL_PLATFORMS.map((p) => {
              const on = enabled.includes(p);
              return (
                <button key={p} onClick={() => toggle(p)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold capitalize ${
                    on ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"
                  }`}>
                  {p}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 grid gap-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground">قالب probe (سؤال للمنصة) — متغيرات: {"{brand}"} {"{keywords}"} {"{market}"}</label>
            <textarea
              value={probePrompt} onChange={(e) => setProbePrompt(e.target.value)}
              rows={3}
              placeholder='What do you know about "{brand}"{keywords} in the context of {market}?'
              className="mt-1 w-full rounded-lg border border-border bg-background/60 p-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">رسالة النظام للـ probe (اختياري)</label>
            <textarea
              value={probeSystem} onChange={(e) => setProbeSystem(e.target.value)}
              rows={3}
              placeholder="(يُترك فارغاً لاستخدام الافتراضي)"
              className="mt-1 w-full rounded-lg border border-border bg-background/60 p-2 text-sm" />
          </div>
        </div>

        <button onClick={save} disabled={busy}
          className="mt-4 rounded-full bg-gradient-to-r from-primary to-accent px-5 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">
          {busy ? "..." : "حفظ"}
        </button>
      </div>
    </div>
  );
}

// ============= Site Content Editor =============
function ContentTab() {
  const [editLang, setEditLang] = useState<"ar" | "en" | "ku">("ar");
  const [overrides, setOverrides] = useState<Record<string, Record<string, string>>>({});
  const [filter, setFilter] = useState("");
  const [group, setGroup] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string>("");
  const [translatingKey, setTranslatingKey] = useState<string | null>(null);
  const [SITE_DICTS, setDicts] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const mod = await import("@/lib/i18n");
      setDicts((mod as any).SITE_DICTS);
      const { data } = await supabase.from("app_settings").select("value").eq("key", "site_text").maybeSingle();
      if (data?.value && typeof data.value === "object") setOverrides(data.value as any);
      setLoading(false);
    })();
  }, []);

  if (loading || !SITE_DICTS) return <div className="p-6 text-muted-foreground">Loading…</div>;

  const baseDict = SITE_DICTS[editLang] || SITE_DICTS.en;
  const allKeys = Object.keys(SITE_DICTS.en);

  // Group keys by prefix (homepage / dashboard / tools / agent / admin / nav / footer / report / other)
  const groupOf = (k: string): string => {
    if (k.startsWith("hero_") || k.startsWith("home_") || k.startsWith("cta_") || k.startsWith("why_") || k.startsWith("how_") || k.startsWith("link_") || k.startsWith("engines_") || k.startsWith("orbit_")) return "homepage";
    if (k.startsWith("dash_") || k.startsWith("dashboard_")) return "dashboard";
    if (k.startsWith("tool") || k.startsWith("guide_") || k.startsWith("sandbox_") || k.startsWith("suggest_") || k.startsWith("compare_") || k.startsWith("visibility_") || k.startsWith("brand_") || k.startsWith("feasibility_") || k.startsWith("research_") || k.startsWith("whatif_") || k.startsWith("monitor_") || k.startsWith("strategist_") || k.startsWith("social_") || k.startsWith("bizdev_") || k.startsWith("company_")) return "tools";
    if (k.startsWith("agent")) return "agent";
    if (k.startsWith("admin_") || k.startsWith("pricing_") || k.startsWith("plan_")) return "admin";
    if (k.startsWith("nav_") || k.startsWith("footer")) return "nav";
    if (k.startsWith("report_")) return "reports";
    if (k.startsWith("auth_") || k.startsWith("signin") || k.startsWith("signup")) return "auth";
    return "other";
  };

  const f = filter.trim().toLowerCase();
  const visible = allKeys.filter((k) => {
    if (group !== "all" && groupOf(k) !== group) return false;
    if (!f) return true;
    return k.toLowerCase().includes(f)
      || String(baseDict[k] || "").toLowerCase().includes(f)
      || String(overrides[editLang]?.[k] || "").toLowerCase().includes(f);
  });

  const setVal = (k: string, v: string, lang: "ar" | "en" | "ku" = editLang) => {
    setOverrides((prev) => {
      const next = { ...prev, [lang]: { ...(prev[lang] || {}) } };
      const base = SITE_DICTS[lang]?.[k] ?? "";
      if (v.trim() === "" || v === base) {
        delete next[lang][k];
        if (Object.keys(next[lang]).length === 0) delete next[lang];
      } else {
        next[lang][k] = v;
      }
      return next;
    });
  };

  const save = async () => {
    setSaving(true); setMsg("");
    const { error } = await supabase.from("app_settings").upsert({
      key: "site_text",
      value: overrides as any,
      updated_at: new Date().toISOString(),
    }, { onConflict: "key" });
    if (error) setMsg("✗ " + error.message);
    else {
      setMsg("✓ تم الحفظ — حدّث الصفحة لرؤية التغييرات");
      try { localStorage.setItem("geo-site-text", JSON.stringify(overrides)); } catch {}
    }
    setSaving(false);
  };

  const autoTranslate = async (k: string) => {
    const sourceText = overrides[editLang]?.[k] ?? String(baseDict[k] ?? "");
    if (!sourceText.trim()) return;
    setTranslatingKey(k);
    try {
      const { translateText } = await import("@/lib/translate.functions");
      const others = (["ar", "en", "ku"] as const).filter((l) => l !== editLang);
      const results = await Promise.all(others.map((target) =>
        translateText({ data: { text: sourceText, sourceLang: editLang, targetLang: target } })
      ));
      results.forEach((r, idx) => setVal(k, r.text, others[idx]));
      setMsg(`✓ تُرجم "${k}" إلى ${others.join(" و ")}`);
    } catch (e: any) {
      setMsg("✗ " + (e?.message || "ترجمة فشلت"));
    } finally {
      setTranslatingKey(null);
    }
  };

  const overrideCount = Object.values(overrides).reduce((a, b) => a + Object.keys(b || {}).length, 0);

  const groups: { id: string; label: string }[] = [
    { id: "all", label: "الكل" },
    { id: "homepage", label: "الرئيسية" },
    { id: "dashboard", label: "لوحتي" },
    { id: "tools", label: "الأدوات" },
    { id: "agent", label: "الوكيل" },
    { id: "reports", label: "التقارير" },
    { id: "admin", label: "الإدارة" },
    { id: "nav", label: "التنقل" },
    { id: "auth", label: "الحساب" },
    { id: "other", label: "أخرى" },
  ];

  return (
    <div className="space-y-4">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 rounded-2xl border-2 border-border bg-card/95 p-4 backdrop-blur shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h2 className="font-display text-xl font-bold">محرّر محتوى الموقع</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">عدّل النصوص باللغة المختارة وستُرجَم تلقائياً للغتين الأخريين عند الضغط على زر الترجمة.</p>
          </div>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{overrideCount} نص مخصّص</span>

          <div className="ms-auto flex items-center gap-2">
            <div className="inline-flex rounded-full border border-border bg-background p-1">
              {(["ar", "en", "ku"] as const).map((l) => (
                <button key={l} onClick={() => setEditLang(l)}
                  className={`rounded-full px-3 py-1 text-xs font-bold transition ${editLang === l ? "bg-gradient-to-r from-primary to-accent text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}>
                  {l === "ar" ? "العربية" : l === "en" ? "English" : "کوردی"}
                </button>
              ))}
            </div>
            <button onClick={save} disabled={saving}
              className="rounded-full bg-gradient-to-r from-primary to-accent px-5 py-2 text-sm font-semibold text-primary-foreground shadow disabled:opacity-50">
              {saving ? "جاري الحفظ…" : "حفظ الكل"}
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input type="search" value={filter} onChange={(e) => setFilter(e.target.value)}
            placeholder="ابحث بالنص أو المفتاح…"
            className="min-w-[200px] flex-1 rounded-full border border-border bg-background px-4 py-2 text-sm" />
          <div className="flex flex-wrap gap-1.5">
            {groups.map((g) => (
              <button key={g.id} onClick={() => setGroup(g.id)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${group === g.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:border-primary/40"}`}>
                {g.label}
              </button>
            ))}
          </div>
        </div>

        {msg && <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-foreground">{msg}</div>}
      </div>

      {/* Cards grid */}
      <div className="text-xs text-muted-foreground">{visible.length} بطاقة من {allKeys.length}</div>
      <div className="grid gap-3 md:grid-cols-2">
        {visible.map((k) => {
          const def = String(baseDict[k] ?? "");
          const ov = overrides[editLang]?.[k];
          const val = ov ?? def;
          const isMultiline = def.length > 60;
          const isCustom = !!ov;
          const isTranslating = translatingKey === k;
          return (
            <div key={k}
              className={`rounded-xl border-2 p-4 transition ${isCustom ? "border-primary bg-primary/5" : "border-border bg-card/50 hover:border-primary/30"}`}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
                  <span className="rounded bg-muted/40 px-1.5 py-0.5 font-mono">{groupOf(k)}</span>
                  <code className="font-mono opacity-60">{k}</code>
                </span>
                {isCustom && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">معدّل</span>}
              </div>
              {isMultiline ? (
                <textarea value={val} onChange={(e) => setVal(k, e.target.value)}
                  rows={Math.min(5, Math.max(2, Math.ceil(val.length / 70)))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm leading-relaxed focus:border-primary focus:outline-none"
                  dir={editLang === "en" ? "ltr" : "rtl"} />
              ) : (
                <input type="text" value={val} onChange={(e) => setVal(k, e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  dir={editLang === "en" ? "ltr" : "rtl"} />
              )}
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <button onClick={() => autoTranslate(k)} disabled={isTranslating}
                  className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-[11px] font-semibold text-accent hover:bg-accent/20 disabled:opacity-50">
                  {isTranslating ? <Loader2 className="size-3 animate-spin" /> : "🌐"} ترجمة تلقائية للغتين الأخريين
                </button>
                {isCustom && (
                  <button onClick={() => setVal(k, "")} className="text-[11px] text-destructive hover:underline">استعادة الافتراضي</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


// ============= Contact Info Editor =============
function ContactInfoTab() {
  const { lang } = useI18n();
  const [info, setInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  useEffect(() => {
    (async () => {
      const { DEFAULT_CONTACT_INFO } = await import("@/lib/contact-info");
      const { data } = await supabase.from("app_settings").select("value").eq("key", "contact_info").maybeSingle();
      const merged = { ...DEFAULT_CONTACT_INFO, ...(data?.value && typeof data.value === "object" ? data.value : {}) };
      setInfo(merged);
      setLoading(false);
    })();
  }, []);

  if (loading || !info) return <div className="p-6 text-muted-foreground">Loading…</div>;

  const update = (k: string, v: string) => setInfo((p: any) => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true); setStatusMsg("");
    try {
      await adminSetAppSetting({ data: { key: "contact_info", value: info } });
      try { localStorage.setItem("geo-contact-info", JSON.stringify(info)); } catch {}
      setStatusMsg(lang === "ar" ? "✓ تم الحفظ — حدّث الصفحة لرؤية التغييرات" : lang === "ku" ? "✓ پاشەکەوتکرا" : "✓ Saved — refresh to see changes");
    } catch (e: any) {
      setStatusMsg("✗ " + (e?.message || "save failed"));
    } finally {
      setSaving(false);
    }
  };

  const L = (ar: string, en: string, ku: string) => lang === "ar" ? ar : lang === "ku" ? ku : en;

  const renderField = (k: string, label: string, placeholder?: string, dir: "ltr" | "rtl" = "ltr") => (
    <div key={k}>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <input
        type="text"
        value={info[k] || ""}
        onChange={(e) => update(k, e.target.value)}
        placeholder={placeholder}
        dir={dir}
        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
      />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border-2 border-border bg-card/95 p-4">
        <h2 className="font-display text-xl font-bold">{L("معلومات الاتصال", "Contact Information", "زانیاری پەیوەندی")}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{L("تظهر هذه المعلومات في صفحة \"اتصل بنا\"، نافذة الاشتراك، وصفحة الأسعار.", "Shown on the Contact page, Subscribe modal, and Pricing page.", "لە پەڕەی پەیوەندی و پەنجەرەی بەشداربوون و پەڕەی نرخەکان دەردەکەوێت.")}</p>
      </div>

      <div className="rounded-2xl border border-border bg-card/60 p-5 space-y-4">
        <h3 className="font-semibold text-sm">{L("الاتصال المباشر", "Direct contact", "پەیوەندی ڕاستەوخۆ")}</h3>
        <div className="grid gap-3 md:grid-cols-3">
          {renderField("whatsapp_number", L("رقم واتساب (أرقام فقط، يشمل كود الدولة)", "WhatsApp number (digits only, with country code)", "ژمارەی واتساپ"), "9647733570130")}
          {renderField("phone_display", L("الرقم المعروض", "Display phone", "ژمارەی پیشاندان"), "+964 773 357 0130")}
          {renderField("email", L("البريد الإلكتروني", "Email", "ئیمەیڵ"), "support@example.com")}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card/60 p-5 space-y-4">
        <h3 className="font-semibold text-sm">{L("العنوان", "Address", "ناونیشان")}</h3>
        <div className="grid gap-3 md:grid-cols-3">
          {renderField("address_ar", "العربية", "", "rtl")}
          {renderField("address_en", "English")}
          {renderField("address_ku", "کوردی", "", "rtl")}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card/60 p-5 space-y-4">
        <h3 className="font-semibold text-sm">{L("ساعات العمل", "Working hours", "کاتژمێری کار")}</h3>
        <div className="grid gap-3 md:grid-cols-3">
          {renderField("hours_ar", "العربية", "", "rtl")}
          {renderField("hours_en", "English")}
          {renderField("hours_ku", "کوردی", "", "rtl")}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card/60 p-5 space-y-4">
        <h3 className="font-semibold text-sm">{L("شبكات التواصل الاجتماعي (اختياري)", "Social networks (optional)", "تۆڕە کۆمەڵایەتییەکان (هەڵبژاردە)")}</h3>
        <div className="grid gap-3 md:grid-cols-2">
          {renderField("facebook", "Facebook URL", "https://facebook.com/...")}
          {renderField("instagram", "Instagram URL", "https://instagram.com/...")}
          {renderField("twitter", "X / Twitter URL", "https://x.com/...")}
          {renderField("linkedin", "LinkedIn URL", "https://linkedin.com/company/...")}
          {renderField("telegram", "Telegram URL", "https://t.me/...")}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-full bg-gradient-to-r from-primary to-accent px-6 py-2.5 text-sm font-bold text-primary-foreground shadow disabled:opacity-50"
        >
          {saving ? "..." : L("حفظ", "Save", "پاشەکەوت")}
        </button>
        {statusMsg && <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs">{statusMsg}</div>}
      </div>
    </div>
  );
}
