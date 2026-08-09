ALTER TABLE public.execution_tasks
  ADD COLUMN IF NOT EXISTS verification_state text,
  ADD COLUMN IF NOT EXISTS execution_kind text,
  ADD COLUMN IF NOT EXISTS result_kind text,
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS duration_ms integer;

ALTER TABLE public.evidence_items
  ADD COLUMN IF NOT EXISTS verification_state text,
  ADD COLUMN IF NOT EXISTS confidence integer;

CREATE INDEX IF NOT EXISTS execution_tasks_verification_state_idx
  ON public.execution_tasks (verification_state);
CREATE INDEX IF NOT EXISTS evidence_items_verification_state_idx
  ON public.evidence_items (verification_state);