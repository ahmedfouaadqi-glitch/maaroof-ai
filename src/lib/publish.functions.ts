import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  publishToTelegram, publishToLinkedIn,
  publishToFacebookPage, publishToInstagram, publishToX,
  testFacebookToken, testInstagramToken, testXToken,
} from "@/lib/agent.server";
import { notifyUser } from "@/lib/notify.server";
import { randomBytes } from "crypto";

const MANUAL_PROVIDERS = new Set(["facebook", "instagram", "x"]);

const ALLOWED_NOTIFY = new Set(["email", "telegram", "linkedin", "inapp", "none"]);
const ALLOWED_MODE = new Set(["manual", "auto"]);

export const startTelegramLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId;
    const username = process.env.TELEGRAM_BOT_USERNAME;
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!username || !token) {
      return { ok: false as const, error: "bot_not_configured" };
    }
    const linkToken = randomBytes(12).toString("base64url");

    const { data: existing } = await supabaseAdmin
      .from("publish_channels").select("id, config, verified_at")
      .eq("user_id", userId).eq("kind", "telegram")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();

    if (existing && !existing.verified_at) {
      const cfg = { ...((existing.config as any) || {}), link_token: linkToken };
      await supabaseAdmin.from("publish_channels").update({ config: cfg }).eq("id", existing.id);
    } else {
      await supabaseAdmin.from("publish_channels").insert({
        user_id: userId, kind: "telegram", label: "Telegram", active: false,
        approval_mode: "manual",
        config: { link_token: linkToken },
      });
    }
    return { ok: true as const, link: `https://t.me/${username}?start=${linkToken}`, username };
  });

export const enableLinkedIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId;
    if (!process.env.LINKEDIN_API_KEY) return { ok: false as const, error: "linkedin_not_connected" };
    const { data: exists } = await supabaseAdmin
      .from("publish_channels").select("id").eq("user_id", userId).eq("kind", "linkedin").maybeSingle();
    if (exists) return { ok: true as const };
    await supabaseAdmin.from("publish_channels").insert({
      user_id: userId, kind: "linkedin", label: "LinkedIn", active: true,
      account_label: "حساب مشترك", verified_at: new Date().toISOString(),
      approval_mode: "manual", config: {},
    });
    return { ok: true as const };
  });

export const disconnectChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    const x = (d || {}) as { id?: string };
    if (!x.id) throw new Error("id_required");
    return { id: x.id };
  })
  .handler(async ({ data, context }) => {
    await supabaseAdmin.from("publish_channels")
      .delete().eq("id", data.id).eq("user_id", context.userId);
    return { ok: true };
  });

export const setChannelApprovalMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    const x = (d || {}) as { id?: string; mode?: string };
    if (!x.id || !x.mode || !ALLOWED_MODE.has(x.mode)) throw new Error("invalid");
    return { id: x.id, mode: x.mode };
  })
  .handler(async ({ data, context }) => {
    await supabaseAdmin.from("publish_channels")
      .update({ approval_mode: data.mode })
      .eq("id", data.id).eq("user_id", context.userId);
    return { ok: true };
  });

export const setPreferredNotify = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    const x = (d || {}) as { channel?: string };
    if (!x.channel || !ALLOWED_NOTIFY.has(x.channel)) throw new Error("invalid_channel");
    return { channel: x.channel };
  })
  .handler(async ({ data, context }) => {
    await supabaseAdmin.from("profiles")
      .update({ preferred_notify_channel: data.channel, notify_onboarded: true })
      .eq("id", context.userId);
    return { ok: true };
  });

export const skipNotifyOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await supabaseAdmin.from("profiles")
      .update({ notify_onboarded: true }).eq("id", context.userId);
    return { ok: true };
  });

export const getChannelsState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("preferred_notify_channel, notify_onboarded")
      .eq("id", context.userId).maybeSingle();
    const { data: chans } = await supabaseAdmin
      .from("publish_channels")
      .select("id, kind, label, account_label, active, verified_at, approval_mode, scopes, owner_type, owner_name, is_default, connected_via, last_verified_at, last_error, external_account_id")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    return {
      preferred: (prof as any)?.preferred_notify_channel ?? "email",
      onboarded: !!(prof as any)?.notify_onboarded,
      channels: chans || [],
      linkedinAvailable: !!process.env.LINKEDIN_API_KEY,
      telegramAvailable: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_USERNAME),
      tiktokAvailable: !!process.env.TIKTOK_API_KEY,
      oauthProviders: {
        linkedin: !!(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET),
        meta: !!(process.env.META_APP_ID && process.env.META_APP_SECRET),
        x: !!(process.env.X_CLIENT_ID && process.env.X_CLIENT_SECRET),
      },
    };
  });

// Manual token save for FB / Instagram / X ---------------------------------

export const saveManualSocialToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    const x = (d || {}) as { provider?: string; token?: string; pageId?: string; igUserId?: string; defaultMediaUrl?: string };
    if (!x.provider || !MANUAL_PROVIDERS.has(x.provider)) throw new Error("invalid_provider");
    if (!x.token || x.token.length < 10) throw new Error("invalid_token");
    return {
      provider: x.provider,
      token: x.token.trim(),
      pageId: x.pageId?.trim() || "",
      igUserId: x.igUserId?.trim() || "",
      defaultMediaUrl: x.defaultMediaUrl?.trim() || "",
    };
  })
  .handler(async ({ data, context }) => {
    let accountLabel = "";
    let config: Record<string, any> = {};
    try {
      if (data.provider === "facebook") {
        if (!data.pageId) throw new Error("page_id_required");
        const r = await testFacebookToken(data.token, data.pageId);
        accountLabel = r.name;
        config = { access_token: data.token, page_id: data.pageId };
      } else if (data.provider === "instagram") {
        if (!data.igUserId) throw new Error("ig_user_id_required");
        const r = await testInstagramToken(data.token, data.igUserId);
        accountLabel = r.name;
        config = { access_token: data.token, ig_user_id: data.igUserId, default_media_url: data.defaultMediaUrl };
      } else if (data.provider === "x") {
        const r = await testXToken(data.token);
        accountLabel = r.name;
        config = { bearer: data.token };
      }
    } catch (e: any) {
      return { ok: false as const, error: e?.message || "token_test_failed" };
    }

    const { data: existing } = await supabaseAdmin
      .from("publish_channels").select("id")
      .eq("user_id", context.userId).eq("kind", data.provider).maybeSingle();

    if (existing) {
      await supabaseAdmin.from("publish_channels").update({
        account_label: accountLabel, config, verified_at: new Date().toISOString(),
        active: true, connected_via: "manual",
      }).eq("id", existing.id);
    } else {
      await supabaseAdmin.from("publish_channels").insert({
        user_id: context.userId, kind: data.provider, label: data.provider,
        account_label: accountLabel, active: true, approval_mode: "manual",
        connected_via: "manual", verified_at: new Date().toISOString(), config,
      });
    }
    return { ok: true as const, accountLabel };
  });



// Approval queue ------------------------------------------------------------

export const listPendingApprovals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await supabaseAdmin
      .from("agent_tasks")
      .select("id, input, result, created_at, approval_status, approval_channel_id")
      .eq("user_id", context.userId)
      .eq("approval_status", "pending")
      .order("created_at", { ascending: false })
      .limit(50);
    return { tasks: data || [] };
  });

export const approveAndPublish = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    const x = (d || {}) as { taskId?: string; channelId?: string; editedText?: string };
    if (!x.taskId || !x.channelId) throw new Error("missing");
    return { taskId: x.taskId, channelId: x.channelId, editedText: x.editedText };
  })
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const { data: task } = await supabaseAdmin
      .from("agent_tasks").select("*").eq("id", data.taskId).eq("user_id", userId).maybeSingle();
    if (!task) return { ok: false, error: "task_not_found" };

    const { data: ch } = await supabaseAdmin
      .from("publish_channels").select("*")
      .eq("id", data.channelId).eq("user_id", userId).maybeSingle();
    if (!ch) return { ok: false, error: "channel_not_found" };

    const text = (data.editedText || (task.result as any)?.summary || task.input || "").toString().slice(0, 4000);
    if (text.length < 3) return { ok: false, error: "text_too_short" };

    try {
      const { publishToSavedChannel } = await import("@/lib/channels/dispatch.server");
      await publishToSavedChannel(ch as any, text);
      await supabaseAdmin.from("agent_tasks").update({
        approval_status: "approved",
        approved_at: new Date().toISOString(),
        approval_channel_id: ch.id,
      }).eq("id", task.id);
      await supabaseAdmin.from("publish_log").insert({
        user_id: userId, task_id: task.id, channel_id: ch.id, kind: ch.kind, status: "sent",
      });
      await notifyUser(userId, "post_published", `تم نشر المنشور على ${ch.label || ch.kind}`, { link: "/agent" });
      return { ok: true };
    } catch (e: any) {
      await supabaseAdmin.from("publish_log").insert({
        user_id: userId, task_id: task.id, channel_id: ch.id, kind: ch.kind,
        status: "failed", error: e?.message || "error",
      });
      return { ok: false, error: e?.message || "error" };
    }
  });

export const rejectApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    const x = (d || {}) as { taskId?: string };
    if (!x.taskId) throw new Error("missing");
    return { taskId: x.taskId };
  })
  .handler(async ({ data, context }) => {
    await supabaseAdmin.from("agent_tasks")
      .update({ approval_status: "rejected" })
      .eq("id", data.taskId).eq("user_id", context.userId);
    return { ok: true };
  });

// In-app inbox -------------------------------------------------------------

export const listNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await supabaseAdmin
      .from("user_notifications")
      .select("id, kind, title, body, link, read_at, created_at, task_id")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(30);
    const unread = (data || []).filter((n) => !n.read_at).length;
    return { items: data || [], unread };
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    const x = (d || {}) as { id?: string; all?: boolean };
    return { id: x.id, all: !!x.all };
  })
  .handler(async ({ data, context }) => {
    const now = new Date().toISOString();
    if (data.all) {
      await supabaseAdmin.from("user_notifications")
        .update({ read_at: now }).eq("user_id", context.userId).is("read_at", null);
    } else if (data.id) {
      await supabaseAdmin.from("user_notifications")
        .update({ read_at: now }).eq("id", data.id).eq("user_id", context.userId);
    }
    return { ok: true };
  });
