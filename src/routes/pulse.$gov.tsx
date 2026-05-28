import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/pulse/$gov")({
  component: GovPage,
});

function GovPage() {
  const { gov } = Route.useParams();
  return (
    <div className="min-h-screen bg-background text-foreground p-8" dir="rtl">
      <h1 className="text-3xl font-bold">{gov}</h1>
      <p className="text-muted-foreground mt-2">قيد التطوير</p>
    </div>
  );
}
