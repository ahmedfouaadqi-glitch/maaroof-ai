import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Save, ArrowDownToLine } from "lucide-react";
import { TOOL_CATALOG, toolLabel } from "@/lib/tool-catalog";
import { CostInput } from "@/components/admin/CostInput";
import { CostBadge } from "@/components/CostBadge";
import { useI18n } from "@/lib/i18n";

type Plan = { id: string; name: string; description: string | null; price_usd: number | string; monthly_tokens: number; daily_tokens: number; agent_daily_cap: number | null; agent_monthly_cap: number | null; agent_max_targets: number | null };
type ToolRow = { id?: string; plan_id: string; tool_key: string; enabled: boolean; tokens_per_use: number; usd_per_use: number; monthly_quota: number | null; daily_quota: number | null };
type Suggestion = { tool_key: string; default_tokens: number; default_usd: number };

const T = {
  ar: { title: "شبكة أسعار الخطط", load: "جارٍ التحميل…", noPlans: "لا توجد خطط مفعّلة.", tool: "الأداة", enabled: "مفعّلة", tokensPerUse: "توكن/مرة", usdPerUse: "تكلفة/مرة", dailyCap: "سقف يومي", monthlyCap: "سقف شهري", copyFromCatalog: "نسخ من كتالوج الاقتراحات", save: "حفظ كل التغييرات", saved: "تم الحفظ", priceUnsetWarn: "أي خانة فارغة = الأداة معطّلة لمشتركي هذه الخطة.", planMeta: "السعر/الشهر · توكن شهري · توكن يومي", agentBlock: "حصص الوكيل الذكي (تتحكم بها الإدارة فقط)", agentDaily: "مهام/يوم", agentMonthly: "مهام/شهر", agentTargets: "أهداف قصوى" },
  en: { title: "Plan pricing grid", load: "Loading…", noPlans: "No active plans.", tool: "Tool", enabled: "Enabled", tokensPerUse: "tokens/use", usdPerUse: "USD/use", dailyCap: "daily cap", monthlyCap: "monthly cap", copyFromCatalog: "Copy from catalog", save: "Save all changes", saved: "Saved", priceUnsetWarn: "Any empty cell = the tool is blocked for users on this plan.", planMeta: "Price/mo · Monthly tokens · Daily tokens", agentBlock: "Smart Agent quotas (admin-controlled)", agentDaily: "tasks/day", agentMonthly: "tasks/month", agentTargets: "max targets" },
  ku: { title: "خشتەی نرخی پلانەکان", load: "بارکردن…", noPlans: "هیچ پلانێک چالاک نییە.", tool: "ئامرازە", enabled: "چالاک", tokensPerUse: "تۆکن/جار", usdPerUse: "نرخ/جار", dailyCap: "سنووری ڕۆژانە", monthlyCap: "سنووری مانگانە", copyFromCatalog: "کۆپی لە کاتالۆگ", save: "پاشەکەوتکردن", saved: "پاشەکەوت کرا", priceUnsetWarn: "هەر خانەیەکی بەتاڵ = ئامرازە بۆ پلانە بلۆککراوە.", planMeta: "نرخ/مانگ · تۆکن مانگانە · ڕۆژانە", agentBlock: "سنووری ئەجێنتی زیرەک (تەنیا ئەدمین)", agentDaily: "کار/ڕۆژ", agentMonthly: "کار/مانگ", agentTargets: "ئامانجی زۆر" },
};


export function AdminPlanPricingPanel() {
  const { lang } = useI18n();
  const L = (T as any)[lang] || T.ar;
  const [plans, setPlans] = useState<Plan[]>([]);
  const [busy, setBusy] = useState(true);

  async function load() {
    setBusy(true);
    const { data } = await supabase.from("subscription_plans").select("id,name,description,price_usd,monthly_tokens,daily_tokens").eq("active", true).order("sort_order");
    setPlans((data || []) as any);
    setBusy(false);
  }
  useEffect(() => { load(); }, []);

  if (busy) return <div className="flex justify-center p-10"><Loader2 className="size-6 animate-spin text-primary" /></div>;
  if (!plans.length) return <div className="rounded-xl border border-border bg-card/40 p-6 text-center text-sm text-muted-foreground">{L.noPlans}</div>;

  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl font-semibold">{L.title}</h2>
      {plans.map((p) => <PlanCard key={p.id} plan={p} L={L} lang={lang as any} onPlanUpdate={load} />)}
    </div>
  );
}

function PlanCard({ plan, L, lang, onPlanUpdate }: { plan: Plan; L: any; lang: "ar" | "en" | "ku"; onPlanUpdate: () => void }) {
  const [rows, setRows] = useState<Record<string, ToolRow>>({});
  const [suggestions, setSuggestions] = useState<Record<string, Suggestion>>({});
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [priceUsd, setPriceUsd] = useState<number>(Number(plan.price_usd) || 0);
  const [monthlyTok, setMonthlyTok] = useState<number>(plan.monthly_tokens || 0);
  const [dailyTok, setDailyTok] = useState<number>(plan.daily_tokens || 0);

  useEffect(() => {
    (async () => {
      setBusy(true);
      const [{ data: tpa }, { data: cat }] = await Promise.all([
        supabase.from("tool_plan_access").select("*").eq("plan_id", plan.id),
        supabase.from("tool_pricing_catalog").select("tool_key, default_tokens, default_usd"),
      ]);
      const byKey: Record<string, ToolRow> = {};
      for (const t of TOOL_CATALOG) {
        const existing = (tpa || []).find((r: any) => r.tool_key === t.key);
        byKey[t.key] = existing
          ? { id: (existing as any).id, plan_id: plan.id, tool_key: t.key, enabled: (existing as any).enabled, tokens_per_use: Number((existing as any).tokens_per_use) || 0, usd_per_use: Number((existing as any).usd_per_use) || 0, monthly_quota: (existing as any).monthly_quota, daily_quota: (existing as any).daily_quota }
          : { plan_id: plan.id, tool_key: t.key, enabled: true, tokens_per_use: 0, usd_per_use: 0, monthly_quota: null, daily_quota: null };
      }
      setRows(byKey);
      setSuggestions(Object.fromEntries(((cat || []) as any[]).map((c) => [c.tool_key, c])));
      setBusy(false);
    })();
  }, [plan.id]);

  function patch(key: string, p: Partial<ToolRow>) {
    setRows((prev) => ({ ...prev, [key]: { ...prev[key], ...p } }));
  }

  function copyFromCatalog() {
    setRows((prev) => {
      const next = { ...prev };
      for (const t of TOOL_CATALOG) {
        const s = suggestions[t.key];
        if (s && (next[t.key].tokens_per_use === 0 && next[t.key].usd_per_use === 0)) {
          next[t.key] = { ...next[t.key], tokens_per_use: Number(s.default_tokens) || 0, usd_per_use: Number(s.default_usd) || 0 };
        }
      }
      return next;
    });
  }

  async function saveAll() {
    setSaving(true);
    // Update plan-level fields
    await supabase.from("subscription_plans").update({
      price_usd: priceUsd, monthly_tokens: monthlyTok, daily_tokens: dailyTok,
    } as any).eq("id", plan.id);
    // Upsert all tool rows
    const payload = Object.values(rows).map((r) => ({
      plan_id: r.plan_id, tool_key: r.tool_key, enabled: r.enabled,
      tokens_per_use: r.tokens_per_use, usd_per_use: r.usd_per_use,
      monthly_quota: r.monthly_quota, daily_quota: r.daily_quota,
    }));
    await supabase.from("tool_plan_access").upsert(payload as any, { onConflict: "plan_id,tool_key" });
    setSaving(false);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
    onPlanUpdate();
  }

  const unpricedCount = Object.values(rows).filter((r) => r.enabled && r.tokens_per_use === 0 && r.usd_per_use === 0).length;

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-display text-lg font-bold">{plan.name}</div>
          {plan.description && <div className="text-xs text-muted-foreground">{plan.description}</div>}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">{L.planMeta}:</span>
          <CostInput value={priceUsd} onChange={setPriceUsd} className="w-32" />
          <input type="number" min={0} value={monthlyTok} onChange={(e) => setMonthlyTok(Number(e.target.value))} className="w-24 rounded-md border border-border bg-background px-2 py-1" placeholder="month" />
          <input type="number" min={0} value={dailyTok} onChange={(e) => setDailyTok(Number(e.target.value))} className="w-24 rounded-md border border-border bg-background px-2 py-1" placeholder="day" />
          <button onClick={copyFromCatalog} className="inline-flex items-center gap-1 rounded-full border border-border bg-background/60 px-3 py-1 text-xs hover:bg-card">
            <ArrowDownToLine className="size-3" /> {L.copyFromCatalog}
          </button>
        </div>
      </div>

      {busy ? (
        <div className="flex justify-center p-6"><Loader2 className="size-5 animate-spin text-primary" /></div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-xs">
            <thead className="bg-background/60">
              <tr>
                <th className="p-2 text-start">{L.tool}</th>
                <th className="p-2">{L.enabled}</th>
                <th className="p-2 w-28">{L.tokensPerUse}</th>
                <th className="p-2 w-40">{L.usdPerUse}</th>
                <th className="p-2 w-24">{L.dailyCap}</th>
                <th className="p-2 w-24">{L.monthlyCap}</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {TOOL_CATALOG.map((t) => {
                const r = rows[t.key]; if (!r) return null;
                return (
                  <tr key={t.key} className="border-t border-border/50">
                    <td className="p-2">
                      <div className="font-semibold">{toolLabel(t.key as any, lang)}</div>
                      <div className="text-[10px] text-muted-foreground">{t.key}</div>
                    </td>
                    <td className="p-2 text-center">
                      <input type="checkbox" checked={r.enabled} onChange={(e) => patch(t.key, { enabled: e.target.checked })} />
                    </td>
                    <td className="p-2">
                      <input type="number" min={0} value={r.tokens_per_use || ""}
                        placeholder={String(suggestions[t.key]?.default_tokens || "")}
                        onChange={(e) => patch(t.key, { tokens_per_use: Number(e.target.value) || 0 })}
                        className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs" />
                    </td>
                    <td className="p-2">
                      <CostInput value={r.usd_per_use} onChange={(v) => patch(t.key, { usd_per_use: v })} />
                    </td>
                    <td className="p-2">
                      <input type="number" min={0} value={r.daily_quota ?? ""} placeholder="∞"
                        onChange={(e) => patch(t.key, { daily_quota: e.target.value === "" ? null : Number(e.target.value) })}
                        className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs" />
                    </td>
                    <td className="p-2">
                      <input type="number" min={0} value={r.monthly_quota ?? ""} placeholder="∞"
                        onChange={(e) => patch(t.key, { monthly_quota: e.target.value === "" ? null : Number(e.target.value) })}
                        className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs" />
                    </td>
                    <td className="p-2 text-center">
                      <CostBadge tokens={r.tokens_per_use} usd={r.usd_per_use} compact />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        {unpricedCount > 0 ? (
          <div className="text-xs text-destructive">⚠ {unpricedCount} {L.priceUnsetWarn}</div>
        ) : <span />}
        <button onClick={saveAll} disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {savedFlash ? L.saved : L.save}
        </button>
      </div>
    </div>
  );
}
