import { createFileRoute, Link } from "@tanstack/react-router";
import { Phone, MessageCircle, Mail, MapPin, Clock, Facebook, Instagram, Twitter, Linkedin, Send } from "lucide-react";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { AuthProvider } from "@/lib/auth";
import { BlurText } from "@/components/motion/BlurText";
import { SiteHeader } from "@/components/SiteHeader";
import { useContactInfo, whatsappLinkFromInfo } from "@/lib/contact-info";

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
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "LocalBusiness",
          name: "MAAROOF Ai",
          url: "https://geoiraq.com/contact",
          email: "ahmedfouaad.qi@gmail.com",
          telephone: "+964 773 357 0130",
          address: {
            "@type": "PostalAddress",
            addressLocality: "Baghdad",
            addressCountry: "IQ",
          },
          areaServed: "IQ",
        }),
      },
    ],
  }),
  component: () => (
    <I18nProvider><AuthProvider><ContactPage /></AuthProvider></I18nProvider>
  ),
});

function ContactPage() {
  const { t, lang } = useI18n();
  const info = useContactInfo();
  const msg = t("whatsapp_msg");
  const address = lang === "ar" ? info.address_ar : lang === "ku" ? info.address_ku : info.address_en;
  const hours = lang === "ar" ? info.hours_ar : lang === "ku" ? info.hours_ku : info.hours_en;

  const socials: { href: string; Icon: any; label: string }[] = [];
  if (info.facebook) socials.push({ href: info.facebook, Icon: Facebook, label: "Facebook" });
  if (info.instagram) socials.push({ href: info.instagram, Icon: Instagram, label: "Instagram" });
  if (info.twitter) socials.push({ href: info.twitter, Icon: Twitter, label: "X / Twitter" });
  if (info.linkedin) socials.push({ href: info.linkedin, Icon: Linkedin, label: "LinkedIn" });
  if (info.telegram) socials.push({ href: info.telegram, Icon: Send, label: "Telegram" });

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-16">
        <BlurText as="h1" text={t("nav_contact")} delay={70} stepDuration={0.28} center={false} className="font-display text-3xl font-bold text-gradient" />
        <p className="mt-3 text-sm text-muted-foreground">{t("subscribe_modal_desc")}</p>

        <div className="mt-8 rounded-2xl border border-primary/30 bg-card/70 p-6 text-center shadow-[var(--shadow-elevated)]">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">{t("contact_phone")}</div>
          <div className="mt-2 font-display text-2xl font-bold tracking-wider" dir="ltr" style={{ unicodeBidi: "isolate" }}>{info.phone_display}</div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <a
              href={whatsappLinkFromInfo(info, msg)}
              target="_blank" rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-success to-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)]"
            >
              <MessageCircle className="size-4" /> {t("whatsapp_cta")}
            </a>
            <a
              href={`tel:+${info.whatsapp_number}`}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-5 py-3 text-sm font-semibold text-primary"
            >
              <Phone className="size-4" /> {t("call_cta")}
            </a>
          </div>

          {info.email && (
            <a
              href={`mailto:${info.email}`}
              className="mt-3 inline-flex items-center justify-center gap-2 text-sm text-primary hover:underline"
              dir="ltr" style={{ unicodeBidi: "isolate" }}
            >
              <Mail className="size-4" /> {info.email}
            </a>
          )}
        </div>

        {(address || hours) && (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {address && (
              <div className="rounded-xl border border-border bg-card/50 p-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
                  <MapPin className="size-3.5" /> {lang === "ar" ? "العنوان" : lang === "ku" ? "ناونیشان" : "Address"}
                </div>
                <div className="mt-1 text-sm font-medium">{address}</div>
              </div>
            )}
            {hours && (
              <div className="rounded-xl border border-border bg-card/50 p-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
                  <Clock className="size-3.5" /> {lang === "ar" ? "ساعات العمل" : lang === "ku" ? "کاتژمێری کار" : "Working hours"}
                </div>
                <div className="mt-1 text-sm font-medium">{hours}</div>
              </div>
            )}
          </div>
        )}

        {socials.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {socials.map(({ href, Icon, label }) => (
              <a
                key={label} href={href} target="_blank" rel="noreferrer"
                aria-label={label}
                className="inline-flex size-10 items-center justify-center rounded-full border border-border bg-card/60 text-muted-foreground transition hover:border-primary/40 hover:text-primary"
              >
                <Icon className="size-4" />
              </a>
            ))}
          </div>
        )}

        <div className="mt-8 text-center">
          <Link to="/" className="text-sm text-primary hover:underline">← {t("brand")}</Link>
        </div>
      </main>
    </div>
  );
}
