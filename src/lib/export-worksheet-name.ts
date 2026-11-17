/** Excel worksheet names: at most 31 characters and no forbidden/control characters. */
export function sanitizeWorksheetName(requested: string, fallback = "Data"): string {
  const forbidden = new Set(["\\", "/", "?", "*", "[", "]", ":"]);
  const cleaned = Array.from(String(requested || ""))
    .filter((character) => character.charCodeAt(0) >= 32)
    .map((character) => forbidden.has(character) ? "_" : character)
    .join("")
    .replace(/^'+|'+$/g, "")
    .slice(0, 31)
    .trim();
  return cleaned || fallback.slice(0, 31);
}
