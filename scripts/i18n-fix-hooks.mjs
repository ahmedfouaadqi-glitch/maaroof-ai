#!/usr/bin/env node
/** Repair pass: put `const { t } = useI18n()` at the top of the right component. */
import { readFileSync, writeFileSync } from "node:fs";

const files = JSON.parse(readFileSync(process.argv[2], "utf8"));
const HOOK = /^[ \t]*const \{ t \} = useI18n\(\);[ \t]*$/;
const DECL_START =
  /^(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function\s+([A-Za-z0-9_]+)|const\s+([A-Za-z0-9_]+))/;
const FN_SIG = [
  /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+\w+\s*(?:<[^>]*>)?\s*\([\s\S]*?\)\s*(?::[^{;]+)?\{/,
  /^(?:export\s+)?const\s+\w+\s*(?::[^=]+)?=\s*(?:React\.)?(?:memo\()?\s*(?:async\s+)?(?:\([\s\S]*?\)|\w+)\s*(?::[^=>]+)?=>\s*\{/,
];

let fixed = 0;
for (const file of files) {
  let src = readFileSync(file, "utf8");
  if (!src.includes('t("auto.')) continue;
  const before = src;

  // 1) drop hook lines that don't sit directly under a top-level declaration
  const lines = src.split("\n");
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (HOOK.test(lines[i])) {
      let j = i - 1;
      while (j >= 0 && !lines[j].trim()) j--;
      const prev = lines[j] ?? "";
      const ok = DECL_START.test(prev) || /^\)\s*(?::[^{]+)?\{\s*$/.test(prev) || /^\s*\)\s*\{\s*$/.test(prev);
      if (!ok) continue; // remove misplaced insertion
    }
    out.push(lines[i]);
  }
  src = out.join("\n");

  // 2) insert the hook at the head of every top-level function that uses t(
  const decls = [];
  {
    let off = 0;
    for (const line of src.split("\n")) {
      const m = DECL_START.exec(line);
      if (m) decls.push({ name: m[1] || m[2], start: off });
      off += line.length + 1;
    }
    for (let i = 0; i < decls.length; i++)
      decls[i].end = i + 1 < decls.length ? decls[i + 1].start : src.length;
  }
  for (let i = decls.length - 1; i >= 0; i--) {
    const d = decls[i];
    const body = src.slice(d.start, d.end);
    if (!/\bt\(["'`]/.test(body)) continue;
    if (/\{[^}\n]*\bt\b[^}\n]*\}\s*=\s*useI18n\(/.test(body)) continue;
    if (/\bconst\s+t\s*=/.test(body)) continue;
    let sig = null;
    for (const re of FN_SIG) { const m = re.exec(body); if (m) { sig = m; break; } }
    if (!sig) { console.log(`  ! no signature: ${file} ${d.name}`); continue; }
    const at = d.start + sig[0].length;
    src = src.slice(0, at) + "\n  const { t } = useI18n();" + src.slice(at);
  }

  if (src !== before) { writeFileSync(file, src); fixed++; }
}
console.log(`repaired ${fixed} files`);
