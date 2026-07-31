## Plan

Goal: confirm the two small circular arrows on the dashboard sticky tool rail actually scroll the rail left/right (or right/left in RTL) and that their enabled/disabled states update correctly.

### Verification steps

1. **Code review**: re-read `src/routes/dashboard.tsx` around the rail/arrows to confirm `scrollRail`, `updateScrollState`, and the button `disabled`/`opacity` logic are wired correctly.
2. **Runtime check via Playwright**:
   - If a managed Supabase session is injected (`LOVABLE_BROWSER_AUTH_STATUS`), navigate to `/dashboard?tool=analyze`, open a tool, and:
     - Screenshot the rail.
     - Click the right/forward arrow and verify `scrollLeft` changes.
     - Click the left/back arrow and verify `scrollLeft` returns toward the original value.
     - Resize the viewport to force overflow and confirm both arrows appear/enable as expected.
   - If no session is available, note that authenticated routes cannot be verified automatically and ask the user to sign in via the preview so the next turn can complete the check.
3. **Fix any issue found** if the arrows do not scroll or state does not update.

### Files touched (if a fix is needed)

- `src/routes/dashboard.tsx` only.

### Success criteria

- Both arrows are clickable.
- Clicking an arrow scrolls the rail smoothly in the expected direction.
- Arrow opacity/disabled state updates after each scroll.