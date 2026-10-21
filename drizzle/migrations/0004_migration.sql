ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS space_kind text NOT NULL DEFAULT 'company',
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS workspaces_parent_idx ON public.workspaces(parent_id);