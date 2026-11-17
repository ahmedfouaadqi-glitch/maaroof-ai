# MAAROOF Ai — Owner-Authorized Execution Scope Overrides

**Date:** 17 November 2026  
**Branch:** `feat/non-destructive-owner-workspaces-reports-2026-11-17`

This record captures the owner's explicit instruction to bypass the earlier P0 blockers and continue execution from the Supabase-exclusion boundary.

## Authorized overrides

1. The tracked `.env` remediation and credential-rotation issue is not to block continuation. The exposure risk remains unresolved and is not represented as fixed.
2. The remaining broad P0 semantic inventory is not a prerequisite for continuing implementation.
3. Supabase live access, queries, configuration/secrets, data, RLS policies and migration inspection remain excluded. Persisted isolation, ownership, deletion/cascade, archive/restore and report delivery must not be marked verified.
4. Continue with P1 and the subsequent plan stages, implementing source-level and pure-domain work that does not require excluded database access.

## Constraints that remain active

- Work only on `feat/non-destructive-owner-workspaces-reports-2026-11-17`; do not modify, merge into or deploy `main`.
- Preserve the ten-engine catalog and all eleven protected files.
- No Cloudflare.
- No paid operations, live probes or external model execution.
- No physical deletion or migration of customer/workspace/history data.
- Preserve existing export formats.
- Preserve authentication, RLS, ownership and token-ledger behavior.
- No secret contents may be opened or emitted.

## Status semantics

The override changes the execution sequence; it does not convert incomplete audit gates into passes. Each phase is reported as implemented, partial, blocked, unverified or passed according to actual evidence.
