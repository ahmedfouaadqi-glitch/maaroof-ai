import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Save, Plus, Trash2, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { adminSetAppSetting } from "@/lib/admin.functions";
import { adminAutoTranslate } from "@/lib/cms.functions";
import {
  DEFAULT_HEADER_CONFIG, type HeaderConfig, type ExtraLink, type ExtraPhone,
} from "@/lib/content";

export function HeaderConfigTab() {
  const setSetting = useServerFn(adminSetAppSetting);
  const translate = useServerFn(adminAutoTranslate);
  const [cfg, setCfg] = useState<HeaderConfig>(DEFAULT_HEADER_CONFIG);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "header_config").maybeSingle();
      if (data?.value) setCfg({ ...DEFAULT_HEADER_CONFIG, ...(data.value as any) });
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setBusy(true);
    try {
      await setSetting({ data: { key: "header_config", value: cfg as any } });
      try { localStorage.removeItem("geo-header-config-v1"); } catch {}
      alert("Saved. Refresh the page to see header changes.");
    } finally { setBusy(false); }
  };

  const autoTr = async (text: string, source: "ar" | "en" | "ku", targets: ("ar" | "en" | "ku")[]) => {
    const r = await translate({ data: { text, sourceLang: source, targetLangs: targets } });
    return r.translations as Record<string, string>;
  };

  const addLink = () => setCfg({ ...cfg, extra_links: [...cfg.extra_links, { href: "/", label_ar: "", label_en: "", label_ku: "" }] });
  const updateLink = (i: number, p: Partial<ExtraLink>) =>
    setCfg({ ...cfg, extra_links: cfg.extra_links.map((l, j) => j === i ? { ...l, ...p } : l) });
  const removeLink = (i: number) => setCfg({ ...cfg, extra_links: cfg.extra_links.filter((_, j) => j !== i) });

  const addPhone = () => setCfg({ ...cfg, extra_phones: [...cfg.extra_phones, { number: "", display: "", desc_ar: "", desc_en: "", desc_ku: "" }] });
  const updatePhone = (i: number, p: Partial<ExtraPhone>) =>
    setCfg({ ...cfg, extra_phones: cfg.extra_phones.map((l, j) => j === i ? { ...l, ...p } : l) });
  const removePhone = (i: number) => setCfg({ ...cfg, extra_phones: cfg.extra_phones.filter((_, j) => j !== i) });

  if (loading) return <div className="grid h-40 place-items-center"><Loader2 className="size-6 animate-spin text-primary" /></div>;

  const Toggles: { key: keyof HeaderConfig; label: string }[] = [
    { key: "show_pricing", label: "Show Pricing" },
    { key: "show_agent", label: "Show Agent" },
    { key: "show_dashboard", label: "Show Dashboard" },
    { key: "show_profile", label: "Show Profile" },
    { key: "show_guide", label: "Show Guide" },
    { key: "show_contact", label: "Show Contact" },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-card/60 p-4">
        <h3 className="mb-3 font-semibold">Header visibility</h3>
        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
          {Toggles.map((t) => (
            <label key={t.key} className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/40 p-2 text-xs">
              <input type="checkbox" checked={(cfg as any)[t.key]} onChange={(e) => setCfg({ ...cfg, [t.key]: e.target.checked })} />
              {t.label}
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card/60 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">Extra navigation links</h3>
          <button onClick={addLink} className="inline-flex items-center gap-1 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary"><Plus className="size-3.5" /> Add</button>
        </div>
        <div className="space-y-3">
          {cfg.extra_links.map((l, i) => (
            <div key={i} className="grid gap-2 rounded-lg border border-border/60 p-3 sm:grid-cols-5">
              <input value={l.href} onChange={(e) => updateLink(i, { href: e.target.value })} placeholder="/path or https://…"
                className="rounded border border-border bg-background/60 p-1.5 text-xs sm:col-span-2" />
              <input value={l.label_ar} onChange={(e) => updateLink(i, { label_ar: e.target.value })} placeholder="AR" dir="rtl"
                className="rounded border border-border bg-background/60 p-1.5 text-xs" />
              <input value={l.label_en} onChange={(e) => updateLink(i, { label_en: e.target.value })} placeholder="EN"
                className="rounded border border-border bg-background/60 p-1.5 text-xs" />
              <div className="flex gap-1">
                <input value={l.label_ku} onChange={(e) => updateLink(i, { label_ku: e.target.value })} placeholder="KU" dir="rtl"
                  className="flex-1 rounded border border-border bg-background/60 p-1.5 text-xs" />
                <button title="Auto-translate from EN" onClick={async () => {
                  if (!l.label_en && !l.label_ar) return;
                  const src = l.label_en ? "en" : "ar";
                  const targets = (["ar", "en", "ku"] as const).filter((x) => x !== src && !(l as any)[`label_${x}`]);
                  if (!targets.length) return;
                  const out = await autoTr((l as any)[`label_${src}`], src as any, targets as any);
                  const patch: any = {};
                  for (const k of Object.keys(out)) patch[`label_${k}`] = out[k];
                  updateLink(i, patch);
                }} className="rounded p-1 text-accent hover:bg-accent/10"><Wand2 className="size-3.5" /></button>
                <button onClick={() => removeLink(i)} className="rounded p-1 text-destructive hover:bg-destructive/10"><Trash2 className="size-3.5" /></button>
              </div>
            </div>
          ))}
          {cfg.extra_links.length === 0 && <p className="text-xs text-muted-foreground">No extra links.</p>}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card/60 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">Extra contact phones</h3>
          <button onClick={addPhone} className="inline-flex items-center gap-1 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary"><Plus className="size-3.5" /> Add</button>
        </div>
        <div className="space-y-3">
          {cfg.extra_phones.map((p, i) => (
            <div key={i} className="grid gap-2 rounded-lg border border-border/60 p-3 sm:grid-cols-6">
              <input value={p.number} onChange={(e) => updatePhone(i, { number: e.target.value })} placeholder="Digits only e.g. 9647…"
                className="rounded border border-border bg-background/60 p-1.5 text-xs" />
              <input value={p.display} onChange={(e) => updatePhone(i, { display: e.target.value })} placeholder="+964 7xx xxx"
                className="rounded border border-border bg-background/60 p-1.5 text-xs" />
              <input value={p.desc_ar} onChange={(e) => updatePhone(i, { desc_ar: e.target.value })} placeholder="Desc AR" dir="rtl"
                className="rounded border border-border bg-background/60 p-1.5 text-xs" />
              <input value={p.desc_en} onChange={(e) => updatePhone(i, { desc_en: e.target.value })} placeholder="Desc EN"
                className="rounded border border-border bg-background/60 p-1.5 text-xs" />
              <input value={p.desc_ku} onChange={(e) => updatePhone(i, { desc_ku: e.target.value })} placeholder="Desc KU" dir="rtl"
                className="rounded border border-border bg-background/60 p-1.5 text-xs" />
              <div className="flex gap-1">
                <button title="Auto-translate desc" onClick={async () => {
                  const src = p.desc_en ? "en" : p.desc_ar ? "ar" : null;
                  if (!src) return;
                  const targets = (["ar", "en", "ku"] as const).filter((x) => x !== src && !(p as any)[`desc_${x}`]);
                  if (!targets.length) return;
                  const out = await autoTr((p as any)[`desc_${src}`], src as any, targets as any);
                  const patch: any = {};
                  for (const k of Object.keys(out)) patch[`desc_${k}`] = out[k];
                  updatePhone(i, patch);
                }} className="rounded p-1 text-accent hover:bg-accent/10"><Wand2 className="size-3.5" /></button>
                <button onClick={() => removePhone(i)} className="rounded p-1 text-destructive hover:bg-destructive/10"><Trash2 className="size-3.5" /></button>
              </div>
            </div>
          ))}
          {cfg.extra_phones.length === 0 && <p className="text-xs text-muted-foreground">No extra phones.</p>}
        </div>
      </section>

      <button onClick={save} disabled={busy}
        className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-accent px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save header config
      </button>
    </div>
  );
}
