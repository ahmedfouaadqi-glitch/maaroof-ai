## Security Hardening Plan

The scanner found 8 issues. Here is what each one means in plain language and how I will close them.

### 1. Free AI access for anyone on the internet (CRITICAL)
`translateText` (`src/lib/translate.functions.ts`) has no authentication. Anyone can hit the RPC URL with `curl` and burn the project's paid Lovable AI credits with no account.

**Fix:** Add `.middleware([requireSupabaseAuth])` so only signed-in users can call it, and charge tokens through the existing `chargeTokens` ledger so abuse is bounded by the caller's quota.

### 2. Open-redirect / phishing vector in `/auth` (HIGH)
`src/routes/auth.tsx` reads the `?redirect=` URL parameter and navigates to it without validation, cast through `as any`. An attacker could send `https://geoiraq.com/auth?redirect=https://evil.com` and land victims on a clone right after they sign in.

**Fix:** In `validateSearch`, accept only relative internal paths (`^/(?!/)`); fall back to `/dashboard` for anything else (absolute URLs, `//evil.com`, `javascript:`, etc.). No component changes needed.

### 3. SECURITY DEFINER functions callable by the public role (5 warnings)
Postgres functions marked `SECURITY DEFINER` run with the owner's privileges. By default `EXECUTE` is granted to `PUBLIC`, so any signed-in (and sometimes anonymous) user can call them directly via the Data API even when that is not intended.

**Fix:** One migration that locks each function down to who actually needs it:
- `handle_new_user`, `guard_profile_privileged_updates` — trigger-only → revoke EXECUTE from PUBLIC.
- `charge_tokens` — server-only (called via service role) → revoke from PUBLIC, grant to `service_role` only.
- `has_role` — used inside RLS policies → revoke from PUBLIC + anon, keep `authenticated` (required so policies can call it).
- `ensure_trial_subscription` — called by signed-in trial flow → revoke from PUBLIC + anon, keep `authenticated`.

### 4. Extension installed in `public` schema (WARN, low priority)
A Postgres extension lives in `public`. Best practice is a dedicated `extensions` schema, but moving an in-use extension can break dependent objects.

**Fix:** Acknowledge and leave in place (document in security memory). I will not move it blindly; if you want it relocated I can do it as a separate, carefully tested migration.

### Verification
After applying the changes I will re-run the security scan to confirm the 4 actionable findings clear, and update the security memory document to reflect the new posture.

### Files / DB touched
- `src/lib/translate.functions.ts` — add auth middleware + token charge.
- `src/routes/auth.tsx` — sanitize `redirect` search param.
- New migration — revoke/grant EXECUTE on the 5 SECURITY DEFINER functions.
