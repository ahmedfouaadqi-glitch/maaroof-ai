-- ============ Part 9/10/11 — Expert Learning + Governance + Living Knowledge ============

CREATE TABLE public.expert_profiles (
  expert_key text PRIMARY KEY,
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'unlearned',
  dna jsonb NOT NULL DEFAULT '{}'::jsonb,
  thinking_style text,
  decision_style text,
  reasoning_style text,
  knowledge_graph jsonb NOT NULL DEFAULT '[]'::jsonb,
  capability_graph jsonb NOT NULL DEFAULT '[]'::jsonb,
  strengths jsonb NOT NULL DEFAULT '[]'::jsonb,
  weaknesses jsonb NOT NULL DEFAULT '[]'::jsonb,
  limitations jsonb NOT NULL DEFAULT '[]'::jsonb,
  risks jsonb NOT NULL DEFAULT '[]'::jsonb,
  success_indicators jsonb NOT NULL DEFAULT '[]'::jsonb,
  failure_indicators jsonb NOT NULL DEFAULT '[]'::jsonb,
  preferred_models jsonb NOT NULL DEFAULT '[]'::jsonb,
  preferred_mcp jsonb NOT NULL DEFAULT '[]'::jsonb,
  policies jsonb NOT NULL DEFAULT '{}'::jsonb,
  cooperation jsonb NOT NULL DEFAULT '[]'::jsonb,
  improvement_suggestions jsonb NOT NULL DEFAULT '[]'::jsonb,
  coverage jsonb NOT NULL DEFAULT '{}'::jsonb,
  understanding_score numeric NOT NULL DEFAULT 0,
  confidence numeric NOT NULL DEFAULT 0,
  sessions_count integer NOT NULL DEFAULT 0,
  last_learned_at timestamptz,
  fingerprint text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expert_profiles TO authenticated;
GRANT ALL ON public.expert_profiles TO service_role;
ALTER TABLE public.expert_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expert_profiles_admin_all" ON public.expert_profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER touch_expert_profiles BEFORE UPDATE ON public.expert_profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.expert_learning_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expert_key text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'running',
  trigger text NOT NULL DEFAULT 'manual',
  transcript jsonb NOT NULL DEFAULT '[]'::jsonb,
  extracted jsonb NOT NULL DEFAULT '{}'::jsonb,
  diff jsonb,
  understanding_score numeric,
  confidence numeric,
  model text,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  tokens integer NOT NULL DEFAULT 0,
  usd numeric NOT NULL DEFAULT 0,
  budget_source text NOT NULL DEFAULT 'system',
  zero_cost_reason text,
  duration_ms integer,
  error text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_els_expert ON public.expert_learning_sessions (expert_key, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expert_learning_sessions TO authenticated;
GRANT ALL ON public.expert_learning_sessions TO service_role;
ALTER TABLE public.expert_learning_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "els_admin_all" ON public.expert_learning_sessions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.expert_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expert_key text NOT NULL,
  version integer NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  approved boolean NOT NULL DEFAULT true,
  session_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (expert_key, version)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expert_snapshots TO authenticated;
GRANT ALL ON public.expert_snapshots TO service_role;
ALTER TABLE public.expert_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expert_snapshots_admin_all" ON public.expert_snapshots FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.learning_budget_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purpose text NOT NULL,
  expert_key text,
  session_id uuid,
  model text,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  tokens integer NOT NULL DEFAULT 0,
  usd numeric NOT NULL DEFAULT 0,
  cache_hit boolean NOT NULL DEFAULT false,
  zero_cost_reason text,
  budget_source text NOT NULL DEFAULT 'system',
  latency_ms integer,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_lbl_created ON public.learning_budget_ledger (created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.learning_budget_ledger TO authenticated;
GRANT ALL ON public.learning_budget_ledger TO service_role;
ALTER TABLE public.learning_budget_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lbl_admin_all" ON public.learning_budget_ledger FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ---------- Living Knowledge Ecosystem ----------
CREATE TABLE public.knowledge_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  layer text NOT NULL,
  node_key text NOT NULL,
  title text NOT NULL,
  summary text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  scope text NOT NULL DEFAULT 'platform',
  user_id uuid,
  workspace_id uuid,
  version integer NOT NULL DEFAULT 1,
  confidence numeric NOT NULL DEFAULT 50,
  reliability numeric NOT NULL DEFAULT 50,
  importance numeric NOT NULL DEFAULT 50,
  quality numeric NOT NULL DEFAULT 50,
  evidence_score numeric NOT NULL DEFAULT 0,
  usage_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'validated',
  freshness_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_kn_identity ON public.knowledge_nodes (layer, node_key, coalesce(workspace_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX idx_kn_layer ON public.knowledge_nodes (layer, updated_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_nodes TO authenticated;
GRANT ALL ON public.knowledge_nodes TO service_role;
ALTER TABLE public.knowledge_nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kn_admin_all" ON public.knowledge_nodes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "kn_owner_select" ON public.knowledge_nodes FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));
CREATE POLICY "kn_owner_write" ON public.knowledge_nodes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "kn_owner_update" ON public.knowledge_nodes FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "kn_owner_delete" ON public.knowledge_nodes FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER touch_knowledge_nodes BEFORE UPDATE ON public.knowledge_nodes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.knowledge_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_node uuid NOT NULL REFERENCES public.knowledge_nodes(id) ON DELETE CASCADE,
  to_node uuid NOT NULL REFERENCES public.knowledge_nodes(id) ON DELETE CASCADE,
  relation text NOT NULL,
  weight numeric NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (from_node, to_node, relation)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_edges TO authenticated;
GRANT ALL ON public.knowledge_edges TO service_role;
ALTER TABLE public.knowledge_edges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ke_admin_all" ON public.knowledge_edges FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "ke_owner_select" ON public.knowledge_edges FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.knowledge_nodes n WHERE n.id = from_node AND (n.user_id = auth.uid() OR n.workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()))));

-- ---------- Reporting views ----------
CREATE VIEW public.expert_understanding_v AS
SELECT p.expert_key, p.version, p.status, p.understanding_score, p.confidence,
       p.sessions_count, p.last_learned_at,
       coalesce((p.coverage->>'knowledge')::numeric, 0)  AS knowledge_coverage,
       coalesce((p.coverage->>'capability')::numeric, 0) AS capability_coverage,
       coalesce((p.coverage->>'reasoning')::numeric, 0)  AS reasoning_coverage,
       coalesce((p.coverage->>'memory')::numeric, 0)     AS memory_coverage,
       coalesce((p.coverage->>'decision')::numeric, 0)   AS decision_coverage,
       coalesce((p.coverage->>'cooperation')::numeric, 0) AS cooperation_score,
       (SELECT count(*) FROM public.expert_learning_sessions s WHERE s.expert_key = p.expert_key) AS total_sessions,
       (SELECT coalesce(sum(s.usd), 0) FROM public.expert_learning_sessions s WHERE s.expert_key = p.expert_key) AS total_usd
FROM public.expert_profiles p;
GRANT SELECT ON public.expert_understanding_v TO authenticated, service_role;

CREATE VIEW public.knowledge_health_v AS
SELECT layer,
       count(*) AS nodes,
       round(avg(confidence), 1) AS avg_confidence,
       round(avg(reliability), 1) AS avg_reliability,
       round(avg(quality), 1) AS avg_quality,
       count(*) FILTER (WHERE status = 'conflict') AS conflicts,
       count(*) FILTER (WHERE freshness_at < now() - interval '30 days') AS stale,
       sum(usage_count) AS total_usage,
       max(updated_at) AS last_updated_at
FROM public.knowledge_nodes GROUP BY layer;
GRANT SELECT ON public.knowledge_health_v TO authenticated, service_role;

CREATE VIEW public.learning_budget_v AS
SELECT date_trunc('day', created_at)::date AS day,
       purpose,
       count(*) AS ops,
       sum(tokens) AS tokens,
       sum(usd) AS usd,
       count(*) FILTER (WHERE usd = 0) AS free_ops
FROM public.learning_budget_ledger GROUP BY 1, 2 ORDER BY 1 DESC;
GRANT SELECT ON public.learning_budget_v TO authenticated, service_role;