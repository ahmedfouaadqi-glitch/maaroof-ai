import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { AuthProvider, useAuth } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { GeoScopeSelector } from "@/components/GeoScopeSelector";
import { supabase } from "@/integrations/supabase/client";
import { computeFingerprint } from "@/lib/fingerprint";
import { Loader2, Save, Lock, ShieldCheck } from "lucide-react";
import { ToolLinksManager } from "@/components/ToolLinksManager";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile · GEO-Iraq" },
      { name: "description", content: "Manage your GEO-Iraq profile, brand details and connected tool links." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: () => (
    <I18nProvider><AuthProvider><ProfilePage /></AuthProvider></I18nProvider>
  ),
});

function ProfilePage() {
  const { t } = useI18n();
  const { user, profile, loading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [brandName, setBrandName] = useState("");
  const [brandKw, setBrandKw] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [locking, setLocking] = useState(false);

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth", search: { mode: "signin", redirect: "/profile" } }); }, [loading, user, navigate]);

  useEffect(() => {
    if (!profile) return;
    setFullName((profile as any).full_name || "");
    setBrandName((profile as any).brand_name || "");
    setBrandKw((profile as any).brand_keywords || "");
    setSpecialty((profile as any).specialty || "");
  }, [profile]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    await supabase.from("profiles").update({
      full_name: fullName, brand_name: brandName, brand_keywords: brandKw, specialty,
    }).eq("id", user.id);
    await refreshProfile();
    setSaving(false); setDone(true); setTimeout(() => setDone(false), 1500);
  };

  const lockToDevice = async () => {
    if (!user) return;
    setLocking(true);
    const fp = await computeFingerprint();
    await supabase.from("profiles").update({ device_fingerprint: fp, device_locked_at: new Date().toISOString() }).eq("id", user.id);
    await refreshProfile();
    setLocking(false);
  };

  if (loading || !user) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>;

  const locked = !!(profile as any)?.device_fingerprint;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="font-display text-2xl font-bold text-gradient">{t("profile_title")}</h1>

        <div className="mt-6 space-y-4 rounded-2xl border border-border bg-card/70 p-5">
          <Field label="Email">
            <input value={profile?.email || ""} disabled className="w-full rounded-lg border border-border bg-background/30 px-3 py-2 text-sm opacity-70" />
            <small className="text-xs text-muted-foreground">{t("profile_email_locked")}</small>
          </Field>
          <Field label={t("profile_full_name")}>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm" />
          </Field>
          <Field label={t("profile_brand_name")}>
            <input value={brandName} onChange={(e) => setBrandName(e.target.value)} className="w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm" />
          </Field>
          <Field label={t("profile_brand_keywords")}>
            <input value={brandKw} onChange={(e) => setBrandKw(e.target.value)} className="w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm" />
          </Field>
          <Field label={t("profile_specialty")}>
            <input value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder={t("profile_specialty_ph")} className="w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm" />
          </Field>
          <Field label="Subscription">
            <div className="text-sm">{profile?.is_subscribed ? (profile as any).subscription_tier || "Pro" : "Free"}</div>
            <small className="text-xs text-muted-foreground">{t("profile_subscription_locked")}</small>
          </Field>
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-accent px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} {done ? t("profile_saved") : t("profile_save")}
          </button>

          <GeoScopeSelector />
        </div>

        <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <Lock className="size-5 text-amber-500" /> {t("profile_device_lock_title")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("profile_device_lock_desc")}</p>
          <div className="mt-3 flex items-center gap-3 text-xs">
            {locked ? <span className="inline-flex items-center gap-1 text-success"><ShieldCheck className="size-4" /> {t("profile_locked")}</span>
                    : <span className="text-muted-foreground">{t("profile_unlocked")}</span>}
          </div>
          <button onClick={lockToDevice} disabled={locking} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-700 disabled:opacity-50">
            {locking ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />} {t("profile_device_lock_enable")}
          </button>
        </div>

        <ToolLinksManager />

        <div className="mt-8 text-center"><Link to="/dashboard" className="text-sm text-primary hover:underline">← {t("nav_dashboard")}</Link></div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</label>{children}</div>;
}
