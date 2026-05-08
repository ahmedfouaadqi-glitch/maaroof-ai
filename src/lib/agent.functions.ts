import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callAI, checkAndConsume, SYSTEM_AGENT, SYSTEM_ANALYZE, SYSTEM_SUGGEST } from "@/lib/agent.server";

type L = "ar" | "en" | "ku";
const normLang = (v: unknown): L => (v === "en" || v === "ku" ? v : "ar");

export const runAgentNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    const x = (d || {}) as { targetId?: string; lang?: string };
    return { targetId: x.targetId, lang: normLang(x.lang) };
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
            data.lang,
          );
          let score: number | null = null;
          if (taskType === "analyze_url") {
            const m = content.match(/(\d{1,3})\s*\/\s*100/);
            if (m) score = Math.min(100, parseInt(m[1], 10));
          }
          await supabaseAdmin.from("agent_tasks").insert({
            user_id: userId, target_id: (tg as any).id, task_type: taskType,
            input: subject, status: "done", result: { summary: content, score, lang: data.lang },
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
    const x = (d || {}) as { command?: string; lang?: string };
    if (!x.command || typeof x.command !== "string" || x.command.trim().length < 3) {
      throw new Error("command_required");
    }
    return { command: x.command.trim().slice(0, 2000), lang: normLang(x.lang) };
  })
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    try {
      await checkAndConsume(userId, 1);
    } catch (e: any) {
      return { ok: false, error: e?.message || "limit" };
    }
    try {
      const content = await callAI(SYSTEM_AGENT, data.command, data.lang);
      const { data: row } = await supabaseAdmin.from("agent_tasks").insert({
        user_id: userId, task_type: "command",
        input: data.command, status: "done", result: { summary: content, lang: data.lang },
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
