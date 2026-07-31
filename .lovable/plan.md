## Goal

MagicRings currently shows behind each tool card's identity face on the grid, but when a card is opened the effect is only a faint 40px strip at 25% opacity behind the workspace header — it reads as an artifact, not a designed element. Make it a deliberate, professional part of the opened tool view.

## What changes (frontend only, `src/routes/dashboard.tsx` + `src/components/backgrounds/MagicRings.tsx`)

1. **Opened-card hero band**
   - Replace the thin `h-40 opacity-25` overlay with a proper header band inside the opened section: the tool icon, title and short description sit on top of a MagicRings canvas, with a gradient scrim from transparent to card so the body text stays fully readable.
   - Tune props for the larger surface: `ringCount={6}`, `speed={0.55}`, `attenuation={11}`, `lineThickness={1.5}`, `baseRadius={0.3}`, `radiusStep={0.1}`, `noiseAmount={0.03}`, `followMouse` with light `mouseInfluence` and `parallax` so it feels alive on hover but never distracting.

2. **Re-key on tool switch**
   - Give the rings a `key={active.key}` so switching tools from the sticky rail replays the ring cycle — a subtle transition cue instead of a static glow.

3. **Performance discipline**
   - When a tool is open, the grid is unmounted, so only one ring canvas runs. Keep the existing `paused` prop and pass `paused` for off-screen/reduced-motion cases; confirm the IntersectionObserver + `visibilitychange` gating still stops the RAF loop when the band scrolls out under the sticky rail.
   - Keep the mobile/coarse-pointer path lighter (fewer rings, lower opacity, `followMouse` off) using the existing media-query approach used by `SiteBackground`.

4. **Robustness check**
   - Verify the `ogl` port mounts correctly when the container starts at zero height (opened section animating in) — the resize handler already clamps to 1px; confirm a `ResizeObserver` tick repaints once real dimensions arrive, otherwise force one render after first non-zero size.

## Notes

- No new dependency: the project's MagicRings is already ported to `ogl` (used by Lightfall); we do not add `three`. Shader math stays identical to the React Bits source.
- Colors stay on brand tokens (`#7A46F8` / `#55B6F0`) rather than the demo pink/cyan.
- Verification: open a tool from the dashboard, screenshot the opened card at desktop and mobile widths, and confirm the rings render, animate, and don't reduce text contrast.
