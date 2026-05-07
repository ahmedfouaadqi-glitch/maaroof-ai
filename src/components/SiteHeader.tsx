import { useI18n } from "@/lib/i18n";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Cpu } from "lucide-react";

export function SiteHeader() {
  const { t } = useI18n();
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-6">
        <a href="#" className="flex items-center gap-2">
          <div className="relative grid size-9 place-items-center rounded-lg bg-gradient-to-br from-primary to-accent shadow-[var(--shadow-glow)]">
            <Cpu className="size-5 text-primary-foreground" />
          </div>
          <div className="leading-tight">
            <div className="font-display text-base font-bold">{t("brand")}</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("ecosystem")}</div>
          </div>
        </a>
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          <a href="#features" className="hover:text-foreground">{t("nav_features")}</a>
          <a href="#how" className="hover:text-foreground">{t("nav_how")}</a>
          <a href="#cta" className="hover:text-foreground">{t("nav_pricing")}</a>
        </nav>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <a
            href="#sandbox"
            className="hidden rounded-full bg-gradient-to-r from-primary to-accent px-4 py-2 text-xs font-semibold text-primary-foreground shadow-[var(--shadow-glow)] sm:inline-block"
          >
            {t("nav_cta")}
          </a>
        </div>
      </div>
    </header>
  );
}
