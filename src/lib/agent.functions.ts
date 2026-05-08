import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callAI, checkAndConsume, publishToTelegram, SYSTEM_AGENT, SYSTEM_ANALYZE, SYSTEM_SUGGEST, SYSTEM_VISIBILITY } from "@/lib/agent.server";

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

// AI Visibility Check — analyzes how the brand appears in AI search engines
export const runVisibilityCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    const x = (d || {}) as { brand?: string; keywords?: string; lang?: string };
    if (!x.brand || x.brand.trim().length < 2) throw new Error("brand_required");
    return {
      brand: x.brand.trim().slice(0, 200),
      keywords: (x.keywords || "").trim().slice(0, 500),
      lang: normLang(x.lang),
    };
  })
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    try { await checkAndConsume(userId, 1); }
    catch (e: any) { return { ok: false, error: e?.message || "limit" }; }

    const prompt = `العلامة التجارية: ${data.brand}\nالكلمات المفتاحية: ${data.keywords || "(غير محددة)"}\nالسوق: العراق`;
    try {
      const raw = await callAI(SYSTEM_VISIBILITY, prompt, data.lang);
      let parsed: any = null;
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch {} }

      // Save brand to profile for next runs
      await supabaseAdmin.from("profiles")
        .update({ brand_name: data.brand, brand_keywords: data.keywords || null })
        .eq("id", userId);

      const { data: row } = await supabaseAdmin.from("agent_tasks").insert({
        user_id: userId, task_type: "ai_visibility",
        input: data.brand, status: "done",
        result: parsed ? { ...parsed, raw, lang: data.lang } : { summary: raw, lang: data.lang },
      }).select("id").single();
      return { ok: true, taskId: row?.id, result: parsed || { summary: raw } };
    } catch (e: any) {
      await supabaseAdmin.from("agent_tasks").insert({
        user_id: userId, task_type: "ai_visibility",
        input: data.brand, status: "failed", error: e?.message || "error",
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
      if (ch.kind === "telegram") {
        const cfg = (ch.config || {}) as { bot_token?: string; chat_id?: string };
        if (!cfg.bot_token || !cfg.chat_id) throw new Error("telegram_config_missing");
        await publishToTelegram(cfg.bot_token, cfg.chat_id, data.text);
      } else {
        throw new Error("channel_kind_not_supported_yet");
      }
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
