import { createFileRoute } from "@tanstack/react-router";
import { PulseMaintenance } from "@/components/PulseMaintenance";

export const Route = createFileRoute("/pulse/compare")({
  head: () => ({
    meta: [
      { title: "نبض — تحت الصيانة" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: PulseMaintenance,
});
