import { createFileRoute } from "@tanstack/react-router";

const PAUSED_MESSAGES = {
  ar: "أداة مراقبة المنافسين موقفة مؤقتاً؛ لم يُنفّذ أي فحص ولم يُخصم أي رصيد.",
  en: "Competitor monitoring is temporarily paused. No scan was run and no credits were charged.",
  ku: "چاودێری ڕکابەر کاتی ڕاگیراوە؛ هیچ پشکنینێک نەکرا و هیچ کرێدیتێک نەبڕدرا.",
} as const;

/** The feature is paused centrally: return before auth, database, provider or billing work. */
export const Route = createFileRoute("/api/competitor-monitor")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json().catch(() => ({} as any));
        const lang = body?.lang === "en" || body?.lang === "ku" ? body.lang : "ar";
        return Response.json({
          error: "temporarily_paused",
          skipped: "temporarily_paused",
          message: PAUSED_MESSAGES[lang],
        }, { status: 503 });
      },
    },
  },
});
