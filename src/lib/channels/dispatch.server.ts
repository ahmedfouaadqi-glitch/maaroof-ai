// Server-only: single dispatch point for publishing to a saved user channel.
// Every publish path (agent auto-publish, approvals, manual publish, notifications)
// must go through publishToSavedChannel so token handling stays in one place.
import { openConfig } from "./crypto.server";
import {
  publishToTelegram, publishToFacebookPage, publishToInstagram, publishToX,
  publishToLinkedIn,
} from "@/lib/agent.server";

export interface SavedChannel {
  id: string;
  kind: string;
  label?: string | null;
  account_label?: string | null;
  owner_type?: string | null;
  owner_name?: string | null;
  external_account_id?: string | null;
  config?: any;
  token_ciphertext?: string | null;
  connected_via?: string | null;
}

/** Merge legacy plaintext config with the encrypted bag (encrypted wins). */
export function channelConfig(ch: SavedChannel): Record<string, any> {
  const legacy = (ch.config || {}) as Record<string, any>;
  if (!ch.token_ciphertext) return legacy;
  return { ...legacy, ...openConfig(ch.token_ciphertext) };
}

export async function publishToLinkedInAs(
  token: string,
  authorUrn: string,
  text: string,
): Promise<void> {
  const body = {
    author: authorUrn,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text: text.slice(0, 3000) },
        shareMediaCategory: "NONE",
      },
    },
    visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
  };
  const resp = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const b = await resp.text().catch(() => "");
    throw new Error(`linkedin_${resp.status}: ${b.slice(0, 180)}`);
  }
}

/** Publish text to one saved channel. Throws with a stable error code on failure. */
export async function publishToSavedChannel(
  ch: SavedChannel,
  text: string,
  opts: { mediaUrl?: string } = {},
): Promise<void> {
  const cfg = channelConfig(ch);

  switch (ch.kind) {
    case "telegram": {
      const botToken = cfg.bot_token || process.env["TELEGRAM_BOT_TOKEN"];
      if (!botToken || !cfg.chat_id) throw new Error("telegram_config_missing");
      await publishToTelegram(botToken, cfg.chat_id, text);
      return;
    }
    case "linkedin": {
      const token = cfg.access_token as string | undefined;
      const urn = (ch.external_account_id || cfg.author_urn) as string | undefined;
      if (token && urn) {
        await publishToLinkedInAs(token, urn, text);
        return;
      }
      // Legacy shared-connector channel
      await publishToLinkedIn(text);
      return;
    }
    case "facebook": {
      const token = cfg.access_token as string | undefined;
      const pageId = (cfg.page_id || ch.external_account_id) as string | undefined;
      if (!token || !pageId) throw new Error("facebook_config_missing");
      await publishToFacebookPage(token, pageId, text);
      return;
    }
    case "instagram": {
      const token = cfg.access_token as string | undefined;
      const igId = (cfg.ig_user_id || ch.external_account_id) as string | undefined;
      const media = opts.mediaUrl || cfg.default_media_url;
      if (!token || !igId) throw new Error("instagram_config_missing");
      if (!media) throw new Error("instagram_needs_image");
      await publishToInstagram(token, igId, text, media);
      return;
    }
    case "x": {
      const bearer = (cfg.access_token || cfg.bearer) as string | undefined;
      if (!bearer) throw new Error("x_config_missing");
      await publishToX(bearer, text);
      return;
    }
    default:
      throw new Error("channel_not_supported");
  }
}

/** Lightweight read-only call that proves the stored credentials still work. */
export async function verifySavedChannel(ch: SavedChannel): Promise<{ ok: boolean; name?: string; error?: string }> {
  const cfg = channelConfig(ch);
  try {
    if (ch.kind === "telegram") {
      const botToken = cfg.bot_token || process.env["TELEGRAM_BOT_TOKEN"];
      if (!botToken || !cfg.chat_id) throw new Error("telegram_config_missing");
      const r = await fetch(`https://api.telegram.org/bot${botToken}/getChat?chat_id=${encodeURIComponent(cfg.chat_id)}`);
      if (!r.ok) throw new Error(`telegram_${r.status}`);
      return { ok: true };
    }
    if (ch.kind === "linkedin") {
      const token = cfg.access_token as string | undefined;
      if (!token) return { ok: true }; // legacy shared connector
      const r = await fetch("https://api.linkedin.com/v2/userinfo", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error(`linkedin_${r.status}`);
      const j = (await r.json()) as { name?: string };
      return { ok: true, name: j.name };
    }
    if (ch.kind === "facebook" || ch.kind === "instagram") {
      const token = cfg.access_token as string | undefined;
      const id = (cfg.ig_user_id || cfg.page_id || ch.external_account_id) as string | undefined;
      if (!token || !id) throw new Error("config_missing");
      const fields = ch.kind === "instagram" ? "username" : "name";
      const r = await fetch(`https://graph.facebook.com/v19.0/${encodeURIComponent(id)}?fields=${fields}&access_token=${encodeURIComponent(token)}`);
      if (!r.ok) throw new Error(`meta_${r.status}`);
      const j = (await r.json()) as { name?: string; username?: string };
      return { ok: true, name: j.name || j.username };
    }
    if (ch.kind === "x") {
      const bearer = (cfg.access_token || cfg.bearer) as string | undefined;
      if (!bearer) throw new Error("x_config_missing");
      const r = await fetch("https://api.twitter.com/2/users/me", { headers: { Authorization: `Bearer ${bearer}` } });
      if (!r.ok) throw new Error(`x_${r.status}`);
      const j = (await r.json()) as { data?: { username?: string } };
      return { ok: true, name: j.data?.username ? `@${j.data.username}` : undefined };
    }
    return { ok: false, error: "channel_not_supported" };
  } catch (e: any) {
    return { ok: false, error: e?.message || "verify_failed" };
  }
}
