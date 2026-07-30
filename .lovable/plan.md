## Goal
Make the Lightfall background actually visible on the home page and on every other page of the site — right now it is mounted globally, but opaque surfaces paint over it, so it only shows faintly at the top of the home hero.

## What's blocking it (verified)
- `src/styles.css` sets an opaque `background: var(--background)` on `html, body`, which sits above the fixed `-z-10` effect layer on most scroll positions.
- Four routes wrap their whole page in `min-h-screen bg-background`, fully hiding the layer: `maaroof.tsx`, `maaroof.memory.tsx`, `guide.geo-vs-aeo.tsx`, `guide.arabic-kurdish-geo.tsx`.
- Home (`routes/index.tsx`) itself is transparent, but individual sections below the hero use solid section backgrounds.

## Changes

1. **Global base layer** — `src/styles.css`
   - Keep `html` painting the solid brand background (so there is never a white flash), and make `body` transparent so the fixed Lightfall canvas shows through the full scroll height.

2. **Un-block full-page wrappers**
   - In the four routes above, drop `bg-background` from the outermost `min-h-screen` wrapper (keep `min-h-screen`). Cards, headers, and panels inside keep their own surfaces, so contrast is unchanged.

3. **Home page visibility** — `src/routes/index.tsx`
   - Replace solid section backgrounds with translucent equivalents (`bg-background/70` style surfaces + backdrop blur) so the streaks read continuously down the page instead of only behind the hero.

4. **Tune the effect for full-page use** — `src/components/backgrounds/SiteBackground.tsx`
   - Slightly raise opacity/glow and extend the ambient gradient so the effect stays present below the fold, while keeping text contrast comfortable in light and dark themes.

## Verification
- Screenshots at top and mid-scroll of: home, `/maaroof`, one guide page, and one admin page — desktop and mobile widths, light and dark — confirming the background is visible everywhere and all text stays readable.
