// Defensive input coercion for tool endpoints.
// Maaroof's planner is an LLM: it may send a field as an array, number, or
// object where the endpoint expects a string. These helpers make every read
// total, so a bad shape degrades instead of throwing a 500.

/** Read any value as a trimmed string. Arrays join with ", ", objects JSON-stringify. */
export function asText(v: unknown, max = 4000): string {
  let s: string;
  if (v == null) s = "";
  else if (typeof v === "string") s = v;
  else if (typeof v === "number" || typeof v === "boolean") s = String(v);
  else if (Array.isArray(v)) s = v.map((x) => asText(x, max)).filter(Boolean).join(", ");
  else {
    try { s = JSON.stringify(v); } catch { s = String(v); }
  }
  s = s.trim();
  return s.length > max ? s.slice(0, max) : s;
}

/** Read any value as a list of trimmed strings (splits comma/newline separated text). */
export function asList(v: unknown, max = 20): string[] {
  const arr = Array.isArray(v) ? v.map((x) => asText(x)) : asText(v).split(/[\n,؛;|]+/);
  return arr.map((s) => s.trim()).filter(Boolean).slice(0, max);
}
