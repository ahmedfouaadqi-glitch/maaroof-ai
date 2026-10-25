ALTER TABLE public.maaroof_chat_messages ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.maaroof_jobs ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.task_attachments ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.knowledge_facts ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS maaroof_chat_messages_workspace_idx ON public.maaroof_chat_messages (user_id, workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS maaroof_jobs_workspace_idx ON public.maaroof_jobs (user_id, workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS maaroof_jobs_user_created_idx ON public.maaroof_jobs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS task_attachments_workspace_idx ON public.task_attachments (user_id, workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS knowledge_facts_workspace_idx ON public.knowledge_facts (user_id, workspace_id, created_at DESC);
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS entity_truth_card jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS onboarding jsonb NOT NULL DEFAULT '{"status":"not_started","answers":{}}'::jsonb,
  ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{"scope":"workspace","memory_isolation":"strict"}'::jsonb;
CREATE INDEX IF NOT EXISTS workspaces_owner_updated_idx ON public.workspaces (owner_id, updated_at DESC);
NOTIFY pgrst, 'reload schema';