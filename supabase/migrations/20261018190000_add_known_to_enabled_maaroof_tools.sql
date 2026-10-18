-- Keep the existing admin-selected tools intact while enabling the known-entity discovery tool.
-- If no enabled_tools row exists, application defaults already include "known".
UPDATE public.maaroof_settings
SET value = (
  SELECT COALESCE(jsonb_agg(to_jsonb(tool) ORDER BY tool), '[]'::jsonb)
  FROM (
    SELECT DISTINCT tool
    FROM (
      SELECT jsonb_array_elements_text(value) AS tool
      UNION
      SELECT 'known'::text AS tool
    ) AS enabled
  ) AS normalized
)
WHERE key = 'enabled_tools'
  AND jsonb_typeof(value) = 'array'
  AND NOT value @> '["known"]'::jsonb;
