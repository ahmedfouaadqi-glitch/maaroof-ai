import { createFileRoute, redirect } from "@tanstack/react-router";

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

// Legacy URL: the free trial now lives at /free-audit.
export const Route = createFileRoute("/visibility-trial")({
  beforeLoad: ({ search }) => {
    const s = search as Record<string, unknown>;
    throw redirect({ to: "/free-audit", search: { entity: str(s.entity), category: str(s.category), market: str(s.market) }, statusCode: 301 });
  },
});
