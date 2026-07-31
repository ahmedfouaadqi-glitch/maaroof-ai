CREATE TABLE public.reality_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id TEXT,
  user_id UUID,
  workspace_id UUID,
  subject TEXT NOT NULL DEFAULT 'answer',
  subject_ref TEXT,
  reality_state TEXT NOT NULL DEFAULT 'unknown',
  reality_score INTEGER NOT NULL DEFAULT 0,
  evidence_score INTEGER NOT NULL DEFAULT 0,
  verification_score INTEGER NOT NULL DEFAULT 0,
  confidence INTEGER NOT NULL DEFAULT 0,
  reproducible BOOLEAN NOT NULL DEFAULT false,
  loop_stage TEXT NOT NULL DEFAULT 'observation',
  missing_evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  contradictions JSONB NOT NULL DEFAULT '[]'::jsonb,
  alternatives JSONB NOT NULL DEFAULT '[]'::jsonb,
  signals JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.evidence_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reality_record_id UUID NOT NULL REFERENCES public.reality_records(id) ON DELETE CASCADE,
  user_id UUID,
  source_kind TEXT NOT NULL DEFAULT 'internal',
  source_ref TEXT,
  claim TEXT,
  weight INTEGER NOT NULL DEFAULT 1,
  success_count INTEGER NOT NULL DEFAULT 0,
  reproducible BOOLEAN NOT NULL DEFAULT false,
  contradicts JSONB NOT NULL DEFAULT '[]'::jsonb,
  verified_by TEXT,
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_reality_records_user_created ON public.reality_records (user_id, created_at DESC);
CREATE INDEX idx_reality_records_run ON public.reality_records (run_id);
CREATE INDEX idx_reality_records_state ON public.reality_records (reality_state);
CREATE INDEX idx_evidence_items_record ON public.evidence_items (reality_record_id);
CREATE INDEX idx_evidence_items_user ON public.evidence_items (user_id);

GRANT SELECT ON public.reality_records TO authenticated;
GRANT ALL ON public.reality_records TO service_role;
GRANT SELECT ON public.evidence_items TO authenticated;
GRANT ALL ON public.evidence_items TO service_role;

ALTER TABLE public.reality_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reality_records_owner_read" ON public.reality_records
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "evidence_items_owner_read" ON public.evidence_items
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER touch_reality_records
  BEFORE UPDATE ON public.reality_records
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();