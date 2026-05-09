CREATE POLICY "users delete own analyses" ON public.analyses FOR DELETE TO public USING (auth.uid() = user_id);
CREATE POLICY "users delete own suggestions" ON public.suggestions FOR DELETE TO public USING (auth.uid() = user_id);
CREATE POLICY "users delete own agent_tasks" ON public.agent_tasks FOR DELETE TO public USING (auth.uid() = user_id);