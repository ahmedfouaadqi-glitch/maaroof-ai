-- Unified operations ledger for Brand Boost, authority publishing, and engine probes.
CREATE TABLE IF NOT EXISTS public.brand_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  operation_type text NOT NULL,
  brand_name text NULL,
  status text NOT NULL DEFAULT 'completed',
  request_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz NOT NULL DEFAULT now(),
  duration_ms bigint NULL,
  charged_units numeric NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS brand_operations_owner_workspace_created_idx
  ON public.brand_operations (user_id, workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS brand_operations_type_created_idx
  ON public.brand_operations (operation_type, created_at DESC);

CREATE TABLE IF NOT EXISTS public.brand_operation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid NOT NULL REFERENCES public.brand_operations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS brand_operation_events_operation_idx
  ON public.brand_operation_events (operation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS brand_operation_events_owner_workspace_idx
  ON public.brand_operation_events (user_id, workspace_id, created_at DESC);

ALTER TABLE public.brand_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_operation_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS brand_operations_owner_select ON public.brand_operations;
CREATE POLICY brand_operations_owner_select ON public.brand_operations
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS brand_operation_events_owner_select ON public.brand_operation_events;
CREATE POLICY brand_operation_events_owner_select ON public.brand_operation_events
  FOR SELECT USING (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
