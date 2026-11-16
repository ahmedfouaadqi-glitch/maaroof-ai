import { useState } from "react";
import { useI18n, type Lang } from "@/lib/i18n";
import { Globe, ChevronDown } from "lucide-react";

const langs: { code: Lang; label: string; name: string }[] = [
  { code: "en", label: "EN", name: "English" },
  { code: "ar", label: "ع", name: "العربية" },
  { code: "ku", label: "ک", name: "کوردی" },
];

export function LanguageSwitcher() {
  const { lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const current = langs.find((item) => item.code === lang) ?? langs[0];

  return (
    <div className="relative">
      <button type="button" aria-label="Choose language" aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-2.5 py-2 text-xs font-semibold backdrop-blur transition hover:border-primary/40">
        <Globe className="size-3.5 text-muted-foreground" />
        <span>{current.label}</span>
        <ChevronDown className={"size-3 text-muted-foreground transition-transform " + (open ? "rotate-180" : "")} />
      </button>
      {open && (
        <div className="absolute end-0 top-full z-50 mt-2 min-w-36 overflow-hidden rounded-xl border border-border bg-card/95 p-1 shadow-xl backdrop-blur-xl">
          {langs.map((item) => (
            <button key={item.code} type="button"
              onClick={() => { setLang(item.code); setOpen(false); }}
              className={"flex w-full items-center justify-between rounded-lg px-3 py-2 text-start text-xs transition hover:bg-muted/70 " + (lang === item.code ? "bg-primary/10 font-semibold text-primary" : "text-foreground")}>
              <span>{item.name}</span><span className="font-semibold">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
