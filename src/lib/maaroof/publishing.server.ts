// Part 14 — Publishing Capability Engine.
// A standalone execution layer: agents produce a Publication Strategy, this
// module owns platform profiles, workflow stages, approval modes and delivery.
// Delivery reuses the existing channel publishers (Evolution over Replacement).
import { createClient } from "@supabase/supabase-js";

let _db: ReturnType<typeof createClient> | null = null;
function db() {
  if (_db) return _db;
  _db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  return _db;
}

/** The 20 stages of the publication workflow (Part 14). */
export const PUBLICATION_STAGES = [
  "idea", "planning", "research", "expert_review", "brand_review",
  "knowledge_validation", "fact_validation", "future_impact", "risk_analysis",
  "compliance_review", "cost_analysis", "approval", "scheduling", "publishing",
  "monitoring", "analytics", "learning", "memory_update", "knowledge_update", "dna_update",
] as const;
export type PublicationStage = (typeof PUBLICATION_STAGES)[number];

export const APPROVAL_MODES = [
  "always_ask", "approve_once", "campaign_approval", "workspace_policy",
  "fully_automatic", "emergency_stop",
] as const;
export type ApprovalMode = (typeof APPROVAL_MODES)[number];

export type PlatformProfile = {
  platform_key: string;
  label_ar: string;
  label_en: string;
  label_ku: string | null;
  category: string;
  profile: Record<string, any>;
  limits: Record<string, any>;
  risk_rules: any[];
  requires_connection: boolean;
  enabled: boolean;
};

let _platforms: { at: number; rows: PlatformProfile[] } | null = null;

/** Platform registry — cached 5 min. New platforms are rows, never new code. */
export async function loadPlatforms(force = false): Promise<PlatformProfile[]> {
  if (!force && _platforms && Date.now() - _platforms.at < 300_000) return _platforms.rows;
  const { data } = await db()
    .from("publishing_platforms")
    .select("*")
    .eq("enabled", true)
    .order("sort_order", { ascending: true });
  const rows = ((data as any[]) || []) as PlatformProfile[];
  _platforms = { at: Date.now(), rows };
  return rows;
}

/** Map a stored publish_channels.kind to a platform key. */
export function channelKindToPlatform(kind: string): string {
  const map: Record<string, string> = {
    telegram: "telegram", linkedin: "linkedin", facebook: "facebook",
    instagram: "instagram", x: "x", whatsapp: "whatsapp", email: "email",
    webhook: "webhook", wordpress: "wordpress",
  };
  return map[kind] || kind;
}

/**
 * Build a Publication Strategy from brand context + platform profiles.
 * Deterministic and free: no model call. The agent enriches it afterwards.
 */
export function buildStrategy(input: {
  goal: string;
  brand?: string | null;
  language?: string;
  geo?: { country?: string | null; city?: string | null } | null;
  platforms: string[];
  registry: PlatformProfile[];
  signals?: Record<string, any> | null;
}) {
  const byKey = new Map(input.registry.map((p) => [p.platform_key, p]));
  const perPlatform = input.platforms.map((key) => {
    const p = byKey.get(key);
    const prof = (p?.profile || {}) as Record<string, any>;
    return {
      platform: key,
      label: p?.label_ar || key,
      audience: prof.audience ?? null,
      content_types: prof.best_types ?? [],
      best_time: prof.best_time ?? null,
      frequency: prof.frequency ?? null,
      hashtags: prof.hashtags ?? null,
      cta: prof.cta ?? null,
      text_limit: (p?.limits as any)?.text ?? null,
      requires_connection: p?.requires_connection ?? true,
      notes: prof.audience
        ? `صيغة المحتوى تُبنى على سلوك جمهور ${p?.label_ar || key} لا على نسخة موحّدة.`
        : null,
    };
  });
  return {
    goal: input.goal,
    brand: input.brand ?? null,
    language: input.language || "ar",
    geo: input.geo ?? null,
    signals: input.signals ?? {},
    per_platform: perPlatform,
    built_at: new Date().toISOString(),
  };
}

/** Effective approval mode: campaign overrides workspace policy overrides default. */
export function resolveApprovalMode(
  campaignMode: string | null | undefined,
  workspacePolicy: string | null | undefined,
): ApprovalMode {
  const valid = (v: any): v is ApprovalMode => APPROVAL_MODES.includes(v);
  if (valid(campaignMode) && campaignMode !== "workspace_policy") return campaignMode;
  if (valid(workspacePolicy)) return workspacePolicy;
  return "always_ask";
}

/** Does this publication need a human before it goes out? */
export function needsApproval(mode: ApprovalMode, alreadyApprovedOnce: boolean): boolean {
  if (mode === "emergency_stop") return true;
  if (mode === "fully_automatic") return false;
  if (mode === "approve_once" || mode === "campaign_approval") return !alreadyApprovedOnce;
  return true;
}

/** Deliver one publication through the existing channel publishers. */
export async function deliverPublication(pub: {
  id: string;
  user_id: string;
  platform_key: string;
  channel_id: string | null;
  content: string;
}): Promise<{ ok: boolean; error?: string; external_ref?: string }> {
  const text = (pub.content || "").slice(0, 4000);
  if (text.trim().length < 3) return { ok: false, error: "text_too_short" };

  let channel: any = null;
  if (pub.channel_id) {
    const { data } = await db().from("publish_channels").select("*").eq("id", pub.channel_id).maybeSingle();
    channel = data;
  } else {
    const { data } = await db()
      .from("publish_channels")
      .select("*")
      .eq("user_id", pub.user_id)
      .eq("active", true)
      .limit(20);
    channel = ((data as any[]) || []).find((c) => channelKindToPlatform(c.kind) === pub.platform_key) || null;
  }
  if (!channel) return { ok: false, error: "channel_not_connected" };

  const cfg = (channel.config as any) || {};
  const {
    publishToTelegram, publishToLinkedIn, publishToFacebookPage, publishToInstagram, publishToX,
  } = await import("@/lib/agent.server");

  try {
    if (channel.kind === "telegram") {
      const token = cfg.bot_token || process.env.TELEGRAM_BOT_TOKEN;
      if (!token || !cfg.chat_id) throw new Error("telegram_config_missing");
      await publishToTelegram(token, cfg.chat_id, text);
    } else if (channel.kind === "linkedin") {
      await publishToLinkedIn(text);
    } else if (channel.kind === "facebook") {
      if (!cfg.access_token || !cfg.page_id) throw new Error("facebook_config_missing");
      await publishToFacebookPage(cfg.access_token, cfg.page_id, text);
    } else if (channel.kind === "instagram") {
      if (!cfg.access_token || !cfg.ig_user_id) throw new Error("instagram_config_missing");
      if (!cfg.default_media_url) throw new Error("instagram_needs_image");
      await publishToInstagram(cfg.access_token, cfg.ig_user_id, text, cfg.default_media_url);
    } else if (channel.kind === "x") {
      if (!cfg.bearer) throw new Error("x_config_missing");
      await publishToX(cfg.bearer, text);
    } else if (channel.kind === "webhook") {
      if (!cfg.url) throw new Error("webhook_config_missing");
      const r = await fetch(cfg.url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ publication_id: pub.id, platform: pub.platform_key, content: text }),
      });
      if (!r.ok) throw new Error(`webhook_${r.status}`);
    } else {
      throw new Error("platform_delivery_unsupported");
    }

    await db().from("publish_log").insert({
      user_id: pub.user_id, channel_id: channel.id, kind: channel.kind, status: "sent",
    } as any);
    return { ok: true, external_ref: channel.id };
  } catch (e: any) {
    const error = String(e?.message || e).slice(0, 300);
    await db().from("publish_log").insert({
      user_id: pub.user_id, channel_id: channel.id, kind: channel.kind, status: "failed", error,
    } as any);
    return { ok: false, error };
  }
}

/** Move a publication to a stage and stamp the stage history. */
export async function advanceStage(publicationId: string, stage: PublicationStage, patch: Record<string, any> = {}) {
  await db().from("publications").update({ stage, ...patch } as any).eq("id", publicationId);
}

/** Aggregate campaign cost from its publications. */
export async function recomputeCampaignSpend(campaignId: string) {
  const { data } = await db().from("publications").select("cost_usd").eq("campaign_id", campaignId);
  const spent = ((data as any[]) || []).reduce((a, r) => a + Number(r.cost_usd || 0), 0);
  await db().from("publishing_campaigns").update({ spent_usd: spent } as any).eq("id", campaignId);
  return spent;
}
