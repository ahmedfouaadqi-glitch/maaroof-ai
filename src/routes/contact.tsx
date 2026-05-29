import { createFileRoute, Link } from "@tanstack/react-router";
import { Phone, MessageCircle } from "lucide-react";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { AuthProvider } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { WHATSAPP_NUMBER, whatsappLink } from "@/lib/whatsapp";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact MAAROOF Ai · Talk to the AI Visibility Team" },
      { name: "description", content: "Reach the MAAROOF Ai team in Baghdad by WhatsApp or phone to ask about plans, the AI visibility agent, or onboarding for brands in Iraq." },
      { property: "og:title", content: "Contact MAAROOF Ai · Talk to the AI Visibility Team" },
      { property: "og:description", content: "Reach the MAAROOF Ai team in Baghdad by WhatsApp or phone to ask about plans, the AI visibility agent, or onboarding for brands in Iraq." },
      { property: "og:url", content: "https://geoiraq.com/contact" },
    ],
    links: [{ rel: "canonical", href: "https://geoiraq.com/contact" }],
  }),
  component: () => (
    <I18nProvider><AuthProvider><ContactPage /></AuthProvider></I18nProvider>
  ),
});

function ContactPage() {
  const { t } = useI18n();
  const display = "+964 773 357 0130";
  const msg = t("whatsapp_msg");
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="font-display text-3xl font-bold text-gradient">{t("nav_contact")}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{t("subscribe_modal_desc")}</p>

        <div className="mt-8 rounded-2xl border border-primary/30 bg-card/70 p-6 text-center shadow-[var(--shadow-elevated)]">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">{t("contact_phone")}</div>
          <div className="mt-2 font-display text-2xl font-bold tracking-wider" dir="ltr" style={{ unicodeBidi: "isolate" }}>{display}</div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
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

        <div className="mt-8 text-center">
          <Link to="/" className="text-sm text-primary hover:underline">← {t("brand")}</Link>
        </div>
      </main>
    </div>
  );
}
