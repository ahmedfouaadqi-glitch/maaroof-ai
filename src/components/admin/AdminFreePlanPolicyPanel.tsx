import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Gift, Loader2, RotateCcw, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { adminSetAppSetting, adminResetTrialGrant } from "@/lib/admin.functions";
import { useI18n } from "@/lib/i18n";

type Policy = {
  trial_enabled: boolean;
  require_email_verified: boolean;
  initial_tokens: number;
  tokens_daily_limit: number | null;
  tokens_monthly_limit: number | null;
  maaroof_daily_sessions: number;
};

const DEFAULTS: Policy = {
  trial_enabled: true,
  require_email_verified: true,
  initial_tokens: 0,
  tokens_daily_limit: null,
  tokens_monthly_limit: null,
  maaroof_daily_sessions: 5,
};

const L = {
  ar: {
    title: "الخطة المجانية وسياسة الحسابات الجديدة",
    desc: "اضبط مرة واحدة ما يحصل عليه كل حساب جديد. يُطبّق تلقائياً على كل تسجيل قادم.",
    trial: "منح التجربة تلقائياً عند التسجيل",
    verify: "اشترط تأكيد البريد قبل أي منح",
    initial: "الرصيد الابتدائي (توكنز)",
    daily: "الحد اليومي (اتركه فارغاً = بلا حد)",
    monthly: "الحد الشهري (اتركه فارغاً = بلا حد)",
    sessions: "جلسات معروف المجانية يومياً",
    save: "حفظ السياسة",
    saved: "تم الحفظ",
    stats: "حسابات مُنحت التجربة",
    today: "اليوم",
    month: "هذا الشهر",
    resetTitle: "تصحيح منح حساب",
    resetDesc: "أدخل بريد المستخدم لإلغاء تجربته الحالية وتصفير رصيده الممنوح (لا يمسّ سجلات الفواتير).",
    email: "بريد المستخدم",
    reset: "تصفير المنح",
  },
  en: {
    title: "Free plan & new-account policy",
    desc: "Set once what every new account receives. Applied automatically to all future signups.",
    trial: "Grant trial automatically on signup",
    verify: "Require confirmed email before any grant",
    initial: "Starting balance (tokens)",
    daily: "Daily cap (empty = unlimited)",
    monthly: "Monthly cap (empty = unlimited)",
    sessions: "Free Maaroof sessions per day",
    save: "Save policy",
    saved: "Saved",
    stats: "Accounts granted a trial",
    today: "Today",
    month: "This month",
    resetTitle: "Correct one account's grant",
    resetDesc: "Enter a user email to cancel their active trial and zero the granted balance (billing records untouched).",
    email: "User email",
    reset: "Reset grant",
  },
  ku: {
    title: "پلانی خۆڕایی و سیاسەتی هەژمارە نوێیەکان",
    desc: "یەک جار دایبنێ کە هەر هەژمارێکی نوێ چی وەردەگرێت.",
    trial: "بەخشینی تاقیکردنەوە بە خۆکاری",
    verify: "پێویستی بە پشتڕاستکردنی ئیمەیل",
    initial: "باڵانسی سەرەتایی (تۆکن)",
    daily: "سنووری ڕۆژانە (بەتاڵ = بێ سنوور)",
    monthly: "سنووری مانگانە (بەتاڵ = بێ سنوور)",
    sessions: "دانیشتنی خۆڕایی ڕۆژانە",
    save: "پاشەکەوت",
    saved: "پاشەکەوتکرا",
    stats: "هەژمارەکانی تاقیکردنەوە",
    today: "ئەمڕۆ",
    month: "ئەم مانگە",
    resetTitle: "ڕاستکردنەوەی بەخشینی هەژمارێک",
    resetDesc: "ئیمەیلی بەکارهێنەر بنووسە بۆ هەڵوەشاندنەوەی تاقیکردنەوەی چالاک.",
    email: "ئیمەیلی بەکارهێنەر",
    reset: "سفرکردن",
  },
};

export function AdminFreePlanPolicyPanel() {
  const { lang } = useI18n();
  const tx = L[(lang as "ar" | "en" | "ku") in L ? (lang as "ar" | "en" | "ku") : "en"];
  const setSetting = useServerFn(adminSetAppSetting);
  const resetGrant = useServerFn(adminResetTrialGrant);

  const [policy, setPolicy] = useState<Policy>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [counts, setCounts] = useState<{ today: number; month: number }>({ today: 0, month: 0 });
  const [email, setEmail] = useState("");
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "free_plan_policy").maybeSingle();
      if ((data as any)?.value) setPolicy({ ...DEFAULTS, ...((data as any).value as Policy) });

      const day = new Date(); day.setUTCHours(0, 0, 0, 0);
      const month = new Date(); month.setUTCDate(1); month.setUTCHours(0, 0, 0, 0);
      const [d, m] = await Promise.all([
        supabase.from("user_agent_subscriptions").select("id", { count: "exact", head: true }).gte("created_at", day.toISOString()),
        supabase.from("user_agent_subscriptions").select("id", { count: "exact", head: true }).gte("created_at", month.toISOString()),
      ]);
      setCounts({ today: d.count || 0, month: m.count || 0 });
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true); setMsg("");
    try {
      await setSetting({ data: { key: "free_plan_policy", value: policy as any } });
      setMsg(tx.saved);
    } catch (e: any) {
      setMsg(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  const doReset = async () => {
    if (!email.trim()) return;
    setResetting(true); setMsg("");
    try {
      const r: any = await resetGrant({ data: { email: email.trim() } });
      setMsg(r?.ok ? tx.saved : String(r?.error || ""));
      setEmail("");
    } catch (e: any) {
      setMsg(String(e?.message || e));
    } finally {
      setResetting(false);
    }
  };

  const numOrNull = (v: string) => (v.trim() === "" ? null : Math.max(0, Number(v) || 0));

  if (loading) {
    return <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> …</div>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card/60 p-4">
        <div className="mb-1 flex items-center gap-2 text-sm font-bold text-foreground">
          <Gift className="size-4 text-primary" /> {tx.title}
        </div>
        <p className="mb-4 text-xs text-muted-foreground">{tx.desc}</p>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 rounded-lg border border-border bg-background/50 px-3 py-2 text-sm">
            <input type="checkbox" checked={policy.trial_enabled} onChange={(e) => setPolicy({ ...policy, trial_enabled: e.target.checked })} />
            {tx.trial}
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-border bg-background/50 px-3 py-2 text-sm">
            <input type="checkbox" checked={policy.require_email_verified} onChange={(e) => setPolicy({ ...policy, require_email_verified: e.target.checked })} />
            {tx.verify}
          </label>

          <label className="text-xs text-muted-foreground">
            {tx.initial}
            <input type="number" min={0} value={policy.initial_tokens}
              onChange={(e) => setPolicy({ ...policy, initial_tokens: Math.max(0, Number(e.target.value) || 0) })}
              className="mt-1 w-full rounded-lg border border-border bg-background/60 px-3 py-1.5 text-sm text-foreground" />
          </label>
          <label className="text-xs text-muted-foreground">
            {tx.sessions}
            <input type="number" min={0} value={policy.maaroof_daily_sessions}
              onChange={(e) => setPolicy({ ...policy, maaroof_daily_sessions: Math.max(0, Number(e.target.value) || 0) })}
              className="mt-1 w-full rounded-lg border border-border bg-background/60 px-3 py-1.5 text-sm text-foreground" />
          </label>
          <label className="text-xs text-muted-foreground">
            {tx.daily}
            <input type="number" min={0} value={policy.tokens_daily_limit ?? ""}
              onChange={(e) => setPolicy({ ...policy, tokens_daily_limit: numOrNull(e.target.value) })}
              className="mt-1 w-full rounded-lg border border-border bg-background/60 px-3 py-1.5 text-sm text-foreground" />
          </label>
          <label className="text-xs text-muted-foreground">
            {tx.monthly}
            <input type="number" min={0} value={policy.tokens_monthly_limit ?? ""}
              onChange={(e) => setPolicy({ ...policy, tokens_monthly_limit: numOrNull(e.target.value) })}
              className="mt-1 w-full rounded-lg border border-border bg-background/60 px-3 py-1.5 text-sm text-foreground" />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button onClick={save} disabled={saving}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-60">
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} {tx.save}
          </button>
          <span className="text-xs text-muted-foreground">
            {tx.stats}: {tx.today} {counts.today} · {tx.month} {counts.month}
          </span>
          {msg && <span className="text-xs text-primary">{msg}</span>}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card/60 p-4">
        <div className="mb-1 flex items-center gap-2 text-sm font-bold text-foreground">
          <RotateCcw className="size-4 text-primary" /> {tx.resetTitle}
        </div>
        <p className="mb-3 text-xs text-muted-foreground">{tx.resetDesc}</p>
        <div className="flex flex-wrap gap-2">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={tx.email}
            className="min-w-[240px] flex-1 rounded-lg border border-border bg-background/60 px-3 py-1.5 text-sm" />
          <button onClick={doReset} disabled={resetting || !email.trim()}
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-bold disabled:opacity-60">
            {resetting ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />} {tx.reset}
          </button>
        </div>
      </div>
    </div>
  );
}
