import { Sparkles, Search } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * Compact info banner shown inside each tool card.
 * Explains how the tool benefits from SGE (Generative Search Experience)
 * + classic SEO so users learn how to amplify reach.
 */
export function ToolHelpBanner({ toolKey }: { toolKey: string }) {
  const { t } = useI18n();
  // Each tool can have its own short usage hint via i18n key `help_<toolKey>`.
  const usage = t(`help_${toolKey}` as any) || t("help_default");
  return (
    <div className="mt-2 rounded-lg border border-accent/30 bg-gradient-to-br from-accent/5 to-primary/5 p-2.5 text-[11px] leading-relaxed">
      <div className="mb-1 flex flex-wrap items-center gap-2 font-semibold text-accent">
        <Sparkles className="size-3.5" /> {t("help_title")}
        <span title={t("help_sge_tooltip")} className="cursor-help text-muted-foreground">ⓘ SGE</span>
        <span title={t("help_seo_tooltip")} className="cursor-help text-muted-foreground"><Search className="inline size-3" /> SEO</span>
      </div>
      <div className="text-foreground/80">{usage}</div>
    </div>
  );
}
