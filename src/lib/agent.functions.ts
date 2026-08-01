import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callAI, checkAndConsume, publishToTelegram, publishToLinkedIn, SYSTEM_AGENT, SYSTEM_ANALYZE, SYSTEM_SUGGEST } from "@/lib/agent.server";
import { notifyUser } from "@/lib/notify.server";

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
    const runId = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`) as string;
    const runStartedAt = new Date().toISOString();
    const q = supabaseAdmin.from("agent_targets").select("*").eq("user_id", userId).eq("active", true);
    const { data: targets } = data.targetId ? await q.eq("id", data.targetId) : await q.limit(5);
    if (!targets || targets.length === 0) return { ok: false, error: "no_targets", runId };

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
          const { data: ins } = await supabaseAdmin.from("agent_tasks").insert({
            user_id: userId, target_id: (tg as any).id, task_type: taskType,
            input: subject, status: "done",
            result: { summary: content, score, lang: data.lang },
            approval_status: taskType === "suggest_post" ? "pending" : "none",
            run_id: runId, run_started_at: runStartedAt,
          }).select("id").single();
          const tid = (ins as any)?.id as string | undefined;
          done++;

          if (taskType === "suggest_post" && tid) {
            // Try auto-publish to any channel in 'auto' mode
            const { data: autoChans } = await supabaseAdmin
              .from("publish_channels").select("*")
              .eq("user_id", userId).eq("approval_mode", "auto").eq("active", true)
              .not("verified_at", "is", null);
            let published = false;
            for (const ch of autoChans || []) {
              try {
                const { publishToSavedChannel } = await import("@/lib/channels/dispatch.server");
                await publishToSavedChannel(ch as any, content);
                published = true;
                if (published) {
                  await supabaseAdmin.from("publish_log").insert({
                    user_id: userId, task_id: tid, channel_id: ch.id, kind: ch.kind, status: "sent",
                  });
                  await supabaseAdmin.from("agent_tasks").update({
                    approval_status: "approved",
                    approved_at: new Date().toISOString(),
                    approval_channel_id: ch.id,
                  }).eq("id", tid);
                  await notifyUser(userId, "post_published", `تم النشر تلقائياً على ${ch.label || ch.kind}`, { link: "/agent" });
                  break;
                }
              } catch (e: any) {
                await supabaseAdmin.from("publish_log").insert({
                  user_id: userId, task_id: tid, channel_id: ch.id, kind: ch.kind,
                  status: "failed", error: e?.message || "error",
                });
              }
            }
            if (!published) {
              await notifyUser(userId, "approval_needed",
                `منشور جديد جاهز لـ "${subject}". افتح الوكيل للمراجعة والنشر.`,
                { link: "/agent", taskId: tid });
            }
          } else if (taskType === "analyze_url" && tid) {
            await notifyUser(userId, "analysis_done",
              `اكتمل تحليل GEO لـ "${subject}"${score != null ? ` — الدرجة ${score}/100` : ""}`,
              { link: "/agent" });
          }
        } catch (e: any) {
          await supabaseAdmin.from("agent_tasks").insert({
            user_id: userId, target_id: (tg as any).id, task_type: taskType,
            input: subject, status: "failed", error: e?.message || "error",
            run_id: runId, run_started_at: runStartedAt,
          });
          failed++;
        }
      }
    }
    return { ok: true, done, failed, runId };
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

// Publish a generated post to a saved channel (Telegram only for now)
export const publishToChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    const x = (d || {}) as { channelId?: string; text?: string; taskId?: string };
    if (!x.channelId) throw new Error("channel_required");
    if (!x.text || x.text.trim().length < 3) throw new Error("text_required");
    return { channelId: x.channelId, text: x.text.slice(0, 4000), taskId: x.taskId };
  })
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const { data: ch, error } = await supabaseAdmin
      .from("publish_channels").select("*")
      .eq("id", data.channelId).eq("user_id", userId).maybeSingle();
    if (error || !ch) return { ok: false, error: "channel_not_found" };
    if (!ch.active) return { ok: false, error: "channel_inactive" };

    try {
      const { publishToSavedChannel } = await import("@/lib/channels/dispatch.server");
      await publishToSavedChannel(ch as any, data.text);
      await supabaseAdmin.from("publish_log").insert({
        user_id: userId, task_id: data.taskId || null, channel_id: ch.id, kind: ch.kind, status: "sent",
      });
      return { ok: true };
    } catch (e: any) {
      await supabaseAdmin.from("publish_log").insert({
        user_id: userId, task_id: data.taskId || null, channel_id: ch.id, kind: ch.kind,
        status: "failed", error: e?.message || "error",
      });
      return { ok: false, error: e?.message || "error" };
    }
  });
