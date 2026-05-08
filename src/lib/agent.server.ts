import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const SYSTEM_ANALYZE = `أنت خبير GEO (Generative Engine Optimization) للسوق العراقي.
بالنظر إلى رابط أو موضوع، قدم:
1) ملخص (3-4 جمل بالعربية) لكيفية تحسين ظهوره في محركات البحث الذكية
2) 3 توصيات عملية محددة قابلة للتنفيذ
3) درجة GEO من 0-100
كن صادقاً ومحدداً. لا تختلق حقائق.`;

export const SYSTEM_SUGGEST = `أنت كاتب محتوى GEO للسوق العراقي.
بالنظر إلى موضوع أو رابط، اكتب منشوراً اجتماعياً واحداً (60-100 كلمة) بالعربية محسّناً للاقتباس من قبل محركات البحث الذكية.
أضف 2-3 هاشتاقات. لا تختلق إحصائيات أو تواريخ.`;

export const SYSTEM_AGENT = `أنت "موظف ذكي" متخصص في تحسين الظهور في محركات البحث الذكية (GEO) للسوق العراقي.
المستخدم سيعطيك أمراً أو طلباً. نفذه بشكل كامل وعملي:
- إذا طلب تحليل: قدم تحليل مفصل + توصيات
- إذا طلب اقتراح محتوى: اكتب منشورات/مقالات جاهزة للنشر
- إذا طلب خطة: قدم خطة عمل مرقمة بخطوات واضحة
- إذا طلب رأي/توصية: قدمها بشكل صريح ومسبب
ردّ دائماً بالعربية الفصحى الواضحة. كن مباشراً وعملياً. لا تختلق حقائق.`;

const LANG_INSTRUCTION: Record<string, string> = {
  ar: "اكتب الإجابة بالكامل باللغة العربية الفصحى.",
  en: "Write the entire response in clear English.",
  ku: "وەڵامەکە بە تەواوی بە کوردی سۆرانی بنووسە.",
};

export async function callAI(system: string, prompt: string, lang: "ar" | "en" | "ku" = "ar"): Promise<string> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY missing");
  const sysWithLang = `${system}\n\n${LANG_INSTRUCTION[lang] || LANG_INSTRUCTION.ar}`;
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: sysWithLang },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (resp.status === 429) throw new Error("rate_limited");
  if (resp.status === 402) throw new Error("credits_exhausted");
  if (!resp.ok) throw new Error(`ai_${resp.status}`);
  const data = await resp.json();
  return data?.choices?.[0]?.message?.content || "";
}

export async function checkAndConsume(userId: string, count = 1): Promise<void> {
  const { data: roleRow } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (roleRow) return;

  const { data: sub } = await supabaseAdmin
    .from("user_agent_subscriptions")
    .select("*, agent_addons(*)")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1).maybeSingle();

  if (!sub) throw new Error("no_active_subscription");
  const addon = (sub as any).agent_addons;
  if (!addon) throw new Error("no_addon");
  if (sub.expires_at && new Date(sub.expires_at) < new Date()) throw new Error("subscription_expired");
  if (sub.tasks_used + count > addon.monthly_tasks) throw new Error("monthly_cap_reached");
  const today = new Date().toISOString().slice(0, 10);
  const dailyUsed = sub.last_run_date === today ? sub.tasks_used_today : 0;
  if (dailyUsed + count > addon.daily_task_cap) throw new Error("daily_cap_reached");
  await supabaseAdmin.from("user_agent_subscriptions").update({
    tasks_used: sub.tasks_used + count,
    tasks_used_today: dailyUsed + count,
    last_run_date: today,
  }).eq("id", sub.id);
}
