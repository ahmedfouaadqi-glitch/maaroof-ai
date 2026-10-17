import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { adminSetAppSetting } from "@/lib/admin.functions";
import { useI18n } from "@/lib/i18n";
import { LoaderCircle, Save, Settings2 } from "lucide-react";
import { MAAROOF_SKILLS } from "@/lib/maaroof/skill-catalog";

type Policy = { enabled: boolean; default_ui: "workbench" | "professional"; available_interfaces: Array<"workbench" | "professional">; allow_user_interface_choice: boolean; show_professional_link: boolean; allowed_modes: Array<"execution" | "recommendation" | "simulation">; show_live_engine_picker: boolean; enabled_skills: string[]; };

const DEFAULT_POLICY: Policy = { enabled: true, default_ui: "workbench", available_interfaces: ["workbench", "professional"], allow_user_interface_choice: true, show_professional_link: true, allowed_modes: ["execution", "recommendation", "simulation"], show_live_engine_picker: true, enabled_skills: MAAROOF_SKILLS.map(skill => skill.key) };

export function WorkbenchSettingsPanel() {
  const { lang } = useI18n();
  const en = lang === "en";
  const ku = lang === "ku";
  const locale = en ? "en" : ku ? "ku" : "ar";
  const [policy, setPolicy] = useState<Policy>(DEFAULT_POLICY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    supabase.from("app_settings").select("value").eq("key", "user_interface_policy").maybeSingle().then(({ data }) => {
      if (!active) return;
      if (data?.value && typeof data.value === "object") { const stored = data.value as Partial<Policy>; const available = Array.isArray(stored.available_interfaces) ? stored.available_interfaces : stored.enabled === false ? ["professional"] : ["workbench", "professional"]; setPolicy({ ...DEFAULT_POLICY, ...stored, available_interfaces: available as Policy["available_interfaces"], enabled: available.includes("workbench") }); }
      setLoading(false);
    }).catch(() => setLoading(false));
    return () => { active = false; };
  }, []);

  const label = (ar: string, enText: string, kuText: string) => en ? enText : ku ? kuText : ar;
  const toggleInterface = (name: Policy["available_interfaces"][number], checked: boolean) => setPolicy(old => { const available = checked ? [...new Set([...old.available_interfaces, name])] : old.available_interfaces.filter(item => item !== name); const default_ui = available.includes(old.default_ui) ? old.default_ui : (available[0] || old.default_ui); return { ...old, available_interfaces: available, enabled: available.includes("workbench"), default_ui, show_professional_link: available.includes("professional") && old.show_professional_link, allow_user_interface_choice: available.length > 1 && old.allow_user_interface_choice }; });
  const toggleMode = (mode: Policy["allowed_modes"][number], checked: boolean) => setPolicy(old => ({
    ...old, allowed_modes: checked ? [...new Set([...old.allowed_modes, mode])] : old.allowed_modes.filter(x => x !== mode)
  }));

  async function save() {
    setSaving(true); setMessage("");
    try {
      await adminSetAppSetting({ data: { key: "user_interface_policy", value: policy as unknown as Record<string, unknown> } });
      setMessage(label("تم حفظ إعدادات واجهة المستخدم.", "User interface settings saved.", "ڕێکخستنەکان پاشەکەوت کران."));
    } catch {
      setMessage(label("تعذر الحفظ. تحقق من صلاحيات الإدارة.", "Could not save. Check administrator permissions.", "پاشەکەوت نەکرا؛ مۆڵەتی ئەدمین بپشکنە."));
    } finally { setSaving(false); }
  }

  if (loading) return <div className="p-6 text-center"><LoaderCircle className="mx-auto size-5 animate-spin" /></div>;

  return <section className="space-y-5 rounded-2xl border border-border bg-card p-5">
    <div className="flex items-start gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Settings2 className="size-5" /></span><div><h2 className="font-semibold">{label("سياسة واجهات المستخدم", "User interface policy", "سیاسەتی ڕووکار")}</h2><p className="mt-1 text-sm text-muted-foreground">{label("تحكم في الواجهة الافتراضية، وإتاحة واجهة المحترفين، وأوضاع التشغيل التي تظهر للمستخدمين.", "Control the default interface, professional interface access, and which run modes users can select.", "ڕووکاری بنەڕەتی و دەستگەیشتنی پسپۆڕان و شێوازەکانی کار کۆنترۆڵ بکە.")}</p></div></div>
    <div className="space-y-2"><div className="text-sm font-medium">{label("الواجهات المتاحة للحسابات الحالية والجديدة", "Interfaces available to existing and new accounts", "ڕووکارە بەردەستەکان بۆ هەموو هەژمارەکان")}</div><p className="text-xs leading-5 text-muted-foreground">{label("فعّل الواجهتين معاً أو أبقِ واحدة فقط. لا تُحذف الحسابات الحالية ولا تتغير أرصدتها عند تغيير هذا الخيار.", "Enable both interfaces or keep only one. Existing accounts and balances are not deleted or changed by this setting.", "هەردوو ڕووکار چالاک بکە یان تەنیا یەکێک بهێڵەوە؛ هەژمار و باڵانسی بەکارهێنەر ناگۆڕدرێت.")}</p>{([{key:"workbench",title:label("مساحة العمل الجديدة", "Goal-first workspace", "شوێنی کاری نوێ"),desc:label("واجهة مبسطة مبنية على الأهداف والمهارات.", "Simplified interface built around goals and skills.", "ڕووکارێکی سادە بۆ ئامانج و شارەزایی.")},{key:"professional",title:label("واجهة المحترفين", "Professional interface", "ڕووکاری پسپۆڕان"),desc:label("الواجهة الحالية ذات أدوات وتحكم تفصيلي.", "Existing interface with detailed tools and controls.", "ڕووکاری هەنووکە بە ئامراز و کۆنترۆڵی ورد.")}] as const).map(item=><label key={item.key} className="flex items-start gap-3 rounded-xl border border-border p-3"><input type="checkbox" className="mt-1 size-4 accent-primary" checked={policy.available_interfaces.includes(item.key)} onChange={e=>toggleInterface(item.key,e.target.checked)}/><span><span className="block text-sm font-medium">{item.title}</span><span className="text-xs text-muted-foreground">{item.desc}</span></span></label>)}</div>
    <div className="space-y-2"><div className="text-sm font-medium">{label("الواجهة الافتراضية", "Default interface", "ڕووکاری بنەڕەتی")}</div>{([{value:"workbench",text:label("مساحة العمل الجديدة", "New workspace", "شوێنی کاری نوێ")},{value:"professional",text:label("واجهة المحترفين الحالية", "Professional interface", "ڕووکاری پسپۆڕان")}] as const).filter(x=>policy.available_interfaces.includes(x.value)).map(x=><label key={x.value} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm"><input type="radio" name="default-ui" checked={policy.default_ui===x.value} onChange={()=>setPolicy(p=>({...p,default_ui:x.value}))} className="accent-primary"/>{x.text}</label>)}</div>
    <label className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm"><input type="checkbox" checked={policy.allow_user_interface_choice && policy.available_interfaces.length > 1} disabled={policy.available_interfaces.length < 2} onChange={e=>setPolicy(p=>({...p,allow_user_interface_choice:e.target.checked}))} className="size-4 accent-primary"/>{label("السماح للمستخدم بالاختيار بين الواجهتين", "Let users choose between interfaces", "ڕێگەدان بە بەکارهێنەر بۆ هەڵبژاردنی ڕووکار")}</label>
    <div className="space-y-2"><div className="text-sm font-medium">{label("الواجهة الافتراضية", "Default interface", "ڕووکاری بنەڕەتی")}</div>{([{value:"workbench",text:label("مساحة العمل الجديدة", "New workbench", "شوێنی کاری نوێ")},{value:"professional",text:label("واجهة المحترفين الحالية", "Existing professional interface", "ڕووکاری پسپۆڕان")}] as const).map(x=><label key={x.value} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm"><input type="radio" name="default-ui" checked={policy.default_ui===x.value} onChange={()=>setPolicy(p=>({...p,default_ui:x.value}))} className="accent-primary"/>{x.text}</label>)}</div>
    <label className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm"><input type="checkbox" checked={policy.show_professional_link && policy.available_interfaces.includes("professional")} disabled={!policy.available_interfaces.includes("professional")} onChange={e=>setPolicy(p=>({...p,show_professional_link:e.target.checked}))} className="size-4 accent-primary"/>{label("إظهار رابط واجهة المحترفين للمستخدم", "Show the professional interface link", "پیشاندانی بەستەری ڕووکاری پسپۆڕان")}</label>
    <label className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm"><input type="checkbox" checked={policy.show_live_engine_picker} onChange={e=>setPolicy(p=>({...p,show_live_engine_picker:e.target.checked}))} className="size-4 accent-primary"/>{label("إظهار خيار الفحص المباشر للمحركات", "Show the live engine-check option", "پیشاندانی هەڵبژاردەی پشکنینی ڕاستەوخۆ")}</label>
    <div className="space-y-2"><div className="text-sm font-medium">{label("المهارات المتاحة للمستخدمين", "Skills available to users", "شارەزاییە بەردەستەکان بۆ بەکارهێنەران")}</div><p className="text-xs text-muted-foreground">{label("كل مهارة تجمع أدوات موجودة؛ إيقافها يخفيها من الواجهة ولا يحذف الأدوات أو يغير أسعارها.", "Each skill composes existing tools. Disabling it hides the skill without deleting tools or changing prices.", "هەر شارەزاییەک ئامرازەکانی هەنووکە کۆدەکاتەوە؛ ناچالاککردن ئامرازەکان ناسڕێتەوە.")}</p>{MAAROOF_SKILLS.map(skill=><label key={skill.key} className="flex items-start gap-3 rounded-lg border border-border px-3 py-2 text-sm"><input type="checkbox" checked={policy.enabled_skills.includes(skill.key)} onChange={e=>setPolicy(p=>({...p,enabled_skills:e.target.checked?[...new Set([...p.enabled_skills,skill.key])]:p.enabled_skills.filter(k=>k!==skill.key)}))} className="mt-1 size-4 accent-primary"/><span><span className="block font-medium">{skill.label[locale]}</span><span className="text-xs text-muted-foreground">{skill.description[locale]}</span></span></label>)}</div>
    <div className="space-y-2"><div className="text-sm font-medium">{label("أوضاع العمل المتاحة", "Available work modes", "شێوازەکانی کار")}</div>{([{key:"execution",text:label("التنفيذ الفعلي", "Execution", "جێبەجێکردن")},{key:"recommendation",text:label("الخطة والتوصية", "Plan and recommendation", "پلان و پێشنیار")},{key:"simulation",text:label("المحاكاة", "Simulation", "هاوشێوەکردن")}] as const).map(x=><label key={x.key} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm"><input type="checkbox" checked={policy.allowed_modes.includes(x.key)} onChange={e=>toggleMode(x.key,e.target.checked)} className="size-4 accent-primary"/>{x.text}</label>)}</div>
    <div className="flex flex-wrap items-center gap-3"><button type="button" disabled={saving||policy.allowed_modes.length===0||policy.available_interfaces.length===0||!policy.available_interfaces.includes(policy.default_ui)} onClick={save} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{saving?<LoaderCircle className="size-4 animate-spin"/>:<Save className="size-4"/>}{label("حفظ الإعدادات", "Save settings", "پاشەکەوتکردن")}</button>{message&&<span role="status" className="text-sm text-muted-foreground">{message}</span>}</div>
    <p className="text-xs leading-5 text-muted-foreground">{label("هذه اللوحة تحفظ سياسة الإتاحة. سيظل التحقق النهائي من الصلاحيات والكلفة من الخادم، ولا تُغيّر السياسة إعدادات أسعار الأدوات أو رصيد الحساب.", "This panel stores UI availability policy. Server-side permissions and pricing remain authoritative; this policy does not change tool prices or account balance.", "ئەمە تەنیا سیاسەتی ڕووکاری پاشەکەوت دەکات؛ مۆڵەت و نرخ لە لایەنی سێرڤەرەوە دەمێنێتەوە.")}</p>
  </section>;
}
