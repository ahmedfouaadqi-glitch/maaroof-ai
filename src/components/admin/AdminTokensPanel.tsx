import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Coins, Save, Search, Wallet, ShieldPlus, ShieldMinus, RotateCcw } from "lucide-react";
import { TOOL_CATALOG, toolLabel } from "@/lib/tool-catalog";
import { CostBadge, formatUsd } from "@/components/CostBadge";
import { CostInput } from "@/components/admin/CostInput";
import { useI18n } from "@/lib/i18n";

type Profile = {
  id: string; email: string | null; full_name: string | null; username: string | null;
  tokens_balance: number; tokens_daily_limit: number | null; tokens_monthly_limit: number | null;
  tokens_used_today: number; tokens_used_month: number;
  per_user_tool_overrides: Record<string, { tokens_per_use?: number; usd_per_use?: number; enabled?: boolean; daily?: number; monthly?: number }>;
  subscription_tier: string | null;
  hide_usage_counter?: boolean;
  ui_visibility?: { tools?: Record<string, boolean>; agent?: Record<string, boolean>; widgets?: Record<string, boolean>; pages?: Record<string, boolean> };
};

const WIDGET_KEYS = [
  "tokens_bar", "cost_badge", "progress_bar", "results_export",
  "history", "alerts_bell", "handoff_menu", "engines_orbit",
  "specialty_banner", "tool_links",
] as const;
const AGENT_FEATURE_KEYS = ["command", "run_targets", "visibility"] as const;
const PAGE_KEYS = ["dashboard", "agent", "tools", "guide", "pricing"] as const;

const VIS_LABELS: Record<string, { ar: string; en: string; ku: string }> = {
  tokens_bar:       { ar: "شريط الوحدات",            en: "Tokens bar",            ku: "شریتی تۆکن" },
  cost_badge:       { ar: "شارة التكلفة",            en: "Cost badge",            ku: "نیشانی نرخ" },
  progress_bar:     { ar: "شريط التقدّم",             en: "Progress bar",          ku: "شریتی پێشکەوتن" },
  results_export:   { ar: "أزرار التصدير",            en: "Export buttons",        ku: "دوگمەی هەناردن" },
  history:          { ar: "سجل التشغيلات",            en: "Run history",           ku: "مێژووی کارکردن" },
  alerts_bell:      { ar: "جرس الإشعارات",            en: "Alerts bell",           ku: "زەنگی ئاگادارکردنەوە" },
  handoff_menu:     { ar: "قائمة الانتقال بين الأدوات", en: "Tool handoff menu",     ku: "مینوی گواستنەوە" },
  engines_orbit:    { ar: "شاشة محركات AI",           en: "AI engines orbit",      ku: "ئۆربیتی AI" },
  specialty_banner: { ar: "بانر التخصص",              en: "Specialty banner",      ku: "بانێری تایبەتمەند" },
  tool_links:       { ar: "روابط الأدوات",             en: "Tool links",            ku: "بەستەری ئامرازەکان" },
  command:          { ar: "أمر مباشر للوكيل",          en: "Agent command",         ku: "فەرمانی ئاراستە" },
  run_targets:      { ar: "تشغيل الأهداف",             en: "Run targets",           ku: "جێبەجێکردنی ئامانج" },
  visibility:       { ar: "تحليل الظهور",              en: "AI Visibility section", ku: "بەشی دەرکەوتن" },
  dashboard:        { ar: "صفحة لوحة التحكم",          en: "/dashboard",            ku: "داشبۆرد" },
  agent:            { ar: "صفحة الوكيل",               en: "/agent",                ku: "وەکیل" },
  tools:            { ar: "صفحة الأدوات",              en: "/tools",                ku: "ئامرازەکان" },
  guide:            { ar: "صفحة الدليل",               en: "/guide",                ku: "ڕێنمایی" },
  pricing:          { ar: "صفحة الأسعار",              en: "/pricing",              ku: "نرخەکان" },
};

type Pricing = { tool_key: string; default_tokens: number; default_usd: number; model: string | null };
type RoleRow = { user_id: string; role: "admin" | "user" | string };
type SpendRow = { user_id: string; tool_key: string; uses: number; total_tokens: number; total_usd: number; tokens_today: number; tokens_month: number; usd_month: number };
type PlanPrice = { tool_key: string; tokens_per_use: number; usd_per_use: number; enabled: boolean };

const T = {
  ar: { title: "إدارة التوكن والصلاحيات والتسعير", search: "بحث بالبريد/الاسم", user: "المستخدم", plan: "الخطة", balance: "الرصيد", daily: "يومي", monthly: "شهري", role: "الدور", action: "إجراء", manage: "إدارة", admin: "مسؤول", normal: "مستخدم", makeAdmin: "ترقية لمسؤول", revokeAdmin: "إلغاء الإدارة", noResults: "لا توجد نتائج", suggestionsCatalog: "كتالوج اقتراحات الأسعار (للمسؤول فقط)", balanceTok: "رصيد التوكن", dailyLimit: "حد يومي (توكن)", monthlyLimit: "حد شهري (توكن)", toolsHeader: "الأدوات: التكلفة/مرة، الحدود، الاستخدام، الإجمالي المنفَق", tokensPerUse: "توكن/مرة", usdPerUse: "تكلفة/مرة", dailyCap: "سقف يومي", monthlyCap: "سقف شهري", usesLbl: "مرات", spent: "المنفَق", reset: "إعادة لقيمة الخطة", save: "حفظ", source: "المصدر", srcUser: "خاص بالمستخدم", srcPlan: "من الخطة", srcNone: "غير مسعّرة", inheritsPlan: "يرث من الخطة", noPlan: "بدون خطة", priceUnsetWarn: "لم تُسعّر هذه الأداة لا في الخطة ولا في إعدادات المستخدم — لن تعمل لهذا المستخدم.", today: "اليوم", month: "الشهر", enabled: "مفعّلة", disabled: "مخفية", usedToday: "المستخدَم اليوم", usedMonth: "المستخدَم هذا الشهر", resetToday: "تصفير اليوم", resetMonth: "تصفير الشهر", hideUsage: "إخفاء عداد الاستخدام عن المستخدم", toolEnabledTip: "تشغيل/إخفاء الأداة لهذا المستخدم" },
  en: { title: "Tokens, Roles & Pricing", search: "search email/name", user: "User", plan: "Plan", balance: "Balance", daily: "Daily", monthly: "Monthly", role: "Role", action: "Action", manage: "Manage", admin: "Admin", normal: "User", makeAdmin: "Promote to admin", revokeAdmin: "Revoke admin", noResults: "No results", suggestionsCatalog: "Price suggestions catalog (admin only)", balanceTok: "Token balance", dailyLimit: "Daily limit (tokens)", monthlyLimit: "Monthly limit (tokens)", toolsHeader: "Tools: cost/use, caps, usage, total spent", tokensPerUse: "tokens/use", usdPerUse: "cost/use", dailyCap: "daily cap", monthlyCap: "monthly cap", usesLbl: "uses", spent: "spent", reset: "Reset to plan", save: "Save", source: "Source", srcUser: "User override", srcPlan: "From plan", srcNone: "Unpriced", inheritsPlan: "inherits from plan", noPlan: "no plan", priceUnsetWarn: "This tool is unpriced in both the plan and the user — it will be blocked for this user.", today: "today", month: "month", enabled: "Enabled", disabled: "Hidden", usedToday: "Used today", usedMonth: "Used this month", resetToday: "Reset today", resetMonth: "Reset month", hideUsage: "Hide usage counter from user", toolEnabledTip: "Enable/hide this tool for this user" },
  ku: { title: "بەڕێوەبردنی تۆکن، ڕۆڵ و نرخدانان", search: "گەڕان", user: "بەکارهێنەر", plan: "پلان", balance: "بەڵانس", daily: "ڕۆژانە", monthly: "مانگانە", role: "ڕۆڵ", action: "کردار", manage: "بەڕێوەبردن", admin: "ئەدمین", normal: "بەکارهێنەر", makeAdmin: "بکە بە ئەدمین", revokeAdmin: "ڕاکێشانەوەی ئەدمین", noResults: "هیچ نییە", suggestionsCatalog: "کاتالۆگی پێشنیار", balanceTok: "بەڵانسی تۆکن", dailyLimit: "سنووری ڕۆژانە", monthlyLimit: "سنووری مانگانە", toolsHeader: "ئامرازەکان", tokensPerUse: "تۆکن/جار", usdPerUse: "نرخ/جار", dailyCap: "سنووری ڕۆژانە", monthlyCap: "سنووری مانگانە", usesLbl: "جار", spent: "خەرجکراو", reset: "گەڕاندنەوە", save: "پاشەکەوت", source: "سەرچاوە", srcUser: "تایبەت", srcPlan: "لە پلان", srcNone: "نرخ نەنراوە", inheritsPlan: "لە پلانەوە", noPlan: "بێ پلان", priceUnsetWarn: "نرخ نەنراوە — کار ناکات.", today: "ئەمڕۆ", month: "مانگ", enabled: "چالاک", disabled: "شاراوە", usedToday: "ئەمڕۆ بەکارهاتوو", usedMonth: "ئەم مانگە بەکارهاتوو", resetToday: "سفرکردن ڕۆژ", resetMonth: "سفرکردن مانگ", hideUsage: "شاردنەوەی ژمێرەری بەکارهێنان", toolEnabledTip: "چالاک/شاردن" },
};

export function AdminTokensPanel() {
  const { lang } = useI18n();
  const L = (T as any)[lang] || T.ar;
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [pricing, setPricing] = useState<Pricing[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(true);
  const [editing, setEditing] = useState<Profile | null>(null);

  async function load() {
    setBusy(true);
    const [p, c, r] = await Promise.all([
      supabase.from("profiles").select("id,email,full_name,username,tokens_balance,tokens_daily_limit,tokens_monthly_limit,tokens_used_today,tokens_used_month,per_user_tool_overrides,subscription_tier,hide_usage_counter,ui_visibility").order("email"),
      supabase.from("tool_pricing_catalog").select("tool_key, default_tokens, default_usd, model"),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    setProfiles((p.data || []) as any);
    setPricing((c.data || []) as any);
    setRoles((r.data || []) as any);
    setBusy(false);
  }
  useEffect(() => { load(); }, []);

  const adminSet = useMemo(() => new Set(roles.filter((r) => r.role === "admin").map((r) => r.user_id)), [roles]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return profiles;
    return profiles.filter((p) => `${p.email} ${p.full_name} ${p.username}`.toLowerCase().includes(s));
  }, [profiles, q]);

  const catalog = useMemo(() => Object.fromEntries(pricing.map((p) => [p.tool_key, p])), [pricing]);

  async function toggleAdmin(userId: string, makeAdmin: boolean) {
    if (makeAdmin) {
      await supabase.from("user_roles").upsert({ user_id: userId, role: "admin" } as any, { onConflict: "user_id,role" });
    } else {
      await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
    }
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold flex items-center gap-2"><Coins className="size-5 text-primary" /> {L.title}</h2>
        <div className="relative">
          <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={L.search} className="rounded-full border border-border bg-card/60 py-2 pr-9 pl-3 text-sm w-64" />
        </div>
      </div>

      {busy ? (
        <div className="flex justify-center p-10"><Loader2 className="size-6 animate-spin text-primary" /></div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-card/60 text-xs">
              <tr>
                <th className="p-2 text-start">{L.user}</th>
                <th className="p-2">{L.role}</th>
                <th className="p-2">{L.plan}</th>
                <th className="p-2">{L.balance}</th>
                <th className="p-2">{L.daily}</th>
                <th className="p-2">{L.monthly}</th>
                <th className="p-2">{L.action}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const isAdmin = adminSet.has(p.id);
                return (
                  <tr key={p.id} className="border-t border-border/50">
                    <td className="p-2">
                      <div className="font-medium">{p.full_name || p.username || p.email}</div>
                      <div className="text-xs text-muted-foreground">{p.email}</div>
                    </td>
                    <td className="p-2 text-center">
                      <button
                        onClick={() => toggleAdmin(p.id, !isAdmin)}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${isAdmin ? "border border-accent/40 bg-accent/10 text-accent" : "border border-border bg-card/60"}`}
                        title={isAdmin ? L.revokeAdmin : L.makeAdmin}
                      >
                        {isAdmin ? <><ShieldPlus className="size-3" /> {L.admin}</> : <><ShieldMinus className="size-3" /> {L.normal}</>}
                      </button>
                    </td>
                    <td className="p-2 text-center text-xs">{p.subscription_tier || "—"}</td>
                    <td className="p-2 text-center font-semibold text-primary">{p.tokens_balance.toLocaleString()}</td>
                    <td className="p-2 text-center text-xs">{p.tokens_used_today}/{p.tokens_daily_limit ?? "∞"}</td>
                    <td className="p-2 text-center text-xs">{p.tokens_used_month}/{p.tokens_monthly_limit ?? "∞"}</td>
                    <td className="p-2 text-center">
                      <button onClick={() => setEditing(p)} className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/20">{L.manage}</button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">{L.noResults}</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <details className="rounded-xl border border-border bg-card/40 p-3">
        <summary className="cursor-pointer text-sm font-semibold">{L.suggestionsCatalog} ({pricing.length})</summary>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {pricing.map((c) => (
            <div key={c.tool_key} className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2 text-xs">
              <div>
                <div className="font-semibold">{toolLabel(c.tool_key as any, lang as any)}</div>
                <div className="text-[10px] text-muted-foreground">{c.model || c.tool_key}</div>
              </div>
              <CostBadge tokens={c.default_tokens} usd={c.default_usd} compact />
            </div>
          ))}
        </div>
      </details>

      {editing && <UserTokensDrawer user={editing} catalog={catalog} L={L} lang={lang as any} onClose={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function UserTokensDrawer({ user, catalog, L, lang, onClose }: { user: Profile; catalog: Record<string, Pricing>; L: any; lang: "ar" | "en" | "ku"; onClose: () => void }) {
  const [balance, setBalance] = useState(user.tokens_balance);
  const [daily, setDaily] = useState<number | "">(user.tokens_daily_limit ?? "");
  const [monthly, setMonthly] = useState<number | "">(user.tokens_monthly_limit ?? "");
  const [usedToday, setUsedToday] = useState<number>(user.tokens_used_today || 0);
  const [usedMonth, setUsedMonth] = useState<number>(user.tokens_used_month || 0);
  const [hideUsage, setHideUsage] = useState<boolean>(!!user.hide_usage_counter);
  const [overrides, setOverrides] = useState<Record<string, any>>(user.per_user_tool_overrides || {});
  const [uiVis, setUiVis] = useState<NonNullable<Profile["ui_visibility"]>>(user.ui_visibility || {});
  const [planPrices, setPlanPrices] = useState<Record<string, PlanPrice>>({});
  const [spend, setSpend] = useState<Record<string, SpendRow>>({});
  const [planActive, setPlanActive] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      // Load plan tool prices for this user's plan (if any)
      if (user.subscription_tier) {
        const { data: plan } = await supabase.from("subscription_plans").select("id").eq("name", user.subscription_tier).maybeSingle();
        const planId = (plan as any)?.id;
        if (planId) {
          const { data: tpa } = await supabase.from("tool_plan_access").select("tool_key, tokens_per_use, usd_per_use, enabled").eq("plan_id", planId);
          setPlanPrices(Object.fromEntries(((tpa || []) as any[]).map((r) => [r.tool_key, r])));
          setPlanActive(true);
        }
      }
      // Real per-tool spend from view
      const { data: sp } = await supabase.from("v_user_tool_spend" as any).select("*").eq("user_id", user.id);
      setSpend(Object.fromEntries(((sp || []) as any[]).map((r) => [r.tool_key, r])));
    })();
  }, [user.id, user.subscription_tier]);

  async function save() {
    setSaving(true);
    // Clean: drop empty overrides, but KEEP entries that only disable the tool
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(overrides)) {
      const hasPrice = Number(v?.tokens_per_use) > 0 || Number(v?.usd_per_use) > 0 || Number(v?.daily) > 0 || Number(v?.monthly) > 0;
      const isDisabled = v?.enabled === false;
      if (hasPrice || isDisabled) clean[k] = v;
    }
    await supabase.from("profiles").update({
      tokens_balance: balance,
      tokens_daily_limit: daily === "" ? null : Number(daily),
      tokens_monthly_limit: monthly === "" ? null : Number(monthly),
      tokens_used_today: Number(usedToday) || 0,
      tokens_used_month: Number(usedMonth) || 0,
      hide_usage_counter: hideUsage,
      per_user_tool_overrides: clean,
      ui_visibility: uiVis,
    } as any).eq("id", user.id);
    setSaving(false);
    onClose();
  }

  function patchTool(key: string, patch: any) {
    setOverrides((prev) => ({ ...prev, [key]: { ...(prev[key] || {}), ...patch } }));
  }
  function resetTool(key: string) {
    setOverrides((prev) => { const next = { ...prev }; delete next[key]; return next; });
  }

  function effective(toolKey: string): { tokens: number; usd: number; source: "user" | "plan" | "none" } {
    const ov = overrides[toolKey] || {};
    if (Number(ov.tokens_per_use) > 0 || Number(ov.usd_per_use) > 0) {
      return { tokens: Number(ov.tokens_per_use) || 0, usd: Number(ov.usd_per_use) || 0, source: "user" };
    }
    const pp = planPrices[toolKey];
    if (planActive && pp?.enabled && (Number(pp.tokens_per_use) > 0 || Number(pp.usd_per_use) > 0)) {
      return { tokens: Number(pp.tokens_per_use), usd: Number(pp.usd_per_use), source: "plan" };
    }
    return { tokens: 0, usd: 0, source: "none" };
  }

  // Grand total actually spent (all tools)
  const grandSpent = useMemo(() => {
    let tokens = 0, usd = 0;
    for (const r of Object.values(spend)) { tokens += r.total_tokens; usd += Number(r.total_usd) || 0; }
    return { tokens, usd };
  }, [spend]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-border bg-background p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg font-bold">{user.full_name || user.email}</h3>
            <p className="text-xs text-muted-foreground">{user.email} · {user.subscription_tier || L.noPlan}</p>
          </div>
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">✕</button>
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <Field label={L.balanceTok} icon={<Wallet className="size-3.5 text-primary" />}>
            <input type="number" value={balance} onChange={(e) => setBalance(Number(e.target.value))} className="w-full rounded-lg border border-border bg-background px-2 py-1 text-sm" />
          </Field>
          <Field label={L.dailyLimit}>
            <input type="number" value={daily} onChange={(e) => setDaily(e.target.value === "" ? "" : Number(e.target.value))} placeholder="∞" className="w-full rounded-lg border border-border bg-background px-2 py-1 text-sm" />
          </Field>
          <Field label={L.monthlyLimit}>
            <input type="number" value={monthly} onChange={(e) => setMonthly(e.target.value === "" ? "" : Number(e.target.value))} placeholder="∞" className="w-full rounded-lg border border-border bg-background px-2 py-1 text-sm" />
          </Field>
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <Field label={L.usedToday}>
            <div className="flex gap-1">
              <input type="number" min={0} value={usedToday} onChange={(e) => setUsedToday(Number(e.target.value))} className="w-full rounded-lg border border-border bg-background px-2 py-1 text-sm" />
              <button type="button" onClick={() => setUsedToday(0)} className="rounded-lg border border-border bg-card/60 px-2 text-[10px] hover:bg-card">{L.resetToday}</button>
            </div>
          </Field>
          <Field label={L.usedMonth}>
            <div className="flex gap-1">
              <input type="number" min={0} value={usedMonth} onChange={(e) => setUsedMonth(Number(e.target.value))} className="w-full rounded-lg border border-border bg-background px-2 py-1 text-sm" />
              <button type="button" onClick={() => setUsedMonth(0)} className="rounded-lg border border-border bg-card/60 px-2 text-[10px] hover:bg-card">{L.resetMonth}</button>
            </div>
          </Field>
          <Field label={L.hideUsage}>
            <label className="flex h-[34px] items-center gap-2 rounded-lg border border-border bg-background px-2 text-xs cursor-pointer">
              <input type="checkbox" checked={hideUsage} onChange={(e) => setHideUsage(e.target.checked)} />
              <span>{hideUsage ? L.disabled : L.enabled}</span>
            </label>
          </Field>
        </div>

        <VisibilitySection lang={lang} value={uiVis} onChange={setUiVis} />

        <h4 className="mb-2 text-sm font-semibold">{L.toolsHeader}</h4>

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-xs">
            <thead className="bg-card/60">
              <tr>
                <th className="p-2 text-start">Tool</th>
                <th className="p-2 w-16" title={L.toolEnabledTip}>{L.enabled}</th>
                <th className="p-2">{L.source}</th>
                <th className="p-2 w-28">{L.tokensPerUse}</th>
                <th className="p-2 w-40">{L.usdPerUse}</th>
                <th className="p-2 w-20">{L.dailyCap}</th>
                <th className="p-2 w-20">{L.monthlyCap}</th>
                <th className="p-2">{L.usesLbl}</th>
                <th className="p-2">{L.spent}</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {TOOL_CATALOG.map((t) => {
                const o = overrides[t.key] || {};
                const eff = effective(t.key);
                const sp = spend[t.key];
                const pp = planPrices[t.key];
                const placeholderTokens = pp?.tokens_per_use && pp.tokens_per_use > 0 ? String(pp.tokens_per_use) : "";
                return (
                  <tr key={t.key} className="border-t border-border/50">
                    <td className="p-2">
                      <div className="font-semibold">{toolLabel(t.key as any, lang)}</div>
                      <div className="text-[10px] text-muted-foreground">{t.key}</div>
                    </td>
                    <td className="p-2 text-center">
                      <label className="inline-flex cursor-pointer items-center gap-1" title={L.toolEnabledTip}>
                        <input
                          type="checkbox"
                          checked={o.enabled !== false}
                          onChange={(e) => patchTool(t.key, { enabled: e.target.checked ? undefined : false })}
                        />
                        <span className="text-[10px] text-muted-foreground">{o.enabled === false ? L.disabled : L.enabled}</span>
                      </label>
                    </td>
                    <td className="p-2 text-center">
                      {eff.source === "user" && <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">{L.srcUser}</span>}
                      {eff.source === "plan" && <span className="rounded-full border border-border bg-card/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{L.srcPlan}</span>}
                      {eff.source === "none" && <span className="rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">{L.srcNone}</span>}
                    </td>
                    <td className="p-2">
                      <input
                        type="number" min={0}
                        value={o.tokens_per_use ?? ""}
                        placeholder={placeholderTokens}
                        onChange={(e) => patchTool(t.key, { tokens_per_use: e.target.value === "" ? undefined : Number(e.target.value) })}
                        className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
                      />
                    </td>
                    <td className="p-2">
                      <CostInput
                        value={Number(o.usd_per_use) || 0}
                        onChange={(usd) => patchTool(t.key, { usd_per_use: usd > 0 ? usd : undefined })}
                        placeholder={pp?.usd_per_use ? formatUsd(Number(pp.usd_per_use)).replace(/[^\d.]/g, "") : "0"}
                      />
                    </td>
                    <td className="p-2">
                      <input type="number" min={0} value={o.daily ?? ""} placeholder="∞"
                        onChange={(e) => patchTool(t.key, { daily: e.target.value === "" ? undefined : Number(e.target.value) })}
                        className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs" />
                    </td>
                    <td className="p-2">
                      <input type="number" min={0} value={o.monthly ?? ""} placeholder="∞"
                        onChange={(e) => patchTool(t.key, { monthly: e.target.value === "" ? undefined : Number(e.target.value) })}
                        className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs" />
                    </td>
                    <td className="p-2 text-center">{sp?.uses ?? 0}</td>
                    <td className="p-2 text-center">
                      <CostBadge tokens={sp?.total_tokens ?? 0} usd={Number(sp?.total_usd) || 0} compact />
                      {sp && (sp.tokens_today > 0 || sp.tokens_month > 0) && (
                        <div className="mt-0.5 text-[9px] text-muted-foreground">{L.today}: {sp.tokens_today} · {L.month}: {sp.tokens_month}</div>
                      )}
                    </td>
                    <td className="p-2 text-center">
                      {overrides[t.key] && (
                        <button onClick={() => resetTool(t.key)} title={L.reset} className="rounded-full border border-border bg-card/60 p-1 hover:bg-card">
                          <RotateCcw className="size-3" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {TOOL_CATALOG.some((t) => effective(t.key).source === "none") && (
          <div className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
            {L.priceUnsetWarn}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
          <div className="text-sm">
            <div className="text-xs text-muted-foreground">{L.spent} (Σ)</div>
            <CostBadge tokens={grandSpent.tokens} usd={grandSpent.usd} />
          </div>
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} {L.save}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="space-y-1">
      <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">{icon}{label}</div>
      {children}
    </label>
  );
}

function VisibilitySection({
  lang, value, onChange,
}: {
  lang: "ar" | "en" | "ku";
  value: NonNullable<Profile["ui_visibility"]>;
  onChange: (v: NonNullable<Profile["ui_visibility"]>) => void;
}) {
  const isAr = lang === "ar";
  const isKu = lang === "ku";
  const heading = isAr ? "ما يراه المستخدم في الموقع" : isKu ? "ئەوەی بەکارهێنەر دەیبینێت" : "What the user sees site-wide";
  const hint = isAr
    ? "ضع علامة على ما تريد إظهاره. عدم التحديد = إخفاء كامل من واجهة هذا المستخدم."
    : isKu
    ? "هەرچی بسەلمێنرێت پیشان دەدرێت."
    : "Check what to show. Unchecked items are hidden entirely from this user.";

  const lbl = (k: string) => VIS_LABELS[k]?.[lang] || k;
  const setGroup = (g: "tools" | "agent" | "widgets" | "pages", k: string, on: boolean) => {
    const next = { ...(value || {}) };
    const grp: Record<string, boolean> = { ...(next[g] || {}) };
    if (on) delete grp[k]; else grp[k] = false;
    if (Object.keys(grp).length === 0) delete (next as any)[g];
    else (next as any)[g] = grp;
    onChange(next);
  };
  const isOn = (g: "tools" | "agent" | "widgets" | "pages", k: string) => (value?.[g] as any)?.[k] !== false;

  return (
    <details className="mb-4 rounded-xl border border-border bg-card/40 p-3" open>
      <summary className="cursor-pointer text-sm font-semibold">{heading}</summary>
      <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>

      <Group title={isAr ? "الأدوات" : isKu ? "ئامرازەکان" : "Tools"}>
        {TOOL_CATALOG.filter(t => t.group === "tools").map(t => (
          <CheckRow key={t.key} label={toolLabel(t.key as any, lang)} hint={t.key} checked={isOn("tools", t.key)} onChange={(on) => setGroup("tools", t.key, on)} />
        ))}
      </Group>

      <Group title={isAr ? "ميزات الوكيل" : isKu ? "وەکیل" : "Agent features"}>
        {AGENT_FEATURE_KEYS.map(k => (
          <CheckRow key={k} label={lbl(k)} hint={`agent.${k}`} checked={isOn("agent", k)} onChange={(on) => setGroup("agent", k, on)} />
        ))}
      </Group>

      <Group title={isAr ? "عناصر الواجهة" : isKu ? "ویجێتەکان" : "Widgets"}>
        {WIDGET_KEYS.map(k => (
          <CheckRow key={k} label={lbl(k)} hint={k} checked={isOn("widgets", k)} onChange={(on) => setGroup("widgets", k, on)} />
        ))}
      </Group>

      <Group title={isAr ? "الصفحات" : isKu ? "پەڕەکان" : "Pages"}>
        {PAGE_KEYS.map(k => (
          <CheckRow key={k} label={lbl(k)} hint={`/${k}`} checked={isOn("pages", k)} onChange={(on) => setGroup("pages", k, on)} />
        ))}
      </Group>
    </details>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </div>
  );
}

function CheckRow({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className={`flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-xs ${checked ? "border-primary/30 bg-primary/5" : "border-border bg-background/40 opacity-70"}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <div className="flex-1">
        <div className="font-medium">{label}</div>
        {hint && <div className="text-[9px] text-muted-foreground">{hint}</div>}
      </div>
    </label>
  );
}
