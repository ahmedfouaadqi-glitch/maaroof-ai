import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Coins, Save, Search, Wallet } from "lucide-react";
import { TOOL_CATALOG, toolLabel } from "@/lib/tool-catalog";
import { CostBadge } from "@/components/CostBadge";
import { useI18n } from "@/lib/i18n";

type Profile = {
  id: string; email: string | null; full_name: string | null; username: string | null;
  tokens_balance: number; tokens_daily_limit: number | null; tokens_monthly_limit: number | null;
  tokens_used_today: number; tokens_used_month: number;
  per_user_tool_overrides: Record<string, { tokens_per_use?: number; usd_per_use?: number; enabled?: boolean; daily?: number; monthly?: number }>;
  subscription_tier: string | null;
};

type Pricing = { tool_key: string; default_tokens: number; default_usd: number; model: string | null };

export function AdminTokensPanel() {
  const { lang } = useI18n();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [pricing, setPricing] = useState<Pricing[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(true);
  const [editing, setEditing] = useState<Profile | null>(null);

  async function load() {
    setBusy(true);
    const [p, c] = await Promise.all([
      supabase.from("profiles").select("id,email,full_name,username,tokens_balance,tokens_daily_limit,tokens_monthly_limit,tokens_used_today,tokens_used_month,per_user_tool_overrides,subscription_tier").order("email"),
      supabase.from("tool_pricing_catalog").select("tool_key, default_tokens, default_usd, model"),
    ]);
    setProfiles((p.data || []) as any);
    setPricing((c.data || []) as any);
    setBusy(false);
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return profiles;
    return profiles.filter((p) => `${p.email} ${p.full_name} ${p.username}`.toLowerCase().includes(s));
  }, [profiles, q]);

  const catalog = useMemo(() => Object.fromEntries(pricing.map((p) => [p.tool_key, p])), [pricing]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold flex items-center gap-2"><Coins className="size-5 text-primary" /> إدارة التوكن والتسعير</h2>
        <div className="relative">
          <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالبريد/الاسم" className="rounded-full border border-border bg-card/60 py-2 pr-9 pl-3 text-sm w-64" />
        </div>
      </div>

      {busy ? (
        <div className="flex justify-center p-10"><Loader2 className="size-6 animate-spin text-primary" /></div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-card/60 text-xs">
              <tr>
                <th className="p-2 text-start">المستخدم</th>
                <th className="p-2">الخطة</th>
                <th className="p-2">الرصيد</th>
                <th className="p-2">يومي</th>
                <th className="p-2">شهري</th>
                <th className="p-2">إجراء</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-t border-border/50">
                  <td className="p-2">
                    <div className="font-medium">{p.full_name || p.username || p.email}</div>
                    <div className="text-xs text-muted-foreground">{p.email}</div>
                  </td>
                  <td className="p-2 text-center text-xs">{p.subscription_tier || "—"}</td>
                  <td className="p-2 text-center font-semibold text-primary">{p.tokens_balance.toLocaleString()}</td>
                  <td className="p-2 text-center text-xs">{p.tokens_used_today}/{p.tokens_daily_limit ?? "∞"}</td>
                  <td className="p-2 text-center text-xs">{p.tokens_used_month}/{p.tokens_monthly_limit ?? "∞"}</td>
                  <td className="p-2 text-center">
                    <button onClick={() => setEditing(p)} className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/20">إدارة</button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">لا توجد نتائج</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <details className="rounded-xl border border-border bg-card/40 p-3">
        <summary className="cursor-pointer text-sm font-semibold">كتالوج التسعير الافتراضي ({pricing.length} أداة)</summary>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {pricing.map((c) => (
            <div key={c.tool_key} className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2 text-xs">
              <div>
                <div className="font-semibold">{c.tool_key}</div>
                <div className="text-[10px] text-muted-foreground">{c.model}</div>
              </div>
              <CostBadge tokens={c.default_tokens} usd={c.default_usd} compact />
            </div>
          ))}
        </div>
      </details>

      {editing && <UserTokensDrawer user={editing} catalog={catalog} onClose={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function UserTokensDrawer({ user, catalog, onClose }: { user: Profile; catalog: Record<string, Pricing>; onClose: () => void }) {
  const [balance, setBalance] = useState(user.tokens_balance);
  const [daily, setDaily] = useState<number | "">(user.tokens_daily_limit ?? "");
  const [monthly, setMonthly] = useState<number | "">(user.tokens_monthly_limit ?? "");
  const [overrides, setOverrides] = useState<Record<string, any>>(user.per_user_tool_overrides || {});
  const [saving, setSaving] = useState(false);

  const totalDailyCost = useMemo(() => {
    let tokens = 0, usd = 0;
    for (const t of TOOL_CATALOG) {
      const o = overrides[t.key] || {};
      const def = catalog[t.key];
      const perUse = Number(o.tokens_per_use ?? def?.default_tokens ?? 0);
      const perUsd = Number(o.usd_per_use ?? def?.default_usd ?? 0);
      const dailyUses = Number(o.daily ?? 0);
      tokens += perUse * dailyUses;
      usd += perUsd * dailyUses;
    }
    return { tokens, usd };
  }, [overrides, catalog]);

  async function save() {
    setSaving(true);
    await supabase.from("profiles").update({
      tokens_balance: balance,
      tokens_daily_limit: daily === "" ? null : Number(daily),
      tokens_monthly_limit: monthly === "" ? null : Number(monthly),
      per_user_tool_overrides: overrides,
    } as any).eq("id", user.id);
    setSaving(false);
    onClose();
  }

  function patchTool(key: string, patch: any) {
    setOverrides((prev) => ({ ...prev, [key]: { ...(prev[key] || {}), ...patch } }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-background p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg font-bold">{user.full_name || user.email}</h3>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">✕</button>
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <Field label="رصيد التوكن" icon={<Wallet className="size-3.5 text-primary" />}>
            <input type="number" value={balance} onChange={(e) => setBalance(Number(e.target.value))} className="w-full rounded-lg border border-border bg-background px-2 py-1 text-sm" />
          </Field>
          <Field label="حد يومي (توكن)">
            <input type="number" value={daily} onChange={(e) => setDaily(e.target.value === "" ? "" : Number(e.target.value))} placeholder="∞" className="w-full rounded-lg border border-border bg-background px-2 py-1 text-sm" />
          </Field>
          <Field label="حد شهري (توكن)">
            <input type="number" value={monthly} onChange={(e) => setMonthly(e.target.value === "" ? "" : Number(e.target.value))} placeholder="∞" className="w-full rounded-lg border border-border bg-background px-2 py-1 text-sm" />
          </Field>
        </div>

        <h4 className="mb-2 text-sm font-semibold">إعدادات الأدوات (تجاوز لكل مستخدم)</h4>
        <div className="space-y-2">
          {TOOL_CATALOG.map((t) => {
            const o = overrides[t.key] || {};
            const def = catalog[t.key];
            const perUse = Number(o.tokens_per_use ?? def?.default_tokens ?? 0);
            const perUsd = Number(o.usd_per_use ?? def?.default_usd ?? 0);
            return (
              <div key={t.key} className="rounded-lg border border-border bg-card/40 p-2 text-xs">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold">{toolLabel(t.key as any, "ar")}</div>
                  <CostBadge tokens={perUse} usd={perUsd} compact />
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <SmallField label="توكن/مرة" value={o.tokens_per_use ?? ""} placeholder={String(def?.default_tokens || 0)} onChange={(v) => patchTool(t.key, { tokens_per_use: v })} />
                  <SmallField label="دولار/مرة" value={o.usd_per_use ?? ""} placeholder={String(def?.default_usd || 0)} step="0.0001" onChange={(v) => patchTool(t.key, { usd_per_use: v })} />
                  <SmallField label="يومي" value={o.daily ?? ""} placeholder="0" onChange={(v) => patchTool(t.key, { daily: v })} />
                  <SmallField label="شهري" value={o.monthly ?? ""} placeholder="0" onChange={(v) => patchTool(t.key, { monthly: v })} />
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
          <div className="text-sm">
            <div className="text-xs text-muted-foreground">التكلفة اليومية الكاملة (لو استُهلكت كل الحصص)</div>
            <CostBadge tokens={totalDailyCost.tokens} usd={totalDailyCost.usd} />
          </div>
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} حفظ
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
function SmallField({ label, value, onChange, placeholder, step }: { label: string; value: any; onChange: (v: number | "") => void; placeholder?: string; step?: string }) {
  return (
    <label className="space-y-0.5">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <input type="number" step={step} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))} className="w-full rounded-md border border-border bg-background px-2 py-1" />
    </label>
  );
}
