import { createFileRoute } from "@tanstack/react-router";
import { I18nProvider } from "@/lib/i18n";
import { AuthProvider } from "@/lib/auth";
import { VisibilityTrialPage } from "@/components/visibility/VisibilityTrialPage";

type S = { entity?: string; category?: string; market?: string };
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

export const Route = createFileRoute("/free-audit")({
  validateSearch: (s: Record<string, unknown>): S => ({ entity: str(s.entity), category: str(s.category), market: str(s.market) }),
  head: () => ({
    meta: [
      { title: "Free AI Visibility Audit · Maaroof AI" },
      { name: "description", content: "See live whether ChatGPT, Gemini and other AI engines mention and recommend your brand — free, no website required." },
      { property: "og:title", content: "Free AI Visibility Audit · Maaroof AI" },
      { property: "og:description", content: "A live sample from three independent AI engines showing whether your brand is mentioned and recommended." },
      { name: "robots", content: "noindex,nofollow,noai,noimageai" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FreeAuditRoute,
});

function FreeAuditRoute() {
  const prefill = Route.useSearch();
  return <I18nProvider><AuthProvider><VisibilityTrialPage prefill={prefill} /></AuthProvider></I18nProvider>;
}
