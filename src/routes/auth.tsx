import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { AuthProvider, useAuth } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Mail, Lock, User as UserIcon } from "lucide-react";
import { z } from "zod";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign In or Sign Up · MAAROOF Ai" },
      { name: "description", content: "Sign in or create your MAAROOF Ai account to access the AI visibility tools, dashboard, and the autonomous brand agent." },
      { name: "robots", content: "noindex,follow" },
      { property: "og:title", content: "Sign In or Sign Up · MAAROOF Ai" },
      { property: "og:description", content: "Sign in or create your MAAROOF Ai account to access the AI visibility tools, dashboard, and the autonomous brand agent." },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    mode: (s.mode as string) === "signup" ? "signup" : "signin",
    redirect: (s.redirect as string) || "/dashboard",
  }),
  component: () => (
    <I18nProvider>
      <AuthProvider>
        <AuthPage />
      </AuthProvider>
    </I18nProvider>
  ),
});

const schema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(72),
  full_name: z.string().trim().min(1).max(100).optional(),
});

function AuthPage() {
  const { t } = useI18n();
  const { mode, redirect } = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isSignup, setIsSignup] = useState(mode === "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  if (user) {
    setTimeout(() => navigate({ to: redirect as any }), 0);
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    const parsed = schema.safeParse({ email, password, full_name: isSignup ? name : undefined });
    if (!parsed.success) {
      setError(parsed.error.errors[0].message);
      return;
    }
    setLoading(true);
    try {
      if (isSignup) {
        const redirectUrl = `${window.location.origin}/dashboard`;
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirectUrl, data: { full_name: name } },
        });
        if (error) throw error;
        setInfo(t("auth_check_email"));
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: redirect as any });
      }
    } catch (e: any) {
      setError(e.message || "Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto flex max-w-md flex-col px-4 py-12">
        <h1 className="mb-6 font-display text-3xl font-bold text-gradient">
          {isSignup ? t("auth_signup_title") : t("auth_signin_title")}
        </h1>
        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-card/70 p-6 backdrop-blur">
          {isSignup && (
            <Field icon={<UserIcon className="size-4" />} label={t("auth_name")}>
              <input
                value={name} onChange={(e) => setName(e.target.value)}
                required maxLength={100}
                className="w-full bg-transparent outline-none"
              />
            </Field>
          )}
          <Field icon={<Mail className="size-4" />} label={t("auth_email")}>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              required maxLength={255}
              className="w-full bg-transparent outline-none"
            />
          </Field>
          <Field icon={<Lock className="size-4" />} label={t("auth_password")}>
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              required minLength={6} maxLength={72}
              className="w-full bg-transparent outline-none"
            />
          </Field>
          {!isSignup && (
            <div className="text-end">
              <button
                type="button"
                onClick={async () => {
                  setError(null); setInfo(null);
                  const e = email.trim();
                  if (!e) { setError(t("auth_enter_email_first")); return; }
                  const { error } = await supabase.auth.resetPasswordForEmail(e, {
                    redirectTo: `${window.location.origin}/reset-password`,
                  });
                  if (error) setError(error.message); else setInfo(t("auth_reset_sent"));
                }}
                className="text-xs text-primary hover:underline"
              >{t("auth_forgot")}</button>
            </div>
          )}
          {error && <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
          {info && <div className="rounded-lg border border-success/40 bg-success/10 p-3 text-sm text-success">{info}</div>}
          <button
            type="submit" disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] disabled:opacity-50"
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            {isSignup ? t("auth_signup_cta") : t("auth_signin_cta")}
          </button>
          <div className="text-center text-sm text-muted-foreground">
            {isSignup ? t("auth_have_account") : t("auth_no_account")}{" "}
            <button type="button" onClick={() => setIsSignup(!isSignup)} className="font-medium text-primary hover:underline">
              {isSignup ? t("auth_signin_link") : t("auth_signup_link")}
            </button>
          </div>
        </form>
        <Link to="/" className="mt-6 text-center text-xs text-muted-foreground hover:text-foreground">
          ← {t("back_home")}
        </Link>
      </div>
    </div>
  );
}

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="flex items-center gap-2 rounded-xl border border-border bg-background/60 px-3 py-2.5 focus-within:border-primary">
        <span className="text-muted-foreground">{icon}</span>
        {children}
      </div>
    </label>
  );
}
