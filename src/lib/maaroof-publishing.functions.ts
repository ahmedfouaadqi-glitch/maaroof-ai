// Parts 14-15 admin/user surface — Publishing Ecosystem + Trust Architecture.
// Thin wrapper module: no runtime helpers at module scope (server-fn splitting).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Platforms + campaigns + recent publications for the current user. */
export const getPublishingCenter = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { loadPlatforms } = await import("@/lib/maaroof/publishing.server");
    const { getMaaroofSettings } = await import("@/lib/maaroof/settings.server");
    const [platforms, settings] = await Promise.all([loadPlatforms(), getMaaroofSettings()]);

    const { data: campaigns } = await supabase
      .from("publishing_campaigns")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    const { data: publications } = await supabase
      .from("publications")
      .select("id, campaign_id, platform_key, title, content, stage, status, approval_status, scheduled_at, published_at, cost_usd, trust_score, error, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(60);
    const { data: channels } = await supabase
      .from("publish_channels")
      .select("id, kind, label, active")
      .eq("user_id", userId);

    return {
      platforms: platforms.map((p) => ({
        platform_key: p.platform_key,
        label: p.label_ar,
        category: p.category,
        profile: p.profile,
        limits: p.limits,
        requires_connection: p.requires_connection,
      })),
      campaigns: campaigns ?? [],
      publications: publications ?? [],
      channels: channels ?? [],
      settings: settings.publishing,
    };
  });

/** Create a campaign with a goal, platforms and an optional budget. */
export const createCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      name: z.string().min(2).max(120),
      goal: z.string().max(2000).optional().nullable(),
      platforms: z.array(z.string().min(1)).min(1).max(22),
      approval_mode: z.string().max(40).optional().nullable(),
      budget_usd: z.number().min(0).max(10000).optional().nullable(),
      workspace_id: z.string().uuid().optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("publishing_campaigns")
      .insert({
        user_id: userId,
        workspace_id: data.workspace_id ?? null,
        name: data.name,
        goal: data.goal ?? null,
        platforms: data.platforms,
        approval_mode: data.approval_mode ?? "always_ask",
        budget_usd: data.budget_usd ?? null,
        status: "active",
      } as any)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { campaign: row };
  });

/** Build a per-platform publication strategy — deterministic, no model cost. */
export const buildPublicationStrategy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      goal: z.string().min(3).max(2000),
      brand: z.string().max(200).optional().nullable(),
      language: z.string().max(10).optional().nullable(),
      platforms: z.array(z.string().min(1)).min(1).max(22),
      campaign_id: z.string().uuid().optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { loadPlatforms, buildStrategy } = await import("@/lib/maaroof/publishing.server");
    const registry = await loadPlatforms();
    const { data: profile } = await supabase
      .from("profiles")
      .select("brand_name, geo_scope")
      .eq("id", userId)
      .maybeSingle();
    const geo = (profile?.geo_scope as any) || null;
    const strategy = buildStrategy({
      goal: data.goal,
      brand: data.brand || (profile as any)?.brand_name || null,
      language: data.language || "ar",
      geo: geo ? { country: geo.country ?? null, city: geo.city ?? null } : null,
      platforms: data.platforms,
      registry,
    });
    if (data.campaign_id) {
      await supabase.from("publishing_campaigns").update({ strategy } as any).eq("id", data.campaign_id).eq("user_id", userId);
    }
    return { strategy };
  });

/** Draft one publication per platform from a strategy. Nothing is sent yet. */
export const draftPublications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      campaign_id: z.string().uuid().optional().nullable(),
      items: z.array(z.object({
        platform_key: z.string().min(1),
        title: z.string().max(200).optional().nullable(),
        content: z.string().min(3).max(8000),
        scheduled_at: z.string().max(40).optional().nullable(),
      })).min(1).max(22),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { getMaaroofSettings } = await import("@/lib/maaroof/settings.server");
    const settings = await getMaaroofSettings();
    if (!settings.publishing.enabled) throw new Error("publishing_disabled");

    const since = new Date(Date.now() - 86_400_000).toISOString();
    const { count } = await supabase
      .from("publications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", since);
    const cap = Number(settings.publishing.daily_publication_cap || 20);
    if ((count || 0) + data.items.length > cap) throw new Error("daily_publication_cap_reached");

    const rows = data.items.map((it) => ({
      user_id: userId,
      campaign_id: data.campaign_id ?? null,
      platform_key: it.platform_key,
      title: it.title ?? null,
      content: it.content,
      stage: "idea",
      status: "draft",
      approval_status: "pending",
      scheduled_at: it.scheduled_at ?? null,
    }));
    const { data: inserted, error } = await supabase.from("publications").insert(rows as any).select();
    if (error) throw new Error(error.message);
    return { publications: inserted ?? [] };
  });

/** Approve (and optionally send immediately) or reject a publication. */
export const decidePublication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      publication_id: z.string().uuid(),
      decision: z.enum(["approve", "reject", "publish"]),
      edited_content: z.string().max(8000).optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: pub } = await supabase
      .from("publications").select("*").eq("id", data.publication_id).eq("user_id", userId).maybeSingle();
    if (!pub) throw new Error("publication_not_found");

    if (data.decision === "reject") {
      await supabase.from("publications")
        .update({ approval_status: "rejected", status: "rejected", stage: "approval" } as any)
        .eq("id", pub.id);
      return { ok: true, status: "rejected" };
    }

    const content = data.edited_content ?? (pub as any).content;
    await supabase.from("publications")
      .update({ approval_status: "approved", approved_at: new Date().toISOString(), content, stage: "approval" } as any)
      .eq("id", pub.id);
    if (data.decision === "approve") return { ok: true, status: "approved" };

    const { deliverPublication, advanceStage, recomputeCampaignSpend } = await import("@/lib/maaroof/publishing.server");
    const res = await deliverPublication({
      id: (pub as any).id,
      user_id: userId,
      platform_key: (pub as any).platform_key,
      channel_id: (pub as any).channel_id ?? null,
      content,
    });
    await advanceStage((pub as any).id, res.ok ? "monitoring" : "publishing", {
      status: res.ok ? "published" : "failed",
      published_at: res.ok ? new Date().toISOString() : null,
      external_ref: res.external_ref ?? null,
      error: res.ok ? null : res.error,
    });
    if ((pub as any).campaign_id) await recomputeCampaignSpend((pub as any).campaign_id);

    const { recordTrustEvent } = await import("@/lib/maaroof/trust.server");
    await recordTrustEvent({
      entityType: "tool",
      entityKey: `publish:${(pub as any).platform_key}`,
      ok: res.ok,
      reason: res.ok ? "publication_delivered" : `publication_failed:${res.error}`,
      userId,
    });

    return { ok: res.ok, status: res.ok ? "published" : "failed", error: res.error ?? null };
  });

/** Record post-publish performance so learning has real signals. */
export const recordPublicationMetrics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      publication_id: z.string().uuid(),
      reach: z.number().int().min(0).max(100_000_000).optional().nullable(),
      impressions: z.number().int().min(0).max(100_000_000).optional().nullable(),
      engagement: z.number().int().min(0).max(100_000_000).optional().nullable(),
      clicks: z.number().int().min(0).max(100_000_000).optional().nullable(),
      conversions: z.number().int().min(0).max(1_000_000).optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: pub } = await supabase
      .from("publications").select("id").eq("id", data.publication_id).eq("user_id", userId).maybeSingle();
    if (!pub) throw new Error("publication_not_found");
    const { error } = await supabase.from("publication_metrics").insert({
      publication_id: data.publication_id,
      user_id: userId,
      reach: data.reach ?? null,
      impressions: data.impressions ?? null,
      engagement: data.engagement ?? null,
      clicks: data.clicks ?? null,
      conversions: data.conversions ?? null,
    } as any);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Trust rankings, weak links and recent trust movements (admin only). */
export const getTrustCenter = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");

    const { listTrustProfiles, findWeakLinks } = await import("@/lib/maaroof/trust.server");
    const { getMaaroofSettings } = await import("@/lib/maaroof/settings.server");
    const [profiles, weakLinks, settings] = await Promise.all([
      listTrustProfiles(), findWeakLinks(), getMaaroofSettings(),
    ]);
    const { data: events } = await supabase
      .from("trust_events")
      .select("id, entity_type, entity_key, delta, score_after, reason, created_at")
      .order("created_at", { ascending: false })
      .limit(60);

    const byType: Record<string, { count: number; avg: number }> = {};
    for (const p of profiles) {
      const t = p.entity_type as string;
      byType[t] ||= { count: 0, avg: 0 };
      byType[t].count += 1;
      byType[t].avg += Number(p.trust_score || 0);
    }
    for (const t of Object.keys(byType)) byType[t].avg = Math.round(byType[t].avg / byType[t].count);

    return {
      profiles: profiles.map((p) => ({
        id: p.id, entity_type: p.entity_type, entity_key: p.entity_key,
        trust_score: Number(p.trust_score), samples: Number(p.samples || 0),
        successes: Number(p.successes || 0), failures: Number(p.failures || 0),
        contradictions: Number(p.contradictions || 0),
        avg_confidence: p.avg_confidence, avg_cost_usd: p.avg_cost_usd,
        avg_latency_ms: p.avg_latency_ms, prediction_accuracy: p.prediction_accuracy,
        dimensions: p.dimensions, last_evaluated_at: p.last_evaluated_at,
      })),
      weak_links: weakLinks,
      events: events ?? [],
      summary: byType,
      settings: settings.trust_engine,
    };
  });
