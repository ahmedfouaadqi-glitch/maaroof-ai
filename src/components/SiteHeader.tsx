import { useEffect, useState } from "react";
import { useI18n, type Lang } from "@/lib/i18n";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Link } from "@tanstack/react-router";
import { LogOut, Menu, X, Volume2, VolumeX, Phone } from "lucide-react";
import maaroofMark from "@/assets/maaroof-ai-mark.png";
import { HexBadge } from "@/components/HexBadge";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AlertsBell } from "@/components/AlertsBell";
import { CountryBadge } from "@/components/CountryBadge";
import { Widget } from "@/lib/visibility";
import { useHeaderConfig, type ExtraLink, type ExtraPhone } from "@/lib/content";

import { isSoundEnabled, setSoundEnabled, playClick } from "@/lib/sound";

function linkLabel(l: ExtraLink, lang: Lang): string {
  return (l as any)[`label_${lang}`] || l.label_en || l.label_ar || l.label_ku || l.href;
}
function phoneDesc(p: ExtraPhone, lang: Lang): string {
  return (p as any)[`desc_${lang}`] || p.desc_en || p.desc_ar || p.desc_ku || "";
}

export function SiteHeader() {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [sound, setSound] = useState(true);
  const hdr = useHeaderConfig();
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
          <HexBadge size={44} className="transition-transform hover:scale-105 drop-shadow-[0_2px_10px_oklch(0.70_0.13_218/0.45)]">
            <img src={maaroofMark} alt="MAAROOF Ai logo" className="size-[88%] object-contain" />
          </HexBadge>


          <div className="leading-tight min-w-0">
            <div className="truncate font-display text-sm font-bold sm:text-base">{t("brand")}</div>
            <div className="truncate text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/80">
              formerly GEO-Iraq
            </div>
            <div className="hidden truncate text-[10px] uppercase tracking-widest text-muted-foreground sm:block">{t("ecosystem")}</div>
          </div>
        </Link>
        <nav className="hidden items-center gap-5 text-sm text-muted-foreground lg:flex xl:gap-6">
          <Link to="/guide" className="hover:text-foreground">{t("nav_how")}</Link>
          {hdr.show_pricing && <Link to="/pricing" className="hover:text-foreground">{t("nav_pricing")}</Link>}
          {auth?.user && hdr.show_dashboard && <Link to="/dashboard" className="hover:text-foreground">{t("nav_dashboard")}</Link>}
          {auth?.user && (hdr.show_maaroof || hdr.show_agent) && <Link to="/maaroof" className="font-semibold text-primary hover:text-foreground">{t("auto.maaroof")}</Link>}
          {auth?.user && hdr.show_profile && <Link to="/profile" className="hover:text-foreground">{t("nav_profile")}</Link>}
          {hdr.show_guide && <Link to="/guide" className="hover:text-foreground">{t("nav_guide")}</Link>}
          {hdr.show_contact && <Link to="/contact" className="hover:text-foreground">{t("nav_contact")}</Link>}
          {hdr.extra_links.map((l, i) => (
            l.href.startsWith("http")
              ? <a key={i} href={l.href} target="_blank" rel="noreferrer" className="hover:text-foreground">{linkLabel(l, lang)}</a>
              : <a key={i} href={l.href} className="hover:text-foreground">{linkLabel(l, lang)}</a>
          ))}
          {auth?.isAdmin && <Link to="/admin" className="text-accent hover:text-foreground">{t("nav_admin")}</Link>}
        </nav>
        <div className="flex items-center gap-1.5 sm:gap-2">
          {hdr.extra_phones.length > 0 && (
            <div className="hidden items-center gap-2 md:flex">
              {hdr.extra_phones.slice(0, 2).map((p, i) => (
                <a key={i} href={`tel:${p.number}`} title={phoneDesc(p, lang)}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-background/60 px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground">
                  <Phone className="size-3" /> {p.display || p.number}
                </a>
              ))}
            </div>
          )}
          <CountryBadge compact />
          <LanguageSwitcher />
          <ThemeToggle />
          <Widget k="alerts_bell"><AlertsBell /></Widget>
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
            {hdr.show_pricing && <Link to="/pricing" onClick={close} className="rounded-md px-2 py-2 text-muted-foreground hover:bg-muted/40 hover:text-foreground">{t("nav_pricing")}</Link>}
            {auth?.user && hdr.show_dashboard && <Link to="/dashboard" onClick={close} className="rounded-md px-2 py-2 text-muted-foreground hover:bg-muted/40 hover:text-foreground">{t("nav_dashboard")}</Link>}
            {auth?.user && hdr.show_agent && <Link to="/maaroof" search={{ tab: "tasks" as const }} onClick={close} className="rounded-md px-2 py-2 text-muted-foreground hover:bg-muted/40 hover:text-foreground">{t("nav_agent")}</Link>}
            {auth?.user && hdr.show_maaroof && <Link to="/maaroof" onClick={close} className="rounded-md px-2 py-2 font-semibold text-primary hover:bg-muted/40">{t("auto.maaroof")}</Link>}
            {auth?.user && hdr.show_profile && <Link to="/profile" onClick={close} className="rounded-md px-2 py-2 text-muted-foreground hover:bg-muted/40 hover:text-foreground">{t("nav_profile")}</Link>}
            {hdr.show_guide && <Link to="/guide" onClick={close} className="rounded-md px-2 py-2 text-muted-foreground hover:bg-muted/40 hover:text-foreground">{t("nav_guide")}</Link>}
            {hdr.show_contact && <Link to="/contact" onClick={close} className="rounded-md px-2 py-2 text-muted-foreground hover:bg-muted/40 hover:text-foreground">{t("nav_contact")}</Link>}
            {hdr.extra_links.map((l, i) => (
              <a key={i} href={l.href} onClick={close} target={l.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer"
                className="rounded-md px-2 py-2 text-muted-foreground hover:bg-muted/40 hover:text-foreground">{linkLabel(l, lang)}</a>
            ))}
            {hdr.extra_phones.map((p, i) => (
              <a key={i} href={`tel:${p.number}`} className="rounded-md px-2 py-2 text-muted-foreground hover:bg-muted/40 hover:text-foreground">
                <Phone className="me-1 inline size-3" /> {p.display || p.number} {phoneDesc(p, lang) && <span className="text-[10px] text-muted-foreground/70">— {phoneDesc(p, lang)}</span>}
              </a>
            ))}
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
