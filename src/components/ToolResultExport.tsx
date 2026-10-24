import { useEffect, useMemo, useRef } from "react";
import { useI18n } from "@/lib/i18n";
import { ExportButtons } from "@/components/ExportButtons";
import { payloadFromResult, useCaptureToolResult } from "@/lib/export-bus";
import { TOOL_CATALOG } from "@/lib/tool-catalog";
import type { ExportPayload } from "@/lib/exports";
import { saveToolResult } from "@/lib/tool-history.functions";

function fingerprint(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return `${h.toString(36)}:${s.length}`;
}

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
  title?: string;
  result?: any;
  subtitle?: string;
  build?: () => ExportPayload;
  className?: string;
  size?: "sm" | "xs";
}) {
  const { lang } = useI18n();
  const tool = TOOL_CATALOG.find((x) => x.key === toolKey);
  const label = title || (tool?.labels as any)?.[lang] || tool?.labels?.en || toolKey;

  const payload = useMemo<ExportPayload | null>(() => {
    try {
      if (build) return build();
      if (result == null) return null;
      const p = payloadFromResult(label, result, subtitle);
      return p.sections.length ? p : null;
    } catch {
      return null;
    }
  }, [build, result, label, subtitle]);

  useCaptureToolResult(toolKey, label, payload ? { ...payload, lang: lang as any } : null);

  // Persist every distinct result into the user's per-tool history (silent on failure).
  const lastSaved = useRef<string>("");
  useEffect(() => {
    if (!payload) return;
    let fp = "";
    try { fp = fingerprint(JSON.stringify(payload.sections)); } catch { return; }
    if (!fp || fp === lastSaved.current) return;
    lastSaved.current = fp;
    saveToolResult({
      data: { toolKey, title: label, payload: { ...payload, lang: lang as any }, lang: lang as any },
    }).catch(() => {});
  }, [payload, toolKey, label, lang]);

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
