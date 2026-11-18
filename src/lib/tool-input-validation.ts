import { isPlaceholderName } from "@/lib/maaroof/event-labels";
import { TOOL_OPTIONS } from "@/lib/tool-options";

export type ToolInputIssue = { field: string; expected: string };

const TEXT_FIELDS = new Set([
  "brand", "brand_name", "business_name", "project_name", "app_name", "app_url",
  "keywords", "brand_keywords", "sector", "city", "country", "text", "url",
  "source_url", "description", "sourceText", "topic", "goal", "kind", "action",
  "site", "category", "market_text", "target_market", "content_language", "request_text", "attachment_id",
  "official_website", "website_url",
]);
const LIST_FIELDS = new Set(["competitors", "platforms", "engines", "urls", "probe_engines", "markets", "skip_keyword_pairs", "skip_keywords", "channel_types"]);

function toText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(toText).filter(Boolean).join(", ");
  return "";
}

function toStringList(value: unknown): string[] | null {
  const values = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[\n,؛;|]+/) : null;
  if (!values) return null;
  return values.map(toText).filter(Boolean);
}

function flatten(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(flatten).filter(Boolean).join(", ");
  try { return JSON.stringify(value) ?? String(value); } catch { return String(value); }
}

/**
 * Normalize planner values with tool-specific field types taking priority over
 * legacy global coercion. This matters for fields such as feasibility.competitors,
 * which is a string while compare.competitors is a string array.
 */
export function normalizeToolInput(tool: string, raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, unknown> = {};
  const fieldTypes = TOOL_OPTIONS[tool]?.fieldTypes || {};

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value == null) continue;
    const declaredType = fieldTypes[key];

    if (declaredType === "string|number") {
      if (typeof value === "number" && Number.isFinite(value)) out[key] = value;
      else if (typeof value === "string" && value.trim()) out[key] = value.trim();
      else out[key] = value;
      continue;
    }
    if (declaredType === "string") {
      const text = toText(value);
      if (text) out[key] = text;
      else if (typeof value === "object" && !Array.isArray(value)) out[key] = value;
      continue;
    }
    if (declaredType === "string[]") {
      const list = toStringList(value)
        ?.filter((item) => key !== "competitors" || !isPlaceholderName(item));
      if (list?.length) out[key] = list;
      else if (Array.isArray(value) && value.length === 0) out[key] = [];
      else out[key] = value;
      continue;
    }
    if (declaredType) {
      out[key] = value;
      continue;
    }

    if (TEXT_FIELDS.has(key)) {
      const text = flatten(value);
      if (text) out[key] = text;
      continue;
    }
    if (LIST_FIELDS.has(key)) {
      const list = (Array.isArray(value) ? value.map(flatten) : flatten(value).split(/[\n,؛;|]+/))
        .map((item) => item.trim())
        .filter(Boolean)
        .filter((item) => key !== "competitors" || !isPlaceholderName(item));
      if (list.length) out[key] = list;
      continue;
    }
    out[key] = value;
  }
  return out;
}

function toBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || (typeof value === "string" && value.toLowerCase() === "true")) return true;
  if (value === 0 || value === "0" || (typeof value === "string" && value.toLowerCase() === "false")) return false;
  return null;
}

/**
 * Coerce only fields with an explicitly declared endpoint type.
 * Unknown fields are preserved for backward compatibility with route-specific inputs.
 * Invalid declared values are omitted and reported; endpoint validation/defaults remain authoritative.
 */
export function coerceToolInput(
  tool: string,
  raw: Record<string, unknown>,
): { input: Record<string, unknown>; issues: ToolInputIssue[] } {
  const fieldTypes = TOOL_OPTIONS[tool]?.fieldTypes || {};
  const input: Record<string, unknown> = { ...raw };
  const issues: ToolInputIssue[] = [];

  for (const [field, type] of Object.entries(fieldTypes)) {
    if (!(field in input) || input[field] == null) continue;
    const value = input[field];
    let normalized: unknown = value;
    let valid = true;

    switch (type) {
      case "string": {
        const text = toText(value);
        normalized = field === "competitors"
          ? text.split(/[\n,؛;|]+/).map((item) => item.trim()).filter((item) => !isPlaceholderName(item)).join(", ")
          : text;
        valid = Boolean(normalized);
        break;
      }
      case "string|number": {
        if (typeof value === "number") {
          normalized = value;
          valid = Number.isFinite(value);
        } else if (typeof value === "string") {
          normalized = value.trim();
          valid = Boolean(normalized);
        } else {
          valid = false;
        }
        break;
      }
      case "string[]": {
        const list = toStringList(value)?.filter((item) => field !== "competitors" || !isPlaceholderName(item)) ?? null;
        normalized = list;
        valid = list !== null && (list.length > 0 || (Array.isArray(value) && value.length === 0));
        break;
      }
      case "number": {
        const number = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
        normalized = number;
        valid = Number.isFinite(number);
        break;
      }
      case "boolean": {
        normalized = toBoolean(value);
        valid = normalized !== null;
        break;
      }
      case "object": {
        normalized = value;
        valid = typeof value === "object" && !Array.isArray(value);
        break;
      }
    }

    if (valid) input[field] = normalized;
    else {
      delete input[field];
      issues.push({ field, expected: type });
    }
  }

  return { input, issues };
}
