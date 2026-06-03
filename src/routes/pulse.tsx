import { createFileRoute } from "@tanstack/react-router";
import { PulseMaintenance } from "@/components/PulseMaintenance";

export const Route = createFileRoute("/pulse")({
  head: () => ({
    meta: [
      { title: "نبض — تحت الصيانة" },
      { name: "description", content: "نظام نبض موقوف مؤقتاً للصيانة." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: PulseMaintenance,
});
