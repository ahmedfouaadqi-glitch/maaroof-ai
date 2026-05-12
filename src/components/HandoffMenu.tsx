import { useEffect, useState } from "react";
import { ArrowRight, ChevronDown, Link2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { HANDOFF_LABELS, HANDOFF_TARGETS, sendHandoff, type HandoffTarget } from "@/lib/tool-handoff";

type Props = {
  source: HandoffTarget;
  /** function returning the text payload to forward (called on click) */
  getText: () => string | null | undefined;
};

/**
 * Dual-action handoff:
 *   - If user has saved an auto-link for this source, shows a primary button "Send to {target}".
 *   - Always shows a dropdown to pick any tool manually.
 */
export function HandoffMenu({ source, getText }: Props) {
  const { t, lang } = useI18n();
  const L = (lang === "en" || lang === "ku" ? lang : "ar") as "ar" | "en" | "ku";
  const { user } = useAuth();
  const [linked, setLinked] = useState<HandoffTarget | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) return;
      const { data } = await supabase.from("tool_links").select("target_tool").eq("user_id", user.id).eq("source_tool", source).maybeSingle();
      if (!cancelled) setLinked((data?.target_tool as HandoffTarget) || null);
    })();
    return () => { cancelled = true; };
  }, [user, source]);

  const fire = (target: HandoffTarget) => {
    const txt = (getText() || "").toString().trim();
    if (!txt) return;
    setOpen(false);
    sendHandoff(target, txt);
  };

  const targets = HANDOFF_TARGETS.filter((x) => x !== source);
  const label = (k: HandoffTarget) => HANDOFF_LABELS[k][L];
  const passLabel = lang === "ar" ? "تمرير إلى" : lang === "ku" ? "ناردن بۆ" : "Pass to";

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 p-2.5">
      <Link2 className="size-3.5 text-primary" />
      <span className="text-[11px] font-semibold text-primary">{passLabel}:</span>

      {linked && (
        <button onClick={() => fire(linked)} className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-primary to-accent px-3 py-1 text-[11px] font-semibold text-primary-foreground hover:scale-[1.02] transition">
          {label(linked)} <ArrowRight className="size-3" />
        </button>
      )}

      <div className="relative">
        <button onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1 rounded-full border border-border bg-background/70 px-3 py-1 text-[11px] font-medium text-foreground/80 hover:bg-background">
          {linked ? (lang === "ar" ? "أداة أخرى" : "Other") : (lang === "ar" ? "اختر أداة" : "Choose tool")}
          <ChevronDown className="size-3" />
        </button>
        {open && (
          <div className="absolute z-20 mt-1 w-52 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
            {targets.map((tg) => (
              <button key={tg} onClick={() => fire(tg)} className="block w-full px-3 py-1.5 text-start text-xs hover:bg-primary/10">
                {label(tg)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
