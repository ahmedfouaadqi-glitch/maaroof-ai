import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TOOL_CATALOG } from "@/lib/tool-catalog";
import type { SkillAccessMode, SkillAccessPolicy } from "@/lib/maaroof/skill-catalog";
import { useI18n } from "@/lib/i18n";

type PolicyMaps = {
  tool_access?: SkillAccessPolicy;
  tool_access_by_plan?: Record<string, SkillAccessPolicy>;
  tool_access_by_user?: Record<string, SkillAccessPolicy>;
};
type Props = { policy: PolicyMaps; onChange: (next: PolicyMaps) => void };

export function ToolAccessOverrides({ policy, onChange }: Props) {
  const { lang } = useI18n();
  const locale = lang === "en" || lang === "ku" ? lang : "ar";
  const [plans, setPlans] = useState<string[]>([]);
  const [users, setUsers] = useState<Array<{id:string; email:string|null; full_name:string|null}>>([]);
  const [planKey, setPlanKey] = useState("");
  const [userId, setUserId] = useState("");
  const label = (ar:string, en:string, ku:string) => locale === "en" ? en : locale === "ku" ? ku : ar;
  const tools = TOOL_CATALOG.filter(tool => tool.group === "tools");

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

  const update = (scope: "global" | "plan" | "user", scopeKey: string, toolKey: string, value: string) => {
    const field = scope === "global" ? "tool_access" : scope === "plan" ? "tool_access_by_plan" : "tool_access_by_user";
    if (scope === "global") {
      const row = {...(policy.tool_access || {})};
      if (value) row[toolKey] = value as SkillAccessMode; else delete row[toolKey];
      onChange({...policy, tool_access: row});
      return;
    }
    const map = {...((scope === "plan" ? policy.tool_access_by_plan : policy.tool_access_by_user) || {})};
    const row = {...(map[scopeKey] || {})};
    if (value) row[toolKey] = value as SkillAccessMode; else delete row[toolKey];
    if (Object.keys(row).length) map[scopeKey] = row; else delete map[scopeKey];
    onChange({...policy, [field]: map});
  };

  const rows = (scope: "global" | "plan" | "user", scopeKey: string, current: SkillAccessPolicy, inheritLabel: string) =>
    tools.map(tool => <div key={tool.key} className="flex flex-wrap items-center justify-between gap-2 border-t border-border py-2">
      <span className="text-sm">{tool.labels[locale]}</span>
      <select aria-label={tool.labels[locale]} value={current[tool.key] || ""} onChange={e=>update(scope, scopeKey, tool.key, e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs">
        <option value="">{inheritLabel}</option>
        <option value="self_service">{label("ترخيص للاستخدام المباشر","Self-service license","بەکارهێنانی ڕاستەوخۆ")}</option>
        <option value="contact">{label("يتطلب الاتصال بنا","Contact us","پەیوەندیمان پێوە بکە")}</option>
        <option value="disabled">{label("غير متاحة","Disabled","ناچالاک")}</option>
      </select>
    </div>);

  return <div className="space-y-4 rounded-xl border border-border p-4">
    <div>
      <h3 className="font-semibold text-sm">{label("سياسة ترخيص الأدوات","Tool licensing policy","سیاسەتی مۆڵەتی ئامرازەکان")}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{label("هذه السياسة تُفحص على الخادم قبل احتساب الرصيد، حتى عند استدعاء نقطة الأداة مباشرة. استثناءات المستخدم ثم الخطة ثم السياسة العامة.", "This policy is enforced server-side before token metering, including direct tool API calls. Precedence: user, plan, global.", "ئەم سیاسەتە لە سێرڤەر پێش ژماردنی تۆکن جێبەجێ دەکرێت.")}</p>
    </div>
    <details>
      <summary className="cursor-pointer text-sm font-medium">{label("الإعداد العام لكل أداة","Global defaults per tool","ڕێکخستنی گشتی بۆ هەر ئامرازێک")}</summary>
      <div className="mt-3">{rows("global","",policy.tool_access || {},label("يرث السلوك الافتراضي","Use default","بنەڕەتی"))}</div>
    </details>
    <div className="border-t border-border pt-3">
      <h3 className="text-sm font-medium">{label("استثناءات الخطة","Plan overrides","دەستکاری پلان")}</h3>
      <select value={planKey} onChange={e=>setPlanKey(e.target.value)} className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
        <option value="">{label("اختر خطة...","Select a plan...","پلانێک هەڵبژێرە...")}</option>
        {plans.map(name=><option key={name} value={name.toLocaleLowerCase()}>{name}</option>)}
      </select>
      {planKey && <div className="mt-3">{rows("plan",planKey,policy.tool_access_by_plan?.[planKey] || {},label("يرث الإعداد العام","Inherit global","گشتی وەردەگرێت"))}</div>}
    </div>
    <div className="border-t border-border pt-3">
      <h3 className="text-sm font-medium">{label("استثناءات المستخدم","User overrides","دەستکاری بەکارهێنەر")}</h3>
      <select value={userId} onChange={e=>setUserId(e.target.value)} className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
        <option value="">{label("اختر مستخدماً...","Select a user...","بەکارهێنەرێک هەڵبژێرە...")}</option>
        {users.map(user=><option key={user.id} value={user.id}>{(user.full_name || user.email || user.id) + (user.email && user.full_name ? " — " + user.email : "")}</option>)}
      </select>
      {userId && <div className="mt-3">{rows("user",userId,policy.tool_access_by_user?.[userId] || {},label("يرث من الخطة/العام","Inherit plan/global","پلان/گشتی وەردەگرێت"))}</div>}
    </div>
  </div>;
}
