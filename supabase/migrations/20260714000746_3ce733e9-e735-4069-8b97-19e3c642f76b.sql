
ALTER TABLE public.maaroof_runs
  ADD COLUMN IF NOT EXISTS decision_log jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.maaroof_memory
  ADD COLUMN IF NOT EXISTS links jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS source_run_id uuid NULL,
  ADD COLUMN IF NOT EXISTS capability text NULL;

CREATE INDEX IF NOT EXISTS maaroof_memory_capability_idx
  ON public.maaroof_memory (user_id, capability)
  WHERE capability IS NOT NULL;
