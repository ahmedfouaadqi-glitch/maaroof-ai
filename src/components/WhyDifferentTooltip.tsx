import { Info } from "lucide-react";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";

export function WhyDifferentTooltip() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-full border border-border bg-card/70 px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground"
      >
        <Info className="size-3" /> {t("why_diff_btn")}
      </button>
      {open && (
        <div className="absolute z-50 mt-2 w-72 rounded-xl border border-border bg-card p-3 text-[11px] leading-relaxed text-foreground/90 shadow-xl">
          <strong className="block mb-1 text-foreground">{t("why_diff_title")}</strong>
          {t("why_diff_body")}
        </div>
      )}
    </div>
  );
}
