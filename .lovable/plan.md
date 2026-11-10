# Merge all open updates into main + make English the default language

## Part 1 — Merge and sync the open pull requests

Open PRs (from the last check): #52, #53, #54, #55, #56, #57, #58.

Steps, in this order (oldest first, so later branches build on earlier ones):
1. Re-read each PR's current state on GitHub (open, mergeable, conflicts, checks).
2. Merge each mergeable PR into `main` through the connected GitHub account. Each merge shows an approval card for you to confirm.
3. If a PR has conflicts or failing checks: stop on that PR, report exactly which files conflict, and continue with the rest only if they don't depend on it. No force-push, no history rewrite.
4. After merging, Lovable pulls `main` automatically. Confirm the project shows the merged code (e.g. the new `sheetsForMarket` in `market-scope.ts`).
5. Run the full test suite and confirm the build is clean. Report the result.
6. No publishing to the live site without your explicit approval (per your standing rule).

## Part 2 — English as the default language

Today the app starts in Arabic (`ar`) for every new visitor; a saved choice overrides it.

Change:
- Default language becomes English (`en`, left-to-right) for visitors with no saved choice.
- Anyone who already picked Arabic or Kurdish keeps their choice.
- The language switcher stays; Arabic and Kurdish remain fully available.
- Landing page content is not changed, only which language it opens in.

## Technical details
- `src/lib/i18n/index.tsx`: initial state `useState<Lang>("ar")` -> `"en"`; `__root.tsx` already sets `<html lang="en">`, so SSR and first render stay consistent (no hydration mismatch).
- Check for any other hard-coded `"ar"` fallbacks (e.g. export language defaults) and switch only UI defaults, not content-language fields the user selects per task.
- Add a small test asserting the default language is `en` when nothing is stored.
- Record the default-language change in project memory (replacing the "pure Arabic UI" rule).

## Out of scope
- Database changes, email sending, CMS connector, competitor monitoring (all still paused).
