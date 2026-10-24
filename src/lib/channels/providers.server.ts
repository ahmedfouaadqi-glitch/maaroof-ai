// Server-only: per-user OAuth for publishing channels (LinkedIn, Meta, X).
// Platform admins register ONE developer app per provider; every end user then
// authorizes their own personal / organization / brand account.
import { createHash, randomBytes } from "node:crypto";

export type ProviderId = "linkedin" | "meta" | "x";
export type OwnerType = "personal" | "organization" | "brand";

export interface LinkAccount {
  /** provider-side account id (member urn, page id, ig user id, x user id) */
  externalId: string;
  name: string;
  kind: "linkedin" | "facebook" | "instagram" | "x";
  ownerType: OwnerType;
  /** extra values needed at publish time, merged into the sealed config */
  extra?: Record<string, unknown>;
  /** account-specific token (Meta page tokens); falls back to the user token */
  token?: string;
}

interface ProviderDef {
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  usesPkce: boolean;
  clientIdEnv: string;
  clientSecretEnv: string;
  /** basic-auth the token endpoint instead of posting the secret (X) */
  basicAuth?: boolean;
}

export const PROVIDERS: Record<ProviderId, ProviderDef> = {
  linkedin: {
    authUrl: "https://www.linkedin.com/oauth/v2/authorization",
    tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
    scopes: ["openid", "profile", "email", "w_member_social", "w_organization_social", "r_organization_social", "rw_organization_admin"],
    usesPkce: false,
    clientIdEnv: "LINKEDIN_CLIENT_ID",
    clientSecretEnv: "LINKEDIN_CLIENT_SECRET",
  },
  meta: {
    authUrl: "https://www.facebook.com/v19.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v19.0/oauth/access_token",
    scopes: [
      "public_profile",
      "pages_show_list",
      "pages_manage_posts",
      "pages_read_engagement",
      "instagram_basic",
      "instagram_content_publish",
      "business_management",
    ],
    usesPkce: false,
    clientIdEnv: "META_APP_ID",
    clientSecretEnv: "META_APP_SECRET",
  },
  x: {
    authUrl: "https://twitter.com/i/oauth2/authorize",
    tokenUrl: "https://api.twitter.com/2/oauth2/token",
    scopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
    usesPkce: true,
    clientIdEnv: "X_CLIENT_ID",
    clientSecretEnv: "X_CLIENT_SECRET",
  },
};

export function providerReady(p: ProviderId): boolean {
  const def = PROVIDERS[p];
  return !!(process.env[def.clientIdEnv] && process.env[def.clientSecretEnv]);
}

export function readyProviders(): Record<ProviderId, boolean> {
  return { linkedin: providerReady("linkedin"), meta: providerReady("meta"), x: providerReady("x") };
}

export function makePkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function buildAuthUrl(opts: {
  provider: ProviderId;
  state: string;
  redirectUri: string;
  codeChallenge?: string;
}): string {
  const def = PROVIDERS[opts.provider];
  const u = new URL(def.authUrl);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", process.env[def.clientIdEnv]!);
  u.searchParams.set("redirect_uri", opts.redirectUri);
  u.searchParams.set("state", opts.state);
  u.searchParams.set("scope", def.scopes.join(opts.provider === "meta" ? "," : " "));
  if (def.usesPkce && opts.codeChallenge) {
    u.searchParams.set("code_challenge", opts.codeChallenge);
    u.searchParams.set("code_challenge_method", "S256");
  }
  return u.toString();
}

export interface TokenResult {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
}

export async function exchangeCode(opts: {
  provider: ProviderId;
  code: string;
  redirectUri: string;
  codeVerifier?: string | null;
}): Promise<TokenResult> {
  const def = PROVIDERS[opts.provider];
  const clientId = process.env[def.clientIdEnv]!;
  const clientSecret = process.env[def.clientSecretEnv]!;
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: opts.code,
    redirect_uri: opts.redirectUri,
    client_id: clientId,
  });
  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
  if (def.basicAuth || def.usesPkce) {
    headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
  } else {
    body.set("client_secret", clientSecret);
  }
  if (opts.codeVerifier) body.set("code_verifier", opts.codeVerifier);

  const resp = await fetch(def.tokenUrl, { method: "POST", headers, body: body.toString() });
  const text = await resp.text();
  if (!resp.ok) throw new Error(`${opts.provider}_token_${resp.status}: ${text.slice(0, 200)}`);
  const j = JSON.parse(text) as { access_token?: string; refresh_token?: string; expires_in?: number };
  if (!j.access_token) throw new Error(`${opts.provider}_token_missing`);
  return {
    accessToken: j.access_token,
    refreshToken: j.refresh_token,
    expiresAt: j.expires_in ? new Date(Date.now() + j.expires_in * 1000).toISOString() : undefined,
  };
}

/** Discover every account the user can publish to with this token. */
export async function discoverAccounts(provider: ProviderId, accessToken: string): Promise<LinkAccount[]> {
  if (provider === "linkedin") return discoverLinkedIn(accessToken);
  if (provider === "meta") return discoverMeta(accessToken);
  return discoverX(accessToken);
}

async function discoverLinkedIn(token: string): Promise<LinkAccount[]> {
  const out: LinkAccount[] = [];
  const me = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (me.ok) {
    const j = (await me.json()) as { sub?: string; name?: string };
    if (j.sub) {
      out.push({
        externalId: `urn:li:person:${j.sub}`,
        name: j.name || "LinkedIn",
        kind: "linkedin",
        ownerType: "personal",
      });
    }
  }
  // Company pages the user administers
  try {
    const acl = await fetch(
      "https://api.linkedin.com/v2/organizationalEntityAcls?q=roleAssignee&role=ADMINISTRATOR&projection=(elements*(organizationalTarget~(localizedName)))",
      { headers: { Authorization: `Bearer ${token}`, "X-Restli-Protocol-Version": "2.0.0" } },
    );
    if (acl.ok) {
      const j = (await acl.json()) as { elements?: any[] };
      for (const el of j.elements || []) {
        const urn: string | undefined = el.organizationalTarget;
        const name: string = el["organizationalTarget~"]?.localizedName || "Company page";
        if (urn) out.push({ externalId: urn, name, kind: "linkedin", ownerType: "organization" });
      }
    }
  } catch {
    /* org scope may not be granted — personal account still works */
  }
  return out;
}

async function discoverMeta(token: string): Promise<LinkAccount[]> {
  const out: LinkAccount[] = [];
  const resp = await fetch(
    `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${encodeURIComponent(token)}`,
  );
  if (!resp.ok) throw new Error(`meta_accounts_${resp.status}`);
  const j = (await resp.json()) as { data?: any[] };
  for (const page of j.data || []) {
    out.push({
      externalId: page.id,
      name: page.name || "Facebook Page",
      kind: "facebook",
      ownerType: "organization",
      token: page.access_token,
      extra: { page_id: page.id },
    });
    const ig = page.instagram_business_account;
    if (ig?.id) {
      out.push({
        externalId: ig.id,
        name: ig.username ? `@${ig.username}` : "Instagram",
        kind: "instagram",
        ownerType: "brand",
        token: page.access_token,
        extra: { ig_user_id: ig.id, page_id: page.id },
      });
    }
  }
  return out;
}

async function discoverX(token: string): Promise<LinkAccount[]> {
  const resp = await fetch("https://api.twitter.com/2/users/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) throw new Error(`x_me_${resp.status}`);
  const j = (await resp.json()) as { data?: { id?: string; username?: string; name?: string } };
  if (!j.data?.id) throw new Error("x_me_missing");
  return [
    {
      externalId: j.data.id,
      name: j.data.username ? `@${j.data.username}` : j.data.name || "X",
      kind: "x",
      ownerType: "personal",
    },
  ];
}
