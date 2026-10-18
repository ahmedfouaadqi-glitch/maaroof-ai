BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(22);

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

-- Explicitly exercise the owner-policy branch, even if a workspace trigger adds membership rows.
DELETE FROM public.workspace_members
WHERE workspace_id = '20000000-0000-4000-8000-000000000001'
  AND user_id = '10000000-0000-4000-8000-000000000001';

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

INSERT INTO public.maaroof_interview_evidence (
  interview_id, user_id, workspace_id, query, title, source_url, domain, locale
)
VALUES
  (
    '30000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    NULL, 'owner query', 'Owner evidence', 'https://owner.example.test/source', 'owner.example.test', 'en'
  ),
  (
    '30000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001', 'workspace query', 'Workspace evidence', 'https://workspace.example.test/source', 'workspace.example.test', 'en'
  )
ON CONFLICT (interview_id, source_url) DO NOTHING;

SELECT has_table(
  'public',
  'maaroof_interviews',
  'Interview sessions table exists'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.maaroof_interviews'::regclass),
  'Row-level security is enabled for interview sessions'
);
SELECT has_column(
  'public',
  'profiles',
  'interview_persona',
  'Profile interview persona preference column exists'
);
INSERT INTO public.maaroof_interview_reports (
  interview_id, user_id, workspace_id, locale, evidence_count,
  evidence_collected_at, report_payload, model_key
)
VALUES
  (
    '30000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    NULL, 'en', 1, now(), '{"summary":"personal test"}'::jsonb, 'test-model'
  ),
  (
    '30000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001', 'en', 1, now(),
    '{"summary":"workspace test"}'::jsonb, 'test-model'
  )
ON CONFLICT (interview_id, report_type) DO NOTHING;

SELECT has_table(
  'public',
  'maaroof_interview_evidence',
  'Interview external evidence table exists'
);
SELECT has_table(
  'public',
  'maaroof_interview_reports',
  'Interview advanced reports table exists'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.maaroof_interview_reports'::regclass),
  'Row-level security is enabled for interview reports'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.maaroof_interview_evidence'::regclass),
  'Row-level security is enabled for interview external evidence'
);

SET LOCAL ROLE authenticated;
DO $$
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',
    true
  );
  PERFORM set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
END
$$;

SELECT is(
  (SELECT count(*)::integer FROM public.maaroof_interview_reports
   WHERE interview_id = '30000000-0000-4000-8000-000000000001'),
  1,
  'a user can read a report linked to their own personal interview'
);
SELECT is(
  (SELECT count(*)::integer FROM public.maaroof_interview_reports
   WHERE interview_id = '30000000-0000-4000-8000-000000000003'),
  1,
  'a workspace owner can read the workspace report'
);
SELECT is(
  (SELECT count(*)::integer FROM public.maaroof_interview_evidence
   WHERE interview_id = '30000000-0000-4000-8000-000000000001'),
  1,
  'a user can read evidence linked to their own personal interview'
);
SELECT is(
  (SELECT count(*)::integer FROM public.maaroof_interview_evidence
   WHERE interview_id = '30000000-0000-4000-8000-000000000003'),
  1,
  'a user can read evidence linked to a workspace they own'
);
SELECT is(
  (SELECT count(*)::integer FROM public.maaroof_interview_evidence
   WHERE interview_id = '30000000-0000-4000-8000-000000000002'),
  0,
  'a user cannot read evidence linked to another personal interview'
);
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

DO $$
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',
    true
  );
  PERFORM set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
END
$$;
SELECT is(
  (SELECT count(*)::integer FROM public.maaroof_interviews
   WHERE id = '30000000-0000-4000-8000-000000000003'),
  1,
  'a workspace viewer can read the workspace interview'
);
SELECT is(
  (SELECT count(*)::integer FROM public.maaroof_interview_reports
   WHERE interview_id = '30000000-0000-4000-8000-000000000003'),
  1,
  'a workspace viewer can read the workspace report'
);

DO $$
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}',
    true
  );
  PERFORM set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
END
$$;
SELECT is(
  (SELECT count(*)::integer FROM public.maaroof_interviews
   WHERE id = '30000000-0000-4000-8000-000000000003'),
  0,
  'a user who is not a workspace member cannot read its interview'
);
SELECT is(
  (SELECT count(*)::integer FROM public.maaroof_interview_reports
   WHERE interview_id = '30000000-0000-4000-8000-000000000003'),
  0,
  'a user who is not a workspace member cannot read its report'
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
