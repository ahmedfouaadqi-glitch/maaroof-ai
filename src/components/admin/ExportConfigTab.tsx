import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Save, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { adminSetAppSetting, adminListExportOverrides, adminUpsertExportOverride, adminDeleteExportOverride } from "@/lib/admin.functions";
import { DEFAULT_EXPORT_CONFIG, ALL_EXPORT_FORMATS, type ExportConfig, type ExportMode, type EmailPrivacyMode } from "@/lib/content";
import { TOOL_CATALOG } from "@/lib/tool-catalog";
import { useAdminL } from "./admin-i18n";

const FORMAT_LABELS: Record<string, string> = {
  pdf: "PDF", xlsx: "Excel", csv: "CSV", docx: "Word", pptx: "PowerPoint", md: "Markdown", json: "JSON",
};

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
    formats: { ar: "الصيغ المسموحة", en: "Allowed formats", ku: "فۆرماتەکان" },
    formatsHelp: { ar: "الصيغ التي يمكن للمستخدم تحميل النتائج بها.", en: "Formats users can download results in.", ku: "" },
    footer: { ar: "التذييل والخصوصية", en: "Footer & privacy", ku: "پێپەڕ" },
    showUser: { ar: "إظهار اسم المستخدم في الملفات", en: "Show user name in exports", ku: "ناوی بەکارهێنەر" },
    showLogo: { ar: "إظهار الشعار", en: "Show logo", ku: "لۆگۆ" },
    emailPrivacy: { ar: "البريد الإلكتروني في التذييل", en: "Email in footer", ku: "ئیمەیل" },
    e_mask: { ar: "مُقنَّع — ah****f@g****.com", en: "Masked — ah****f@g****.com", ku: "داپۆشراو" },
    e_code: { ar: "رمز مختصر (غير قابل للعكس)", en: "Short code (irreversible)", ku: "کۆدی کورت" },
    e_hide: { ar: "مخفي تماماً", en: "Hidden", ku: "شاراوە" },
    users: { ar: "استثناءات لكل مستخدم", en: "Per-user exceptions", ku: "جیاکاری بەکارهێنەر" },
    usersHelp: { ar: "تجاوز السياسة العامة لحساب معيّن. اتركه فارغاً لاستخدام السياسة العامة.", en: "Override the global policy for one account.", ku: "" },
    email: { ar: "بريد المستخدم", en: "User email", ku: "ئیمەیل" },
    enabled: { ar: "التصدير مُفعَّل", en: "Exports enabled", ku: "چالاک" },
    addOverride: { ar: "حفظ الاستثناء", en: "Save exception", ku: "هەڵگرتن" },
    notFound: { ar: "لا يوجد حساب بهذا البريد.", en: "No account with this email.", ku: "نەدۆزرایەوە" },
    formatsForUser: { ar: "صيغ خاصة بهذا المستخدم (اتركها فارغة = كل الصيغ المسموحة عامةً)", en: "Formats for this user (empty = global list)", ku: "" },
  });
  const setSetting = useServerFn(adminSetAppSetting);
  const listOverrides = useServerFn(adminListExportOverrides);
  const upsertOverride = useServerFn(adminUpsertExportOverride);
  const deleteOverride = useServerFn(adminDeleteExportOverride);

  const [cfg, setCfg] = useState<ExportConfig>(DEFAULT_EXPORT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [uEmail, setUEmail] = useState("");
  const [uEnabled, setUEnabled] = useState(true);
  const [uFormats, setUFormats] = useState<string[]>([]);
  const [uBusy, setUBusy] = useState(false);
  const [uMsg, setUMsg] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "export_config").maybeSingle();
      if (data?.value) {
        const v: any = data.value;
        setCfg({
          ...DEFAULT_EXPORT_CONFIG,
          ...v,
          formats_enabled: v.formats_enabled || {},
          footer: { ...DEFAULT_EXPORT_CONFIG.footer, ...(v.footer || {}) },
        });
      }
      setLoading(false);
      try { const r: any = await listOverrides({ data: {} as any }); setRows(r?.rows || []); } catch {}
    })();
  }, []);

  const save = async () => {
    setBusy(true);
    try {
      await setSetting({ data: { key: "export_config", value: cfg as any } });
      try { localStorage.removeItem("geo-export-config-v2"); localStorage.removeItem("geo-export-config-v1"); } catch {}
      alert(L.saved);
    } finally { setBusy(false); }
  };

  const saveOverride = async () => {
    if (!uEmail.trim()) return;
    setUBusy(true); setUMsg("");
    try {
      const res: any = await upsertOverride({ data: {
        email: uEmail.trim(),
        exports_enabled: uEnabled,
        allowed_formats: uFormats,
        allowed_tools: [],
        show_user_name: null,
        email_privacy: null,
        show_logo: null,
        note: null,
      } });
      if (res?.error === "user_not_found") { setUMsg(L.notFound); return; }
      setUEmail(""); setUFormats([]); setUEnabled(true);
      const r: any = await listOverrides({ data: {} as any });
      setRows(r?.rows || []);
    } finally { setUBusy(false); }
  };

  const removeOverride = async (id: string) => {
    await deleteOverride({ data: { id } });
    const r: any = await listOverrides({ data: {} as any });
    setRows(r?.rows || []);
  };

  if (loading) return <div className="grid h-40 place-items-center"><Loader2 className="size-6 animate-spin text-primary" /></div>;

  const modes: { v: ExportMode; label: string; desc: string }[] = [
    { v: "report_only", label: L.m_report_only, desc: L.m_report_only_d },
    { v: "per_tool", label: L.m_per_tool, desc: L.m_per_tool_d },
    { v: "both", label: L.m_both, desc: L.m_both_d },
  ];

  const setPerTool = (k: string, v: boolean) =>
    setCfg({ ...cfg, per_tool_enabled: { ...cfg.per_tool_enabled, [k]: v } });
  const setFormat = (k: string, v: boolean) =>
    setCfg({ ...cfg, formats_enabled: { ...cfg.formats_enabled, [k]: v } });

  const privacyOptions: { v: EmailPrivacyMode; label: string }[] = [
    { v: "mask", label: L.e_mask }, { v: "code", label: L.e_code }, { v: "hide", label: L.e_hide },
  ];

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

      <section className="rounded-xl border border-border bg-card/60 p-4">
        <h3 className="mb-1 font-semibold">{L.formats}</h3>
        <p className="mb-3 text-xs text-muted-foreground">{L.formatsHelp}</p>
        <div className="flex flex-wrap gap-2">
          {ALL_EXPORT_FORMATS.map((f) => {
            const on = cfg.formats_enabled[f] !== false;
            return (
              <label key={f} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-xs ${on ? "border-primary bg-primary/5" : "border-border"}`}>
                <input type="checkbox" checked={on} onChange={(e) => setFormat(f, e.target.checked)} />
                {FORMAT_LABELS[f]}
              </label>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card/60 p-4">
        <h3 className="mb-3 font-semibold">{L.footer}</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={cfg.footer.show_user_name}
              onChange={(e) => setCfg({ ...cfg, footer: { ...cfg.footer, show_user_name: e.target.checked } })} />
            {L.showUser}
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={cfg.footer.show_logo}
              onChange={(e) => setCfg({ ...cfg, footer: { ...cfg.footer, show_logo: e.target.checked } })} />
            {L.showLogo}
          </label>
          <label className="text-xs">
            <div className="mb-1 text-muted-foreground">{L.emailPrivacy}</div>
            <select value={cfg.footer.email_privacy}
              onChange={(e) => setCfg({ ...cfg, footer: { ...cfg.footer, email_privacy: e.target.value as EmailPrivacyMode } })}
              className="w-full rounded-lg border border-border bg-background px-2 py-1.5">
              {privacyOptions.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
            </select>
          </label>
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

      <section className="rounded-xl border border-border bg-card/60 p-4">
        <h3 className="mb-1 font-semibold">{L.users}</h3>
        <p className="mb-3 text-xs text-muted-foreground">{L.usersHelp}</p>
        <div className="grid gap-2 md:grid-cols-3">
          <input value={uEmail} onChange={(e) => setUEmail(e.target.value)} placeholder={L.email}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={uEnabled} onChange={(e) => setUEnabled(e.target.checked)} /> {L.enabled}
          </label>
          <button onClick={saveOverride} disabled={uBusy || !uEmail.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-4 py-2 text-xs font-semibold text-primary disabled:opacity-50">
            {uBusy ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />} {L.addOverride}
          </button>
        </div>
        <div className="mt-2">
          <div className="mb-1 text-[11px] text-muted-foreground">{L.formatsForUser}</div>
          <div className="flex flex-wrap gap-2">
            {ALL_EXPORT_FORMATS.map((f) => {
              const on = uFormats.includes(f);
              return (
                <label key={f} className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] ${on ? "border-primary bg-primary/5" : "border-border"}`}>
                  <input type="checkbox" checked={on}
                    onChange={(e) => setUFormats((s) => e.target.checked ? [...s, f] : s.filter((x) => x !== f))} />
                  {FORMAT_LABELS[f]}
                </label>
              );
            })}
          </div>
        </div>
        {uMsg && <p className="mt-2 text-xs text-destructive">{uMsg}</p>}

        {rows.length > 0 && (
          <div className="mt-4 space-y-1">
            {rows.map((r) => (
              <div key={r.id} className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/40 px-3 py-1.5 text-xs">
                <span className="font-mono">{r.email}</span>
                <span className={r.exports_enabled ? "text-success" : "text-destructive"}>
                  {r.exports_enabled ? "✓" : "✕"}
                </span>
                <span className="text-muted-foreground">
                  {(Array.isArray(r.allowed_formats) && r.allowed_formats.length ? r.allowed_formats : ["*"]).join(", ")}
                </span>
                <button onClick={() => removeOverride(r.id)} className="ms-auto text-destructive hover:opacity-70">
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
