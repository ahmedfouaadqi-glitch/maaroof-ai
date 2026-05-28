import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePulseI18n } from "@/lib/pulse-i18n";

export const Route = createFileRoute("/pulse/sources")({
  component: SourcesPage,
});

type Src = {
  id: string; key: string; name_ar: string; name_en: string; url: string;
  active: boolean; last_success_at: string | null;
};

function SourcesPage() {
  const { t, dir } = usePulseI18n();
  const [sources, setSources] = useState<Src[]>([]);

  useEffect(() => {
    supabase.from("pulse_sources").select("id, key, name_ar, name_en, url, active, last_success_at").order("name_ar")
      .then(({ data }) => setSources((data ?? []) as Src[]));
  }, []);

  return (
    <div dir={dir} className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/40 backdrop-blur">
        <div className="mx-auto max-w-7xl px-6 py-6">
          <Link to="/pulse" className="text-xs text-muted-foreground hover:text-foreground">← {t("pulse_brand")}</Link>
          <h1 className="text-3xl font-extrabold mt-1">{t("pulse_sources")}</h1>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8 space-y-4">
        <ul className="space-y-2">
          {sources.map((s) => (
            <li key={s.id} className="rounded-xl border border-border bg-card/50 p-4 flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="font-bold">{s.name_ar}</div>
                <div className="text-xs text-muted-foreground">{s.name_en}</div>
                <a href={s.url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline break-all">{s.url}</a>
              </div>
              <div className="text-end">
                <div className={`text-xs ${s.active ? "text-green-500" : "text-muted-foreground"}`}>
                  {s.active ? "نشط" : "موقوف"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t("pulse_last_updated")}: {s.last_success_at ? new Date(s.last_success_at).toLocaleString() : "—"}
                </div>
              </div>
            </li>
          ))}
        </ul>

        <footer className="border-t border-border pt-6 text-xs text-muted-foreground leading-relaxed">
          {t("pulse_disclaimer")}
        </footer>
      </main>
    </div>
  );
}
