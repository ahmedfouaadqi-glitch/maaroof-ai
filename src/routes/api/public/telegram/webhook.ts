import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createHash, timingSafeEqual } from "crypto";

function deriveSecret(token: string) {
  return createHash("sha256").update(`telegram-webhook:${token}`).digest("base64url");
}
function safeEq(a: string, b: string) {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
async function tgSend(token: string, chatId: number | string, text: string, extra: Record<string, unknown> = {}) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", ...extra }),
  }).catch(() => null);
}
async function tgAnswerCallback(token: string, queryId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: queryId, text, show_alert: false }),
  }).catch(() => null);
}

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        if (!token) return new Response("not_configured", { status: 503 });

        const expected = deriveSecret(token);
        const got = request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
        if (!safeEq(got, expected)) return new Response("unauthorized", { status: 401 });

        const update = (await request.json().catch(() => null)) as any;

        // Inline keyboard callbacks: approve / reject pending posts
        if (update?.callback_query) {
          const cb = update.callback_query;
          const data: string = cb.data || "";
          const [action, taskId] = data.split(":");
          if (taskId && (action === "approve" || action === "reject")) {
            const { data: task } = await supabaseAdmin
              .from("agent_tasks").select("*").eq("id", taskId).maybeSingle();
            if (task) {
              if (action === "approve") {
                await supabaseAdmin.from("agent_tasks").update({
                  approval_status: "approved",
                  approved_at: new Date().toISOString(),
                }).eq("id", taskId);
                await tgAnswerCallback(token, cb.id, "✅ تمت الموافقة — سيُنشر قريباً");
              } else {
                await supabaseAdmin.from("agent_tasks").update({
                  approval_status: "rejected",
                }).eq("id", taskId);
                await tgAnswerCallback(token, cb.id, "❌ تم الرفض");
              }
            } else {
              await tgAnswerCallback(token, cb.id, "تعذّر العثور على المهمة");
            }
          }
          return Response.json({ ok: true });
        }

        const msg = update?.message ?? update?.edited_message;
        const chatId = msg?.chat?.id;
        const text: string = msg?.text || "";
        if (!chatId) return Response.json({ ok: true });

        // /start <linkToken>
        const m = text.match(/^\/start\s+([A-Za-z0-9_-]{8,64})/);
        if (m) {
          const linkToken = m[1];
          const { data: ch } = await supabaseAdmin
            .from("publish_channels")
            .select("id, user_id, config")
            .eq("kind", "telegram")
            .filter("config->>link_token", "eq", linkToken)
            .maybeSingle();

          if (!ch) {
            await tgSend(token, chatId, "⚠️ رمز الربط غير صالح أو منتهي. أعد المحاولة من التطبيق.");
            return Response.json({ ok: true });
          }

          const newCfg: Record<string, unknown> = { ...((ch.config as any) || {}), chat_id: String(chatId) };
          delete newCfg.link_token;
          const acctLabel = msg.from?.username
            ? `@${msg.from.username}`
            : msg.chat?.title || `chat ${chatId}`;

          await supabaseAdmin.from("publish_channels").update({
            config: newCfg,
            account_label: acctLabel,
            verified_at: new Date().toISOString(),
            active: true,
          }).eq("id", ch.id);

          await tgSend(token, chatId, "✅ <b>تم ربط حسابك بنجاح بـ MAAROOF Ai</b>\nستصلك نتائج التحليل والمنشورات هنا.\nاكتب /help لرؤية الأوامر المتاحة.");
          return Response.json({ ok: true });
        }

        if (text === "/start") {
          await tgSend(token, chatId,
            "👋 مرحباً بك في <b>MAAROOF Ai</b>\nلربط هذه المحادثة بحسابك:\n١) افتح صفحة الوكيل في التطبيق\n٢) اضغط <b>ربط Telegram</b>\n٣) سيُفتح هذا البوت تلقائياً ويتم الربط بنقرة.");
        } else if (text === "/help") {
          await tgSend(token, chatId,
            "<b>الأوامر:</b>\n/start — معلومات الربط\n/help — هذه الرسالة\n\nستصلك إشعارات وموافقات على المنشورات هنا تلقائياً.");
        }
        return Response.json({ ok: true });
      },
    },
  },
});
