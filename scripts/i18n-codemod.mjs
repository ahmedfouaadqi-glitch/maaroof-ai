#!/usr/bin/env node
/**
 * i18n codemod: replace Arabic literals inside React components with t("key"),
 * register the keys in src/lib/i18n/{en,ar,ku}.ts and make sure each touched
 * component has `const { t } = useI18n()`.
 *
 * Conservative by design — it only touches occurrences it can prove are inside
 * a component body (top-level declaration whose name looks like `PascalCase`).
 * Everything it skips is reported so it can be handled by hand.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const AR = /[\u0600-\u06FF]/;
const KU = /[\u0695\u06B5\u06BE\u06CE\u06C6\u06D5\u0763]/; // Kurdish-only letters
const LANG_TERNARY = /lang\s*===?\s*["']|isKu|isAr\b|=== *"ku"/;
const cache = JSON.parse(readFileSync("/tmp/i18n-translations.json", "utf8"));
const files = JSON.parse(readFileSync(process.argv[2], "utf8"));
const DRY = process.argv.includes("--dry");

// ---------- key allocation ----------
const keyMapPath = "/tmp/i18n-keymap.json";
const keyMap = existsSync(keyMapPath) ? JSON.parse(readFileSync(keyMapPath, "utf8")) : {};
const used = new Set(Object.values(keyMap));

function slug(en) {
  const s = (en || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .split("_")
    .filter(Boolean)
    .slice(0, 6)
    .join("_");
  return s || "text";
}
function keyFor(arabic) {
  if (keyMap[arabic]) return keyMap[arabic];
  const tr = cache[arabic];
  if (!tr) return null;
  let base = `auto.${slug(tr.en)}`;
  let k = base;
  let i = 2;
  while (used.has(k)) k = `${base}_${i++}`;
  used.add(k);
  keyMap[arabic] = k;
  return k;
}

// ---------- helpers ----------
function lineStarts(src) {
  const arr = [0];
  for (let i = 0; i < src.length; i++) if (src[i] === "\n") arr.push(i + 1);
  return arr;
}
const DECL_RE = /^(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function\s+([A-Za-z0-9_]+)|const\s+([A-Za-z0-9_]+))/;

/** Map char offset -> { name, bodyStart } of the enclosing column-0 declaration. */
function topDecls(src) {
  const out = [];
  const lines = src.split("\n");
  let off = 0;
  for (const line of lines) {
    const m = DECL_RE.exec(line);
    if (m) out.push({ name: m[1] || m[2], start: off });
    off += line.length + 1;
  }
  for (let i = 0; i < out.length; i++) out[i].end = i + 1 < out.length ? out[i + 1].start : src.length;
  return out;
}
function declAt(decls, pos) {
  for (const d of decls) if (pos >= d.start && pos < d.end) return d;
  return null;
}
const isComponent = (n) => !!n && /^[A-Z][a-z]/.test(n);

const report = { changed: [], skipped: [], keys: 0 };

for (const file of files) {
  let src = readFileSync(file, "utf8");
  const orig = src;
  const decls = topDecls(src);
  const edits = [];
  const touchedDecls = new Set();

  const push = (start, end, text, decl) => {
    edits.push({ start, end, text });
    touchedDecls.add(decl.name);
  };

  // 1) quoted string literals
  const strRe = /(["'])((?:[^\\\n]|\\.)*?)\1/g;
  let m;
  while ((m = strRe.exec(src))) {
    const raw = m[2];
    if (!AR.test(raw) || raw.includes("\\")) continue;
    const start = m.index;
    const lineStart = src.lastIndexOf("\n", start) + 1;
    const line = src.slice(lineStart, src.indexOf("\n", start));
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;
    const before = src.slice(Math.max(0, start - 40), start);
    if (/(?:^|[{,\s])(?:ar|en|ku|ckb|name_ar|name_en|name_ku)\s*:\s*$/.test(before)) continue;
    if (/\bimport\b|\bfrom\s*$|require\(\s*$/.test(before)) continue;
    if (KU.test(raw)) { report.skipped.push([file, raw, "kurdish-literal"]); continue; }
    if (LANG_TERNARY.test(src.slice(Math.max(0, start - 240), start))) { report.skipped.push([file, raw, "lang-ternary"]); continue; }
    const key = keyFor(raw.trim());
    if (!key) { report.skipped.push([file, raw, "no-translation"]); continue; }
    const decl = declAt(decls, start);
    if (!isComponent(decl?.name)) { report.skipped.push([file, raw, `module-scope:${decl?.name}`]); continue; }
    const attr = /=\s*$/.test(before);
    const pad = raw.length - raw.trimStart().length ? "" : "";
    push(start, m.index + m[0].length, attr ? `{t("${key}")}${pad}` : `t("${key}")`, decl);
  }

  // 2) JSX text nodes
  const jsxRe = />([^<>{}"'`]*[\u0600-\u06FF][^<>{}"'`]*)</g;
  while ((m = jsxRe.exec(src))) {
    const raw = m[1];
    const value = raw.trim();
    if (!value || !AR.test(value)) continue;
    if (KU.test(value)) { report.skipped.push([file, value, "kurdish-literal"]); continue; }
    if (LANG_TERNARY.test(src.slice(Math.max(0, m.index - 240), m.index))) { report.skipped.push([file, value, "lang-ternary"]); continue; }
    const key = keyFor(value);
    if (!key) { report.skipped.push([file, value, "no-translation"]); continue; }
    const decl = declAt(decls, m.index);
    if (!isComponent(decl?.name)) { report.skipped.push([file, value, `module-scope:${decl?.name}`]); continue; }
    const lead = raw.slice(0, raw.indexOf(value));
    const tail = raw.slice(raw.indexOf(value) + value.length);
    push(m.index + 1, m.index + 1 + raw.length, `${lead}{t("${key}")}${tail}`, decl);
  }

  if (!edits.length) continue;
  edits.sort((a, b) => b.start - a.start);
  // drop overlaps (string literal inside an already-replaced jsx range etc.)
  let lastStart = Infinity;
  for (const e of edits) {
    if (e.end > lastStart) continue;
    src = src.slice(0, e.start) + e.text + src.slice(e.end);
    lastStart = e.start;
  }

  // 3) ensure useI18n import + hook in each touched component
  if (!/from\s+["']@\/lib\/i18n["']/.test(src)) {
    const firstImportEnd = src.indexOf("\n", src.indexOf("import"));
    src = src.slice(0, firstImportEnd + 1) + `import { useI18n } from "@/lib/i18n";\n` + src.slice(firstImportEnd + 1);
  } else if (!/\buseI18n\b/.test(src.split("\n").filter((l) => l.includes("@/lib/i18n"))[0] || "")) {
    src = src.replace(/import\s*{([^}]*)}\s*from\s*["']@\/lib\/i18n["']/, (mm, inner) => `import {${inner.trimEnd()}, useI18n } from "@/lib/i18n"`);
  }

  const newDecls = topDecls(src);
  for (const name of touchedDecls) {
    const d = newDecls.find((x) => x.name === name);
    if (!d) continue;
    const body = src.slice(d.start, d.end);
    if (/const\s*{[^}]*\bt\b[^}]*}\s*=\s*useI18n\(/.test(body) || /\bconst\s+t\s*=/.test(body)) continue;
    // find the opening brace of the function body
    const sig = /(?:function\s+\w+\s*\([^)]*\)\s*(?::[^{]+)?{|=\s*(?:\([^)]*\)|\w+)\s*(?::[^=]+)?=>\s*{)/.exec(body);
    if (!sig) { report.skipped.push([file, name, "implicit-return-component"]); continue; }
    const insertAt = d.start + sig.index + sig[0].length;
    src = src.slice(0, insertAt) + `\n  const { t } = useI18n();` + src.slice(insertAt);
  }

  if (src !== orig) {
    if (!DRY) writeFileSync(file, src);
    report.changed.push([file, edits.length]);
  }
}

if (!DRY) writeFileSync(keyMapPath, JSON.stringify(keyMap, null, 1));
report.keys = Object.keys(keyMap).length;
console.log(`changed files: ${report.changed.length}`);
for (const [f, n] of report.changed) console.log(`  ${n}\t${f}`);
const bucket = {};
for (const [f, , why] of report.skipped) bucket[why.split(":")[0]] = (bucket[why.split(":")[0]] || 0) + 1;
console.log("skipped:", JSON.stringify(bucket));
writeFileSync("/tmp/i18n-codemod-report.json", JSON.stringify(report, null, 1));
