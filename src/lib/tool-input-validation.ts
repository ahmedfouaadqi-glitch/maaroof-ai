import { TOOL_OPTIONS } from "@/lib/tool-options";

export type ToolInputIssue = { field: string; expected: string };

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
    let normalized: unknown;
    let valid = true;

    switch (type) {
      case "string": {
        normalized = toText(value);
        valid = Boolean(normalized);
        break;
      }
      case "string[]": {
        const list = toStringList(value);
        normalized = list;
        valid = list !== null && list.length > 0;
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
