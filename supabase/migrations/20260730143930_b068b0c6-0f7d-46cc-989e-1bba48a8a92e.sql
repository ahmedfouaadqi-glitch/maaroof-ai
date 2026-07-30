-- ============ PART 16: Living State Anchor ============
CREATE TABLE public.state_anchors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level text NOT NULL,
  scope_id text NOT NULL,
  parent_anchor_id uuid REFERENCES public.state_anchors(id) ON DELETE SET NULL,
  user_id uuid,
  workspace_id uuid,
  run_id uuid,
  label text,
  dna jsonb NOT NULL DEFAULT '{}'::jsonb,
  mission text,
  current_goal text,
  future_goal text,
  constraints jsonb NOT NULL DEFAULT '[]'::jsonb,
  policies jsonb NOT NULL DEFAULT '{}'::jsonb,
  language text,
  geo jsonb,
  budget jsonb NOT NULL DEFAULT '{}'::jsonb,
  quality_target numeric,
  risk_target numeric,
  priority integer NOT NULL DEFAULT 5,
  approval_status text NOT NULL DEFAULT 'ok',
  health jsonb NOT NULL DEFAULT '{}'::jsonb,
  health_score integer,
  drift jsonb NOT NULL DEFAULT '[]'::jsonb,
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'active',
  last_validated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (level, scope_id)
);
CREATE INDEX idx_state_anchors_user ON public.state_anchors(user_id);
CREATE INDEX idx_state_anchors_level ON public.state_anchors(level, status);
GRANT SELECT ON public.state_anchors TO authenticated;
GRANT ALL ON public.state_anchors TO service_role;
ALTER TABLE public.state_anchors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "state_anchors_owner_read" ON public.state_anchors
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "state_anchors_admin_read" ON public.state_anchors
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_state_anchors_touch BEFORE UPDATE ON public.state_anchors
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.state_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anchor_id uuid REFERENCES public.state_anchors(id) ON DELETE CASCADE,
  level text NOT NULL,
  scope_id text NOT NULL,
  user_id uuid,
  run_id uuid,
  change_kind text NOT NULL,
  old_state jsonb,
  new_state jsonb,
  reason text,
  initiated_by text NOT NULL DEFAULT 'system',
  affected jsonb NOT NULL DEFAULT '{}'::jsonb,
  drift jsonb,
  cost_usd numeric NOT NULL DEFAULT 0,
  tokens integer NOT NULL DEFAULT 0,
  rollback_point boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_state_timeline_anchor ON public.state_timeline(anchor_id, created_at DESC);
CREATE INDEX idx_state_timeline_user ON public.state_timeline(user_id, created_at DESC);
GRANT SELECT ON public.state_timeline TO authenticated;
GRANT ALL ON public.state_timeline TO service_role;
ALTER TABLE public.state_timeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "state_timeline_owner_read" ON public.state_timeline
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "state_timeline_admin_read" ON public.state_timeline
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ============ PART 17: HERMES Executive Steward ============
CREATE TABLE public.hermes_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  title text NOT NULL,
  executive_summary text NOT NULL,
  problem text,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  business_value text,
  technical_analysis text,
  risk_analysis jsonb NOT NULL DEFAULT '[]'::jsonb,
  cost_analysis jsonb NOT NULL DEFAULT '{}'::jsonb,
  revenue_potential jsonb NOT NULL DEFAULT '{}'::jsonb,
  alternatives jsonb NOT NULL DEFAULT '[]'::jsonb,
  rollback_plan text,
  affected_components jsonb NOT NULL DEFAULT '[]'::jsonb,
  required_approval text NOT NULL DEFAULT 'founder',
  expected_value_usd numeric,
  expected_cost_usd numeric,
  estimated_roi numeric,
  estimated_tokens integer,
  estimated_runtime_ms integer,
  maintenance_note text,
  expected_gains jsonb NOT NULL DEFAULT '{}'::jsonb,
  priority integer NOT NULL DEFAULT 5,
  confidence numeric,
  status text NOT NULL DEFAULT 'pending',
  founder_note text,
  decided_by uuid,
  decided_at timestamptz,
  auto_rejected_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_hermes_proposals_status ON public.hermes_proposals(status, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hermes_proposals TO authenticated;
GRANT ALL ON public.hermes_proposals TO service_role;
ALTER TABLE public.hermes_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hermes_proposals_admin_all" ON public.hermes_proposals
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_hermes_proposals_touch BEFORE UPDATE ON public.hermes_proposals
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.hermes_founder_dna (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  founder_key text NOT NULL UNIQUE DEFAULT 'ahmed_maaroof',
  vision jsonb NOT NULL DEFAULT '[]'::jsonb,
  architecture_preferences jsonb NOT NULL DEFAULT '[]'::jsonb,
  reasoning_style jsonb NOT NULL DEFAULT '[]'::jsonb,
  business_strategy jsonb NOT NULL DEFAULT '[]'::jsonb,
  risk_tolerance numeric NOT NULL DEFAULT 50,
  cost_philosophy jsonb NOT NULL DEFAULT '[]'::jsonb,
  innovation_style jsonb NOT NULL DEFAULT '[]'::jsonb,
  quality_expectations jsonb NOT NULL DEFAULT '[]'::jsonb,
  language_preferences jsonb NOT NULL DEFAULT '["ar"]'::jsonb,
  security_priorities jsonb NOT NULL DEFAULT '[]'::jsonb,
  product_philosophy jsonb NOT NULL DEFAULT '[]'::jsonb,
  growth_strategy jsonb NOT NULL DEFAULT '[]'::jsonb,
  revenue_strategy jsonb NOT NULL DEFAULT '[]'::jsonb,
  approved_count integer NOT NULL DEFAULT 0,
  rejected_count integer NOT NULL DEFAULT 0,
  signals jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.hermes_founder_dna TO authenticated;
GRANT ALL ON public.hermes_founder_dna TO service_role;
ALTER TABLE public.hermes_founder_dna ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hermes_dna_admin_all" ON public.hermes_founder_dna
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_hermes_dna_touch BEFORE UPDATE ON public.hermes_founder_dna
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.hermes_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'مكتب هرمس',
  language text NOT NULL DEFAULT 'ar',
  total_tokens integer NOT NULL DEFAULT 0,
  total_usd numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hermes_conversations TO authenticated;
GRANT ALL ON public.hermes_conversations TO service_role;
ALTER TABLE public.hermes_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hermes_conv_admin_all" ON public.hermes_conversations
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) AND user_id = auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) AND user_id = auth.uid());
CREATE TRIGGER trg_hermes_conv_touch BEFORE UPDATE ON public.hermes_conversations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.hermes_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.hermes_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  tokens integer NOT NULL DEFAULT 0,
  usd numeric NOT NULL DEFAULT 0,
  model text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_hermes_messages_conv ON public.hermes_messages(conversation_id, created_at);
GRANT SELECT, INSERT ON public.hermes_messages TO authenticated;
GRANT ALL ON public.hermes_messages TO service_role;
ALTER TABLE public.hermes_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hermes_msg_admin_all" ON public.hermes_messages
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) AND user_id = auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) AND user_id = auth.uid());

CREATE TABLE public.hermes_discoveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  title text NOT NULL,
  why_it_matters text,
  business_impact text,
  migration_complexity text,
  risk text,
  cost_note text,
  recommendation text,
  source text,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_hermes_disc_status ON public.hermes_discoveries(status, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hermes_discoveries TO authenticated;
GRANT ALL ON public.hermes_discoveries TO service_role;
ALTER TABLE public.hermes_discoveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hermes_disc_admin_all" ON public.hermes_discoveries
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Platform anchor: the permanent identity row.
INSERT INTO public.state_anchors (level, scope_id, label, mission, current_goal, future_goal, language, dna, constraints, policies, priority)
VALUES (
  'platform', 'geoiraq', 'هوية المنصة',
  'رفع حضور العلامات التجارية في محركات الذكاء الاصطناعي والبحث الجيلي (GEO) في العراق والعالم.',
  'تشغيل منظومة معروف بالكامل بجودة وثقة وكلفة مُقاسة.',
  'منصة ذكاء تنفيذي متعددة العلامات التجارية تعمل ذاتياً تحت إشراف بشري.',
  'ar',
  '{"identity":"GEO IRAQ / معروف","founder":"أحمد معروف","never_change":["ولاء هرمس للمؤسس","لا تنفيذ بلا موافقة","الشفافية في التكلفة الحقيقية"]}'::jsonb,
  '["لا نشر بلا موافقة","لا تجاوز لميزانية المستخدم","لا ادعاء بلا دليل"]'::jsonb,
  '{"approval":"human_in_the_loop","cost_transparency":true}'::jsonb,
  1
);

INSERT INTO public.hermes_founder_dna (founder_key) VALUES ('ahmed_maaroof');