import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePulseI18n } from "@/lib/pulse-i18n";
import { useAuth } from "@/lib/auth";
import { pulseAssistant } from "@/lib/pulse.functions";
import { exportPulseReport } from "@/lib/pulse-export";
import { PulseSubNav } from "@/components/PulseSubNav";

export const Route = createFileRoute("/pulse/assistant")({
  component: AssistantPage,
});

type Gov = { id: string; slug: string; name_ar: string };

function AssistantPage() {
  const { t, dir, lang } = usePulseI18n();
  let auth: ReturnType<typeof useAuth> | null = null;
  try { auth = useAuth(); } catch { /* no provider */ }
  const specialty = (auth?.profile as any)?.specialty ?? undefined;

  const ask = useServerFn(pulseAssistant);
  const [govs, setGovs] = useState<Gov[]>([]);
  const [govSlug, setGovSlug] = useState<string>("");
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    supabase.from("governorates").select("id, slug, name_ar").order("name_ar")
      .then(({ data }) => setGovs((data ?? []) as Gov[]));
  }, []);

  const handleAsk = async () => {
    if (question.trim().length < 3 || busy) return;
    setBusy(true); setError(""); setResult("");
    try {
      const r = await ask({
        data: {
          question: question.trim(),
          governorateSlug: govSlug || undefined,
          specialty,
          lang,
        },
      });
      if (r.ok) {
        setResult(r.markdown);
        if (auth?.user) {
          void supabase.from("pulse_user_behavior").insert({
            user_id: auth.user.id,
            action: "assistant_query",
            weight: 3,
          });
        }
      } else {
        setError(r.error || "AI error");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  const handleExport = () => {
    exportPulseReport({
      title: `${t("pulse_brand")} — ${t("pulse_assistant")}`,
      subtitle: question,
      lang,
      metrics: [],
      assistantMarkdown: result,
    });
  };

  return (
    <div dir={dir} className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/40 backdrop-blur">
        <div className="mx-auto max-w-7xl px-6 py-6">
          <Link to="/pulse" className="text-xs text-muted-foreground hover:text-foreground">← {t("pulse_brand")}</Link>
          <h1 className="text-3xl font-extrabold mt-1">{t("pulse_assistant")}</h1>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8 space-y-6">
        <div className="space-y-3">
          <select
            value={govSlug}
            onChange={(e) => setGovSlug(e.target.value)}
            className="w-full rounded-lg border border-border bg-card/50 px-3 py-2 text-sm"
          >
            <option value="">— كل العراق —</option>
            {govs.map((g) => <option key={g.id} value={g.slug}>{g.name_ar}</option>)}
          </select>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={4}
            placeholder={t("pulse_ask_placeholder")}
            className="w-full rounded-lg border border-border bg-card/50 px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={handleAsk}
              disabled={busy || question.trim().length < 3}
              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {busy ? t("pulse_assistant_thinking") : t("pulse_run_assistant")}
            </button>
            {result && (
              <button onClick={handleExport} className="rounded-full border border-border px-5 py-2 text-sm">
                {t("pulse_export")}
              </button>
            )}
          </div>
        </div>

        {error && <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

        {result && (
          <article className="rounded-xl border border-border bg-card/50 p-6 prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap">
            {result}
          </article>
        )}

        <footer className="border-t border-border pt-6 text-xs text-muted-foreground leading-relaxed">
          {t("pulse_disclaimer")}
        </footer>
      </main>
    </div>
  );
}
