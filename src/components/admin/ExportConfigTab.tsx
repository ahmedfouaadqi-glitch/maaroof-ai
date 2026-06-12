import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { adminSetAppSetting } from "@/lib/admin.functions";
import { DEFAULT_EXPORT_CONFIG, type ExportConfig, type ExportMode } from "@/lib/content";
import { TOOL_CATALOG } from "@/lib/tool-catalog";
import { useAdminL } from "./admin-i18n";

export function ExportConfigTab() {
  const L = useAdminL({
    title: { ar: "النمط العام للتصدير", en: "Global mode", ku: "شێوازی گشتی" },
    perTool: { ar: "تصدير لكل أداة", en: "Per-tool exports", ku: "هەناردەی هەر ئامرازێک" },
    perToolHelp: { ar: "حدّد الأدوات التي تظهر بها أزرار التصدير. (المُغلق = مخفي عن المستخدم).", en: "Toggle which tools show export buttons.", ku: "ئامرازەکان دیاری بکە." },
    save: { ar: "حفظ إعدادات التصدير", en: "Save export config", ku: "هەڵگرتن" },
    saved: { ar: "تم الحفظ.", en: "Saved.", ku: "هەڵگیرا." },
    m_report_only: { ar: "منشئ التقارير فقط", en: "Report Builder only", ku: "تەنها بنیات‌نەری ڕاپۆرت" },
    m_report_only_d: { ar: "إخفاء أزرار التصدير في الأدوات. التصدير من منشئ التقارير فقط.", en: "Hide per-tool export buttons; users export from Report Builder only.", ku: "تەنها لە ڕاپۆرت‌بەرتانە." },
    m_per_tool: { ar: "لكل أداة فقط", en: "Per-tool only", ku: "هەر ئامرازێک" },
    m_per_tool_d: { ar: "كل أداة بأزرار تصدير مستقلة. منشئ التقارير منفصل.", en: "Each tool has its own export buttons; Report Builder is independent.", ku: "" },
    m_both: { ar: "كلاهما", en: "Both", ku: "هەردووکیان" },
    m_both_d: { ar: "تصدير لكل أداة + منشئ التقارير متاحان معاً.", en: "Per-tool exports AND Report Builder are available.", ku: "" },
  });
  const setSetting = useServerFn(adminSetAppSetting);
  const [cfg, setCfg] = useState<ExportConfig>(DEFAULT_EXPORT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "export_config").maybeSingle();
      if (data?.value) setCfg({ ...DEFAULT_EXPORT_CONFIG, ...(data.value as any) });
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setBusy(true);
    try {
      await setSetting({ data: { key: "export_config", value: cfg as any } });
      try { localStorage.removeItem("geo-export-config-v1"); } catch {}
      alert(L.saved);
    } finally { setBusy(false); }
  };

  if (loading) return <div className="grid h-40 place-items-center"><Loader2 className="size-6 animate-spin text-primary" /></div>;

  const modes: { v: ExportMode; label: string; desc: string }[] = [
    { v: "report_only", label: L.m_report_only, desc: L.m_report_only_d },
    { v: "per_tool", label: L.m_per_tool, desc: L.m_per_tool_d },
    { v: "both", label: L.m_both, desc: L.m_both_d },
  ];

  const setPerTool = (k: string, v: boolean) =>
    setCfg({ ...cfg, per_tool_enabled: { ...cfg.per_tool_enabled, [k]: v } });

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-card/60 p-4">
        <h3 className="mb-3 font-semibold">{L.title}</h3>
        <div className="grid gap-2 md:grid-cols-3">
          {modes.map((m) => (
            <label key={m.v} className={`cursor-pointer rounded-lg border p-3 text-xs ${cfg.mode === m.v ? "border-primary bg-primary/5" : "border-border"}`}>
              <div className="mb-1 flex items-center gap-2">
                <input type="radio" name="mode" checked={cfg.mode === m.v} onChange={() => setCfg({ ...cfg, mode: m.v })} />
                <span className="font-semibold">{m.label}</span>
              </div>
              <p className="text-muted-foreground">{m.desc}</p>
            </label>
          ))}
        </div>
      </section>

      {cfg.mode !== "report_only" && (
        <section className="rounded-xl border border-border bg-card/60 p-4">
          <h3 className="mb-3 font-semibold">{L.perTool}</h3>
          <p className="mb-3 text-xs text-muted-foreground">{L.perToolHelp}</p>
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
            {TOOL_CATALOG.map((tool) => {
              const enabled = cfg.per_tool_enabled[tool.key] !== false;
              return (
                <label key={tool.key} className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/40 p-2 text-xs">
                  <input type="checkbox" checked={enabled} onChange={(e) => setPerTool(tool.key, e.target.checked)} />
                  <span className="font-mono text-[10px] text-muted-foreground">{tool.key}</span>
                  <span className="ms-auto">{tool.labels.en}</span>
                </label>
              );
            })}
          </div>
        </section>
      )}

      <button onClick={save} disabled={busy}
        className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-accent px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} {L.save}
      </button>
    </div>
  );
}
