-- Ensure the built-in "known" discovery tool is enabled by default.
-- Preserve all existing admin choices and append only this missing tool.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.maaroof_settings
    WHERE key = 'enabled_tools'
  ) THEN
    UPDATE public.maaroof_settings
    SET value = CASE
      WHEN jsonb_typeof(value) = 'array' AND NOT (value @> '["known"]'::jsonb)
        THEN value || '["known"]'::jsonb
      ELSE value
    END
    WHERE key = 'enabled_tools';
  ELSE
    INSERT INTO public.maaroof_settings (key, value)
    VALUES (
      'enabled_tools',
      '["suggest","geo_rewrite","analyze","research","feasibility","bizdev","brand_boost","what_if","applied_ranking","visibility","social_analysis","compare","company_email","geo_strategist","competitor_monitor","brand_authority","known"]'::jsonb
    );
  END IF;
END $$;
