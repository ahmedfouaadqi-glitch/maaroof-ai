## Plan

Current state: `src/routes/dashboard.tsx` already has two small circular arrow buttons for the sticky tool rail, but the "back" arrow is placed between the "All tools" button and the scrollable rail, while the "forward" arrow is at the right end of the rail. When the rail is at its start, the back arrow is hidden (`opacity-0`), so only one arrow is visible at a time.

The user wants the same small arrow to also appear on the left side, not just in one place.

### Changes

1. **Reposition the scroll arrows** so they sit at both ends of the scrollable rail itself:
   - Left arrow at the left edge of the rail.
   - Right arrow at the right edge of the rail.
2. **Keep both arrows visible** whenever horizontal overflow exists (i.e., whenever scrolling is possible in either direction), instead of hiding the one that points toward the current edge.
3. **Preserve RTL behavior**: arrow icons flip correctly for Arabic/Kurdish (RTL) and English (LTR).
4. **Preserve existing behavior**: smooth scroll by ~55% of rail width, disabled states when no overflow, and keyboard navigation.
5. **No changes** to tool cards, workspace content, MagicRings, or routing logic.

### Files touched

- `src/routes/dashboard.tsx` only.

### Verification

- TypeScript check passes.
- Build succeeds.
- In the dashboard preview, opening any tool shows a small circular arrow on both the left and right ends of the sticky tool rail when the tools overflow horizontally.