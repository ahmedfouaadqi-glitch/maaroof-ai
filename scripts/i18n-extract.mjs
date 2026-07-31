#!/usr/bin/env node
/**
 * Extract Arabic user-facing strings from src/** and classify their scope so the
 * apply step knows whether `t()` (React) or `serverT()` (server) can be used.
 *
 * Output: /tmp/i18n-extract.json
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, basename } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");
const ARABIC = /[\u0600-\u06FF]/;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === "ui" || name === "i18n") continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(name) && !name.endsWith(".gen.ts")) out.push(p);
  }
  return out;
}

/** find enclosing top-level declaration for a character offset */
function declMap(src) {
  const decls = [];
  const re = /^(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function\s+([A-Za-z0-9_]+)|const\s+([A-Za-z0-9_]+)\s*[:=])/gm;
  for (const m of src.matchAll(re)) {
    decls.push({ start: m.index, name: m[1] || m[2] });
  }
  return decls;
}
function declAt(decls, offset) {
  let cur = null;
  for (const d of decls) {
    if (d.start <= offset) cur = d; else break;
  }
  return cur;
}

const files = walk(SRC);
const items = [];
const strings = new Set();

for (const f of files) {
  const rel = relative(ROOT, f).replace(/\\/g, "/");
  if (rel.includes("/components/ui/")) continue;
  const src = readFileSync(f, "utf8");
  if (!ARABIC.test(src)) continue;
  const decls = declMap(src);
  const isServer = /\/routes\/api\//.test(rel) || /\.server\.ts$/.test(rel);

  const push = (kind, raw, index) => {
    if (!ARABIC.test(raw)) return;
    const d = declAt(decls, index);
    const line = src.slice(0, index).split("\n").length;
    items.push({
      file: rel,
      line,
      kind,
      raw,
      decl: d?.name ?? null,
      component: !!d && /^[A-Z]/.test(d.name) && !isServer,
      server: isServer,
    });
    strings.add(raw);
  };

  // double / single quoted string literals
  for (const m of src.matchAll(/"((?:[^"\\\n]|\\.)*)"/g)) push("dq", m[1], m.index);
  for (const m of src.matchAll(/'((?:[^'\\\n]|\\.)*)'/g)) push("sq", m[1], m.index);
  // JSX text nodes: >text< with arabic
  for (const m of src.matchAll(/>([^<>{}\n]*[\u0600-\u06FF][^<>{}]*)</g)) push("jsx", m[1], m.index + 1);
  // template literals (report only)
  for (const m of src.matchAll(/`([^`]*[\u0600-\u06FF][^`]*)`/g)) push("tpl", m[1], m.index);
}

const byFile = {};
for (const it of items) (byFile[it.file] ||= []).push(it);

const summary = Object.entries(byFile)
  .map(([f, v]) => ({
    file: f,
    total: v.length,
    component: v.filter((x) => x.component).length,
    moduleScope: v.filter((x) => !x.component && !x.server).length,
    server: v.filter((x) => x.server).length,
  }))
  .sort((a, b) => b.total - a.total);

writeFileSync("/tmp/i18n-extract.json", JSON.stringify({ items, strings: [...strings] }, null, 2));
console.log(`unique strings: ${strings.size}, occurrences: ${items.length}, files: ${summary.length}`);
console.table(summary.slice(0, 45));
console.log("kinds:", items.reduce((a, i) => ((a[i.kind] = (a[i.kind] || 0) + 1), a), {}));
console.log("scopes:", {
  component: items.filter((i) => i.component).length,
  module: items.filter((i) => !i.component && !i.server).length,
  server: items.filter((i) => i.server).length,
});
