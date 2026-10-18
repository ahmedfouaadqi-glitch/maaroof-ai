-- Add durable rationale and answer guidance to knowledge-space interviews.
-- Existing interview records remain valid; their new fields are nullable.
ALTER TABLE public.knowledge_space_interviews
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS answer_example text;

COMMENT ON COLUMN public.knowledge_space_interviews.reason
  IS 'Short explanation of the knowledge gap this question is intended to address.';
COMMENT ON COLUMN public.knowledge_space_interviews.answer_example
  IS 'Illustrative answer pattern; not a verified statement of business facts.';
