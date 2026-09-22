// Session-wide bus of the latest result of every tool, so the Report Builder
// can combine live tool results with its database metrics.
import { useEffect, useSyncExternalStore } from "react";
import type { ExportPayload, ExportSection } from "@/lib/exports";

export type CapturedResult = {
  toolKey: string;
  title: string;
  at: number;
  payload: ExportPayload;
};

const RESULTS = new Map<string, CapturedResult>();
const subs = new Set<() => void>();
let version = 0;

function emit() {
  version++;
  for (const fn of subs) fn();
}

export function captureToolResult(toolKey: string, title: string, payload: ExportPayload) {
  RESULTS.set(toolKey, { toolKey, title, at: Date.now(), payload });
  emit();
}

export function clearToolResult(toolKey: string) {
  if (RESULTS.delete(toolKey)) emit();
}

export function listCapturedResults(): CapturedResult[] {
  return Array.from(RESULTS.values()).sort((a, b) => b.at - a.at);
}

export function useCapturedResults(): CapturedResult[] {
  useSyncExternalStore(
    (cb) => { subs.add(cb); return () => { subs.delete(cb); }; },
    () => version,
    () => version,
  );
  return listCapturedResults();
}

/** Register a tool result for the Report Builder while it is on screen. */
export function useCaptureToolResult(toolKey: string, title: string, payload: ExportPayload | null) {
  useEffect(() => {
    if (!payload) return;
    captureToolResult(toolKey, title, payload);
  }, [toolKey, title, payload]);
}

/* ---------------- generic result → sections serializer ---------------- */

const isPlain = (v: any) => v && typeof v === "object" && !Array.isArray(v);
const humanize = (k: string) => k.replace(/[_.-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

function scalar(v: any): string {
  if (v == null) return "";
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v);
}

/**
 * Convert any tool result object into complete export sections.
 * Nothing is truncated: long text stays whole, every row and key is kept.
 */
export function sectionsFromResult(value: any, heading = "Result", depth = 0): ExportSection[] {
  const out: ExportSection[] = [];
  if (value == null) return out;

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    out.push({ kind: "text", heading, text: scalar(value) });
    return out;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return out;
    const objects = value.filter(isPlain);
    if (objects.length === value.length) {
      const cols = Array.from(new Set(objects.flatMap((o) => Object.keys(o))));
      const simple = cols.every((c) => objects.every((o) => !isPlain(o[c]) && !Array.isArray(o[c])));
      if (simple) {
        out.push({
          kind: "table",
          heading,
          table: { columns: cols.map(humanize), data: objects.map((o) => cols.map((c) => scalar(o[c]))) },
        });
        return out;
      }
      objects.forEach((o, i) => out.push(...sectionsFromResult(o, `${heading} ${i + 1}`, depth + 1)));
      return out;
    }
    out.push({ kind: "list", heading, list: value.map((v) => (isPlain(v) ? JSON.stringify(v) : scalar(v))) });
    return out;
  }

  if (isPlain(value)) {
    const rows: Array<[string, string | number]> = [];
    const nested: Array<[string, any]> = [];
    for (const [k, v] of Object.entries(value)) {
      if (v == null || v === "") continue;
      if (Array.isArray(v) || isPlain(v)) nested.push([k, v]);
      else rows.push([humanize(k), scalar(v)]);
    }
    if (rows.length) out.push({ kind: "kv", heading, rows });
    for (const [k, v] of nested) out.push(...sectionsFromResult(v, humanize(k), depth + 1));
  }
  return out;
}

/** Build a full ExportPayload from an arbitrary tool result. */
export function payloadFromResult(title: string, result: any, subtitle?: string): ExportPayload {
  return { title, subtitle, sections: sectionsFromResult(result, title) };
}
