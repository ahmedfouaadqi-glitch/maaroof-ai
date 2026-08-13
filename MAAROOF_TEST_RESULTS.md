# MAAROOF Test Results

## Environment

Dependencies were installed from the existing package metadata for local verification. The installation reported eight dependency audit findings (four moderate and four high); no automatic force upgrade was applied because that could introduce unrelated breaking changes.

## Baseline at `406cb31`

| Check | Result | Note |
|---|---|---|
| `npm test` | PASS | 10 tests passed in 2 test files |
| `npx tsc --noEmit` | PASS | No type errors |
| `npm run build` | PASS | Build completed; Cloudflare warning says Wrangler `main` is overridden by the build integration |
| `npm run lint` | FAIL before changes | Existing repository-wide lint debt: approximately 15,107 problems, including formatting and explicit-any findings across unrelated files |

## After kernel branch changes and safety correction

| Check | Result | Note |
|---|---|---|
| `vitest run src/lib/maaroof/__tests__/kernel.test.ts` | PASS | 2 kernel tests passed after the safety correction |
| `tsc --noEmit` | PASS | No type errors after adding the kernel contract and safety correction |
| `vite build` | PASS | Build completed successfully; generated route tree was restored and is not part of the branch diff |
| `eslint .` | FAIL, pre-existing repository-wide debt | 15,110 problems were reported; the failure is not limited to the safety correction and requires a separate lint-debt project |
| `git diff --check` | PASS | No whitespace errors in the branch diff at the recorded check |

## Required authenticated checks still pending

A real authenticated runtime session is still required to verify workspace isolation, SSE event ordering, token/trial charging, tool endpoint behavior, and the visible `/maaroof` experience. These cannot be honestly simulated by unit tests. Per the user's current instruction, no Lovable review or Preview action will be performed in this task. Production Publish is not part of this report and requires explicit approval.
