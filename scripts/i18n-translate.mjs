#!/usr/bin/env node
/**
 * Translate the extracted Arabic UI strings into English + Kurdish (Sorani)
 * using the Lovable AI Gateway. Caches results in /tmp/i18n-translations.json.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const CACHE = "/tmp/i18n-translations.json";
const KEY = process.env.LOVABLE_API_KEY;
if (!KEY) { console.error("LOVABLE_API_KEY missing"); process.exit(1); }

const input = JSON.parse(readFileSync(process.argv[2] || "/tmp/i18n-todo.json", "utf8"));
const list = Array.isArray(input) ? input : input.strings;
const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : {};

const todo = list.filter((s) => !cache[s]);
console.log(`to translate: ${todo.length} (cached ${list.length - todo.length})`);

const SYS = `You translate UI strings for an Arabic SaaS product (AI search-visibility / GEO analytics).
You receive a JSON array of Arabic UI strings. Return ONLY a JSON array of the same length,
each element: {"en": "...", "ku": "..."} where ku is Central Kurdish (Sorani, Arabic script).
Rules:
- Preserve placeholders such as {n}, {name}, %s, $, numbers, emoji and product names (MAAROOF, GEO, ChatGPT, Gemini, Telegram, LinkedIn, PDF...) exactly.
- Keep the same tone, length and punctuation style; UI labels stay short.
- Do not add quotes, explanations, or extra keys. Same order as input.`;

async function batch(items) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYS },
        { role: "user", content: JSON.stringify(items) },
      ],
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const json = await res.json();
  let txt = json.choices?.[0]?.message?.content?.trim() || "";
  txt = txt.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const arr = JSON.parse(txt);
  if (!Array.isArray(arr) || arr.length !== items.length) throw new Error(`length mismatch ${arr.length}/${items.length}`);
  return arr;
}

const SIZE = 30;
const chunks = [];
for (let i = 0; i < todo.length; i += SIZE) chunks.push(todo.slice(i, i + SIZE));

let done = 0;
const CONCURRENCY = 6;
async function worker(queue) {
  while (queue.length) {
    const c = queue.shift();
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const out = await batch(c);
        c.forEach((s, i) => { cache[s] = out[i]; });
        break;
      } catch (e) {
        if (attempt === 2) console.error("FAILED chunk:", String(e).slice(0, 200));
        else await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      }
    }
    done += c.length;
    if (done % 150 < SIZE) { writeFileSync(CACHE, JSON.stringify(cache, null, 1)); console.log(`… ${done}/${todo.length}`); }
  }
}
const queue = chunks.slice();
await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(queue)));
writeFileSync(CACHE, JSON.stringify(cache, null, 1));
console.log(`translated: ${Object.keys(cache).length} total in cache`);
