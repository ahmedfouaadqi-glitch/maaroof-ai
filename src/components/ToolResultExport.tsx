import { useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { ExportButtons } from "@/components/ExportButtons";
import { payloadFromResult, useCaptureToolResult } from "@/lib/export-bus";
import type { ExportPayload } from "@/lib/exports";

/**
 * Drop-in export control for any tool result.
 * - Serializes the whole result object (nothing truncated) when no custom builder is given.
 * - Registers the result in the export bus so the Report Builder can include it.
 */
export function ToolResultExport({
  toolKey,
  title,
  result,
  subtitle,
  build,
  className = "",
  size = "sm",
}: {
  toolKey: string;
  title: string;
  result?: any;
  subtitle?: string;
  build?: () => ExportPayload;
  className?: string;
  size?: "sm" | "xs";
}) {
  const { lang } = useI18n();

  const payload = useMemo<ExportPayload | null>(() => {
    try {
      if (build) return build();
      if (result == null) return null;
      const p = payloadFromResult(title, result, subtitle);
      return p.sections.length ? p : null;
    } catch {
      return null;
    }
  }, [build, result, title, subtitle]);

  useCaptureToolResult(toolKey, title, payload ? { ...payload, lang: lang as any } : null);

  if (!payload) return null;
  return (
    <ExportButtons
      toolKey={toolKey}
      size={size}
      className={className}
      build={() => (build ? build() : payload)}
    />
  );
}
