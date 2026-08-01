import { createFileRoute, redirect } from "@tanstack/react-router";

// The autonomous agent now lives inside the unified Maaroof workspace.
export const Route = createFileRoute("/agent")({
  beforeLoad: () => {
    throw redirect({ to: "/maaroof", search: { tab: "tasks" } });
  },
});
