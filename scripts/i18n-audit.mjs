#!/usr/bin/env node
/**
 * i18n audit — scans src/** for hardcoded user-facing text and validates the
 * translation dictionaries (en / ar / ku).
 *
 * Usage:  node scripts/i18n-audit.mjs [--json out.json]
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");

/* ------------------------------------------------------------------ files */
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === "ui") continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(name) && !name.endsWith(".gen.ts")) {
      out.push(p);
    }
  }
  return out;
}

const files = walk(SRC);

/* ------------------------------------------------------- dictionaries */
function loadDicts() {
  const dir = join(SRC, "lib", "i18n");
  const dicts = {};
  const single = join(SRC, "lib", "i18n.tsx");
  const sources = [];
  if (existsSync(dir)) {
    for (const lang of ["en", "ar", "ku"]) {
      const f = join(dir, `${lang}.ts`);
      if (existsSync(f)) sources.push([lang, readFileSync(f, "utf8")]);
    }
  }
  if (!sources.length && existsSync(single)) {
    const s = readFileSync(single, "utf8");
    for (const lang of ["en", "ar", "ku"]) {
      const m = s.match(new RegExp(`const ${lang}(?::\\s*Dict)?\\s*=\\s*\\{([\\s\\S]*?)\\n\\};`));
      if (m) sources.push([lang, m[1]]);
    }
  }
  for (const [lang, body] of sources) {
    const keys = [...body.matchAll(/(?:^|[{,])\s*([A-Za-z0-9_]+)\s*:\s*(?=["'`])/gm)].map((m) => m[1]);
    dicts[lang] = keys;
  }
  return dicts;
}

const dicts = loadDicts();
const sets = Object.fromEntries(Object.entries(dicts).map(([k, v]) => [k, new Set(v)]));

/* ------------------------------------------------------- key usage */
const usedKeys = new Set();
for (const f of files) {
  const s = readFileSync(f, "utf8");
  for (const m of s.matchAll(/\bt\(\s*["'`]([A-Za-z0-9_]+)["'`]/g)) usedKeys.add(m[1]);
  for (const m of s.matchAll(/\bserverT\(\s*\w+\s*,\s*["'`]([A-Za-z0-9_]+)["'`]/g)) usedKeys.add(m[1]);
}

/* --------------------------------------------- hardcoded text detection */
const ARABIC = /[\u0600-\u06FF]/;
const IGNORE_FILE = /(\/lib\/i18n(\.tsx|\/)|\/components\/ui\/|\.server\.ts$|routeTree)/;

const hardcoded = [];
for (const f of files) {
  if (IGNORE_FILE.test(f.replace(/\\/g, "/"))) continue;
  const rel = relative(ROOT, f);
  const lines = readFileSync(f, "utf8").split("\n");
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;
    if (!ARABIC.test(line)) return;
    hardcoded.push({ file: rel, line: i + 1, text: trimmed.slice(0, 160) });
  });
}

/* ---------------------------------------------------------------- report */
const enKeys = dicts.en || [];
const report = {
  scannedFiles: files.length,
  components: files.filter((f) => f.includes("/components/")).length,
  routes: files.filter((f) => f.includes("/routes/")).length,
  keys: Object.fromEntries(Object.entries(dicts).map(([k, v]) => [k, v.length])),
  duplicates: Object.fromEntries(
    Object.entries(dicts).map(([k, v]) => [k, v.filter((x, i) => v.indexOf(x) !== i)]),
  ),
  missing: {
    ar: enKeys.filter((k) => !sets.ar?.has(k)),
    ku: enKeys.filter((k) => !sets.ku?.has(k)),
  },
  unknownKeysUsed: [...usedKeys].filter((k) => !sets.en?.has(k)).sort(),
  unusedKeys: enKeys.filter((k) => !usedKeys.has(k)).sort(),
  hardcodedCount: hardcoded.length,
  hardcodedByFile: Object.entries(
    hardcoded.reduce((acc, h) => ((acc[h.file] = (acc[h.file] || 0) + 1), acc), {}),
  ).sort((a, b) => b[1] - a[1]),
  hardcoded,
};

const jsonArg = process.argv.indexOf("--json");
if (jsonArg > -1 && process.argv[jsonArg + 1]) {
  writeFileSync(process.argv[jsonArg + 1], JSON.stringify(report, null, 2));
}

console.log(`files: ${report.scannedFiles}  components: ${report.components}  routes: ${report.routes}`);
console.log(`keys: ${JSON.stringify(report.keys)}`);
console.log(`missing ar: ${report.missing.ar.length}  missing ku: ${report.missing.ku.length}`);
console.log(`unknown keys used: ${report.unknownKeysUsed.length}`);
console.log(`unused keys: ${report.unusedKeys.length}`);
console.log(`hardcoded lines: ${report.hardcodedCount} across ${report.hardcodedByFile.length} files`);
for (const [f, n] of report.hardcodedByFile.slice(0, 40)) console.log(`  ${n}\t${f}`);
