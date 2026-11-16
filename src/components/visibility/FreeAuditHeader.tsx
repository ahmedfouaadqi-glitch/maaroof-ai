import { Link } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AnimatedLogoMark } from "@/components/AnimatedLogoMark";
import maaroofMark from "@/assets/maaroof-ai-mark.png";

/** Minimal header for the free audit: theme, language and contact only (no sign-in). */
export function FreeAuditHeader() {
  const { t, lang } = useI18n();
  const contact = lang === "ar" ? "تواصل" : lang === "ku" ? "پەیوەندی" : "Contact";
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <AnimatedLogoMark src={maaroofMark} alt="MAAROOF Ai logo" />
          <div className="leading-tight">
            <div className="truncate font-display text-sm font-bold sm:text-base" dir="ltr">Maaroof AI</div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/80">GEO AGENCY</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LanguageSwitcher />
          <Link to="/contact" className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
            <MessageCircle className="size-3.5" /><span dir={lang === "en" ? "ltr" : "rtl"}>{contact}</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
