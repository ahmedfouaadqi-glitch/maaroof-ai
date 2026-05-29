## المشكلة
في أداة GEO (Sandbox)، الخطوة الثالثة أثناء التحليل تعرض دائماً "فحص الصلة بالسياق العراقي" بغض النظر عن النطاق الجغرافي المختار (عالم / دولة / محافظة / مدينة).

السبب: `src/components/Sandbox.tsx` يعرض `t("scan_local")` وهو نص ثابت في `src/lib/i18n.tsx` (سطر 36 إنجليزي، 802 عربي، 1600 كردي).

## الحل (تغيير بصري بسيط، 3 ملفات)

### 1. `src/lib/i18n.tsx` — إضافة 4 مفاتيح بديلة (× 3 لغات)
```
scan_local_world     → "فحص الصلة بالسياق العالمي" / "Checking global relevance" / "پشکنینی پەیوەندی جیهانی"
scan_local_country   → "فحص الصلة بسياق {country}" / "Checking {country} relevance"
scan_local_province  → "فحص الصلة بسياق محافظة {city}"
scan_local_city      → "فحص الصلة بسياق مدينة {city}"
```
(الـ`scan_local` الأصلي يبقى كاحتياطي للأدوات الأخرى)

### 2. `src/components/Sandbox.tsx`
- احسب النطاق الفعّال مرة واحدة قبل العرض: `const scope = getEffectiveScope(auth?.profile, "analyze")`
- استبدل `STEPS` الثابتة بدالة `getStepLabel(stepKey, scope)` تختار النص المناسب وتستبدل `{country}` / `{city}` بالقيم الفعلية
- استخدم خرائط بسيطة لترجمة `country` (مثل `IQ` → "العراق" / "Iraq")

### 3. اختياري — تطبيق نفس النمط على الأدوات الأخرى التي تستخدم `getEffectiveScope` لاحقاً (FeasibilityStudy, CompetitorCompare, PostSuggester) — لكن المستخدم ذكر "أداة GEO" فقط، لذا سأقتصر على Sandbox.

## نطاق العمل
- لا تغييرات في قاعدة البيانات
- لا تغييرات في الـAPI / `analyze.ts` (الـbackend يستقبل scope صحيحاً أصلاً)
- 3 ملفات فقط، تغيير عرضي بحت