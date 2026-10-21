import { Link, useRouterState } from "@tanstack/react-router";
import { BrainCircuit, Bot, Sparkles, Wallet, Settings, BookOpen } from "lucide-react";
import type { ReactNode } from "react";

type Locale = "ar" | "en" | "ku";

const NAV = [
  { to: "/workspace", icon: BrainCircuit, label: { ar: "مساحة العمل", en: "Workspace", ku: "شوێنی کار" } },
  { to: "/maaroof", icon: Bot, label: { ar: "معروف", en: "Maaroof", ku: "مەعروف" } },
  { to: "/workspace#skills", icon: Sparkles, label: { ar: "المهارات", en: "Skills", ku: "تواناکان" } },
  { to: "/pricing", icon: Wallet, label: { ar: "الرصيد", en: "Balance", ku: "باڵانس" } },
  { to: "/guide", icon: BookOpen, label: { ar: "الدليل", en: "Guide", ku: "ڕێبەر" } },
  { to: "/profile", icon: Settings, label: { ar: "الإعدادات", en: "Settings", ku: "ڕێکخستن" } },
] as const;

/** Presentation-only app shell: side menu on desktop, bottom bar on phones. */
export function WorkspaceShell({ locale, children }: { locale: Locale; children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const item = (n: (typeof NAV)[number], compact: boolean) => {
    const Icon = n.icon;
    const [to, hash] = n.to.split("#");
    const on = path === to && !hash;
    return (
      <Link
        key={n.to}
        to={to as "/workspace"}
        hash={hash}
        aria-current={on ? "page" : undefined}
        className={compact
          ? `flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-semibold ${on ? "text-primary" : "text-muted-foreground"}`
          : `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${on ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
      >
        <Icon className={compact ? "size-5" : "size-4"} />
        <span>{n.label[locale]}</span>
      </Link>
    );
  };
  return (
    <div className="mx-auto flex max-w-7xl gap-6 px-0 md:px-6">
      <aside className="sticky top-20 hidden h-[calc(100vh-6rem)] w-56 shrink-0 flex-col gap-1 rounded-2xl border border-border bg-card/80 p-3 backdrop-blur md:flex">
        {NAV.map((n) => item(n, false))}
      </aside>
      <div className="min-w-0 flex-1 pb-20 md:pb-0">{children}</div>
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-card/95 backdrop-blur md:hidden">
        {NAV.filter((n) => n.to !== "/guide").slice(0, 5).map((n) => item(n, true))}
      </nav>
    </div>
  );
}

/** Formats a real elapsed duration in ms as m:ss. */
export function formatElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
