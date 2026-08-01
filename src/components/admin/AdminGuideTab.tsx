import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { BookOpen, AlertTriangle, Search } from "lucide-react";
import {
  ADMIN_GROUPS, ADMIN_GUIDE_TITLE, ADMIN_GUIDE_INTRO, ADMIN_GUIDE_SEARCH,
  ADMIN_GUIDE_PURPOSE, ADMIN_GUIDE_USAGE, ADMIN_GUIDE_WARN, type L3,
} from "./admin-guide-content";

/** Full, searchable explanation of every admin group and sub-section. */
export function AdminGuideTab({ onJump }: { onJump?: (groupKey: string, subKey: string) => void }) {
  const { lang } = useI18n();
  const l = (lang === "en" || lang === "ku" ? lang : "ar") as keyof L3;
  const L = (x?: L3) => (x ? x[l] : "");
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();

  const groups = ADMIN_GROUPS.map((g) => ({
    ...g,
    subs: needle
      ? g.subs.filter((s) =>
          [L(s.label), L(s.purpose), L(s.usage), L(s.warning), L(g.label)]
            .join(" ").toLowerCase().includes(needle))
      : g.subs,
  })).filter((g) => g.subs.length > 0);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5 p-5">
        <h2 className="flex items-center gap-2 font-display text-xl font-bold text-gradient">
          <BookOpen className="size-5" /> {L(ADMIN_GUIDE_TITLE)}
        </h2>
        <p className="mt-2 text-sm text-foreground/85">{L(ADMIN_GUIDE_INTRO)}</p>
        <div className="relative mt-4">
          <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={L(ADMIN_GUIDE_SEARCH)}
            aria-label={L(ADMIN_GUIDE_SEARCH)}
            className="w-full rounded-lg border border-border bg-background/60 px-9 py-2 text-sm"
          />
        </div>
      </div>

      {groups.map((g) => (
        <section key={g.key} className="space-y-3">
          <div>
            <h3 className="font-display text-lg font-bold">{L(g.label)}</h3>
            <p className="text-sm text-muted-foreground">{L(g.desc)}</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {g.subs.map((s) => (
              <div key={s.key} className="rounded-2xl border border-border bg-card/70 p-4">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-display text-sm font-bold">{L(s.label)}</h4>
                  {onJump && (
                    <button type="button" onClick={() => onJump(g.key, s.key)} className="text-[11px] font-semibold text-primary hover:underline">
                      {L({ ar: "افتح", en: "Open", ku: "بکەرەوە" })} →
                    </button>
                  )}
                </div>
                <p className="mt-2 text-xs text-foreground/85"><b>{L(ADMIN_GUIDE_PURPOSE)}:</b> {L(s.purpose)}</p>
                <p className="mt-1 text-xs text-foreground/85"><b>{L(ADMIN_GUIDE_USAGE)}:</b> {L(s.usage)}</p>
                {s.warning && (
                  <p className="mt-2 flex items-start gap-1.5 text-xs text-destructive">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                    <span><b>{L(ADMIN_GUIDE_WARN)}:</b> {L(s.warning)}</span>
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
