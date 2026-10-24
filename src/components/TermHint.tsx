import type { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useI18n } from "@/lib/i18n";
import { GLOSSARY } from "@/lib/maaroof/report-sections";

/** Wraps a term with a one-line explanation from the shared glossary. */
export function TermHint({ term, children }: { term: string; children: ReactNode }) {
  const { lang } = useI18n();
  const g = GLOSSARY[term];
  if (!g) return <>{children}</>;
  const text = g[(lang === "en" || lang === "ku" ? lang : "ar") as "ar"];
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help underline decoration-dotted underline-offset-2">{children}</span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs">{text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
