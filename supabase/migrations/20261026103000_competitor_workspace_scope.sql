-- Scope existing competitor watches to the same workspace that initiated them.
-- This extends existing tables; it does not create another monitoring store.
ALTER TABLE public.competitor_watch
  ADD COLUMN IF NOT EXISTS workspace_id uuid;

ALTER TABLE public.competitor_alerts
  ADD COLUMN IF NOT EXISTS workspace_id uuid;

CREATE INDEX IF NOT EXISTS competitor_watch_user_workspace_created_idx
  ON public.competitor_watch (user_id, workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS competitor_alerts_user_workspace_created_idx
  ON public.competitor_alerts (user_id, workspace_id, created_at DESC);
