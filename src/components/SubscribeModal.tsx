import { Phone, MessageCircle, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { WHATSAPP_NUMBER, whatsappLink } from "@/lib/whatsapp";

export function SubscribeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  if (!open) return null;
  const display = "+964 773 357 0130";
  const msg = t("whatsapp_msg");
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-primary/40 bg-card p-7 shadow-[var(--shadow-elevated)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute end-3 top-3 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent opacity-70" />
        <h3 className="font-display text-2xl font-bold text-gradient">{t("subscribe_modal_title")}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{t("subscribe_modal_desc")}</p>

        <div className="mt-5 rounded-xl border border-border bg-background/60 p-4 text-center">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">{t("contact_phone")}</div>
          <div className="mt-1 font-display text-xl font-bold tracking-wider" dir="ltr" style={{ unicodeBidi: "isolate" }}>{display}</div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <a
            href={whatsappLink(msg)}
            target="_blank" rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-success to-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)]"
          >
            <MessageCircle className="size-4" /> {t("whatsapp_cta")}
          </a>
          <a
            href={`tel:+${WHATSAPP_NUMBER}`}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-5 py-3 text-sm font-semibold text-primary"
          >
            <Phone className="size-4" /> {t("call_cta")}
          </a>
        </div>
      </div>
    </div>
  );
}
