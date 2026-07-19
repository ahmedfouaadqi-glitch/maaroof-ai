
ALTER TABLE public.profiles ALTER COLUMN cognitive_consent SET DEFAULT 'full';
UPDATE public.profiles SET cognitive_consent = 'full' WHERE cognitive_consent = 'dna_only';
