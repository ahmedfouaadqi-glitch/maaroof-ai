import { Link } from "@tanstack/react-router";
import { Loader2, LockKeyhole } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { SiteHeader } from "@/components/SiteHeader";

/**
 * Unified entry state for protected pages.
 * تطوير لا إنشاء: replaces the bare `<Loader2 />` white screens that made
 * /dashboard, /profile and /admin render an empty document (no <main>, no <h1>)
 * for signed-out visitors and crawlers.
 */
export function AuthGate({
  state,
  title,
  redirect,
}: {
  state: "loading" | "signed-out";
  /** Page name shown in the heading, already localized. */
  title: string;
  /** Path to return to after sign-in. */
  redirect: string;
}) {
  const { t } = useI18n();

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto grid min-h-[60vh] max-w-xl place-items-center px-4 py-16 text-center">
        <div>
          {state === "loading" ? (
            <Loader2 className="mx-auto size-8 animate-spin text-primary" aria-hidden="true" />
          ) : (
            <LockKeyhole className="mx-auto size-10 text-primary" aria-hidden="true" />
          )}
          <h1 className="mt-4 font-display text-2xl font-bold text-gradient">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground" aria-live="polite">
            {state === "loading" ? t("gate_loading") : t("gate_desc")}
          </p>
          {state === "signed-out" && (
            <Link
              to="/auth"
              search={{ mode: "signin", redirect }}
              className="mt-6 inline-block rounded-full bg-gradient-to-r from-primary to-accent px-5 py-2 text-sm font-semibold text-primary-foreground"
            >
              {t("gate_cta")}
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}
