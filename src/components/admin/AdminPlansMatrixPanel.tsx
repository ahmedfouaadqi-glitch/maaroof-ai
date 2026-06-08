// Unified matrix: rows = tools + agent features + agent addons;
// columns = subscription plans. Each cell controls enabled + tokens/USD per use.
// "+ New plan" inline column lets admin create a plan and immediately link tools.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Plus, Save, Copy, Trash2, Bot, Wrench } from "lucide-react";
import { TOOL_CATALOG, toolLabel } from "@/lib/tool-catalog";
import { useI18n } from "@/lib/i18n";
import { formatUsd } from "@/components/CostBadge";

type Plan = {
  id: string;
  name: string;
  description: string | null;
  price_iqd: number | null;
  price_usd: number | null;
  monthly_tokens: number | null;
  active: boolean;
  sort_order: number | null;
};

type PlanAccess = {
  plan_id: string;
  tool_key: string;
  enabled: boolean;
  tokens_per_use: number | null;
  usd_per_use: number | null;
};

const AGENT_ROWS = [
  { key: "agent.command", group: "agent" as const },
  { key: "agent.run_targets", group: "agent" as const },
  { key: "agent.visibility", group: "agent" as const },
];

const L = {
  ar: { title: "شبكة الخطط × الأدوات", subtitle: "تحكّم بكل ما تقدمه كل خطة من أدوات وميزات الوكيل، والأسعار لكل استخدام.", newPlan: "خطة جديدة", saveAll: "حفظ الكل", copyFrom: "نسخ من", deletePlan: "حذف الخطة", tools: "الأدوات", agentFeatures: "ميزات الوكيل", enabled: "مفعّلة", tokens: "توكن/مرة", usd: "تكلفة/مرة", name: "اسم الخطة", priceIqd: "السعر بالدينار", priceUsd: "السعر بالدولار", monthlyTokens: "توكن شهري", create: "إنشاء", cancel: "إلغاء", saved: "تم الحفظ", saveFailed: "فشل الحفظ" },
  en: { title: "Plans × Tools Matrix", subtitle: "Control which tools and agent features each plan unlocks, and the per-use price.", newPlan: "New plan", saveAll: "Save all", copyFrom: "Copy from", deletePlan: "Delete plan", tools: "Tools", agentFeatures: "Agent features", enabled: "Enabled", tokens: "tokens/use", usd: "cost/use", name: "Plan name", priceIqd: "Price (IQD)", priceUsd: "Price (USD)", monthlyTokens: "Monthly tokens", create: "Create", cancel: "Cancel", saved: "Saved", saveFailed: "Save failed" },
  ku: { title: "تۆڕی پلان × ئامراز", subtitle: "کۆنترۆڵی هەموو ئامرازەکان و تایبەتمەندییەکانی وەکیل بۆ هەر پلانێک.", newPlan: "پلانی نوێ", saveAll: "پاشەکەوتی هەموو", copyFrom: "کۆپی لە", deletePlan: "سڕینەوەی پلان", tools: "ئامرازەکان", agentFeatures: "تایبەتمەندی وەکیل", enabled: "چالاک", tokens: "تۆکن/جار", usd: "نرخ/جار", name: "ناوی پلان", priceIqd: "نرخ بە دینار", priceUsd: "نرخ بە دۆلار", monthlyTokens: "تۆکنی مانگانە", create: "دروستکردن", cancel: "ڕەتکردنەوە", saved: "پاشەکەوتکرا", saveFailed: "شکست" },
};

export function AdminPlansMatrixPanel() {
  const { lang } = useI18n();
  const t = (L as any)[lang] || L.ar;
  const [plans, setPlans] = useState<Plan[]>([]);
  const [access, setAccess] = useState<Record<string, Record<string, PlanAccess>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [dirty, setDirty] = useState<Set<string>>(new Set()); // `${planId}:${toolKey}`

  async function load() {
    setLoading(true);
    const [{ data: pl }, { data: ac }] = await Promise.all([
      supabase.from("subscription_plans").select("id,name,description,price_iqd,price_usd,monthly_tokens,active,sort_order").eq("active", true).order("sort_order"),
      supabase.from("tool_plan_access").select("plan_id, tool_key, enabled, tokens_per_use, usd_per_use"),
    ]);
    setPlans((pl as any) || []);
    const map: Record<string, Record<string, PlanAccess>> = {};
    for (const r of (ac as any[]) || []) {
      if (!map[r.plan_id]) map[r.plan_id] = {};
      map[r.plan_id][r.tool_key] = r;
    }
    setAccess(map);
    setDirty(new Set());
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const rows = useMemo(() => {
    const lk = (lang as "ar" | "en" | "ku");
    const tools = TOOL_CATALOG.filter((x) => x.group === "tools").map((x) => ({ key: x.key as string, label: x.labels[lk] || x.key, group: "tools" as const }));
    const agent = AGENT_ROWS.map((r) => ({ key: r.key, label: toolLabel(r.key, lk), group: "agent" as const }));
    return { tools, agent };
  }, [lang]);

  function getCell(planId: string, toolKey: string): PlanAccess {
    return access[planId]?.[toolKey] || { plan_id: planId, tool_key: toolKey, enabled: false, tokens_per_use: 0, usd_per_use: 0 };
  }

  function patchCell(planId: string, toolKey: string, patch: Partial<PlanAccess>) {
    setAccess((prev) => {
      const next = { ...prev };
      if (!next[planId]) next[planId] = {};
      next[planId][toolKey] = { ...getCell(planId, toolKey), ...patch };
      return next;
    });
    setDirty((d) => new Set(d).add(`${planId}:${toolKey}`));
  }

  function copyPlan(fromId: string, toId: string) {
    const src = access[fromId] || {};
    const allKeys = [...rows.tools, ...rows.agent].map((r) => r.key);
    setAccess((prev) => {
      const next = { ...prev };
      if (!next[toId]) next[toId] = {};
      for (const k of allKeys) {
        const s = src[k];
        if (s) {
          next[toId][k] = { plan_id: toId, tool_key: k, enabled: s.enabled, tokens_per_use: s.tokens_per_use, usd_per_use: s.usd_per_use };
          setDirty((d) => new Set(d).add(`${toId}:${k}`));
        }
      }
      return { ...next };
    });
  }

  async function saveAll() {
    setSaving(true); setMsg(null);
    try {
      const rowsToUpsert: any[] = [];
      for (const tag of dirty) {
        const [planId, toolKey] = tag.split(":");
        const cell = getCell(planId, toolKey);
        rowsToUpsert.push({
          plan_id: planId,
          tool_key: toolKey,
          enabled: cell.enabled,
          tokens_per_use: cell.tokens_per_use ?? 0,
          usd_per_use: cell.usd_per_use ?? 0,
        });
      }
      if (rowsToUpsert.length > 0) {
        const { error } = await supabase.from("tool_plan_access").upsert(rowsToUpsert as any, { onConflict: "plan_id,tool_key" });
        if (error) throw error;
      }
      setMsg({ ok: true, text: t.saved });
      await load();
    } catch (e: any) {
      setMsg({ ok: false, text: `${t.saveFailed}: ${e?.message || ""}` });
    } finally {
      setSaving(false);
    }
  }

  async function createPlan(form: { name: string; price_iqd: number; price_usd: number; monthly_tokens: number }) {
    const { data, error } = await supabase.from("subscription_plans").insert({
      name: form.name,
      price_iqd: form.price_iqd,
      price_usd: form.price_usd,
      monthly_tokens: form.monthly_tokens,
      active: true,
      duration_days: 30,
      monthly_analyses: 0,
      monthly_suggestions: 0,
      sort_order: plans.length + 1,
    } as any).select().single();
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setShowNew(false);
    await load();
  }

  async function deletePlan(planId: string) {
    if (!confirm("Delete plan?")) return;
    await supabase.from("subscription_plans").update({ active: false }).eq("id", planId);
    await load();
  }

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="size-6 animate-spin text-primary" /></div>;

  const allRows = [...rows.tools.map((r) => ({ ...r, icon: <Wrench className="size-3.5" /> })), ...rows.agent.map((r) => ({ ...r, icon: <Bot className="size-3.5" /> }))];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">{t.title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {msg && <span className={`text-xs ${msg.ok ? "text-success" : "text-destructive"}`}>{msg.text}</span>}
          <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs font-semibold hover:border-primary"><Plus className="size-3.5" /> {t.newPlan}</button>
          <button onClick={saveAll} disabled={saving || dirty.size === 0} className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-accent px-4 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50">
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            {t.saveAll} {dirty.size > 0 && `(${dirty.size})`}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[900px] text-xs">
          <thead className="bg-card/60 sticky top-0">
            <tr>
              <th className="p-2 text-start font-semibold w-56">{t.tools} / {t.agentFeatures}</th>
              {plans.map((p) => (
                <th key={p.id} className="p-2 text-start font-semibold border-l border-border min-w-[180px]">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-display text-sm text-primary">{p.name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {p.price_usd ? `${formatUsd(Number(p.price_usd))}` : (p.price_iqd ? `${p.price_iqd?.toLocaleString()} IQD` : "—")}
                        {p.monthly_tokens ? ` · ${p.monthly_tokens.toLocaleString()} tok` : ""}
                      </div>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <select onChange={(e) => { if (e.target.value) copyPlan(e.target.value, p.id); e.target.value=""; }} className="rounded border border-border bg-background px-1 py-0.5 text-[10px]" title={t.copyFrom}>
                        <option value="">{t.copyFrom}…</option>
                        {plans.filter((x) => x.id !== p.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                      </select>
                      <button onClick={() => deletePlan(p.id)} className="text-[10px] text-destructive hover:underline" title={t.deletePlan}><Trash2 className="inline size-3" /></button>
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="bg-background/40"><td colSpan={plans.length + 1} className="p-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold"><Wrench className="inline size-3 me-1" /> {t.tools}</td></tr>
            {rows.tools.map((row) => (
              <RowLine key={row.key} row={row} plans={plans} getCell={getCell} patchCell={patchCell} t={t} />
            ))}
            <tr className="bg-background/40"><td colSpan={plans.length + 1} className="p-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold"><Bot className="inline size-3 me-1" /> {t.agentFeatures}</td></tr>
            {rows.agent.map((row) => (
              <RowLine key={row.key} row={row} plans={plans} getCell={getCell} patchCell={patchCell} t={t} />
            ))}
          </tbody>
        </table>
      </div>

      {showNew && <NewPlanModal t={t} onClose={() => setShowNew(false)} onCreate={createPlan} />}
    </div>
  );
}

function RowLine({ row, plans, getCell, patchCell, t }: { row: { key: string; label: string }; plans: Plan[]; getCell: (p: string, k: string) => PlanAccess; patchCell: (p: string, k: string, patch: Partial<PlanAccess>) => void; t: any }) {
  return (
    <tr className="border-t border-border/40">
      <td className="p-2 align-middle font-medium">{row.label}</td>
      {plans.map((p) => {
        const c = getCell(p.id, row.key);
        return (
          <td key={p.id} className="p-1.5 border-l border-border/40 align-middle">
            <div className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={!!c.enabled}
                onChange={(e) => patchCell(p.id, row.key, { enabled: e.target.checked })}
                className="size-3.5 accent-primary"
                title={t.enabled}
              />
              <input
                type="number"
                min={0}
                value={c.tokens_per_use ?? 0}
                onChange={(e) => patchCell(p.id, row.key, { tokens_per_use: Number(e.target.value) || 0 })}
                placeholder="tok"
                className="w-14 rounded border border-border bg-background/60 px-1 py-0.5 text-[11px]"
                title={t.tokens}
              />
              <input
                type="number"
                step="0.001"
                min={0}
                value={c.usd_per_use ?? 0}
                onChange={(e) => patchCell(p.id, row.key, { usd_per_use: Number(e.target.value) || 0 })}
                placeholder="$"
                className="w-16 rounded border border-border bg-background/60 px-1 py-0.5 text-[11px]"
                title={t.usd}
              />
            </div>
          </td>
        );
      })}
    </tr>
  );
}

function NewPlanModal({ t, onClose, onCreate }: { t: any; onClose: () => void; onCreate: (f: any) => void }) {
  const [name, setName] = useState("");
  const [iqd, setIqd] = useState("");
  const [usd, setUsd] = useState("");
  const [tok, setTok] = useState("");
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display text-lg font-bold">{t.newPlan}</h3>
        <div className="mt-4 space-y-3">
          <Field label={t.name}><input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm" /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t.priceIqd}><input type="number" value={iqd} onChange={(e) => setIqd(e.target.value)} className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm" /></Field>
            <Field label={t.priceUsd}><input type="number" step="0.01" value={usd} onChange={(e) => setUsd(e.target.value)} className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm" /></Field>
          </div>
          <Field label={t.monthlyTokens}><input type="number" value={tok} onChange={(e) => setTok(e.target.value)} className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm" /></Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded border border-border px-3 py-1.5 text-sm">{t.cancel}</button>
          <button
            onClick={() => name.trim() && onCreate({ name: name.trim(), price_iqd: Number(iqd) || 0, price_usd: Number(usd) || 0, monthly_tokens: Number(tok) || 0 })}
            disabled={!name.trim()}
            className="rounded bg-gradient-to-r from-primary to-accent px-4 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {t.create}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><div className="mb-1 text-xs font-semibold text-muted-foreground">{label}</div>{children}</label>;
}
