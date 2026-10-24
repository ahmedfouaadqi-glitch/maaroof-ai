import { createFileRoute, redirect } from "@tanstack/react-router";

// The autonomous agent now lives inside Maaroof Space.
export const Route = createFileRoute("/agent")({
  beforeLoad: () => {
    throw redirect({ to: "/workspace", search: { tab: "ops" }, statusCode: 301 });
  },
});
