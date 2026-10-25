-- Source provenance extension for the existing evidence_items table.
-- No parallel evidence store is created. All columns are additive and nullable/defaulted
-- so historical evidence remains valid and old writers retain their existing contract.
ALTER TABLE public.evidence_items
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS capability text,
  ADD COLUMN IF NOT EXISTS retrieved_at timestamptz,
  ADD COLUMN IF NOT EXISTS data_period text,
  ADD COLUMN IF NOT EXISTS locale text,
  ADD COLUMN IF NOT EXISTS market text,
  ADD COLUMN IF NOT EXISTS measurement_unit text,
  ADD COLUMN IF NOT EXISTS sample_size integer,
  ADD COLUMN IF NOT EXISTS reality_kind text NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'success',
  ADD COLUMN IF NOT EXISTS limitation text,
  ADD COLUMN IF NOT EXISTS relevance_score integer,
  ADD COLUMN IF NOT EXISTS business_importance integer;

UPDATE public.evidence_items
SET retrieved_at = COALESCE(retrieved_at, created_at),
    reality_kind = COALESCE(NULLIF(reality_kind, ''), 'unverified'),
    status = COALESCE(NULLIF(status, ''), 'success')
WHERE retrieved_at IS NULL OR reality_kind IS NULL OR reality_kind = '' OR status IS NULL OR status = '';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'evidence_items_sample_size_nonnegative' AND conrelid = 'public.evidence_items'::regclass) THEN
    ALTER TABLE public.evidence_items
      ADD CONSTRAINT evidence_items_sample_size_nonnegative CHECK (sample_size IS NULL OR sample_size >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'evidence_items_relevance_score_range' AND conrelid = 'public.evidence_items'::regclass) THEN
    ALTER TABLE public.evidence_items
      ADD CONSTRAINT evidence_items_relevance_score_range CHECK (relevance_score IS NULL OR relevance_score BETWEEN 0 AND 100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'evidence_items_business_importance_range' AND conrelid = 'public.evidence_items'::regclass) THEN
    ALTER TABLE public.evidence_items
      ADD CONSTRAINT evidence_items_business_importance_range CHECK (business_importance IS NULL OR business_importance BETWEEN 0 AND 100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'evidence_items_reality_kind_valid' AND conrelid = 'public.evidence_items'::regclass) THEN
    ALTER TABLE public.evidence_items
      ADD CONSTRAINT evidence_items_reality_kind_valid CHECK (reality_kind IN ('observation','measurement','estimate','inference','unverified'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'evidence_items_status_valid' AND conrelid = 'public.evidence_items'::regclass) THEN
    ALTER TABLE public.evidence_items
      ADD CONSTRAINT evidence_items_status_valid CHECK (status IN ('success','empty','unavailable','blocked','stale','failed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS evidence_items_scope_retrieved_idx
  ON public.evidence_items (user_id, workspace_id, retrieved_at DESC);

CREATE INDEX IF NOT EXISTS evidence_items_source_ref_idx
  ON public.evidence_items (source_ref)
  WHERE source_ref IS NOT NULL;
