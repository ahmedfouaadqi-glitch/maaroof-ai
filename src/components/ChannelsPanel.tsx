import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getChannelsState,
  startTelegramLink,
  disconnectChannel,
  setChannelApprovalMode,
  setPreferredNotify,
  saveManualSocialToken,
} from "@/lib/publish.functions";
import {
  startChannelOAuth, listOAuthAccounts, attachOAuthAccounts,
  verifyChannel, setDefaultChannel, updateChannelOwner,
} from "@/lib/channel-link.functions";
import { useI18n } from "@/lib/i18n";
import {
  Send, Linkedin, Facebook, Instagram, Twitter, Trash2, CheckCircle2,
  Loader2, ExternalLink, Bell, Mail, Inbox, ChevronDown, ShieldCheck,
  Plus, Star, Building2, User, Sparkles, AlertTriangle,
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
  owner_type?: string | null;
  owner_name?: string | null;
  is_default?: boolean;
  connected_via?: string | null;
  last_error?: string | null;
};

type State = {
  preferred: string;
  onboarded: boolean;
  channels: Channel[];
  linkedinAvailable: boolean;
  telegramAvailable: boolean;
  tiktokAvailable: boolean;
  oauthProviders: { linkedin: boolean; meta: boolean; x: boolean };
};

type PlatformKey = "telegram" | "linkedin" | "facebook" | "instagram" | "x";
type OAuthProvider = "linkedin" | "meta" | "x";

const OWNER_ICON: Record<string, any> = { personal: User, organization: Building2, brand: Sparkles };

const PLATFORMS: {
  key: PlatformKey;
  name: string;
  icon: any;
  color: string;
  gradient: string;
  oauth?: OAuthProvider;
  steps: string[];
}[] = [
  {
    key: "telegram", name: "Telegram", icon: Send, color: "text-sky-500",
    gradient: "from-sky-500/20 to-sky-700/10",
    steps: ["ch_steps_tg_1", "ch_steps_tg_2", "ch_steps_tg_3"],
  },
  {
    key: "linkedin", name: "LinkedIn", icon: Linkedin, color: "text-blue-600",
    gradient: "from-blue-600/20 to-blue-800/10", oauth: "linkedin",
    steps: ["ch_steps_li_1", "ch_steps_li_2", "ch_steps_li_3"],
  },
  {
    key: "facebook", name: "Facebook", icon: Facebook, color: "text-blue-500",
    gradient: "from-blue-500/20 to-indigo-700/10", oauth: "meta",
    steps: ["ch_steps_meta_1", "ch_steps_meta_2", "ch_steps_meta_3"],
  },
  {
    key: "instagram", name: "Instagram", icon: Instagram, color: "text-pink-500",
    gradient: "from-pink-500/20 to-fuchsia-700/10", oauth: "meta",
    steps: ["ch_steps_ig_1", "ch_steps_ig_2", "ch_steps_ig_3"],
  },
  {
    key: "x", name: "X (Twitter)", icon: Twitter, color: "text-foreground",
    gradient: "from-zinc-500/20 to-zinc-800/10", oauth: "x",
    steps: ["ch_steps_x_1", "ch_steps_x_2", "ch_steps_x_3"],
  },
];

type PickerAccount = { externalId: string; name: string; kind: string; ownerType: string };

export function ChannelsPanel({ onChanged }: { onChanged?: () => void }) {
  const { t } = useI18n();
  const fetchState = useServerFn(getChannelsState);
  const tgLinkFn = useServerFn(startTelegramLink);
  const disconnectFn = useServerFn(disconnectChannel);
  const setModeFn = useServerFn(setChannelApprovalMode);
  const setPrefFn = useServerFn(setPreferredNotify);
  const saveManualFn = useServerFn(saveManualSocialToken);
  const startOAuthFn = useServerFn(startChannelOAuth);
  const listAccountsFn = useServerFn(listOAuthAccounts);
  const attachFn = useServerFn(attachOAuthAccounts);
  const verifyFn = useServerFn(verifyChannel);
  const defaultFn = useServerFn(setDefaultChannel);
  const ownerFn = useServerFn(updateChannelOwner);

  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [tgLink, setTgLink] = useState<string | null>(null);
  const [dialogProvider, setDialogProvider] = useState<"facebook" | "instagram" | "x" | null>(null);
  const [picker, setPicker] = useState<{ linkId: string; provider: string; accounts: PickerAccount[] } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = async () => setState((await fetchState()) as State);
  useEffect(() => { load(); }, []);

  // ---- OAuth popup flow -----------------------------------------------------
  const waitForPopup = (popup: Window, provider: string) =>
    new Promise<string>((resolve, reject) => {
      let poll: number | undefined;
      const cleanup = () => {
        window.removeEventListener("message", onMsg);
        if (poll !== undefined) window.clearInterval(poll);
      };
      const onMsg = (e: MessageEvent) => {
        const d: any = e.data;
        if (!d || (d.type !== "channelLinkComplete" && d.type !== "channelLinkFailed")) return;
        if (d.provider !== provider) return;
        cleanup();
        if (d.type === "channelLinkComplete") resolve(String(d.linkId));
        else reject(new Error(d.error || "oauth_failed"));
      };
      window.addEventListener("message", onMsg);
      poll = window.setInterval(() => {
        if (!popup.closed) return;
        cleanup();
        reject(new Error("popup_closed"));
      }, 600);
    });

  const connectOAuth = async (provider: OAuthProvider) => {
    setNotice(null);
    const popup = window.open("", "maaroof-oauth", "width=620,height=760");
    if (!popup) { setNotice(t("ch_popup_blocked")); return; }
    setBusy(provider);
    try {
      const r = (await startOAuthFn({ data: { provider } })) as any;
      if (!r?.ok) { popup.close(); setNotice(t("ch_provider_pending")); return; }
      const done = waitForPopup(popup, provider);
      popup.location.href = r.authorizationUrl;
      const linkId = await done;
      const accs = (await listAccountsFn({ data: { linkId } })) as any;
      if (!accs?.ok) { setNotice(t("ch_link_incomplete")); return; }
      setPicker({ linkId, provider, accounts: accs.accounts as PickerAccount[] });
    } catch (e: any) {
      try { popup.close(); } catch { /* noop */ }
      if (e?.message !== "popup_closed") setNotice(`${t("ch_link_failed")} — ${e?.message || ""}`);
    } finally {
      setBusy(null);
    }
  };

  const connectTelegram = async () => {
    setBusy("telegram");
    try {
      const r = (await tgLinkFn()) as any;
      if (r?.ok && r.link) {
        setTgLink(r.link);
        window.open(r.link, "_blank", "noopener,noreferrer");
      } else {
        setNotice(t("ag_ch_tg_not_ready") || t("auto.telegram_bot_not_configured_contact_admin"));
      }
    } finally { setBusy(null); await load(); onChanged?.(); }
  };

  const disconnect = async (id: string) => {
    if (!confirm(t("ag_ch_confirm_disconnect") || t("auto.disconnect_this_channel"))) return;
    setBusy(id);
    try { await disconnectFn({ data: { id } }); }
    finally { setBusy(null); await load(); onChanged?.(); }
  };

  const verify = async (id: string) => {
    setBusy(id);
    try {
      const r = (await verifyFn({ data: { id } })) as any;
      setNotice(r?.ok ? t("ch_verify_ok") : `${t("ch_verify_fail")} — ${r?.error || ""}`);
    } finally { setBusy(null); await load(); onChanged?.(); }
  };

  const makeDefault = async (id: string) => { await defaultFn({ data: { id } }); await load(); };
  const toggleMode = async (id: string, mode: string) => {
    await setModeFn({ data: { id, mode: mode === "auto" ? "manual" : "auto" } });
    await load();
  };
  const setOwner = async (id: string, ownerType: string) => {
    await ownerFn({ data: { id, ownerType } });
    await load();
  };
  const choosePref = async (channel: string) => { await setPrefFn({ data: { channel } }); await load(); };

  if (!state) {
    return <div className="rounded-2xl border border-border bg-card/70 p-5"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>;
  }

  const ready = state.oauthProviders || { linkedin: false, meta: false, x: false };
  const accountsOf = (kind: string) => state.channels.filter((c) => c.kind === kind);

  return (
    <div className="mt-8 space-y-6">
      <div className="rounded-2xl border border-accent/30 bg-card/70 p-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold">
          <CheckCircle2 className="size-5 text-accent" />
          {t("ch_panel_title") || t("auto.publishing_channels")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("ch_panel_desc2")}</p>

        <div className="mt-3 flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs text-foreground/85">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>{t("ch_security_note")}</span>
        </div>

        {notice && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
            <span>{notice}</span>
          </div>
        )}

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {PLATFORMS.map((p) => {
            const Icon = p.icon;
            const list = accountsOf(p.key);
            const oauthReady = p.oauth ? ready[p.oauth] : state.telegramAvailable;

            return (
              <div key={p.key} className={`rounded-xl border ${list.length ? "border-success/40" : "border-border/60"} bg-gradient-to-br ${p.gradient} p-4`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`grid size-10 place-items-center rounded-lg bg-background/60 ${p.color}`}>
                      <Icon className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-display text-base font-bold">{p.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {list.length
                          ? `${list.length} ${t("ch_linked_accounts")}`
                          : (oauthReady ? t("ch_not_connected") : t("ch_provider_pending_short"))}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => (p.oauth ? connectOAuth(p.oauth) : connectTelegram())}
                    disabled={busy === (p.oauth || p.key) || !oauthReady}
                    className="inline-flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-50"
                  >
                    {busy === (p.oauth || p.key) ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
                    {list.length ? t("ch_add_account") : (t("ch_connect") || t("auto.connect"))}
                  </button>
                </div>

                {/* Linked accounts */}
                {list.map((ch) => {
                  const OwnerIcon = OWNER_ICON[ch.owner_type || "personal"] || User;
                  return (
                    <div key={ch.id} className="mt-3 rounded-lg border border-border/60 bg-background/50 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 truncate text-sm font-semibold">
                            <OwnerIcon className="size-3.5 text-primary" />
                            {ch.owner_name || ch.account_label || p.name}
                            {ch.is_default && <Star className="size-3 fill-warning text-warning" />}
                          </div>
                          <div className="mt-0.5 text-[11px] text-muted-foreground">
                            {t(`ch_owner_${ch.owner_type || "personal"}`)}
                            {ch.last_error ? ` · ⚠ ${ch.last_error}` : ch.verified_at ? " · ✓" : ""}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button onClick={() => verify(ch.id)} disabled={busy === ch.id} title={t("ch_verify")}
                            className="rounded-md border border-border p-1.5 hover:bg-muted disabled:opacity-50">
                            {busy === ch.id ? <Loader2 className="size-3 animate-spin" /> : <ShieldCheck className="size-3" />}
                          </button>
                          <button onClick={() => makeDefault(ch.id)} title={t("ch_make_default")}
                            className="rounded-md border border-border p-1.5 hover:bg-muted">
                            <Star className={`size-3 ${ch.is_default ? "fill-warning text-warning" : ""}`} />
                          </button>
                          <button onClick={() => disconnect(ch.id)} disabled={busy === ch.id} title={t("ch_disconnect")}
                            className="rounded-md border border-destructive/40 p-1.5 text-destructive hover:bg-destructive/10 disabled:opacity-50">
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {(["personal", "organization", "brand"] as const).map((ot) => (
                          <button key={ot} onClick={() => setOwner(ch.id, ot)}
                            className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${((ch.owner_type || "personal") === ot) ? "bg-primary text-primary-foreground" : "border border-border bg-background/60 hover:bg-background"}`}>
                            {t(`ch_owner_${ot}`)}
                          </button>
                        ))}
                        <button onClick={() => toggleMode(ch.id, ch.approval_mode)}
                          className="ms-auto inline-flex items-center gap-1.5 rounded-md border border-border bg-background/60 px-2 py-0.5 text-[11px] font-semibold hover:bg-background">
                          <span className={`inline-block size-2 rounded-full ${ch.approval_mode === "auto" ? "bg-warning" : "bg-success"}`} />
                          {ch.approval_mode === "auto" ? (t("ch_mode_auto") || t("auto.auto_publish")) : (t("ch_mode_manual") || t("auto.pre_publication_approval"))}
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Inline how-to */}
                <Collapsible className="mt-3">
                  <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border border-border/50 bg-background/40 px-2.5 py-1.5 text-[11px] font-semibold hover:bg-background/60">
                    <span>{t("ch_how_to_link")}</span><ChevronDown className="size-3" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-1.5 rounded-md border border-border/50 bg-background/40 p-2.5">
                    <ol className="list-decimal space-y-1 ps-4 text-[11px] text-muted-foreground">
                      {p.steps.map((s) => <li key={s}>{t(s)}</li>)}
                    </ol>
                    {p.key === "telegram" && tgLink && (
                      <a href={tgLink} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 truncate text-[11px] text-primary underline">
                        <ExternalLink className="size-3" /> {tgLink}
                      </a>
                    )}
                    {p.oauth && !oauthReady && (
                      <p className="mt-2 text-[11px] text-warning">{t("ch_provider_pending")}</p>
                    )}
                    {(p.key === "facebook" || p.key === "instagram" || p.key === "x") && (
                      <button onClick={() => setDialogProvider(p.key as any)}
                        className="mt-2 text-[11px] font-semibold text-muted-foreground underline hover:text-foreground">
                        {t("ch_manual_fallback")}
                      </button>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              </div>
            );
          })}
        </div>

        {/* Notification preference */}
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
                { v: "telegram", label: "Telegram", icon: Send },
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

      <AccountPicker
        data={picker}
        onClose={() => setPicker(null)}
        onSave={async (selections) => {
          if (!picker) return;
          await attachFn({ data: { linkId: picker.linkId, selections } });
          setPicker(null);
          await load();
          onChanged?.();
        }}
      />

      <ManualTokenDialog
        provider={dialogProvider}
        onClose={() => setDialogProvider(null)}
        onSaved={async () => { setDialogProvider(null); await load(); onChanged?.(); }}
        saveFn={saveManualFn}
      />
    </div>
  );
}

function AccountPicker({
  data, onClose, onSave,
}: {
  data: { linkId: string; provider: string; accounts: PickerAccount[] } | null;
  onClose: () => void;
  onSave: (sel: { externalId: string; ownerType: string; ownerName: string }[]) => Promise<void>;
}) {
  const { t } = useI18n();
  const [sel, setSel] = useState<Record<string, { ownerType: string; ownerName: string }>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!data) { setSel({}); return; }
    const init: Record<string, { ownerType: string; ownerName: string }> = {};
    for (const a of data.accounts) init[a.externalId] = { ownerType: a.ownerType, ownerName: a.name };
    setSel(init);
  }, [data]);

  if (!data) return null;
  const chosen = Object.entries(sel);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("ch_pick_accounts")}</DialogTitle>
          <DialogDescription>{t("ch_pick_accounts_desc")}</DialogDescription>
        </DialogHeader>

        <div className="max-h-[50vh] space-y-2 overflow-y-auto">
          {data.accounts.map((a) => {
            const on = !!sel[a.externalId];
            return (
              <div key={a.externalId} className={`rounded-lg border p-3 ${on ? "border-primary/50 bg-primary/5" : "border-border/60"}`}>
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(e) => setSel((s) => {
                      const n = { ...s };
                      if (e.target.checked) n[a.externalId] = { ownerType: a.ownerType, ownerName: a.name };
                      else delete n[a.externalId];
                      return n;
                    })}
                  />
                  <span className="truncate">{a.name}</span>
                  <span className="ms-auto rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase">{a.kind}</span>
                </label>
                {on && (
                  <div className="mt-2 space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      {(["personal", "organization", "brand"] as const).map((ot) => (
                        <button key={ot}
                          onClick={() => setSel((s) => ({ ...s, [a.externalId]: { ...s[a.externalId], ownerType: ot } }))}
                          className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${sel[a.externalId].ownerType === ot ? "bg-primary text-primary-foreground" : "border border-border bg-background/60"}`}>
                          {t(`ch_owner_${ot}`)}
                        </button>
                      ))}
                    </div>
                    <Input
                      value={sel[a.externalId].ownerName}
                      onChange={(e) => setSel((s) => ({ ...s, [a.externalId]: { ...s[a.externalId], ownerName: e.target.value } }))}
                      placeholder={t("ch_owner_name_ph")}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <button onClick={onClose} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">{t("auto.cancel")}</button>
          <button
            disabled={busy || !chosen.length}
            onClick={async () => {
              setBusy(true);
              try { await onSave(chosen.map(([externalId, v]) => ({ externalId, ...v }))); }
              finally { setBusy(false); }
            }}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {busy && <Loader2 className="size-3 animate-spin" />} {t("ch_attach")}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const MANUAL_HELP: Record<string, { name: string; icon: any; color: string; url: string; steps: string[] }> = {
  facebook: {
    name: "Facebook", icon: Facebook, color: "text-blue-500",
    url: "https://developers.facebook.com/tools/explorer/",
    steps: ["auto.open_graph_api_explorer_and_select", "auto.request_my_permissions_pages_manage_posts", "auto.copy_the_page_access_token_and"],
  },
  instagram: {
    name: "Instagram", icon: Instagram, color: "text-pink-500",
    url: "https://developers.facebook.com/docs/instagram-api/getting-started",
    steps: ["auto.your_instagram_business_account_must_be", "auto.get_long_lived_page_access_token", "auto.copy_the_ig_user_id_from"],
  },
  x: {
    name: "X (Twitter)", icon: Twitter, color: "text-foreground",
    url: "https://developer.twitter.com/en/portal/dashboard",
    steps: ["auto.open_developer_portal_and_create_an", "auto.enable_oauth_2_0_with_scopes", "auto.generate_user_access_token_bearer_and"],
  },
};

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
  const meta = MANUAL_HELP[provider];
  const MetaIcon = meta.icon;

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
            <MetaIcon className={`size-5 ${meta.color}`} /> {meta.name}
          </DialogTitle>
          <DialogDescription>{t("auto.follow_the_steps_to_get_your")}</DialogDescription>
        </DialogHeader>

        <ol className="list-decimal space-y-1 rounded-lg border border-border/60 bg-muted/40 p-3 ps-6 text-xs text-muted-foreground">
          {meta.steps.map((s, i) => <li key={i}>{t(s)}</li>)}
        </ol>

        <a href={meta.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
          <ExternalLink className="size-3" /> {meta.url}
        </a>

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
            {busy && <Loader2 className="size-3 animate-spin" />} {t("ch_test_and_save")}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
