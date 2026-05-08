import { Languages } from "lucide-react";
import { useI18n, type Lang } from "@/lib/i18n";

const LABELS: Record<Lang, string> = { en: "English", ar: "العربية", ku: "کوردی" };

export function ToolLangSelect({
  value,
  onChange,
  className = "",
}: {
  value: Lang;
  onChange: (l: Lang) => void;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <div className={`flex items-center gap-2 text-xs ${className}`}>
      <Languages className="size-3.5 text-primary" />
      <span className="text-muted-foreground">{t("tool_output_lang")}:</span>
      <div className="flex rounded-full border border-border bg-background/40 p-0.5">
        {(["en", "ar", "ku"] as Lang[]).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => onChange(l)}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
              value === l
                ? "bg-gradient-to-r from-primary to-accent text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {LABELS[l]}
          </button>
        ))}
      </div>
    </div>
  );
}
