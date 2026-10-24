import { useI18n, type Lang } from "@/lib/i18n";
import { Globe } from "lucide-react";

const langs: { code: Lang; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "ar", label: "ع" },
  { code: "ku", label: "ک" },
];

export function LanguageSwitcher() {
  const { lang, setLang } = useI18n();
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-border bg-card/60 p-1 backdrop-blur">
      <Globe className="ms-2 size-3.5 text-muted-foreground" />
      {langs.map((l) => (
        <button
          key={l.code}
          onClick={() => setLang(l.code)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition ${
            lang === l.code
              ? "bg-primary text-primary-foreground shadow"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
