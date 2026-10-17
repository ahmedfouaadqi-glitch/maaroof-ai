import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MAAROOF_SKILLS, type SkillAccessMode, type SkillAccessPolicy } from "@/lib/maaroof/skill-catalog";
import { useI18n } from "@/lib/i18n";

type PolicyMaps = {
  skill_access_by_plan?: Record<string, SkillAccessPolicy>;
  skill_access_by_user?: Record<string, SkillAccessPolicy>;
};
type Props = { policy: PolicyMaps; onChange: (next: PolicyMaps) => void };

export function SkillAccessOverrides({ policy, onChange }: Props) {
  const { lang } = useI18n();
  const locale = lang === "en" || lang === "ku" ? lang : "ar";
  const [plans, setPlans] = useState<string[]>([]);
  const [users, setUsers] = useState<Array<{id:string; email:string|null; full_name:string|null}>>([]);
  const [planKey, setPlanKey] = useState("");
  const [userId, setUserId] = useState("");
  const label = (ar:string, en:string, ku:string) => locale === "en" ? en : locale === "ku" ? ku : ar;

  useEffect(() => {
    let active = true;
    Promise.all([
      supabase.from("subscription_plans").select("name").eq("active", true).order("sort_order"),
      supabase.from("profiles").select("id,email,full_name").order("email").limit(500),
    ]).then(([planResult, userResult]) => {
      if (!active) return;
      setPlans((planResult.data || []).map((row:any) => String(row.name || "")).filter(Boolean));
      setUsers((userResult.data || []) as Array<{id:string; email:string|null; full_name:string|null}>);
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  const update = (scope: "plan" | "user", scopeKey: string, skillKey: string, value: string) => {
    const field = scope === "plan" ? "skill_access_by_plan" : "skill_access_by_user";
    const map = {...(policy[field] || {})};
    const row = {...(map[scopeKey] || {})};
    if (value) row[skillKey] = value as SkillAccessMode;
    else delete row[skillKey];
    if (Object.keys(row).length) map[scopeKey] = row;
    else delete map[scopeKey];
    onChange({...policy, [field]: map});
  };

  const choices = (scope: "plan" | "user", scopeKey: string, inheritLabel: string) => MAAROOF_SKILLS.map(skill => {
    const override = (scope === "plan" ? policy.skill_access_by_plan : policy.skill_access_by_user)?.[scopeKey]?.[skill.key] || "";
    return <div key={skill.key} className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
      <span className="text-sm">{skill.label[locale]}</span>
      <select aria-label={skill.label[locale]} value={override} onChange={e=>update(scope, scopeKey, skill.key, e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs">
        <option value="">{inheritLabel}</option>
        <option value="self_service">{label("استخدام مباشر","Self-service","بەکارهێنانی ڕاستەوخۆ")}</option>
        <option value="contact">{label("اتصال بنا","Contact us","پەیوەندیمان پێوە بکە")}</option>
        <option value="disabled">{label("غير متاح","Disabled","ناچالاک")}</option>
      </select>
    </div>;
  });

  return <div className="space-y-4 rounded-xl border border-border p-4">
    <div>
      <h3 className="font-semibold text-sm">{label("استثناءات المهارات حسب الخطة","Skill overrides by plan","دەستکاری شارەزایی بەپێی پلان")}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{label("تُطبّق على المشتركين الفعّالين في الخطة المحددة. المهارات بلا استثناء ترث السياسة العامة.","Applies to active subscribers on the selected plan. Skills without overrides inherit global settings.","ئەگەر دەستکاری نەکرابێت، سیاسەتی گشتی وەردەگرێت.")}</p>
    </div>
    <select value={planKey} onChange={e=>setPlanKey(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
      <option value="">{label("اختر خطة...","Select a plan...","پلانێک هەڵبژێرە...")}</option>
      {plans.map(name=><option key={name} value={name.toLocaleLowerCase()}>{name}</option>)}
    </select>
    {planKey && choices("plan", planKey, label("يرث العام","Inherit global","گشتی وەردەگرێت"))}
    <div className="border-t border-border pt-4">
      <h3 className="font-semibold text-sm">{label("استثناءات المهارات حسب المستخدم","Skill overrides by user","دەستکاری شارەزایی بەپێی بەکارهێنەر")}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{label("استثناء المستخدم أعلى أولوية من الخطة والسياسة العامة.","User overrides take precedence over plan and global settings.","دەستکاری بەکارهێنەر لە پلان و سیاسەتی گشتی پێشترە.")}</p>
    </div>
    <select value={userId} onChange={e=>setUserId(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
      <option value="">{label("اختر مستخدماً...","Select a user...","بەکارهێنەرێک هەڵبژێرە...")}</option>
      {users.map(user=><option key={user.id} value={user.id}>{(user.full_name || user.email || user.id) + (user.email && user.full_name ? " — " + user.email : "")}</option>)}
    </select>
    {userId && choices("user", userId, label("يرث من الخطة/العام","Inherit plan/global","پلان/گشتی وەردەگرێت"))}
  </div>;
}
