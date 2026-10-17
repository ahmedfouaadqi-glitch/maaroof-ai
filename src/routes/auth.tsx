import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { AuthProvider, useAuth } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
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
  validateSearch: (s: Record<string, unknown>): { mode?: "signin" | "signup"; redirect?: string } => {
    const raw = typeof s.redirect === "string" ? s.redirect : "";
    // Only allow internal absolute paths; reject protocol-relative (//evil)
    // and absolute URLs (https://evil) to prevent open-redirect phishing.
    const safe = /^\/(?!\/)[^\s]*$/.test(raw) && !raw.toLowerCase().startsWith("/javascript")
      ? raw
      : "/workspace";
    return {
      mode: (s.mode as string) === "signup" ? "signup" : "signin",
      redirect: safe,
    };
  },
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
    let target = redirect;
    try {
      const saved = sessionStorage.getItem("auth_redirect");
      if (saved && /^\/(?!\/)[^\s]*$/.test(saved)) target = saved;
      sessionStorage.removeItem("auth_redirect");
    } catch { /* storage unavailable */ }
    setTimeout(() => navigate({ to: target as any }), 0);
  }

  const oauthSignIn = async (provider: "google" | "microsoft" | "apple") => {
    setError(null);
    setInfo(null);
    try { sessionStorage.setItem("auth_redirect", redirect || "/workspace"); } catch { /* ignore */ }
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: `${window.location.origin}/auth`,
    });
    if (result.error) {
      setError(result.error.message || "Sign-in failed");
      return;
    }
    if (result.redirected) return; // browser is navigating to the provider
  };

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
        const redirectUrl = `${window.location.origin}/workspace`;
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
          <button
            type="button"
            onClick={() => oauthSignIn("google")}
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-3 rounded-full border border-border bg-background/70 px-6 py-3 text-sm font-semibold transition-colors hover:bg-background disabled:opacity-50"
          >
            <svg className="size-5" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/>
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/>
              <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/>
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"/>
            </svg>
            {t("auth_google")}
          </button>
          <button
            type="button"
            onClick={() => oauthSignIn("microsoft")}
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-3 rounded-full border border-border bg-background/70 px-6 py-3 text-sm font-semibold transition-colors hover:bg-background disabled:opacity-50"
          >
            <svg className="size-5" viewBox="0 0 21 21" aria-hidden="true">
              <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
              <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
              <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
              <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
            </svg>
            {t("auth_microsoft")}
          </button>
          <button
            type="button"
            onClick={() => oauthSignIn("apple")}
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-3 rounded-full border border-border bg-background/70 px-6 py-3 text-sm font-semibold transition-colors hover:bg-background disabled:opacity-50"
          >
            <svg className="size-5" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
              <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8.98-.2 1.92-.87 3.42-.9 1.28.11 2.24.72 2.86 1.8-2.62 1.57-2.19 5.02.46 6.03-.52 1.37-1.19 2.73-2.82 5.24zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
            </svg>
            {t("auth_apple")}
          </button>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            {t("auth_or")}
            <span className="h-px flex-1 bg-border" />
          </div>
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
