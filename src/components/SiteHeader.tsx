import { useI18n } from "@/lib/i18n";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Link } from "@tanstack/react-router";
import { Cpu, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth";

export function SiteHeader() {
  const { t } = useI18n();
  // useAuth may throw outside provider — guard
  let auth: ReturnType<typeof useAuth> | null = null;
  try { auth = useAuth(); } catch { /* not in provider */ }

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="relative grid size-9 place-items-center rounded-lg bg-gradient-to-br from-primary to-accent shadow-[var(--shadow-glow)]">
            <Cpu className="size-5 text-primary-foreground" />
          </div>
          <div className="leading-tight">
            <div className="font-display text-base font-bold">{t("brand")}</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("ecosystem")}</div>
          </div>
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <Link to="/" hash="features" className="hover:text-foreground">{t("nav_features")}</Link>
          <Link to="/" hash="how" className="hover:text-foreground">{t("nav_how")}</Link>
          <Link to="/pricing" className="hover:text-foreground">{t("nav_pricing")}</Link>
          {auth?.user && <Link to="/dashboard" className="hover:text-foreground">{t("nav_dashboard")}</Link>}
          {auth?.user && <Link to="/agent" className="hover:text-foreground">🤖 الوكيل</Link>}
          {auth?.isAdmin && <Link to="/admin" className="text-accent hover:text-foreground">{t("nav_admin")}</Link>}
        </nav>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          {auth?.user ? (
            <button onClick={() => auth!.signOut()} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
              <LogOut className="size-3" /> {t("nav_signout")}
            </button>
          ) : (
            <Link to="/auth" search={{ mode: "signin", redirect: "/dashboard" }}
              className="rounded-full bg-gradient-to-r from-primary to-accent px-4 py-2 text-xs font-semibold text-primary-foreground shadow-[var(--shadow-glow)]">
              {t("nav_signin")}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
