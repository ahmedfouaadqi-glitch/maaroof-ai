## Goal
Use the React Bits `OrbitImages` motion component as the central hero animation, instead of the current morph video clip in `src/components/EnginesOrbit.tsx`.

## Current state (verified)
- `src/components/EnginesOrbit.tsx` renders a `<video>` (webm/mp4 + poster) inside a rounded glass plate, wrapped by badge/title/subtitle and the two CTA buttons.
- The `motion` package is NOT in `package.json` dependencies — it must be installed.
- The nine engine marks are React SVG components (`ENGINES[].Logo`) in `src/components/engine-logos.tsx`, not image URLs.
- `HexBadge` exists and matches the MAAROOF hexagon look, good for the orbit center.

## What changes

1. **Install `motion`** (Motion for React, provides `motion/react`).

2. **Add the component** at `src/components/orbit/OrbitImages.tsx` + `src/components/orbit/OrbitImages.css`, copied from the provided source, with two minimal adaptations:
   - Converted to TypeScript with typed props (same prop names/defaults as the reference table).
   - Adds an optional `items?: ReactNode[]` prop alongside `images`, so we can orbit the real SVG logo components instead of raster URLs. When `items` is absent it behaves exactly as documented with `images`.
   - CSS imported from the component file (local file import, allowed — only remote `@import` in `styles.css` is forbidden).

3. **Use it in `EnginesOrbit.tsx`**
   - Remove the `<video>`, poster `<img>` and the three `*.asset.json` imports.
   - Render `<OrbitImages />` in the same slot with the nine engine logos as `items`, `shape="ellipse"`, `responsive`, a `baseWidth`-scaled ellipse, `duration={40}`, `itemSize` sized so the marks stay as legible as the current animation, and `centerContent` = the MAAROOF hexagon (`HexBadge`) so the middle isn't empty.
   - Each orbiting mark sits on a small bordered circular plate (`bg-card/70 border-border`) so light and dark themes both read well.
   - Keep the ambient glow, badge, heading, subheading, tagline, the two CTAs, the `useVisibility("engines_orbit")` gate, and all i18n strings untouched.
   - `prefers-reduced-motion`: pass `paused` so the logos render in a static ring instead of spinning.

4. Delete the now-unused morph asset pointer files (`engines-morph.webm/.mp4/-poster.jpg.asset.json`).

## Notes
- The orbit is decorative; it keeps `aria-hidden` plus the existing screen-reader text.
- Nothing outside this component changes — no engine logic, routes, or data.
