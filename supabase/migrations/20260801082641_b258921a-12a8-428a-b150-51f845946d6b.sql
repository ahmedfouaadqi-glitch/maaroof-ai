-- ===== Knowledge Spaces (Teach Once, Work Forever) =====
CREATE TABLE public.knowledge_spaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  lang text NOT NULL DEFAULT 'ar',
  brand_identity jsonb NOT NULL DEFAULT '{}'::jsonb,
  space_dna jsonb NOT NULL DEFAULT '{}'::jsonb,
  policies jsonb NOT NULL DEFAULT '{}'::jsonb,
  inheritance jsonb NOT NULL DEFAULT '{"enabled": true, "approved_only": true}'::jsonb,
  status text NOT NULL DEFAULT 'active',
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  assets_count integer NOT NULL DEFAULT 0,
  nodes_count integer NOT NULL DEFAULT 0,
  confidence numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_spaces TO authenticated;
GRANT ALL ON public.knowledge_spaces TO service_role;
ALTER TABLE public.knowledge_spaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "spaces_owner_or_workspace_select" ON public.knowledge_spaces
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id, auth.uid()))
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );
CREATE POLICY "spaces_owner_insert" ON public.knowledge_spaces
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "spaces_owner_update" ON public.knowledge_spaces
  FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "spaces_owner_delete" ON public.knowledge_spaces
  FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_knowledge_spaces_touch BEFORE UPDATE ON public.knowledge_spaces
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- helper: can the caller reach a space?
CREATE OR REPLACE FUNCTION public.can_access_space(_space_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.knowledge_spaces s
    WHERE s.id = _space_id AND (
      s.user_id = _user_id
      OR (s.workspace_id IS NOT NULL AND public.is_workspace_member(s.workspace_id, _user_id))
    )
  )
$$;
REVOKE ALL ON FUNCTION public.can_access_space(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_space(uuid, uuid) TO authenticated, service_role;

-- ===== Assets =====
CREATE TABLE public.knowledge_space_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.knowledge_spaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'document',
  source_type text NOT NULL DEFAULT 'upload',
  title text NOT NULL,
  file_path text,
  source_url text,
  mime_type text,
  size_bytes bigint,
  lang text,
  status text NOT NULL DEFAULT 'queued',
  stage text NOT NULL DEFAULT 'import',
  stages jsonb NOT NULL DEFAULT '[]'::jsonb,
  classification jsonb NOT NULL DEFAULT '{}'::jsonb,
  extracted jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_text text,
  confidence numeric NOT NULL DEFAULT 0,
  evidence_score numeric NOT NULL DEFAULT 0,
  reality_score numeric NOT NULL DEFAULT 0,
  verification_score numeric NOT NULL DEFAULT 0,
  duplicate_of uuid REFERENCES public.knowledge_space_assets(id) ON DELETE SET NULL,
  conflicts jsonb NOT NULL DEFAULT '[]'::jsonb,
  needs_approval boolean NOT NULL DEFAULT false,
  approved boolean NOT NULL DEFAULT false,
  approved_at timestamptz,
  error text,
  nodes_created integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_space_assets TO authenticated;
GRANT ALL ON public.knowledge_space_assets TO service_role;
ALTER TABLE public.knowledge_space_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assets_space_select" ON public.knowledge_space_assets
  FOR SELECT TO authenticated USING (public.can_access_space(space_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "assets_owner_insert" ON public.knowledge_space_assets
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.can_access_space(space_id, auth.uid()));
CREATE POLICY "assets_owner_update" ON public.knowledge_space_assets
  FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "assets_owner_delete" ON public.knowledge_space_assets
  FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_ks_assets_touch BEFORE UPDATE ON public.knowledge_space_assets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_ks_assets_space ON public.knowledge_space_assets(space_id, created_at DESC);

-- ===== Agent access =====
CREATE TABLE public.knowledge_space_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.knowledge_spaces(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES public.maaroof_agents(id) ON DELETE CASCADE,
  agent_role text,
  access_level text NOT NULL DEFAULT 'read',
  inherit boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (space_id, agent_id),
  UNIQUE (space_id, agent_role)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_space_agents TO authenticated;
GRANT ALL ON public.knowledge_space_agents TO service_role;
ALTER TABLE public.knowledge_space_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ks_agents_select" ON public.knowledge_space_agents
  FOR SELECT TO authenticated USING (public.can_access_space(space_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "ks_agents_write" ON public.knowledge_space_agents
  FOR ALL TO authenticated USING (public.can_access_space(space_id, auth.uid())) WITH CHECK (public.can_access_space(space_id, auth.uid()));

-- ===== Prompt library / Prompt DNA =====
CREATE TABLE public.knowledge_space_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.knowledge_spaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  asset_id uuid REFERENCES public.knowledge_space_assets(id) ON DELETE SET NULL,
  title text NOT NULL,
  body text NOT NULL,
  intent text,
  structure jsonb NOT NULL DEFAULT '{}'::jsonb,
  prompt_dna jsonb NOT NULL DEFAULT '{}'::jsonb,
  tags text[] NOT NULL DEFAULT '{}',
  quality numeric NOT NULL DEFAULT 0,
  approved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_space_prompts TO authenticated;
GRANT ALL ON public.knowledge_space_prompts TO service_role;
ALTER TABLE public.knowledge_space_prompts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ks_prompts_select" ON public.knowledge_space_prompts
  FOR SELECT TO authenticated USING (public.can_access_space(space_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "ks_prompts_write" ON public.knowledge_space_prompts
  FOR ALL TO authenticated USING (user_id = auth.uid() AND public.can_access_space(space_id, auth.uid()))
  WITH CHECK (user_id = auth.uid() AND public.can_access_space(space_id, auth.uid()));
CREATE TRIGGER trg_ks_prompts_touch BEFORE UPDATE ON public.knowledge_space_prompts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ===== Interview mode =====
CREATE TABLE public.knowledge_space_interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.knowledge_spaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  question text NOT NULL,
  topic text,
  answer text,
  answered_at timestamptz,
  node_id uuid REFERENCES public.knowledge_nodes(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_space_interviews TO authenticated;
GRANT ALL ON public.knowledge_space_interviews TO service_role;
ALTER TABLE public.knowledge_space_interviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ks_interviews_select" ON public.knowledge_space_interviews
  FOR SELECT TO authenticated USING (public.can_access_space(space_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "ks_interviews_write" ON public.knowledge_space_interviews
  FOR ALL TO authenticated USING (user_id = auth.uid() AND public.can_access_space(space_id, auth.uid()))
  WITH CHECK (user_id = auth.uid() AND public.can_access_space(space_id, auth.uid()));

-- ===== Link knowledge graph to spaces (additive) =====
ALTER TABLE public.knowledge_nodes
  ADD COLUMN IF NOT EXISTS space_id uuid REFERENCES public.knowledge_spaces(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS approved boolean NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_space ON public.knowledge_nodes(space_id);

-- ===== Pricing entry for the new agent tool =====
INSERT INTO public.tool_pricing_catalog (tool_key, default_tokens, default_usd, notes)
VALUES ('teach_space', 4000, 0.05, 'Teach Once, Work Forever - knowledge space ingestion (per asset)')
ON CONFLICT (tool_key) DO NOTHING;