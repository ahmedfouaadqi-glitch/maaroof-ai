## Goal
Adopt the React Bits **Lightfall** WebGL effect as the ambient background for the whole project (all pages), tuned to MAAROOF's brand and readability standards — not as a one-off hero widget.

## What gets built

1. **Dependency**: install `ogl`.

2. **Component** — `src/components/backgrounds/Lightfall.tsx` + `Lightfall.css`
   - Full source from the spec, converted to TypeScript with a typed props interface (all documented props kept, same defaults).
   - Client-only safety: WebGL init stays inside `useEffect`, and the effect array is stabilized so a new `colors` array literal doesn't rebuild the renderer every render (memoize the colors key).
   - Graceful no-op if WebGL context creation fails (falls back to nothing rendered, page stays intact).

3. **Global wrapper** — `src/components/backgrounds/SiteBackground.tsx`
   - Renders Lightfall in a `fixed inset-0 -z-10 pointer-events-none` layer so it sits behind every page without capturing clicks.
   - Respects `prefers-reduced-motion` → renders a static brand gradient instead.
   - Lowers cost on small screens / low-end devices: reduced `dpr`, fewer streaks; pauses when the tab is hidden.
   - Colors pulled from the existing brand tokens rather than the demo blue/pink, with low `opacity` + `backgroundGlow` so text contrast and the existing surfaces stay readable in both light and dark themes.

4. **Wire-up** — `src/routes/__root.tsx`
   - Mount `<SiteBackground />` once inside `RootComponent`, above `<Outlet />` in DOM order but behind it visually. Every route inherits it automatically; no per-page edits.

5. **Existing hero**: the `OrbitImages` engine orbit stays exactly as is — Lightfall renders behind it, tuned so it doesn't compete with the orbiting logos.

## Verification
- Visual capture of the home page plus one tool page and one admin page, light and dark, confirming readability and that the background doesn't block interaction.
- Confirm reduced-motion fallback and that no console/WebGL errors appear.

## Technical notes
- Only presentation code changes: two new component files, one dependency, one root-route mount.
- `mouseInteraction` will be enabled on desktop only (disabled under a touch/small-screen check) to avoid pointer cost on mobile.
