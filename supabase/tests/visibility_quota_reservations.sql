BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(17);

SELECT has_table(
  'public',
  'visibility_quota_reservations',
  'Visibility quota reservations table exists'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.visibility_quota_reservations'::regclass),
  'RLS is enabled for visibility quota reservations'
);
SELECT ok(
  NOT has_table_privilege('anon', 'public.visibility_quota_reservations', 'SELECT'),
  'Anonymous users cannot read quota reservations'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.visibility_quota_reservations', 'SELECT'),
  'Authenticated users cannot read quota reservations directly'
);
SELECT ok(
  has_table_privilege('service_role', 'public.visibility_quota_reservations', 'SELECT'),
  'Service role can access quota reservations'
);
SELECT ok(
  to_regprocedure('public.consume_visibility_quota(uuid,text,integer,uuid,text)') IS NOT NULL,
  'Run-linked atomic quota reservation RPC exists'
);
SELECT ok(
  to_regprocedure('public.finalize_visibility_quota(uuid,text,text)') IS NOT NULL,
  'Quota finalization RPC exists'
);
SELECT ok(
  NOT has_function_privilege('anon', 'public.consume_visibility_quota(uuid,text,integer,uuid,text)', 'EXECUTE'),
  'Anonymous users cannot reserve quota'
);
SELECT ok(
  NOT has_function_privilege('authenticated', 'public.consume_visibility_quota(uuid,text,integer,uuid,text)', 'EXECUTE'),
  'Authenticated users cannot reserve quota directly'
);
SELECT ok(
  has_function_privilege('service_role', 'public.consume_visibility_quota(uuid,text,integer,uuid,text)', 'EXECUTE'),
  'Service role can reserve quota'
);
SELECT ok(
  NOT has_function_privilege('anon', 'public.finalize_visibility_quota(uuid,text,text)', 'EXECUTE'),
  'Anonymous users cannot finalize quota'
);
SELECT ok(
  NOT has_function_privilege('authenticated', 'public.finalize_visibility_quota(uuid,text,text)', 'EXECUTE'),
  'Authenticated users cannot finalize quota directly'
);
SELECT ok(
  has_function_privilege('service_role', 'public.finalize_visibility_quota(uuid,text,text)', 'EXECUTE'),
  'Service role can finalize quota'
);

SELECT ok(
  public.consume_visibility_quota(NULL, 'profile', 1, NULL, 'invalid-test-run')->>'reason' = 'invalid_request',
  'Quota reservation rejects a missing user without mutating counters'
);
SELECT ok(
  public.finalize_visibility_quota(NULL, 'invalid-test-run', 'release')->>'reason' = 'invalid_request',
  'Quota finalization rejects a missing user'
);
SELECT ok(
  public.refund_token_charge(NULL, 'visibility', 'invalid-test-run', 'test')->>'reason' = 'invalid_refund_reference',
  'Token refund rejects an incomplete charge reference'
);
SELECT ok(
  public.charge_tokens(NULL, 'visibility', -1, 0, 'invalid-test-run', '{}'::jsonb)->>'reason' = 'invalid_amount',
  'Ordinary token charge rejects negative token amounts'
);

SELECT * FROM finish();
ROLLBACK;
