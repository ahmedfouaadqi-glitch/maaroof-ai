import { Link } from "@tanstack/react-router";
import { Sparkles, ArrowRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";

export function SpecialtyBanner() {
  const { t } = useI18n();
  const { profile } = useAuth();
  const specialty = (profile as any)?.specialty as string | undefined;

  if (specialty) {
    return (
      <div className="rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/10 via-card/70 to-accent/10 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-primary/30 to-accent/30 text-primary">
              <Sparkles className="size-5" />
            </span>
            <div>
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{t("specialty_banner_active")}</div>
              <div className="font-display text-base font-bold text-gradient">{specialty}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{t("specialty_banner_desc")}</div>
            </div>
          </div>
          <Link to="/profile" className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-background/60 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10">
            {t("specialty_change")} <ArrowRight className="size-3" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-amber-500/20 text-amber-600">
            <Sparkles className="size-5" />
          </span>
          <div>
            <div className="font-display text-base font-bold">{t("specialty_banner_empty_title")}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{t("specialty_banner_empty_desc")}</div>
          </div>
        </div>
        <Link to="/profile" className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-primary to-accent px-4 py-2 text-xs font-semibold text-primary-foreground">
          {t("specialty_set_now")} <ArrowRight className="size-3" />
        </Link>
      </div>
    </div>
  );
}
