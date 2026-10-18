BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(8);

-- Fixed fixtures are isolated inside this transaction and removed by ROLLBACK.
INSERT INTO auth.users (id, email)
VALUES
  ('10000000-0000-4000-8000-000000000001', 'maaroof-rls-owner@example.test'),
  ('10000000-0000-4000-8000-000000000002', 'maaroof-rls-viewer@example.test'),
  ('10000000-0000-4000-8000-000000000003', 'maaroof-rls-outsider@example.test')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.workspaces (id, owner_id, name)
VALUES (
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'Maaroof RLS test workspace'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.workspace_members (workspace_id, user_id, role)
VALUES (
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  'viewer'
)
ON CONFLICT DO NOTHING;

INSERT INTO public.maaroof_interviews (
  id, user_id, workspace_id, target_type, target_name,
  question_set_version, questions_snapshot, state
)
VALUES
  (
    '30000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    NULL, 'individual', 'Owner personal session',
    'rls-test', '[]'::jsonb, '{}'::jsonb
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    NULL, 'individual', 'Viewer personal session',
    'rls-test', '[]'::jsonb, '{}'::jsonb
  ),
  (
    '30000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'company', 'Workspace session',
    'rls-test', '[]'::jsonb, '{}'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);

SELECT is(
  (SELECT count(*)::integer FROM public.maaroof_interviews
   WHERE id = '30000000-0000-4000-8000-000000000001'),
  1,
  'a user can read their own personal interview'
);
SELECT is(
  (SELECT count(*)::integer FROM public.maaroof_interviews
   WHERE id = '30000000-0000-4000-8000-000000000002'),
  0,
  'a user cannot read another user personal interview'
);
SELECT is(
  (SELECT count(*)::integer FROM public.maaroof_interviews
   WHERE id = '30000000-0000-4000-8000-000000000003'),
  1,
  'a workspace owner can read a workspace interview without a membership row'
);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
SELECT is(
  (SELECT count(*)::integer FROM public.maaroof_interviews
   WHERE id = '30000000-0000-4000-8000-000000000003'),
  1,
  'a workspace viewer can read the workspace interview'
);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
SELECT is(
  (SELECT count(*)::integer FROM public.maaroof_interviews
   WHERE id = '30000000-0000-4000-8000-000000000003'),
  0,
  'a user who is not a workspace member cannot read its interview'
);

RESET ROLE;
SELECT ok(
  NOT has_table_privilege('anon', 'public.maaroof_interviews', 'SELECT'),
  'anonymous role has no direct SELECT privilege'
);
SELECT ok(
  has_table_privilege('authenticated', 'public.maaroof_interviews', 'SELECT'),
  'authenticated role has SELECT privilege subject to row-level security'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.maaroof_interviews', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'public.maaroof_interviews', 'UPDATE')
  AND NOT has_table_privilege('authenticated', 'public.maaroof_interviews', 'DELETE'),
  'authenticated clients cannot directly write interview rows'
);

SELECT * FROM finish();
ROLLBACK;
