/** Server-only unified notification dispatcher. */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { publishToTelegram } from "@/lib/agent.server";

export type NotifyKind = "analysis_done" | "competitor_alert" | "post_published" | "suggestion_ready" | "approval_needed";

const TITLES: Record<NotifyKind, string> = {
  analysis_done: "✅ تم إكمال التحليل",
  competitor_alert: "🔔 تنبيه منافس",
  post_published: "📤 تم نشر المنشور",
  suggestion_ready: "💡 اقتراح منشور جديد",
  approval_needed: "⏳ منشور بانتظار موافقتك",
};

async function tgSendWithKeyboard(token: string, chatId: string, text: string, taskId?: string) {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: false,
  };
  if (taskId) {
    body.reply_markup = {
      inline_keyboard: [[
        { text: "✅ موافقة ونشر", callback_data: `approve:${taskId}` },
        { text: "❌ رفض", callback_data: `reject:${taskId}` },
      ]],
    };
  }
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
}

export async function notifyUser(
  userId: string,
  kind: NotifyKind,
  message: string,
  opts: { link?: string; taskId?: string } = {},
): Promise<void> {
  const title = TITLES[kind];
  // Always write to in-app inbox
  try {
    await supabaseAdmin.from("user_notifications").insert({
      user_id: userId,
      kind,
      title,
      body: message.slice(0, 2000),
      link: opts.link || null,
      task_id: opts.taskId || null,
    });
  } catch (e: any) {
    console.error("[notifyUser] inbox insert failed:", e?.message || e);
  }

  try {
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("preferred_notify_channel")
      .eq("id", userId).maybeSingle();

    const channel = ((prof as any)?.preferred_notify_channel ?? "email") as string;
    if (channel === "none" || channel === "email") return; // email dispatch TODO

    if (channel === "telegram") {
      const { data: ch } = await supabaseAdmin
        .from("publish_channels").select("config, token_ciphertext")
        .eq("user_id", userId).eq("kind", "telegram")
        .not("verified_at", "is", null)
        .order("verified_at", { ascending: false }).limit(1).maybeSingle();
      const { channelConfig } = await import("@/lib/channels/dispatch.server");
      const cfg = (ch ? channelConfig(ch as any) : {}) as { bot_token?: string; chat_id?: string };
      const botToken = cfg.bot_token || process.env.TELEGRAM_BOT_TOKEN;
      if (botToken && cfg.chat_id) {
        const body = `<b>${title}</b>\n\n${message}${opts.link ? `\n\n🔗 ${opts.link}` : ""}`;
        if (kind === "approval_needed" && opts.taskId) {
          await tgSendWithKeyboard(botToken, cfg.chat_id, body, opts.taskId);
        } else {
          await publishToTelegram(botToken, cfg.chat_id, body);
        }
      }
    }
  } catch (e: any) {
    console.error("[notifyUser] external dispatch failed:", e?.message || e);
  }
}
