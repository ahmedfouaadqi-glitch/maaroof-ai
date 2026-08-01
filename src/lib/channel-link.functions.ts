import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { randomBytes } from "node:crypto";

const PROVIDERS = new Set(["linkedin", "meta", "x"]);
const OWNER_TYPES = new Set(["personal", "organization", "brand"]);

/** Step 1 — create a single-use state row and return the provider consent URL. */
export const startChannelOAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    const x = (d || {}) as { provider?: string };
    if (!x.provider || !PROVIDERS.has(x.provider)) throw new Error("invalid_provider");
    return { provider: x.provider as "linkedin" | "meta" | "x" };
  })
  .handler(async ({ data, context }) => {
    const { providerReady, buildAuthUrl, makePkce, PROVIDERS: DEFS } = await import("@/lib/channels/providers.server");
    if (!providerReady(data.provider)) return { ok: false as const, error: "provider_not_configured" };

    const req = getRequest();
    if (!req) return { ok: false as const, error: "no_request" };
    const origin = new URL(req.url).origin;
    const redirectUri = `${origin}/api/public/oauth/${data.provider}/callback`;

    const state = randomBytes(32).toString("base64url");
    const pkce = DEFS[data.provider].usesPkce ? makePkce() : null;

    const { data: row, error } = await supabaseAdmin
      .from("oauth_link_states")
      .insert({
        state,
        user_id: context.userId,
        provider: data.provider,
        code_verifier: pkce?.verifier ?? null,
        redirect_uri: redirectUri,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      })
      .select("id")
      .single();
    if (error || !row) return { ok: false as const, error: "state_failed" };

    return {
      ok: true as const,
      linkId: row.id,
      authorizationUrl: buildAuthUrl({
        provider: data.provider,
        state,
        redirectUri,
        codeChallenge: pkce?.challenge,
      }),
    };
  });

/** Step 2 — after the popup reports success, list the accounts the user may attach. */
export const listOAuthAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    const x = (d || {}) as { linkId?: string };
    if (!x.linkId) throw new Error("link_required");
    return { linkId: x.linkId };
  })
  .handler(async ({ data, context }) => {
    const { data: row } = await supabaseAdmin
      .from("oauth_link_states")
      .select("id, provider, payload, user_id")
      .eq("id", data.linkId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!row) return { ok: false as const, error: "link_not_found" };
    const payload = (row.payload || {}) as any;
    if (!payload.accounts) return { ok: false as const, error: "link_incomplete" };
    return {
      ok: true as const,
      provider: row.provider,
      accounts: (payload.accounts as any[]).map((a) => ({
        externalId: a.externalId,
        name: a.name,
        kind: a.kind,
        ownerType: a.ownerType,
      })),
    };
  });

/** Step 3 — attach one or more discovered accounts as publishing channels. */
export const attachOAuthAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    const x = (d || {}) as { linkId?: string; selections?: { externalId?: string; ownerType?: string; ownerName?: string }[] };
    if (!x.linkId) throw new Error("link_required");
    const sel = (x.selections || []).filter((s) => !!s.externalId).slice(0, 20);
    if (!sel.length) throw new Error("selection_required");
    return {
      linkId: x.linkId,
      selections: sel.map((s) => ({
        externalId: String(s.externalId),
        ownerType: s.ownerType && OWNER_TYPES.has(s.ownerType) ? s.ownerType : undefined,
        ownerName: (s.ownerName || "").toString().slice(0, 120),
      })),
    };
  })
  .handler(async ({ data, context }) => {
    const { data: row } = await supabaseAdmin
      .from("oauth_link_states")
      .select("id, provider, payload")
      .eq("id", data.linkId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!row) return { ok: false as const, error: "link_not_found" };

    const payload = (row.payload || {}) as any;
    const accounts = (payload.accounts || []) as any[];
    if (!accounts.length || !payload.sealed) return { ok: false as const, error: "link_incomplete" };

    const { openConfig, sealConfig } = await import("@/lib/channels/crypto.server");
    const userToken = openConfig(payload.sealed).access_token as string | undefined;
    if (!userToken) return { ok: false as const, error: "token_missing" };

    const { PROVIDERS: DEFS } = await import("@/lib/channels/providers.server");
    const scopes = DEFS[row.provider as "linkedin" | "meta" | "x"].scopes;

    let attached = 0;
    for (const sel of data.selections) {
      const acc = accounts.find((a) => a.externalId === sel.externalId);
      if (!acc) continue;
      const accToken = acc.sealedToken ? openConfig(acc.sealedToken).access_token : userToken;
      const sealed = sealConfig({ access_token: accToken, ...(acc.extra || {}), author_urn: acc.externalId });

      const { data: existing } = await supabaseAdmin
        .from("publish_channels")
        .select("id")
        .eq("user_id", context.userId)
        .eq("kind", acc.kind)
        .eq("external_account_id", acc.externalId)
        .maybeSingle();

      const patch = {
        label: acc.kind,
        account_label: acc.name,
        owner_type: sel.ownerType || acc.ownerType,
        owner_name: sel.ownerName || acc.name,
        token_ciphertext: sealed,
        token_expires_at: payload.expires_at || null,
        scopes,
        connected_via: "oauth",
        active: true,
        verified_at: new Date().toISOString(),
        last_verified_at: new Date().toISOString(),
        last_error: null,
        config: {},
      };

      if (existing) {
        await supabaseAdmin.from("publish_channels").update(patch).eq("id", existing.id);
      } else {
        await supabaseAdmin.from("publish_channels").insert({
          user_id: context.userId,
          kind: acc.kind,
          external_account_id: acc.externalId,
          approval_mode: "manual",
          ...patch,
        });
      }
      attached++;
    }

    // The state row held credentials — wipe it once channels are stored.
    await supabaseAdmin.from("oauth_link_states").delete().eq("id", row.id);

    return { ok: attached > 0, attached };
  });

/** Re-test stored credentials for one channel. */
export const verifyChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    const x = (d || {}) as { id?: string };
    if (!x.id) throw new Error("id_required");
    return { id: x.id };
  })
  .handler(async ({ data, context }) => {
    const { data: ch } = await supabaseAdmin
      .from("publish_channels")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!ch) return { ok: false as const, error: "channel_not_found" };

    const { verifySavedChannel } = await import("@/lib/channels/dispatch.server");
    const res = await verifySavedChannel(ch as any);
    await supabaseAdmin
      .from("publish_channels")
      .update({
        last_verified_at: new Date().toISOString(),
        last_error: res.ok ? null : (res.error || "verify_failed").slice(0, 200),
        account_label: res.name || ch.account_label,
        active: res.ok ? ch.active : false,
      })
      .eq("id", ch.id);
    return res.ok ? { ok: true as const, name: res.name } : { ok: false as const, error: res.error };
  });

/** Mark one channel as the default target for its platform. */
export const setDefaultChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    const x = (d || {}) as { id?: string };
    if (!x.id) throw new Error("id_required");
    return { id: x.id };
  })
  .handler(async ({ data, context }) => {
    const { data: ch } = await supabaseAdmin
      .from("publish_channels")
      .select("id, kind")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!ch) return { ok: false, error: "channel_not_found" };
    await supabaseAdmin
      .from("publish_channels")
      .update({ is_default: false })
      .eq("user_id", context.userId)
      .eq("kind", ch.kind);
    await supabaseAdmin.from("publish_channels").update({ is_default: true }).eq("id", ch.id);
    return { ok: true };
  });

/** Rename the owner label (personal / organization / brand naming). */
export const updateChannelOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    const x = (d || {}) as { id?: string; ownerType?: string; ownerName?: string };
    if (!x.id) throw new Error("id_required");
    if (x.ownerType && !OWNER_TYPES.has(x.ownerType)) throw new Error("invalid_owner_type");
    return { id: x.id, ownerType: x.ownerType, ownerName: (x.ownerName || "").slice(0, 120) };
  })
  .handler(async ({ data, context }) => {
    const patch: Record<string, any> = {};
    if (data.ownerType) patch.owner_type = data.ownerType;
    if (data.ownerName) patch.owner_name = data.ownerName;
    if (!Object.keys(patch).length) return { ok: true };
    await supabaseAdmin
      .from("publish_channels")
      .update(patch as any)
      .eq("id", data.id)
      .eq("user_id", context.userId);
    return { ok: true };
  });
