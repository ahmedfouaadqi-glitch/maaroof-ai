import { Link, useRouterState } from "@tanstack/react-router";
import { Sparkles, Share2, PanelRightClose, PanelRightOpen, BrainCircuit, History, Wallet, Settings, Brain, MessagesSquare, Activity, Cpu, LayoutGrid, Globe } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

type Locale = "ar" | "en" | "ku";
export type WorkspaceTab = "main" | "history" | "balance" | "knowledge" | "interview" | "pulse" | "models" | "settings" | "browser" | "skills" | "tools" | "extras" | "more";

type NavItem = { tab?: WorkspaceTab; to?: "/profile"; icon: any; label: Record<Locale, string> };

const NAV: NavItem[] = [
  { tab: "main", icon: BrainCircuit, label: { ar: "مساحة معروف", en: "Maaroof Space", ku: "شوێنی معروف" } },
  { tab: "tools", icon: Wrench, label: { ar: "الأدوات المباشرة", en: "Direct tools", ku: "ئامرازەکان" } },
  { tab: "history", icon: History, label: { ar: "المهام السابقة", en: "Previous tasks", ku: "ئەرکە پێشووەکان" } },
  { tab: "balance", icon: Wallet, label: { ar: "الرصيد", en: "Balance", ku: "باڵانس" } },
  { tab: "knowledge", icon: Brain, label: { ar: "مساحة المعرفة", en: "Knowledge", ku: "زانیاری" } },
  { tab: "interview", icon: MessagesSquare, label: { ar: "المقابلة", en: "Interview", ku: "چاوپێکەوتن" } },
  { tab: "pulse", icon: Activity, label: { ar: "نبض حسابك", en: "Account pulse", ku: "لێدانی هەژمار" } },
  { tab: "models", icon: Cpu, label: { ar: "اختيار النماذج", en: "Models", ku: "مۆدێلەکان" } },
  { tab: "browser", icon: Globe, label: { ar: "المتصفح المفوّض", en: "Delegated browser", ku: "وێبگەڕی ڕێگەپێدراو" } },
  { tab: "skills", icon: Sparkles, label: { ar: "المهارات", en: "Skills", ku: "کارامەییەکان" } },
  { tab: "extras", icon: Share2, label: { ar: "الإضافات", en: "Add-ons", ku: "زیادکراوەکان" } },
  { tab: "settings", icon: Settings, label: { ar: "الإعدادات", en: "Settings", ku: "ڕێکخستن" } },
];
const MORE: NavItem = { tab: "more", icon: LayoutGrid, label: { ar: "المزيد", en: "More", ku: "زیاتر" } };
export const MORE_ITEMS = NAV.slice(4);

/** Presentation-only app shell: side menu on desktop, bottom bar on phones. */
export function WorkspaceShell({ locale, tab, children, autoCollapse = false }: { locale: Locale; tab: WorkspaceTab; children: ReactNode; autoCollapse?: boolean }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [userCollapsed, setUserCollapsed] = useState(false);
  const [hover, setHover] = useState(false);
  useEffect(() => { try { setUserCollapsed(localStorage.getItem("ws-sidebar-collapsed") === "1"); } catch {} }, []);
  const toggle = () => setUserCollapsed((v) => { const n = !v; try { localStorage.setItem("ws-sidebar-collapsed", n ? "1" : "0"); } catch {} return n; });
  const collapsed = sidebarCollapsed(userCollapsed, autoCollapse) && !hover;
  return (
    <div className="mx-auto flex w-full max-w-[1600px] gap-4 px-0 md:px-4 xl:gap-6">
      <aside onMouseEnter={() => autoCollapse && !userCollapsed && setHover(true)} onMouseLeave={() => setHover(false)} className={`sticky top-20 hidden h-[calc(100vh-6rem)] shrink-0 flex-col gap-1 rounded-2xl border border-border bg-card/80 p-2 backdrop-blur transition-[width] duration-300 md:flex ${collapsed ? "w-14" : "w-56"}`}>
        <button type="button" onClick={toggle} aria-label={userCollapsed ? (locale === "en" ? "Show menu" : locale === "ku" ? "پیشاندانی لیست" : "إظهار القائمة") : (locale === "en" ? "Hide menu" : locale === "ku" ? "شاردنەوەی لیست" : "إخفاء القائمة")} title={userCollapsed ? "+" : "−"} className="mb-1 flex items-center justify-center rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
          {collapsed ? <PanelRightOpen className="size-4" /> : <PanelRightClose className="size-4" />}
        </button>
        {NAV.map((n) => <NavLink key={n.tab || n.to} n={n} locale={locale} on={n.tab ? path === "/workspace" && tab === n.tab : path === n.to} compact={false} iconOnly={collapsed} />)}
      </aside>
      <div className="min-w-0 flex-1 pb-20 md:pb-0">{children}</div>
      <nav className="fixed inset-x-3 bottom-3 z-40 flex rounded-2xl border border-border bg-card/90 shadow-lg backdrop-blur-md md:hidden">
        {[...NAV.slice(0, 4), MORE].map((n) => <NavLink key={n.tab || n.to} n={n} locale={locale} on={tab === n.tab || (n.tab === "more" && ["interview", "pulse", "models", "browser", "skills", "extras", "settings"].includes(tab))} compact />)}
      </nav>
    </div>
  );
}

export function NavLink({ n, locale, on, compact, iconOnly = false }: { n: NavItem; locale: Locale; on: boolean; compact: boolean; iconOnly?: boolean }) {
  const Icon = n.icon;
  const cls = compact
    ? `flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-semibold transition-transform active:scale-90 ${on ? "text-primary -translate-y-0.5" : "text-muted-foreground"}`
    : `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${on ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`;
  const label = n.label[locale];
  const inner = <><Icon className={`${compact ? "size-5" : "size-4"} shrink-0`} /><span className={iconOnly ? "sr-only" : "truncate"}>{label}</span></>;
  const c2 = iconOnly ? cls.replace("px-3", "justify-center px-2") : cls;
  if (n.to) return <Link to={n.to} title={iconOnly ? label : undefined} className={c2}>{inner}</Link>;
  return <Link to="/workspace" search={{ tab: n.tab === "main" ? undefined : n.tab }} title={iconOnly ? label : undefined} aria-current={on ? "page" : undefined} className={c2}>{inner}</Link>;
}

/** Formats a real elapsed duration in ms as m:ss. */
export function formatElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Sidebar is collapsed when the user chose so, or automatically while a task runs. */
export function sidebarCollapsed(userCollapsed: boolean, autoCollapse: boolean): boolean {
  return userCollapsed || autoCollapse;
}
