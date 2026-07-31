import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getChannelsState, setPreferredNotify, skipNotifyOnboarding } from "@/lib/publish.functions";
import { Send, Linkedin, Inbox, Mail, BellOff, Loader2, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function NotifyOnboardModal() {
  const { t } = useI18n();
  const stateFn = useServerFn(getChannelsState);
  const prefFn = useServerFn(setPreferredNotify);
  const skipFn = useServerFn(skipNotifyOnboarding);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const s = (await stateFn()) as any;
        if (!s.onboarded) setShow(true);
      } catch { /* not authed */ }
    })();
  }, []);

  if (!show) return null;

  const pick = async (channel: string) => {
    setBusy(channel);
    try { await prefFn({ data: { channel } }); setShow(false); }
    finally { setBusy(null); }
  };
  const skip = async () => {
    setBusy("skip");
    try { await skipFn(); setShow(false); }
    finally { setBusy(null); }
  };

  const opts = [
    { v: "inapp", label: t("notify_inapp") || t("auto.application_box"), icon: Inbox, desc: t("notify_inapp_desc") || t("auto.in_site_notification_bell") },
    { v: "telegram", label: "Telegram", icon: Send, desc: t("notify_tg_desc") || t("auto.link_telegram_to_receive_results_as") },
    { v: "linkedin", label: "LinkedIn", icon: Linkedin, desc: t("notify_li_desc") || t("auto.direct_publish_after_your_approval") },
    { v: "email", label: t("notify_email") || t("auto.mail"), icon: Mail, desc: t("notify_email_desc") || t("auto.summaries_to_your_email") },
    { v: "none", label: t("notify_none") || t("auto.nothing"), icon: BellOff, desc: t("notify_none_desc") || t("auto.work_silently") },
  ];

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-display text-xl font-bold">{t("notify_onb_title") || t("auto.how_do_you_want_to_receive")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("notify_onb_desc") || t("auto.choose_one_method_now_you_can")}</p>
          </div>
          <button onClick={skip} aria-label="close" className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
        </div>

        <div className="mt-5 grid gap-2">
          {opts.map((o) => (
            <button
              key={o.v}
              onClick={() => pick(o.v)}
              disabled={busy !== null}
              className="flex items-center gap-3 rounded-xl border border-border bg-background/60 p-3 text-start hover:border-primary hover:bg-background disabled:opacity-50"
            >
              <div className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
                {busy === o.v ? <Loader2 className="size-5 animate-spin" /> : <o.icon className="size-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold">{o.label}</div>
                <div className="text-xs text-muted-foreground">{o.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
