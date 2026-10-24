import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { adminSetAppSetting } from "@/lib/admin.functions";
import { normalizeInterfacePolicy, type InterfacePolicy } from "@/lib/interface-policy";
import { useI18n } from "@/lib/i18n";
import { MAAROOF_SKILLS } from "@/lib/maaroof/skill-catalog";
import { visibleSkillKeys } from "@/lib/landing-data";

const T = {
  ar: { title: "الواجهات المتاحة للمستخدمين", access: "الواجهة المتاحة", both: "كلتاهما", ws: "الواجهة الجديدة فقط (مساحة العمل)", pro: "واجهة المحترفين فقط", def: "الواجهة الافتراضية بعد الدخول", landing: "صفحة الهبوط", lnew: "الجديدة", lold: "الكلاسيكية", link: "إظهار رابط واجهة المحترفين", skills: "المهارات المفتوحة للمستخدمين (تظهر في الصفحة الرئيسية ومساحة العمل)", save: "حفظ", saved: "تم الحفظ ويسري فوراً", wsShort: "مساحة العمل", proShort: "المحترفين" },
  en: { title: "Interfaces available to users", access: "Available interface", both: "Both", ws: "New interface only (workspace)", pro: "Professional only", def: "Default after sign-in", landing: "Landing page", lnew: "New", lold: "Classic", link: "Show professional interface link", skills: "Skills open to users (shown on the home page and workspace)", save: "Save", saved: "Saved, effective immediately", wsShort: "Workspace", proShort: "Professional" },
  ku: { title: "ڕووکارە بەردەستەکان بۆ بەکارهێنەران", access: "ڕووکاری بەردەست", both: "هەردووکیان", ws: "تەنها ڕووکاری نوێ", pro: "تەنها پسپۆڕان", def: "ڕووکاری بنەڕەت دوای چوونەژوورەوە", landing: "پەڕەی سەرەکی", lnew: "نوێ", lold: "کلاسیک", link: "پیشاندانی بەستەری پسپۆڕان", skills: "کارامەییە کراوەکان بۆ بەکارهێنەران", save: "پاشەکەوت", saved: "پاشەکەوت کرا", wsShort: "شوێنی کار", proShort: "پسپۆڕان" },
};

export function InterfacesAdminPanel() {
  const { lang } = useI18n();
  const c = T[(lang === "en" || lang === "ku" ? lang : "ar") as keyof typeof T];
  const [raw, setRaw] = useState<Record<string, any>>({});
  const [p, setP] = useState<InterfacePolicy>(normalizeInterfacePolicy(undefined));
  const [skillsOn, setSkillsOn] = useState<string[]>(MAAROOF_SKILLS.map((s) => s.key));
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("app_settings").select("value").eq("key", "user_interface_policy").maybeSingle().then(({ data }) => {
      const v = data?.value && typeof data.value === "object" ? (data.value as Record<string, any>) : {};
      setRaw(v); setP(normalizeInterfacePolicy(v)); setSkillsOn(visibleSkillKeys(v));
    });
  }, []);

  const access = p.available_interfaces.length === 2 ? "both" : p.available_interfaces[0];
  const setAccess = (a: string) => {
    const list = a === "both" ? ["workbench", "professional"] : [a];
    setP((o) => normalizeInterfacePolicy({ ...o, available_interfaces: list }));
  };

  const save = async () => {
    setSaving(true); setMsg("");
    try {
      // Keep every other key (skills, modes, per-plan access) untouched.
      await adminSetAppSetting({ data: { key: "user_interface_policy", value: { ...raw, ...p, enabled_skills: skillsOn, skill_access: Object.fromEntries(Object.entries(raw.skill_access || {}).filter(([k, m]) => !(m === "disabled" && skillsOn.includes(k)))), enabled: p.available_interfaces.includes("workbench") } } });
      setMsg(c.saved);
    } catch (e: any) { setMsg("✗ " + (e?.message || "error")); }
    setSaving(false);
  };

  const opt = "rounded-lg border px-3 py-2 text-sm text-start";
  const on = "border-primary bg-primary/10 text-primary";
  const off = "border-border text-muted-foreground";

  return (
    <div className="space-y-5 rounded-xl border border-border bg-card/40 p-5">
      <h2 className="font-display text-lg font-bold">{c.title}</h2>
      <div>
        <div className="mb-2 text-xs font-semibold text-muted-foreground">{c.access}</div>
        <div className="grid gap-2 sm:grid-cols-3">
          {[["workbench", c.ws], ["professional", c.pro], ["both", c.both]].map(([k, l]) => (
            <button key={k} onClick={() => setAccess(k)} className={`${opt} ${access === k ? on : off}`}>{l}</button>
          ))}
        </div>
      </div>
      {access === "both" && (
        <div>
          <div className="mb-2 text-xs font-semibold text-muted-foreground">{c.def}</div>
          <div className="flex gap-2">
            {[["workbench", c.wsShort], ["professional", c.proShort]].map(([k, l]) => (
              <button key={k} onClick={() => setP((o) => ({ ...o, default_ui: k as any }))} className={`${opt} ${p.default_ui === k ? on : off}`}>{l}</button>
            ))}
          </div>
        </div>
      )}
      <div>
        <div className="mb-2 text-xs font-semibold text-muted-foreground">{c.landing}</div>
        <div className="flex gap-2">
          {[["new", c.lnew], ["classic", c.lold]].map(([k, l]) => (
            <button key={k} onClick={() => setP((o) => ({ ...o, landing: k as any }))} className={`${opt} ${p.landing === k ? on : off}`}>{l}</button>
          ))}
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={p.show_professional_link} onChange={(e) => setP((o) => ({ ...o, show_professional_link: e.target.checked }))} />
        {c.link}
      </label>
      <div>
        <div className="mb-2 text-xs font-semibold text-muted-foreground">{c.skills} ({skillsOn.length}/{MAAROOF_SKILLS.length})</div>
        <div className="grid gap-2 sm:grid-cols-2">
          {MAAROOF_SKILLS.map((s) => (
            <label key={s.key} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={skillsOn.includes(s.key)} onChange={(e) => setSkillsOn((o) => e.target.checked ? [...o, s.key] : o.filter((k) => k !== s.key))} />
              {s.label[(lang === "en" || lang === "ku" ? lang : "ar") as "ar" | "en" | "ku"]}
            </label>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="rounded-full bg-gradient-to-r from-primary to-accent px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">{c.save}</button>
        {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
      </div>
    </div>
  );
}
