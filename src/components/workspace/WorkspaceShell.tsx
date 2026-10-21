import { Link, useRouterState } from "@tanstack/react-router";
import { BrainCircuit, History, Wallet, Settings, Brain, MessagesSquare, Activity, Cpu, LayoutGrid } from "lucide-react";
import type { ReactNode } from "react";

type Locale = "ar" | "en" | "ku";
export type WorkspaceTab = "main" | "history" | "balance" | "knowledge" | "interview" | "pulse" | "models" | "settings" | "more";

type NavItem = { tab?: WorkspaceTab; to?: "/profile"; icon: any; label: Record<Locale, string> };

const NAV: NavItem[] = [
  { tab: "main", icon: BrainCircuit, label: { ar: "مساحة العمل", en: "Workspace", ku: "شوێنی کار" } },
  { tab: "history", icon: History, label: { ar: "المهام السابقة", en: "Previous tasks", ku: "ئەرکە پێشووەکان" } },
  { tab: "balance", icon: Wallet, label: { ar: "الرصيد", en: "Balance", ku: "باڵانس" } },
  { tab: "knowledge", icon: Brain, label: { ar: "مساحة المعرفة", en: "Knowledge", ku: "زانیاری" } },
  { tab: "interview", icon: MessagesSquare, label: { ar: "المقابلة", en: "Interview", ku: "چاوپێکەوتن" } },
  { tab: "pulse", icon: Activity, label: { ar: "نبض حسابك", en: "Account pulse", ku: "لێدانی هەژمار" } },
  { tab: "models", icon: Cpu, label: { ar: "اختيار النماذج", en: "Models", ku: "مۆدێلەکان" } },
  { tab: "settings", icon: Settings, label: { ar: "الإعدادات", en: "Settings", ku: "ڕێکخستن" } },
];
const MORE: NavItem = { tab: "more", icon: LayoutGrid, label: { ar: "المزيد", en: "More", ku: "زیاتر" } };
export const MORE_ITEMS = NAV.slice(4);

/** Presentation-only app shell: side menu on desktop, bottom bar on phones. */
export function WorkspaceShell({ locale, tab, children }: { locale: Locale; tab: WorkspaceTab; children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="mx-auto flex max-w-7xl gap-6 px-0 md:px-6">
      <aside className="sticky top-20 hidden h-[calc(100vh-6rem)] w-56 shrink-0 flex-col gap-1 rounded-2xl border border-border bg-card/80 p-3 backdrop-blur md:flex">
        {NAV.map((n) => <NavLink key={n.tab || n.to} n={n} locale={locale} on={n.tab ? path === "/workspace" && tab === n.tab : path === n.to} compact={false} />)}
      </aside>
      <div className="min-w-0 flex-1 pb-20 md:pb-0">{children}</div>
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-card/95 backdrop-blur md:hidden">
        {[...NAV.slice(0, 4), MORE].map((n) => <NavLink key={n.tab || n.to} n={n} locale={locale} on={tab === n.tab || (n.tab === "more" && ["interview", "pulse", "models", "settings"].includes(tab))} compact />)}
      </nav>
    </div>
  );
}

export function NavLink({ n, locale, on, compact }: { n: NavItem; locale: Locale; on: boolean; compact: boolean }) {
  const Icon = n.icon;
  const cls = compact
    ? `flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-semibold ${on ? "text-primary" : "text-muted-foreground"}`
    : `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${on ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`;
  const inner = <><Icon className={compact ? "size-5" : "size-4"} /><span>{n.label[locale]}</span></>;
  if (n.to) return <Link to={n.to} className={cls}>{inner}</Link>;
  return <Link to="/workspace" search={{ tab: n.tab === "main" ? undefined : n.tab }} aria-current={on ? "page" : undefined} className={cls}>{inner}</Link>;
}

/** Formats a real elapsed duration in ms as m:ss. */
export function formatElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
