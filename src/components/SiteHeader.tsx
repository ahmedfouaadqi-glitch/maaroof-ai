import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Link } from "@tanstack/react-router";
import { Cpu, LogOut, Menu, X, Volume2, VolumeX } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { isSoundEnabled, setSoundEnabled, playClick } from "@/lib/sound";

export function SiteHeader() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [sound, setSound] = useState(true);
  useEffect(() => { setSound(isSoundEnabled()); }, []);
  let auth: ReturnType<typeof useAuth> | null = null;
  try { auth = useAuth(); } catch { /* not in provider */ }

  const close = () => setOpen(false);
  const toggleSound = () => {
    const next = !sound;
    setSound(next);
    setSoundEnabled(next);
    if (next) playClick();
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-3 sm:gap-4 sm:px-4 md:px-6">
        <Link to="/" className="flex items-center gap-2 min-w-0">
          <div className="relative grid size-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary to-accent shadow-[var(--shadow-glow)]">
            <Cpu className="size-5 text-primary-foreground" />
          </div>
          <div className="leading-tight min-w-0">
            <div className="truncate font-display text-sm font-bold sm:text-base">{t("brand")}</div>
            <div className="hidden truncate text-[10px] uppercase tracking-widest text-muted-foreground sm:block">{t("ecosystem")}</div>
          </div>
        </Link>
        <nav className="hidden items-center gap-5 text-sm text-muted-foreground lg:flex xl:gap-6">
          <Link to="/" hash="features" className="hover:text-foreground">{t("nav_features")}</Link>
          <Link to="/" hash="how" className="hover:text-foreground">{t("nav_how")}</Link>
          <Link to="/pricing" className="hover:text-foreground">{t("nav_pricing")}</Link>
          <Link to="/pulse" className="hover:text-foreground text-primary">نبض</Link>
          {auth?.user && <Link to="/dashboard" className="hover:text-foreground">{t("nav_dashboard")}</Link>}
          {auth?.user && <Link to="/agent" className="hover:text-foreground">{t("nav_agent")}</Link>}
          {auth?.user && <Link to="/profile" className="hover:text-foreground">{t("nav_profile")}</Link>}
          <Link to="/guide" className="hover:text-foreground">{t("nav_guide")}</Link>
          <Link to="/contact" className="hover:text-foreground">{t("nav_contact")}</Link>
          {auth?.isAdmin && <Link to="/admin" className="text-accent hover:text-foreground">{t("nav_admin")}</Link>}
        </nav>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <LanguageSwitcher />
          <button
            type="button"
            onClick={toggleSound}
            aria-label={sound ? t("sound_off") : t("sound_on")}
            title={sound ? t("sound_off") : t("sound_on")}
            className="inline-flex size-8 items-center justify-center rounded-full border border-border bg-background/60 text-muted-foreground hover:text-foreground"
          >
            {sound ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
          </button>
          {auth?.user ? (
            <button onClick={() => auth!.signOut()} className="hidden items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground sm:inline-flex">
              <LogOut className="size-3" /> {t("nav_signout")}
            </button>
          ) : (
            <Link to="/auth" search={{ mode: "signin", redirect: "/dashboard" }}
              className="rounded-full bg-gradient-to-r from-primary to-accent px-3 py-1.5 text-[11px] font-semibold text-primary-foreground shadow-[var(--shadow-glow)] sm:px-4 sm:py-2 sm:text-xs">
              {t("nav_signin")}
            </Link>
          )}
          <button
            type="button"
            aria-label="menu"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex size-9 items-center justify-center rounded-lg border border-border bg-background/60 text-foreground lg:hidden"
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>
      {open && (
        <div className="border-t border-border/60 bg-background/95 backdrop-blur-xl lg:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3 text-sm">
            <Link to="/" hash="features" onClick={close} className="rounded-md px-2 py-2 text-muted-foreground hover:bg-muted/40 hover:text-foreground">{t("nav_features")}</Link>
            <Link to="/" hash="how" onClick={close} className="rounded-md px-2 py-2 text-muted-foreground hover:bg-muted/40 hover:text-foreground">{t("nav_how")}</Link>
            <Link to="/pricing" onClick={close} className="rounded-md px-2 py-2 text-muted-foreground hover:bg-muted/40 hover:text-foreground">{t("nav_pricing")}</Link>
            <Link to="/pulse" onClick={close} className="rounded-md px-2 py-2 text-primary hover:bg-muted/40">نبض</Link>
            {auth?.user && <Link to="/dashboard" onClick={close} className="rounded-md px-2 py-2 text-muted-foreground hover:bg-muted/40 hover:text-foreground">{t("nav_dashboard")}</Link>}
            {auth?.user && <Link to="/agent" onClick={close} className="rounded-md px-2 py-2 text-muted-foreground hover:bg-muted/40 hover:text-foreground">{t("nav_agent")}</Link>}
            {auth?.user && <Link to="/profile" onClick={close} className="rounded-md px-2 py-2 text-muted-foreground hover:bg-muted/40 hover:text-foreground">{t("nav_profile")}</Link>}
            <Link to="/guide" onClick={close} className="rounded-md px-2 py-2 text-muted-foreground hover:bg-muted/40 hover:text-foreground">{t("nav_guide")}</Link>
            <Link to="/contact" onClick={close} className="rounded-md px-2 py-2 text-muted-foreground hover:bg-muted/40 hover:text-foreground">{t("nav_contact")}</Link>
            {auth?.isAdmin && <Link to="/admin" onClick={close} className="rounded-md px-2 py-2 text-accent hover:bg-muted/40">{t("nav_admin")}</Link>}
            {auth?.user && (
              <button onClick={() => { auth!.signOut(); close(); }} className="mt-1 inline-flex items-center gap-1 rounded-md px-2 py-2 text-start text-xs text-muted-foreground hover:bg-muted/40 hover:text-foreground sm:hidden">
                <LogOut className="size-3" /> {t("nav_signout")}
              </button>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
