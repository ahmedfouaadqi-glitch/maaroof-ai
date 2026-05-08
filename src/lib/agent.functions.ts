import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SYSTEM_ANALYZE = `أنت خبير GEO (Generative Engine Optimization) للسوق العراقي.
بالنظر إلى رابط أو موضوع، قدم:
1) ملخص (3-4 جمل بالعربية) لكيفية تحسين ظهوره في محركات البحث الذكية
2) 3 توصيات عملية محددة قابلة للتنفيذ
3) درجة GEO من 0-100
كن صادقاً ومحدداً. لا تختلق حقائق.`;

const SYSTEM_SUGGEST = `أنت كاتب محتوى GEO للسوق العراقي.
بالنظر إلى موضوع أو رابط، اكتب منشوراً اجتماعياً واحداً (60-100 كلمة) بالعربية محسّناً للاقتباس من قبل محركات البحث الذكية.
أضف 2-3 هاشتاقات. لا تختلق إحصائيات أو تواريخ.`;

const SYSTEM_AGENT = `أنت "موظف ذكي" متخصص في تحسين الظهور في محركات البحث الذكية (GEO) للسوق العراقي.
المستخدم سيعطيك أمراً أو طلباً. نفذه بشكل كامل وعملي:
- إذا طلب تحليل: قدم تحليل مفصل + توصيات
- إذا طلب اقتراح محتوى: اكتب منشورات/مقالات جاهزة للنشر
- إذا طلب خطة: قدم خطة عمل مرقمة بخطوات واضحة
- إذا طلب رأي/توصية: قدمها بشكل صريح ومسبب
ردّ دائماً بالعربية الفصحى الواضحة. كن مباشراً وعملياً. لا تختلق حقائق.`;

async function callAI(system: string, prompt: string): Promise<string> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY missing");
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: system },
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

async function getSubOrAdmin(userId: string) {
  const { data: roleRow } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  const isAdmin = !!roleRow;

  const { data: sub } = await supabaseAdmin
    .from("user_agent_subscriptions")
    .select("*, agent_addons(*)")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1).maybeSingle();

  return { sub, isAdmin };
}

async function checkAndConsume(userId: string, count = 1): Promise<void> {
  const { sub, isAdmin } = await getSubOrAdmin(userId);
  if (isAdmin) return;
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

export const runAgentNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    const x = (d || {}) as { targetId?: string };
    return { targetId: x.targetId };
  })
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const q = supabaseAdmin.from("agent_targets").select("*").eq("user_id", userId).eq("active", true);
    const { data: targets } = data.targetId ? await q.eq("id", data.targetId) : await q.limit(5);
    if (!targets || targets.length === 0) return { ok: false, error: "no_targets" };

    let done = 0; let failed = 0;
    for (const tg of targets) {
      const subject = (tg as any).url || (tg as any).topic || "";
      if (!subject) continue;
      for (const taskType of ["analyze_url", "suggest_post"] as const) {
        try {
          await checkAndConsume(userId, 1);
        } catch (e: any) {
          return { ok: done > 0, done, failed, error: e?.message || "limit" };
        }
        try {
          const content = await callAI(
            taskType === "analyze_url" ? SYSTEM_ANALYZE : SYSTEM_SUGGEST,
            subject,
          );
          let score: number | null = null;
          if (taskType === "analyze_url") {
            const m = content.match(/(\d{1,3})\s*\/\s*100/);
            if (m) score = Math.min(100, parseInt(m[1], 10));
          }
          await supabaseAdmin.from("agent_tasks").insert({
            user_id: userId, target_id: (tg as any).id, task_type: taskType,
            input: subject, status: "done", result: { summary: content, score },
          });
          done++;
        } catch (e: any) {
          await supabaseAdmin.from("agent_tasks").insert({
            user_id: userId, target_id: (tg as any).id, task_type: taskType,
            input: subject, status: "failed", error: e?.message || "error",
          });
          failed++;
        }
      }
    }
    return { ok: true, done, failed };
  });

export const runAgentCommand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    const x = (d || {}) as { command?: string };
    if (!x.command || typeof x.command !== "string" || x.command.trim().length < 3) {
      throw new Error("command_required");
    }
    return { command: x.command.trim().slice(0, 2000) };
  })
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    try {
      await checkAndConsume(userId, 1);
    } catch (e: any) {
      return { ok: false, error: e?.message || "limit" };
    }
    try {
      const content = await callAI(SYSTEM_AGENT, data.command);
      const { data: row } = await supabaseAdmin.from("agent_tasks").insert({
        user_id: userId, task_type: "command",
        input: data.command, status: "done", result: { summary: content },
      }).select("id").single();
      return { ok: true, taskId: row?.id, summary: content };
    } catch (e: any) {
      await supabaseAdmin.from("agent_tasks").insert({
        user_id: userId, task_type: "command",
        input: data.command, status: "failed", error: e?.message || "error",
      });
      return { ok: false, error: e?.message || "error" };
    }
  });
