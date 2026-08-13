# MAAROOF Changed Files

## Branch

`feature/maaroof-kernel-v1`, based on `main` at `406cb31`; latest remote safety correction is `7aea692`. The branch is currently 4 commits ahead and 5 commits behind `main` because `main` received later updates.

| File | Change | Reason | Risk |
|---|---|---|---|
| `src/lib/maaroof/kernel.server.ts` | Added `MaaroofKernelManifest`, `createKernelManifest`, and `kernelPromptBlock` | Provide a small server-side identity/policy contract over the existing MAAROOF layers | Low; pure metadata and prompt context, no new table or provider |
| `src/lib/maaroof/orchestrator.server.ts` | Creates, emits, logs, and injects the kernel manifest in the existing run | Make the contract visible in SSE, durable run messages, and model context | Medium; touches the central run path, covered by typecheck/build/tests but needs authenticated Preview |
| `src/lib/maaroof/settings.server.ts` | Keeps `platform_evolution.execution_modes_enabled` default `false` (safety correction after review) while leaving advanced engines OFF | Prevent unverified recommendation/simulation behavior from opening globally; keep execution opt-in | Low after correction; one-line flag and no schema/API change |
| `src/lib/maaroof/__tests__/kernel.test.ts` | Added two unit tests | Verify workspace scope, allowed-tool normalization, and non-executing mode labeling | Low |
| `MAAROOF_EXISTING_SYSTEM_MAP.md` | Added system map | Required implementation evidence | None at runtime |
| `MAAROOF_INTEGRATION_MATRIX.md` | Added integration matrix | Required mapping between bundle and repository | None at runtime |
| `MAAROOF_CHANGED_FILES.md` | This file | Change record | None at runtime |

No existing route, database migration, API contract, UI tab, tool endpoint, memory provider, or browser integration was deleted or renamed. No Lovable action is part of the current execution; the branch is prepared for later manual review only.
