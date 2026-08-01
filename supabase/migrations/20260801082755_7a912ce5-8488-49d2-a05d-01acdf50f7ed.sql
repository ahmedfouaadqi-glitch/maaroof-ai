CREATE POLICY "ks_files_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'knowledge-spaces' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin'::app_role)));

CREATE POLICY "ks_files_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'knowledge-spaces' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "ks_files_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'knowledge-spaces' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "ks_files_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'knowledge-spaces' AND auth.uid()::text = (storage.foldername(name))[1]);