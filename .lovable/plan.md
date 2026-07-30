## Goal
Replace the circular "engines orbit" animation in the middle of the home page with your uploaded morphing-logos motion clip, at the same size and visual clarity.

## What it is now
`src/components/EnginesOrbit.tsx` renders a 380×380 canvas: SVG rings + beams, nine rotating engine chips, and the central MAAROOF hexagon logo. It sits inside the hero section of `src/routes/index.tsx`.

## What changes

1. **Prepare the clip** (`output_1.mp4`, 600×1068, 16s, cream background):
   - Crop to the centered square region that contains the animation, so it drops into the same 380×380 slot with no letterboxing.
   - Key out the cream background and export a transparent WebM (VP9 + alpha) so the animation floats over the site's own gradient/glow in both light and dark themes.
   - Keep a trimmed MP4 as a fallback source for browsers without alpha-WebM support (it renders on a soft rounded plate so it still looks intentional).
   - Both files are uploaded as CDN assets (`lovable-assets`), not committed binaries.

2. **Swap the visual in `EnginesOrbit.tsx`**:
   - Remove the SVG rings/beams block, the rotating engine-chip ring, and the central logo block.
   - Render a `<video autoplay loop muted playsinline>` in the same wrapper, same 380px box, `max-width: 100%`, `object-contain`, `aria-hidden` + a visually-hidden text alternative for accessibility.
   - Keep the ambient glow layers, the badge, heading, subheading, tagline and the two CTA buttons exactly as they are.
   - Keep the `useVisibility("engines_orbit")` gate and the i18n strings untouched.
   - Respect `prefers-reduced-motion`: pause the video and show its first frame instead.

3. Nothing else changes — no other page, no engine logic, no data.

## Note
The nine brand icons stay in use everywhere else (hero chips, selector, results, admin map); only the central orbit animation is replaced.
