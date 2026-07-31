#!/usr/bin/env node
/**
 * Second pass: module-scope label constants.
 * Arabic values become translation keys; every read of the property/map is
 * wrapped in t(...) so the value resolves against the active language.
 */
import { readFileSync, writeFileSync } from "node:fs";

const cache = JSON.parse(readFileSync("/tmp/i18n-translations.json", "utf8"));
const keyMap = JSON.parse(readFileSync("/tmp/i18n-keymap.json", "utf8"));
const used = new Set(Object.values(keyMap));
const AR = /[\u0600-\u06FF]/;

function slug(en) {
  return (
    (en || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").split("_").filter(Boolean).slice(0, 6).join("_") || "text"
  );
}
function keyFor(ar) {
  if (keyMap[ar]) return keyMap[ar];
  const tr = cache[ar];
  if (!tr) return null;
  let base = `auto.${slug(tr.en)}`, k = base, i = 2;
  while (used.has(k)) k = `${base}_${i++}`;
  used.add(k); keyMap[ar] = k;
  return k;
}

/** [file, propNames[], mapNames[]] */
const JOBS = [
  ["src/components/GeoStrategist.tsx", ["label"], []],
  ["src/components/WhatIfSimulator.tsx", ["label"], []],
  ["src/components/admin/MaaroofAdminTab.tsx", ["label", "hint"], []],
  ["src/components/admin/MaaroofIntelligenceCenter.tsx", ["label"], []],
  ["src/components/maaroof/SchedulesPanel.tsx", [], ["FREQ_LABEL", "APPROVAL_LABEL"]],
];

for (const [file, props, maps] of JOBS) {
  let src = readFileSync(file, "utf8");
  const before = src;
  for (const p of props) {
    src = src.replace(new RegExp(`(\\b${p}\\s*:\\s*)"([^"\\n]*[\\u0600-\\u06FF][^"\\n]*)"`, "g"), (m, head, val) => {
      const k = keyFor(val.trim());
      return k ? `${head}"${k}"` : m;
    });
    // wrap reads: obj.prop  ->  t(obj.prop)
    src = src.replace(new RegExp(`(?<!t\\()\\b([a-zA-Z_$][\\w$]*)\\.${p}\\b`, "g"), (m, obj) => `t(${obj}.${p})`);
  }
  for (const mp of maps) {
    src = src.replace(new RegExp(`(${mp}[\\s\\S]*?\\n\\};)`, ""), (block) =>
      block.replace(/"([^"\n]*[\u0600-\u06FF][^"\n]*)"/g, (m, val) => {
        const k = keyFor(val.trim());
        return k ? `"${k}"` : m;
      }),
    );
    src = src.replace(new RegExp(`(?<!t\\()\\b${mp}\\[([^\\]]+)\\]`, "g"), (m, idx) => `t(${mp}[${idx}])`);
  }
  if (src !== before) { writeFileSync(file, src); console.log("updated", file); }
}
writeFileSync("/tmp/i18n-keymap.json", JSON.stringify(keyMap, null, 1));
