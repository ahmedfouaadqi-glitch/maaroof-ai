import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { adminSetAppSetting } from "@/lib/admin.functions";
import { useI18n } from "@/lib/i18n";
import { MAAROOF_SKILLS, type MaaroofSkillAccessMode } from "@/lib/maaroof/skill-catalog";

type Mode = MaaroofSkillAccessMode | "inherit";
type Map = Record<string, MaaroofSkillAccessMode>;

const PLANS = ["", "pro", "premium", "business", "enterprise"] as const;

const T = {
  ar: { title: "المهارات", hint: "الترتيب: الافتراضي ← العام ← الاشتراك ← المستخدم. التغيير يسري فوراً على جميع المستخدمين في مساحة العمل والتوصيات.", global: "الإعداد العام (كل المستخدمين)", plan: "حسب الاشتراك", user: "حسب المستخدم", inherit: "يرث", self_service: "متاحة", contact: "تواصل معنا", disabled: "موقوفة", free: "مجاني/تجريبي", find: "بحث بالبريد", notFound: "لا يوجد مستخدم بهذا البريد", save: "حفظ", saved: "تم الحفظ ويسري فوراً", users: "مستخدمون مخصّصون" },
  en: { title: "Skills", hint: "Order: default → global → plan → user. Changes apply immediately for every user in the workspace and recommendations.", global: "Global (all users)", plan: "By plan", user: "By user", inherit: "Inherit", self_service: "Available", contact: "Contact us", disabled: "Disabled", free: "Free/Trial", find: "Find by email", notFound: "No user with this email", save: "Save", saved: "Saved, effective immediately", users: "Customised users" },
  ku: { title: "کارامەییەکان", hint: "ڕیزبەندی: بنەڕەت ← گشتی ← بەشداریکردن ← بەکارهێنەر.", global: "گشتی", plan: "بەپێی بەشداریکردن", user: "بەپێی بەکارهێنەر", inherit: "میرات", self_service: "بەردەست", contact: "پەیوەندی", disabled: "ڕاگیراو", free: "بەخۆڕایی", find: "گەڕان بە ئیمەیڵ", notFound: "بەکارهێنەر نەدۆزرایەوە", save: "پاشەکەوت", saved: "پاشەکەوت کرا", users: "بەکارهێنەرانی تایبەت" },
};

export function SkillsAdminPanel() {
  const { lang } = useI18n();
  const l = (lang === "en" || lang === "ku" ? lang : "ar") as "ar" | "en" | "ku";
  const c = T[l];
  const [raw, setRaw] = useState<Record<string, any>>({});
  const [globalMap, setGlobal] = useState<Map>({});
  const [byPlan, setByPlan] = useState<Record<string, Map>>({});
  const [byUser, setByUser] = useState<Record<string, Map>>({});
  const [userEmails, setUserEmails] = useState<Record<string, string>>({});
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("app_settings").select("value").eq("key", "user_interface_policy").maybeSingle().then(async ({ data }) => {
      const v = data?.value && typeof data.value === "object" ? (data.value as Record<string, any>) : {};
      setRaw(v);
      setGlobal(v.skill_access || {});
      setByPlan(v.skill_access_by_plan || {});
      const bu = v.skill_access_by_user || {};
      setByUser(bu);
      const ids = Object.keys(bu);
      if (ids.length) {
        const { data: rows } = await supabase.from("profiles").select("id, email").in("id", ids);
        setUserEmails(Object.fromEntries((rows || []).map((r: any) => [r.id, r.email || r.id])));
      }
    });
  }, []);

  const setIn = (m: Map, key: string, mode: Mode): Map => {
    const n = { ...m };
    if (mode === "inherit") delete n[key]; else n[key] = mode;
    return n;
  };

  const addUser = async () => {
    setMsg("");
    const { data } = await supabase.from("profiles").select("id, email").ilike("email", email.trim()).maybeSingle();
    if (!data) { setMsg(c.notFound); return; }
    setByUser((o) => ({ ...o, [(data as any).id]: o[(data as any).id] || {} }));
    setUserEmails((o) => ({ ...o, [(data as any).id]: (data as any).email }));
    setEmail("");
  };

  const save = async () => {
    setSaving(true); setMsg("");
    try {
      const enabled = MAAROOF_SKILLS.filter((s) => globalMap[s.key] !== "disabled").map((s) => s.key);
      await adminSetAppSetting({ data: { key: "user_interface_policy", value: { ...raw, skill_access: globalMap, skill_access_by_plan: byPlan, skill_access_by_user: byUser, enabled_skills: enabled } } });
      setMsg(c.saved);
    } catch (e: any) { setMsg("✗ " + (e?.message || "error")); }
    setSaving(false);
  };

  const Picker = ({ value, onChange, allowInherit }: { value: Mode; onChange: (m: Mode) => void; allowInherit: boolean }) => (
    <select value={value} onChange={(e) => onChange(e.target.value as Mode)} className="rounded-md border border-border bg-background px-2 py-1 text-xs">
      {allowInherit && <option value="inherit">{c.inherit}</option>}
      <option value="self_service">{c.self_service}</option>
      <option value="contact">{c.contact}</option>
      <option value="disabled">{c.disabled}</option>
    </select>
  );

  const Grid = ({ map, onChange, allowInherit }: { map: Map; onChange: (k: string, m: Mode) => void; allowInherit: boolean }) => (
    <div className="grid gap-2 sm:grid-cols-2">
      {MAAROOF_SKILLS.map((s) => (
        <div key={s.key} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm">
          <span>{s.label[l]}</span>
          <Picker value={(map[s.key] as Mode) || (allowInherit ? "inherit" : "self_service")} onChange={(m) => onChange(s.key, m)} allowInherit={allowInherit} />
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-6 rounded-xl border border-border bg-card/40 p-5">
      <div>
        <h2 className="font-display text-lg font-bold">{c.title}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{c.hint}</p>
      </div>
      <section>
        <h3 className="mb-2 text-sm font-semibold">{c.global}</h3>
        <Grid map={globalMap} allowInherit={false} onChange={(k, m) => setGlobal((o) => setIn(o, k, m))} />
      </section>
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">{c.plan}</h3>
        {PLANS.map((p) => (
          <details key={p || "free"} className="rounded-lg border border-border/60 p-3">
            <summary className="cursor-pointer text-sm">{p ? p.toUpperCase() : c.free}</summary>
            <div className="mt-3"><Grid map={byPlan[p] || {}} allowInherit onChange={(k, m) => setByPlan((o) => ({ ...o, [p]: setIn(o[p] || {}, k, m) }))} /></div>
          </details>
        ))}
      </section>
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">{c.user}</h3>
        <div className="flex gap-2">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" dir="ltr" className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm" />
          <button onClick={addUser} disabled={!email.trim()} className="rounded-md border border-primary/40 px-3 py-1.5 text-xs text-primary disabled:opacity-50">{c.find}</button>
        </div>
        {Object.keys(byUser).map((id) => (
          <details key={id} className="rounded-lg border border-border/60 p-3" open>
            <summary className="cursor-pointer text-sm" dir="ltr">{userEmails[id] || id}</summary>
            <div className="mt-3"><Grid map={byUser[id] || {}} allowInherit onChange={(k, m) => setByUser((o) => ({ ...o, [id]: setIn(o[id] || {}, k, m) }))} /></div>
            <button onClick={() => setByUser((o) => { const n = { ...o }; delete n[id]; return n; })} className="mt-2 text-xs text-destructive">✕</button>
          </details>
        ))}
      </section>
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="rounded-full bg-gradient-to-r from-primary to-accent px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">{c.save}</button>
        {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
      </div>
    </div>
  );
}
