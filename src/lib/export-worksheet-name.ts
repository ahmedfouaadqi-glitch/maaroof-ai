/** Excel worksheet names: at most 31 characters and no forbidden/control characters. */
export function sanitizeWorksheetName(requested: string, fallback = "Data"): string {
  const cleaned = String(requested || "")
    .replace(/[\u0000-\u001f\\/?*\[\]:]/g, "_")
    .replace(/^'+|'+$/g, "")
    .slice(0, 31)
    .trim();
  return cleaned || fallback.slice(0, 31);
}
