import { createFileRoute } from "@tanstack/react-router";
import { exchangeCode, discoverAccounts, providerReady, type ProviderId } from "@/lib/channels/providers.server";

const VALID = new Set<ProviderId>(["linkedin", "meta", "x"]);

function page(script: string, message: string) {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>MAAROOF</title></head>
<body style="font-family:system-ui;background:#0b1020;color:#e6ecff;display:grid;place-items:center;height:100vh;margin:0">
<p>${message}</p><script>${script}</script></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

function notify(ok: boolean, provider: string, linkId: string, error?: string) {
  const payload = JSON.stringify({ type: ok ? "channelLinkComplete" : "channelLinkFailed", provider, linkId, error: error || null });
  return page(
    `try{window.opener&&window.opener.postMessage(${payload},"*")}catch(e){};window.close();`,
    ok ? "تم التفويض — يمكنك إغلاق هذه النافذة." : `فشل الربط: ${error || "unknown"}`,
  );
}

export const Route = createFileRoute("/api/public/oauth/$provider/callback")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const provider = params.provider as ProviderId;
        const url = new URL(request.url);
        const state = url.searchParams.get("state") || "";
        const code = url.searchParams.get("code") || "";
        const providerError = url.searchParams.get("error_description") || url.searchParams.get("error");

        if (!VALID.has(provider) || !providerReady(provider)) {
          return notify(false, provider, "", "provider_not_configured");
        }
        if (!state) return notify(false, provider, "", "missing_state");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: row } = await supabaseAdmin
          .from("oauth_link_states")
          .select("id, user_id, provider, code_verifier, redirect_uri, consumed_at, expires_at")
          .eq("state", state)
          .maybeSingle();

        if (!row || row.provider !== provider) return notify(false, provider, "", "invalid_state");
        if (row.consumed_at) return notify(false, provider, row.id, "state_already_used");
        if (new Date(row.expires_at).getTime() < Date.now()) return notify(false, provider, row.id, "state_expired");

        // single-use: burn it before doing anything else
        await supabaseAdmin
          .from("oauth_link_states")
          .update({ consumed_at: new Date().toISOString() })
          .eq("id", row.id);

        if (providerError || !code) {
          return notify(false, provider, row.id, providerError || "missing_code");
        }

        try {
          const token = await exchangeCode({
            provider,
            code,
            redirectUri: row.redirect_uri,
            codeVerifier: row.code_verifier,
          });
          const accounts = await discoverAccounts(provider, token.accessToken);
          if (!accounts.length) return notify(false, provider, row.id, "no_publishable_accounts");

          const { sealConfig } = await import("@/lib/channels/crypto.server");
          await supabaseAdmin
            .from("oauth_link_states")
            .update({
              payload: {
                sealed: sealConfig({ access_token: token.accessToken, refresh_token: token.refreshToken }),
                expires_at: token.expiresAt || null,
                accounts: accounts.map((a) => ({
                  externalId: a.externalId,
                  name: a.name,
                  kind: a.kind,
                  ownerType: a.ownerType,
                  extra: a.extra || {},
                  sealedToken: a.token ? sealConfig({ access_token: a.token }) : null,
                })),
              } as any,
            })
            .eq("id", row.id);

          return notify(true, provider, row.id);
        } catch (e: any) {
          return notify(false, provider, row.id, (e?.message || "link_failed").slice(0, 160));
        }
      },
    },
  },
});
