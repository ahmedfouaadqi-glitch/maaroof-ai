import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { SiteHeader } from "@/components/SiteHeader";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Lock } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset Your Password · MAAROOF Ai" },
      { name: "description", content: "Securely reset your MAAROOF Ai account password to regain access to your dashboard." },
      { name: "robots", content: "noindex,follow" },
      { property: "og:title", content: "Reset Password · MAAROOF Ai" },
      { property: "og:description", content: "Securely reset your MAAROOF Ai account password." },
      { property: "og:url", content: "https://geoiraq.com/reset-password" },
    ],
  }),
  component: () => (
    <I18nProvider>
      <ResetPage />
    </I18nProvider>
  ),
});

function ResetPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    // Supabase recovery places a session in the URL hash; ensure session is present
    supabase.auth.getSession().then(({ data }) => {
      setReady(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setInfo(null);
    if (pwd.length < 6) { setError(t("reset_min")); return; }
    if (pwd !== pwd2) { setError(t("reset_mismatch")); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setBusy(false);
    if (error) { setError(error.message); return; }
    setInfo(t("reset_done"));
    setTimeout(() => navigate({ to: "/dashboard" }), 1500);
  };

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto flex max-w-md flex-col px-4 py-12">
        <h1 className="mb-6 font-display text-3xl font-bold text-gradient">{t("reset_title")}</h1>
        {!ready ? (
          <div className="rounded-2xl border border-border bg-card/70 p-6 text-sm text-muted-foreground">{t("reset_link_invalid")}</div>
        ) : (
          <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-card/70 p-6 backdrop-blur">
            <label className="block">
              <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("reset_new_pwd")}</div>
              <div className="flex items-center gap-2 rounded-xl border border-border bg-background/60 px-3 py-2.5 focus-within:border-primary">
                <Lock className="size-4 text-muted-foreground" />
                <input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} required minLength={6} maxLength={72} className="w-full bg-transparent outline-none" />
              </div>
            </label>
            <label className="block">
              <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("reset_confirm_pwd")}</div>
              <div className="flex items-center gap-2 rounded-xl border border-border bg-background/60 px-3 py-2.5 focus-within:border-primary">
                <Lock className="size-4 text-muted-foreground" />
                <input type="password" value={pwd2} onChange={(e) => setPwd2(e.target.value)} required minLength={6} maxLength={72} className="w-full bg-transparent outline-none" />
              </div>
            </label>
            {error && <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
            {info && <div className="rounded-lg border border-success/40 bg-success/10 p-3 text-sm text-success">{info}</div>}
            <button type="submit" disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] disabled:opacity-50">
              {busy && <Loader2 className="size-4 animate-spin" />} {t("reset_save")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
