// Pure rules for the light website security check. No network here.

export type SecCheck = { id: string; ok: boolean; label: string; evidence: string; weight: number };

export const SECURITY_HEADERS: { key: string; label: string; weight: number }[] = [
  { key: "strict-transport-security", label: "إجبار الاتصال المشفّر (HSTS)", weight: 15 },
  { key: "content-security-policy", label: "سياسة أمان المحتوى (CSP)", weight: 15 },
  { key: "x-frame-options", label: "منع تضمين الموقع في إطار (X-Frame-Options)", weight: 10 },
  { key: "x-content-type-options", label: "منع تخمين نوع الملفات (X-Content-Type-Options)", weight: 10 },
  { key: "referrer-policy", label: "سياسة إرسال مصدر الزيارة (Referrer-Policy)", weight: 5 },
];

export const EXPOSED_PATHS = ["/.env", "/.git/config", "/backup.zip", "/wp-config.php.bak", "/.DS_Store"];

/** Only public http(s) hosts; blocks localhost, private and link-local addresses. */
export function isPublicUrl(raw: string): boolean {
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  if (u.username || u.password) return false;
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!h.includes(".") && !h.includes(":")) return false;
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return false;
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 10 || a === 127 || a === 0 || a >= 224) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
  }
  if (h.includes(":")) {
    if (h === "::1" || h === "::" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80")) return false;
  }
  return true;
}

/** An exposed file counts only when it answered 200 with content that looks like the real file. */
export function looksExposed(path: string, status: number, body: string): boolean {
  if (status !== 200) return false;
  const b = body.slice(0, 2000);
  if (/<html|<!doctype/i.test(b)) return false; // SPA fallback page, not the file
  if (path === "/.env") return /^[A-Z0-9_]+\s*=/m.test(b);
  if (path === "/.git/config") return /\[core\]/.test(b);
  if (path === "/wp-config.php.bak") return /DB_PASSWORD|define\(/.test(b);
  return b.length > 0;
}

export function buildChecks(input: { finalUrl: string; headers: Record<string, string>; exposed: string[]; brokenLinks: { url: string; status: number }[]; checkedLinks: number }): SecCheck[] {
  const checks: SecCheck[] = [];
  const https = input.finalUrl.startsWith("https://");
  checks.push({ id: "https", ok: https, label: "الموقع يعمل عبر HTTPS", evidence: input.finalUrl, weight: 20 });
  for (const h of SECURITY_HEADERS) {
    const v = input.headers[h.key];
    checks.push({ id: h.key, ok: !!v, label: h.label, evidence: v ? `${h.key}: ${v.slice(0, 120)}` : `الترويسة ${h.key} غير موجودة`, weight: h.weight });
  }
  checks.push({ id: "exposed", ok: input.exposed.length === 0, label: "لا ملفات حساسة مكشوفة", evidence: input.exposed.length ? input.exposed.join("، ") : `فُحصت: ${EXPOSED_PATHS.join("، ")}`, weight: 20 });
  checks.push({ id: "links", ok: input.brokenLinks.length === 0, label: "لا روابط معطوبة في الصفحة الرئيسية", evidence: input.brokenLinks.length ? input.brokenLinks.map((l) => `${l.url} (${l.status || "لا رد"})`).join("، ") : `فُحص ${input.checkedLinks} رابط`, weight: 5 });
  return checks;
}

export function securityScore(checks: SecCheck[]): number {
  const total = checks.reduce((s, c) => s + c.weight, 0);
  if (!total) return 0;
  return Math.round((checks.filter((c) => c.ok).reduce((s, c) => s + c.weight, 0) / total) * 100);
}
