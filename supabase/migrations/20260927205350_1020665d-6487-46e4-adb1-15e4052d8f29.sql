CREATE TABLE public.mkd_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  brand text NOT NULL,
  scope jsonb NOT NULL DEFAULT '{"scope":"world"}'::jsonb,
  depth text NOT NULL DEFAULT 'quick',
  status text NOT NULL DEFAULT 'pending',
  cost_tokens integer NOT NULL DEFAULT 0,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mkd_runs TO authenticated;
GRANT ALL ON public.mkd_runs TO service_role;
ALTER TABLE public.mkd_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mkd_runs owner" ON public.mkd_runs FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER mkd_runs_touch BEFORE UPDATE ON public.mkd_runs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX mkd_runs_user_idx ON public.mkd_runs(user_id, created_at DESC);

CREATE TABLE public.mkd_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.mkd_runs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  entity_name text NOT NULL,
  entity_domain text,
  category text NOT NULL,
  confidence numeric NOT NULL DEFAULT 0,
  reason text,
  verification_state text NOT NULL DEFAULT 'inferred',
  is_ai_observation boolean NOT NULL DEFAULT false,
  evidence_ids uuid[] NOT NULL DEFAULT '{}',
  knowledge_node_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mkd_relations TO authenticated;
GRANT ALL ON public.mkd_relations TO service_role;
ALTER TABLE public.mkd_relations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mkd_relations owner" ON public.mkd_relations FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER mkd_relations_touch BEFORE UPDATE ON public.mkd_relations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX mkd_relations_run_idx ON public.mkd_relations(run_id);