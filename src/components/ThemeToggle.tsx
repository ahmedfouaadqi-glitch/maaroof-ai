import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Sun, Moon } from "lucide-react";

const KEY = "maaroof-theme";

function apply(theme: "light" | "dark") {
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

export function ThemeToggle() {
  const { t } = useI18n();
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  useEffect(() => {
    const saved = (typeof localStorage !== "undefined" && (localStorage.getItem(KEY) as "light" | "dark")) || "dark";
    setTheme(saved);
    apply(saved);
  }, []);
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    apply(next);
    try { localStorage.setItem(KEY, next); } catch {}
  };
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? t("auto.daytime") : t("auto.nightly")}
      className="inline-flex size-8 items-center justify-center rounded-full border border-border bg-background/60 text-muted-foreground hover:text-foreground"
    >
      {theme === "dark" ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
    </button>
  );
}
