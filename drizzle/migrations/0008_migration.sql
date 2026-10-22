ALTER TABLE public.knowledge_facts ADD COLUMN IF NOT EXISTS broadcast boolean NOT NULL DEFAULT false;
GRANT UPDATE (broadcast) ON public.knowledge_facts TO authenticated;
CREATE POLICY "own facts broadcast update" ON public.knowledge_facts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);