import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getChannelsState,
  startTelegramLink,
  enableLinkedIn,
  disconnectChannel,
  setChannelApprovalMode,
  setPreferredNotify,
  saveManualSocialToken,
} from "@/lib/publish.functions";
import { useI18n } from "@/lib/i18n";
import {
  Send, Linkedin, Facebook, Instagram, Twitter, Trash2, CheckCircle2,
  Loader2, ExternalLink, Bell, Mail, Inbox, ChevronDown,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type Channel = {
  id: string;
  kind: string;
  label: string | null;
  account_label: string | null;
  active: boolean;
  verified_at: string | null;
  approval_mode: string;
};

type State = {
  preferred: string;
  onboarded: boolean;
  channels: Channel[];
  linkedinAvailable: boolean;
  telegramAvailable: boolean;
  tiktokAvailable: boolean;
};

type ProviderKey = "telegram" | "linkedin" | "facebook" | "instagram" | "x";

const PROVIDER_META: Record<ProviderKey, {
  name: string;
  icon: any;
  color: string;
  gradient: string;
  tokenHelpUrl?: string;
  tokenHelpSteps?: string[];
}> = {
  telegram: {
    name: "Telegram", icon: Send, color: "text-sky-500",
    gradient: "from-sky-500/20 to-sky-700/10",
  },
  linkedin: {
    name: "LinkedIn", icon: Linkedin, color: "text-blue-600",
    gradient: "from-blue-600/20 to-blue-800/10",
  },
  facebook: {
    name: "Facebook", icon: Facebook, color: "text-blue-500",
    gradient: "from-blue-500/20 to-indigo-700/10",
    tokenHelpUrl: "https://developers.facebook.com/tools/explorer/",
    tokenHelpSteps: [
      "auto.open_graph_api_explorer_and_select",
      "auto.request_my_permissions_pages_manage_posts",
      "auto.copy_the_page_access_token_and",
    ],
  },
  instagram: {
    name: "Instagram", icon: Instagram, color: "text-pink-500",
    gradient: "from-pink-500/20 to-fuchsia-700/10",
    tokenHelpUrl: "https://developers.facebook.com/docs/instagram-api/getting-started",
    tokenHelpSteps: [
      "auto.your_instagram_business_account_must_be",
      "auto.get_long_lived_page_access_token",
      "auto.copy_the_ig_user_id_from",
    ],
  },
  x: {
    name: "X (Twitter)", icon: Twitter, color: "text-foreground",
    gradient: "from-zinc-500/20 to-zinc-800/10",
    tokenHelpUrl: "https://developer.twitter.com/en/portal/dashboard",
    tokenHelpSteps: [
      "auto.open_developer_portal_and_create_an",
      "auto.enable_oauth_2_0_with_scopes",
      "auto.generate_user_access_token_bearer_and",
    ],
  },
};

const ORDER: ProviderKey[] = ["telegram", "linkedin", "facebook", "instagram", "x"];

export function ChannelsPanel({ onChanged }: { onChanged?: () => void }) {
  const { t } = useI18n();
  const fetchState = useServerFn(getChannelsState);
  const tgLinkFn = useServerFn(startTelegramLink);
  const liEnableFn = useServerFn(enableLinkedIn);
  const disconnectFn = useServerFn(disconnectChannel);
  const setModeFn = useServerFn(setChannelApprovalMode);
  const setPrefFn = useServerFn(setPreferredNotify);
  const saveManualFn = useServerFn(saveManualSocialToken);

  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [tgLink, setTgLink] = useState<string | null>(null);
  const [dialogProvider, setDialogProvider] = useState<"facebook" | "instagram" | "x" | null>(null);

  const load = async () => setState((await fetchState()) as State);
  useEffect(() => { load(); }, []);

  const connectTelegram = async () => {
    setBusy("telegram");
    try {
      const r = (await tgLinkFn()) as any;
      if (r?.ok && r.link) {
        setTgLink(r.link);
        window.open(r.link, "_blank", "noopener,noreferrer");
      } else {
        alert(t("ag_ch_tg_not_ready") || t("auto.telegram_bot_not_configured_contact_admin"));
      }
    } finally { setBusy(null); await load(); onChanged?.(); }
  };

  const connectLinkedIn = async () => {
    setBusy("linkedin");
    try {
      const r = (await liEnableFn()) as any;
      if (!r?.ok) alert(t("ag_ch_li_unavailable") || t("auto.linkedin_currently_unavailable_not_yet_connected"));
    } finally { setBusy(null); await load(); onChanged?.(); }
  };

  const disconnect = async (id: string) => {
    if (!confirm(t("ag_ch_confirm_disconnect") || t("auto.disconnect_this_channel"))) return;
    setBusy(id);
    try { await disconnectFn({ data: { id } }); }
    finally { setBusy(null); await load(); onChanged?.(); }
  };

  const toggleMode = async (id: string, currentMode: string) => {
    await setModeFn({ data: { id, mode: currentMode === "auto" ? "manual" : "auto" } });
    await load();
  };

  const choosePref = async (channel: string) => {
    await setPrefFn({ data: { channel } });
    await load();
  };

  if (!state) {
    return <div className="rounded-2xl border border-border bg-card/70 p-5"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>;
  }

  const findChan = (kind: string) => state.channels.find((c) => c.kind === kind && c.verified_at);

  return (
    <div className="mt-8 space-y-6">
      <div className="rounded-2xl border border-accent/30 bg-card/70 p-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold">
          <CheckCircle2 className="size-5 text-accent" />
          {t("ch_panel_title") || t("auto.publishing_channels")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("ch_panel_desc") || t("auto.connect_your_accounts_with_one_click")}
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {ORDER.map((kind) => {
            const meta = PROVIDER_META[kind];
            const Icon = meta.icon;
            const ch = findChan(kind);
            const isPref = state.preferred === kind;
            const isManual = kind === "facebook" || kind === "instagram" || kind === "x";

            const onConnect = () => {
              if (kind === "telegram") return connectTelegram();
              if (kind === "linkedin") return connectLinkedIn();
              setDialogProvider(kind as any);
            };

            return (
              <div key={kind} className={`rounded-xl border ${ch ? "border-success/40" : "border-border/60"} bg-gradient-to-br ${meta.gradient} p-4`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`grid size-10 place-items-center rounded-lg bg-background/60 ${meta.color}`}>
                      <Icon className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-display text-base font-bold">{meta.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {ch ? `✓ ${ch.account_label || t("ch_connected") || t("auto.connected")}` : (t("ch_not_connected") || t("auto.offline"))}
                      </div>
                    </div>
                  </div>
                  {ch ? (
                    <button
                      onClick={() => disconnect(ch.id)}
                      disabled={busy === ch.id}
                      className="inline-flex items-center gap-1 rounded-lg border border-destructive/40 px-2.5 py-1 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"
                    >
                      {busy === ch.id ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
                      {t("ch_disconnect") || t("auto.disconnect")}
                    </button>
                  ) : (
                    <button
                      onClick={onConnect}
                      disabled={busy === kind}
                      className="inline-flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-50"
                    >
                      {busy === kind ? <Loader2 className="size-3 animate-spin" /> : <ExternalLink className="size-3" />}
                      {t("ch_connect") || t("auto.connect")}
                    </button>
                  )}
                </div>

                {ch && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/40 pt-3">
                    <button
                      onClick={() => toggleMode(ch.id, ch.approval_mode)}
                      className="inline-flex items-center gap-2 rounded-md border border-border bg-background/60 px-2.5 py-1 text-xs font-semibold hover:bg-background"
                    >
                      <span className={`inline-block size-2 rounded-full ${ch.approval_mode === "auto" ? "bg-warning" : "bg-success"}`} />
                      {ch.approval_mode === "auto" ? (t("ch_mode_auto") || t("auto.auto_publish")) : (t("ch_mode_manual") || t("auto.pre_publication_approval"))}
                    </button>
                    <button
                      onClick={() => choosePref(kind)}
                      className={`inline-flex items-center gap-2 rounded-md px-2.5 py-1 text-xs font-semibold ${isPref ? "bg-primary text-primary-foreground" : "border border-border bg-background/60 hover:bg-background"}`}
                    >
                      <Bell className="size-3" />
                      {isPref ? (t("ch_notify_here_on") || t("auto.you_receive_here")) : (t("ch_notify_here") || t("auto.receive_here"))}
                    </button>
                  </div>
                )}

                {isManual && !ch && (
                  <div className="mt-2 text-[11px] text-muted-foreground">
                    {t("ch_manual_note") || t("auto.requires_pasting_access_token_from_your")}
                  </div>
                )}

                {kind === "telegram" && tgLink && !ch && (
                  <div className="mt-3 rounded-md border border-primary/40 bg-primary/10 p-2 text-[11px]">
                    <p className="font-semibold">{t("ch_tg_open_link") || t("auto.press_start_in_telegram_to_complete")}</p>
                    <a href={tgLink} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-primary underline truncate">
                      <ExternalLink className="size-3" /> {tgLink}
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Notification preference fallback */}
        <Collapsible className="mt-5">
          <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-border/60 bg-background/40 px-4 py-2 text-xs font-semibold hover:bg-background/60">
            <span>{t("ch_notify_pref_title") || t("auto.advanced_notification_settings")}</span>
            <ChevronDown className="size-4" />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 rounded-lg border border-border/60 bg-background/40 p-3">
            <div className="mb-2 text-xs text-muted-foreground">
              {t("ch_notify_fallback") || t("auto.if_you_don_t_connect_a")}
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { v: "inapp", label: t("notify_inapp") || t("auto.application_box"), icon: Inbox },
                { v: "email", label: t("notify_email") || t("auto.mail"), icon: Mail },
                { v: "none", label: t("notify_none") || t("auto.without"), icon: Bell },
              ].map((o) => (
                <button
                  key={o.v}
                  onClick={() => choosePref(o.v)}
                  className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold ${state.preferred === o.v ? "bg-primary text-primary-foreground" : "border border-border bg-background/60 hover:bg-background"}`}
                >
                  <o.icon className="size-3" /> {o.label}
                </button>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      <ManualTokenDialog
        provider={dialogProvider}
        onClose={() => setDialogProvider(null)}
        onSaved={async () => { setDialogProvider(null); await load(); onChanged?.(); }}
        saveFn={saveManualFn}
      />
    </div>
  );
}

function ManualTokenDialog({
  provider, onClose, onSaved, saveFn,
}: {
  provider: "facebook" | "instagram" | "x" | null;
  onClose: () => void;
  onSaved: () => void;
  saveFn: (a: any) => Promise<any>;
}) {
  const { t } = useI18n();
  const [token, setToken] = useState("");
  const [pageId, setPageId] = useState("");
  const [igUserId, setIgUserId] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (provider) { setToken(""); setPageId(""); setIgUserId(""); setMediaUrl(""); setErr(null); }
  }, [provider]);

  if (!provider) return null;
  const meta = PROVIDER_META[provider];

  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await saveFn({ data: { provider, token, pageId, igUserId, defaultMediaUrl: mediaUrl } });
      if (!r?.ok) setErr(r?.error || t("auto.validation_failed"));
      else onSaved();
    } catch (e: any) { setErr(e?.message || t("auto.error")); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={!!provider} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <meta.icon className={`size-5 ${meta.color}`} /> ربط {meta.name}
          </DialogTitle>
          <DialogDescription>{t("auto.follow_the_steps_to_get_your")}</DialogDescription>
        </DialogHeader>

        <ol className="list-decimal space-y-1 rounded-lg border border-border/60 bg-muted/40 p-3 ps-6 text-xs text-muted-foreground">
          {meta.tokenHelpSteps?.map((s, i) => <li key={i}>{t(s)}</li>)}
        </ol>

        {meta.tokenHelpUrl && (
          <a href={meta.tokenHelpUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
            <ExternalLink className="size-3" /> افتح صفحة الحصول على التوكن
          </a>
        )}

        <div className="space-y-2">
          {provider === "facebook" && (
            <Input placeholder="Page ID" value={pageId} onChange={(e) => setPageId(e.target.value)} />
          )}
          {provider === "instagram" && (
            <>
              <Input placeholder="Instagram User ID" value={igUserId} onChange={(e) => setIgUserId(e.target.value)} />
              <Input placeholder={t("auto.default_image_link_required_for_publishing")} value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} />
            </>
          )}
          <Input type="password" placeholder={provider === "x" ? "User Bearer Token" : "Access Token"} value={token} onChange={(e) => setToken(e.target.value)} />
        </div>

        {err && <p className="text-xs text-destructive">⚠ {err}</p>}

        <DialogFooter>
          <button onClick={onClose} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">{t("auto.cancel")}</button>
          <button onClick={submit} disabled={busy || token.length < 10} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {busy && <Loader2 className="size-3 animate-spin" />} اختبر واحفظ
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
