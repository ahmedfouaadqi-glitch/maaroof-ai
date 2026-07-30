## Goal
Use the nine official brand SVGs you uploaded as the engine icons everywhere in the site (home page, engine selector, orbit, answers/results, admin model map).

## What changes

Single file: `src/components/engine-logos.tsx` — rewrite each logo component's SVG path data with the official artwork:

| Engine key | Uploaded file |
|---|---|
| chatgpt | `openai.svg` |
| gemini | `gemini-color.svg` |
| claude | `claude-color.svg` |
| perplexity | `perplexity-color.svg` |
| copilot | `copilot-color.svg` |
| grok | `grok.svg` |
| mistral | `mistral-color.svg` |
| deepseek | `deepseek-color.svg` |
| kimi | `kimi-color.svg` |

Everything else stays as is: the components keep the same names, the same `{ size }` prop API, `viewBox="0 0 24 24"`, and the `LOGO_BY_KEY` mapping, so all consumers (`index.tsx`, `EngineSelector`, `EnginesOrbit`, `BrandBoostAgent`, `AIVisibility`, `ModelDecisionPanels`) pick the new icons up automatically with no edits.

## Technical details

- Gradient/`<defs>` IDs in the uploaded Copilot and Gemini files (`lobe-icons-...-_R_0_`) are renamed to unique, stable IDs per component so multiple icons on one page never collide.
- SVG attributes are converted to JSX (`fill-rule` → `fillRule`, `stop-color` → `stopColor`, inline `style` removed) and `height/width="1em"` replaced by the existing `size` prop.
- Grok and OpenAI stay `fill="currentColor"` so they follow the theme in light/dark; the rest keep their official brand colors.
- The Kimi logo has a blue mark on a white shape — a dark rounded background is added behind it so it stays visible on dark surfaces.
- No changes to `ai-engines.ts`, engine model mapping, or any business logic.
