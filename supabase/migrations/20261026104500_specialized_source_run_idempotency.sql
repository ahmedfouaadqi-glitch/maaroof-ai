-- Durable idempotency ledger for explicitly approved specialized-source operations.
-- This records side-effect state, not evidence; source observations remain in evidence_items.
CREATE TABLE IF NOT EXISTS public.specialized_source_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid NULL REFERENCES public.workspaces(id) ON DELETE SET NULL,
  request_id text NOT NULL CHECK (request_id ~ '^[A-Za-z0-9._:-]{1,128}$'),
  candidate_id text NOT NULL CHECK (candidate_id ~ '^[a-fA-F0-9]{24}$'),
  status text NOT NULL DEFAULT 'reserved'
    CHECK (status IN ('reserved','running','succeeded','rejected','uncertain')),
  estimated_credits numeric NULL CHECK (estimated_credits IS NULL OR estimated_credits >= 0),
  charged_tokens integer NOT NULL DEFAULT 0 CHECK (charged_tokens >= 0),
  error_code text NULL,
  response jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, request_id)
);

CREATE INDEX IF NOT EXISTS specialized_source_runs_user_workspace_created_idx
  ON public.specialized_source_runs (user_id, workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS specialized_source_runs_uncertain_idx
  ON public.specialized_source_runs (status, updated_at DESC)
  WHERE status IN ('reserved','running','uncertain');

ALTER TABLE public.specialized_source_runs ENABLE ROW LEVEL SECURITY;
-- No end-user policies by design. API service-role code is the only reader/writer;
-- users only receive the sanitized result for their own authenticated request.
