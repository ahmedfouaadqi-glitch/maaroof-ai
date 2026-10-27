ALTER TABLE public.task_attachments ADD COLUMN IF NOT EXISTS structure jsonb;
DELETE FROM public.knowledge_facts
 WHERE workspace_id = '8447e022-6ab0-411a-93b9-0df33e52651e'
   AND (fact ILIKE '%غير متاح%' OR fact ILIKE '%لم يتم استلام%' OR fact ILIKE '%not available%' OR fact ILIKE '%not accessible%' OR fact ILIKE '%لم يُرفق%');