ALTER TABLE public.knowledge_space_interviews
  ADD COLUMN IF NOT EXISTS engine_key text NOT NULL DEFAULT 'gemini',
  ADD COLUMN IF NOT EXISTS engine_name text NOT NULL DEFAULT 'Gemini',
  ADD COLUMN IF NOT EXISTS generation_status text NOT NULL DEFAULT 'ready',
  ADD COLUMN IF NOT EXISTS failure_reason text;

COMMENT ON COLUMN public.knowledge_space_interviews.engine_key IS
  'Stable user-facing engine identity key; never a provider or API key.';
COMMENT ON COLUMN public.knowledge_space_interviews.generation_status IS
  'Question generation state: ready or failed. Answer completion remains represented by answer/answered_at.';
