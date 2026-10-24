import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { HelpCircle, ChevronDown, AlertTriangle } from "lucide-react";
import {
  findSub, ADMIN_HELP_LABEL, ADMIN_HELP_MORE, ADMIN_GUIDE_USAGE, ADMIN_GUIDE_WARN, type L3,
} from "./admin-guide-content";

function useL() {
  const { lang } = useI18n();
  const l = (lang === "en" || lang === "ku" ? lang : "ar") as keyof L3;
  return (x?: L3) => (x ? x[l] : "");
}

/** Collapsible one-line explainer shown above every admin sub-section. */
export function AdminSectionHelp({ subKey, onOpenGuide }: { subKey: string; onOpenGuide?: () => void }) {
  const L = useL();
  const [open, setOpen] = useState(false);
  const hit = findSub(subKey);
  if (!hit) return null;
  const { sub } = hit;

  return (
    <div className="mb-4 rounded-xl border border-primary/25 bg-primary/5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-start text-xs font-semibold text-primary"
      >
        <HelpCircle className="size-3.5 shrink-0" />
        <span className="truncate">{L(sub.purpose) || L(ADMIN_HELP_LABEL)}</span>
        <ChevronDown className={`ms-auto size-3.5 shrink-0 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="space-y-2 border-t border-primary/20 px-3 py-2 text-xs text-foreground/85">
          <div><b>{L(ADMIN_GUIDE_USAGE)}:</b> {L(sub.usage)}</div>
          {sub.warning && (
            <div className="flex items-start gap-1.5 text-destructive">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span><b>{L(ADMIN_GUIDE_WARN)}:</b> {L(sub.warning)}</span>
            </div>
          )}
          {onOpenGuide && (
            <button type="button" onClick={onOpenGuide} className="text-primary hover:underline">
              {L(ADMIN_HELP_MORE)} →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
