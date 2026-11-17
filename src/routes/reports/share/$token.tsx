import { createFileRoute } from "@tanstack/react-router";
import { getSharedReport } from "@/lib/reports/reports.functions";

export const Route = createFileRoute("/reports/share/$token")({
  loader: ({ params }) => getSharedReport({ data: { token: params.token } }),
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.title} — MAAROOF AI` : "Report — MAAROOF AI" },
      { name: "description", content: "Shared executive report from MAAROOF AI." },
      { name: "robots", content: "noindex,nofollow,noai" },
      { property: "og:title", content: "Shared report — MAAROOF AI" },
      { property: "og:description", content: "Executive report shared privately by MAAROOF AI." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SharedReport,
});

function SharedReport() {
  const r = Route.useLoaderData();
  if (!r) return <main className="flex min-h-screen items-center justify-center p-6 text-center"><div><h1 className="text-xl font-semibold">الرابط غير صالح أو منتهي</h1><p className="mt-2 text-sm text-muted-foreground">This link is invalid, expired or revoked.</p></div></main>;
  return <iframe title={r.title} srcDoc={r.html} sandbox="allow-modals allow-popups" className="h-screen w-full border-0 bg-background" />;
}
