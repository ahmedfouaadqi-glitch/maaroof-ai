import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getChannelsState,
  startTelegramLink,
  enableLinkedIn,
  disconnectChannel,
  setChannelApprovalMode,
  setPreferredNotify,
} from "@/lib/publish.functions";
import { useI18n } from "@/lib/i18n";
import { Send, Linkedin, Music2, Trash2, CheckCircle2, Loader2, ExternalLink, Bell, Mail, Inbox } from "lucide-react";

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

const KIND_META: Record<string, { name: string; icon: any; color: string; gradient: string }> = {
  telegram: { name: "Telegram", icon: Send, color: "text-sky-500", gradient: "from-sky-500/20 to-sky-700/10" },
  linkedin: { name: "LinkedIn", icon: Linkedin, color: "text-blue-600", gradient: "from-blue-600/20 to-blue-800/10" },
  tiktok: { name: "TikTok", icon: Music2, color: "text-pink-500", gradient: "from-pink-500/20 to-fuchsia-700/10" },
};

const COMING_SOON = ["facebook", "instagram", "x", "whatsapp"];

export function ChannelsPanel({ onChanged }: { onChanged?: () => void }) {
  const { t } = useI18n();
  const fetchState = useServerFn(getChannelsState);
  const tgLinkFn = useServerFn(startTelegramLink);
  const liEnableFn = useServerFn(enableLinkedIn);
  const disconnectFn = useServerFn(disconnectChannel);
  const setModeFn = useServerFn(setChannelApprovalMode);
  const setPrefFn = useServerFn(setPreferredNotify);

  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [tgLink, setTgLink] = useState<string | null>(null);

  const load = async () => {
    const s = (await fetchState()) as State;
    setState(s);
  };
  useEffect(() => { load(); }, []);

  const connectTelegram = async () => {
    setBusy("tg");
    try {
      const r = (await tgLinkFn()) as any;
      if (r?.ok && r.link) {
        setTgLink(r.link);
        window.open(r.link, "_blank", "noopener,noreferrer");
      } else {
        alert(t("ag_ch_tg_not_ready") || "بوت Telegram غير مُهيّأ بعد. تواصل مع الإدارة.");
      }
    } finally {
      setBusy(null);
      await load();
      onChanged?.();
    }
  };

  const connectLinkedIn = async () => {
    setBusy("li");
    try {
      const r = (await liEnableFn()) as any;
      if (!r?.ok) alert(t("ag_ch_li_unavailable") || "LinkedIn غير متاح حالياً.");
    } finally {
      setBusy(null);
      await load();
      onChanged?.();
    }
  };

  const disconnect = async (id: string) => {
    if (!confirm(t("ag_ch_confirm_disconnect") || "هل تريد فصل هذه القناة؟")) return;
    setBusy(id);
    try { await disconnectFn({ data: { id } }); }
    finally { setBusy(null); await load(); onChanged?.(); }
  };

  const toggleMode = async (id: string, currentMode: string) => {
    const mode = currentMode === "auto" ? "manual" : "auto";
    await setModeFn({ data: { id, mode } });
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
      {/* OAuth / Real connections */}
      <div className="rounded-2xl border border-accent/30 bg-card/70 p-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold">
          <CheckCircle2 className="size-5 text-accent" />
          {t("ch_panel_title") || "قنوات الربط الحقيقية"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("ch_panel_desc") || "اربط حساباتك بنقرة واحدة. الوكيل يحترم تفضيلك: نشر تلقائي أو موافقة قبل النشر."}
        </p>

        <div className="mt-4 space-y-3">
          {(["telegram", "linkedin", "tiktok"] as const).map((kind) => {
            const meta = KIND_META[kind];
            const Icon = meta.icon;
            const ch = findChan(kind);
            const avail =
              kind === "telegram" ? state.telegramAvailable :
              kind === "linkedin" ? state.linkedinAvailable :
              state.tiktokAvailable;
            const isPref = state.preferred === kind;
            return (
              <div key={kind} className={`rounded-xl border ${ch ? "border-success/40" : "border-border/60"} bg-gradient-to-br ${meta.gradient} p-4`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`grid size-10 place-items-center rounded-lg bg-background/60 ${meta.color}`}>
                      <Icon className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-display text-base font-bold">{meta.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {ch ? `✓ ${ch.account_label || t("ch_connected") || "متصل"}` : (avail ? (t("ch_not_connected") || "غير متصل") : (t("ch_coming") || "قريباً"))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {ch ? (
                      <button
                        onClick={() => disconnect(ch.id)}
                        disabled={busy === ch.id}
                        className="inline-flex items-center gap-1 rounded-lg border border-destructive/40 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"
                      >
                        {busy === ch.id ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
                        {t("ch_disconnect") || "فصل"}
                      </button>
                    ) : avail ? (
                      <button
                        onClick={kind === "telegram" ? connectTelegram : kind === "linkedin" ? connectLinkedIn : () => alert(t("ch_tiktok_soon") || "TikTok قريباً.")}
                        disabled={busy === kind.slice(0, 2)}
                        className="inline-flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-50"
                      >
                        {busy === kind.slice(0, 2) ? <Loader2 className="size-3 animate-spin" /> : <ExternalLink className="size-3" />}
                        {t("ch_connect") || "اتصال"}
                      </button>
                    ) : (
                      <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">{t("ch_soon") || "قريباً"}</span>
                    )}
                  </div>
                </div>

                {ch && (
                  <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border/40 pt-3">
                    <button
                      onClick={() => toggleMode(ch.id, ch.approval_mode)}
                      className="inline-flex items-center gap-2 rounded-md border border-border bg-background/60 px-3 py-1.5 text-xs font-semibold hover:bg-background"
                    >
                      <span className={`inline-block size-2 rounded-full ${ch.approval_mode === "auto" ? "bg-warning" : "bg-success"}`} />
                      {ch.approval_mode === "auto"
                        ? (t("ch_mode_auto") || "نشر تلقائي بدون موافقة")
                        : (t("ch_mode_manual") || "موافقة قبل النشر")}
                    </button>
                    <button
                      onClick={() => choosePref(kind)}
                      className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold ${isPref ? "bg-primary text-primary-foreground" : "border border-border bg-background/60 hover:bg-background"}`}
                    >
                      <Bell className="size-3" />
                      {isPref ? (t("ch_notify_here_on") || "✓ تستلم النتائج هنا") : (t("ch_notify_here") || "استلم النتائج هنا")}
                    </button>
                  </div>
                )}

                {kind === "telegram" && tgLink && !ch && (
                  <div className="mt-3 rounded-md border border-primary/40 bg-primary/10 p-3 text-xs">
                    <p className="font-semibold">{t("ch_tg_open_link") || "فُتح Telegram في نافذة جديدة. اضغط Start لإكمال الربط."}</p>
                    <a href={tgLink} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-primary underline">
                      <ExternalLink className="size-3" /> {tgLink}
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Preferred = email/inapp/none */}
        <div className="mt-5 rounded-xl border border-border/60 bg-background/40 p-4">
          <div className="mb-2 text-xs font-semibold text-muted-foreground">{t("ch_notify_pref_title") || "إذا لم تربط قناة خارجية، استلم الإشعارات عبر:"}</div>
          <div className="flex flex-wrap gap-2">
            {[
              { v: "inapp", label: t("notify_inapp") || "صندوق التطبيق", icon: Inbox },
              { v: "email", label: t("notify_email") || "البريد", icon: Mail },
              { v: "none", label: t("notify_none") || "بدون", icon: Bell },
            ].map((o) => (
              <button
                key={o.v}
                onClick={() => choosePref(o.v)}
                className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold ${state.preferred === o.v ? "bg-primary text-primary-foreground" : "border border-border bg-background/60 hover:bg-background"}`}
              >
                <o.icon className="size-3" />
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Coming soon */}
      <div className="rounded-2xl border border-border bg-card/40 p-4">
        <h3 className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
          ⏰ {t("ch_coming_title") || "قريباً (بانتظار اعتماد Meta و X)"}
        </h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {COMING_SOON.map((k) => (
            <span key={k} className="rounded-full border border-border/60 bg-background/40 px-3 py-1 text-xs capitalize text-muted-foreground">
              {k}
            </span>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {t("ch_coming_desc") || "هذه المنصات تتطلب اعتمادات أعمال خاصة. نعمل على توفيرها."}
        </p>
      </div>
    </div>
  );
}
