
-- Reset plans to the 4 official tiers + first-time discount metadata
UPDATE public.subscription_plans SET active = false;

INSERT INTO public.subscription_plans (name, description, price_iqd, duration_days, monthly_analyses, monthly_suggestions, features, active, sort_order)
VALUES
('Starter', 'للأفراد وصنّاع المحتوى المبتدئين', 15000, 30, 30, 15,
  '["30 تحليل GEO شهرياً","15 اقتراح منشور شهرياً","تقارير مفصّلة","دعم عبر واتساب"]'::jsonb, true, 1),
('Pro', 'للشركات الصغيرة وأصحاب المتاجر', 35000, 30, 120, 60,
  '["120 تحليل شهرياً","60 اقتراح منشور شهرياً","رفع الصور وتحليلها","أولوية في المعالجة","دعم عبر واتساب"]'::jsonb, true, 2),
('Business', 'للوكالات والفرق التسويقية', 75000, 30, 350, 180,
  '["350 تحليل شهرياً","180 اقتراح شهرياً","تقارير متقدمة","تصدير PDF","دعم مخصّص"]'::jsonb, true, 3),
('Pro Yearly', 'باقة سنوية كاملة بسعر مميّز (300,000 د.ع لأول مرة، بعدها 350,000)', 300000, 365, 1500, 720,
  '["1,500 تحليل سنوياً","720 اقتراح سنوياً","كل مزايا Pro","خصم 300,000 د.ع لأول اشتراك","دعم أولوية"]'::jsonb, true, 4);
