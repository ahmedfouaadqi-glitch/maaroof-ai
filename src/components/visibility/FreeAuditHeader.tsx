import { Link } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { AnimatedLogoMark } from "@/components/AnimatedLogoMark";
import maaroofMark from "@/assets/maaroof-ai-mark.png";

/** Minimal header for the campaign page: logo, language, sign out only. */
export function FreeAuditHeader() {
  const { t, lang } = useI18n();
  const { user, signOut } = useAuth();
  const out = lang === "ar" ? "خروج" : lang === "ku" ? "دەرچوون" : "Sign out";
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <Link to="/" className="flex min-w-0 items-center gap-2">
          <AnimatedLogoMark src={maaroofMark} alt="MAAROOF Ai logo" />
          <div className="leading-tight">
            <div className="truncate font-display text-sm font-bold sm:text-base">{t("brand")}</div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/80">GEO AGENCY</div>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          {user && (
            <button onClick={() => signOut()} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
              <LogOut className="size-3.5" />{out}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
