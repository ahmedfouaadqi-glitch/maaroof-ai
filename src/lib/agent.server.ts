import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { LOVABLE_AI_CHAT_COMPLETIONS_URL, lovableAiHeaders } from "@/lib/lovable-ai";

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

export const SYSTEM_VISIBILITY = `أنت محلل ظهور علامات تجارية في محركات البحث الذكية (ChatGPT, Gemini, Perplexity, Claude).
سيُعطى لك اسم علامة تجارية وكلمات مفتاحية. حلّل بصدق كيف ستظهر هذه العلامة عند سؤال نموذج ذكي عنها في السوق العراقي.
أعد JSON صالح فقط (بدون أي نص خارجه) بهذا الشكل بالضبط:
{
  "visibility_percent": <0-100>,
  "sentiment": "positive" | "neutral" | "negative",
  "appearance_summary": "جملتان عن كيف يُحتمل أن تظهر",
  "strengths": ["...","..."],
  "weaknesses": ["...","..."],
  "competitors": ["...","..."],
  "recommendations": ["خطوة عملية 1","خطوة عملية 2","خطوة عملية 3"]
}
كن صادقاً ومتحفظاً عند نقص المعلومات. لا تختلق أرقاماً.`;

// Telegram publish helper
export async function publishToTelegram(botToken: string, chatId: string, text: string): Promise<void> {
  const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: false }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`telegram_${resp.status}: ${body.slice(0, 200)}`);
  }
}

const LANG_INSTRUCTION: Record<string, string> = {
  ar: "اكتب الإجابة بالكامل باللغة العربية الفصحى.",
  en: "Write the entire response in clear English.",
  ku: "وەڵامەکە بە تەواوی بە کوردی سۆرانی بنووسە.",
};

export async function callAI(system: string, prompt: string, lang: "ar" | "en" | "ku" = "ar"): Promise<string> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY missing");
  const sysWithLang = `${system}\n\n${LANG_INSTRUCTION[lang] || LANG_INSTRUCTION.ar}`;
  const resp = await fetch(LOVABLE_AI_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: lovableAiHeaders(apiKey),
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

function clampPercent(value: unknown): number {
  const parsed = Number.parseInt(String(value ?? 0), 10);
  if (Number.isNaN(parsed)) return 0;
  return Math.max(0, Math.min(100, parsed));
}

function normalizeTextArray(value: unknown, max = 6): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .slice(0, max)
    .map((item) => item.slice(0, 220));
}

export async function runVisibilityAnalysis(params: {
  userId: string;
  brand: string;
  keywords?: string;
  lang?: "ar" | "en" | "ku";
}) {
  const lang = params.lang === "en" || params.lang === "ku" ? params.lang : "ar";
  await checkAndConsume(params.userId, 1);

  const prompt = `العلامة التجارية: ${params.brand}\nالكلمات المفتاحية: ${params.keywords || "(غير محددة)"}\nالسوق: العراق`;
  const raw = await callAI(SYSTEM_VISIBILITY, prompt, lang);

  let parsed: any = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        parsed = null;
      }
    }
  }

  const result = {
    visibility_percent: clampPercent(parsed?.visibility_percent),
    sentiment: ["positive", "neutral", "negative"].includes(parsed?.sentiment) ? parsed.sentiment : "neutral",
    appearance_summary: String(parsed?.appearance_summary || raw || "").slice(0, 500),
    strengths: normalizeTextArray(parsed?.strengths, 5),
    weaknesses: normalizeTextArray(parsed?.weaknesses, 5),
    competitors: normalizeTextArray(parsed?.competitors, 5),
    recommendations: normalizeTextArray(parsed?.recommendations, 6),
  };

  try {
    await supabaseAdmin
      .from("profiles")
      .update({ brand_name: params.brand, brand_keywords: params.keywords || null })
      .eq("id", params.userId);
  } catch (e: any) {
    console.error("[runVisibilityAnalysis] profile update error:", e?.message || e);
  }

  const { data: row, error } = await supabaseAdmin
    .from("agent_tasks")
    .insert({
      user_id: params.userId,
      task_type: "ai_visibility",
      input: params.brand,
      status: "done",
      result: { ...result, raw, lang, keywords: params.keywords || "" },
    })
    .select("id")
    .single();

  if (error) {
    console.error("[runVisibilityAnalysis] insert error:", error.message);
  }

  return { ok: true, taskId: row?.id ?? null, result };
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
