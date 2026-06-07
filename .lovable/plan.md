# خطة إكمال العمل المتبقي

## ما تم إنجازه سابقاً
- توضيح A/S → تحليلات/منشورات في لوحة الأدمن
- إضافة Kimi كمحرّك تاسع في `api/analyze.ts`
- لوحة تسعير الخطط `AdminPlanPricingPanel`
- سجل التوكنات `AdminLedgerPanel` + تصدير CSV
- helper موحّد `api-auth.server.ts` (authAndCharge)
- مكوّن `HowItWorks` متعدد اللغات

## المتبقي (سيتم تنفيذه بهذا الترتيب)

### 1) ربط `authAndCharge` بجميع مسارات الـ API الـ17
لكل مسار في `src/routes/api/*` (suggest, compare, feasibility, bizdev, research, visibility, brand_boost, company_email, applied_ranking, geo_strategist, competitor_monitor, social_analysis, what_if, brand_authority, geo_rewrite) + أوامر `agent.server.ts`:
- إضافة gate في أعلى الـ handler
- عند الفشل: إرجاع `gate.response` (401 أو 402)
- معالجة `unpriced` برسالة عربية واضحة "هذه الأداة غير مُسعّرة من قبل المسؤول"

### 2) إضافة Kimi لباقي المكوّنات (مجموع المحرّكات = 9)
- `AIVisibility.tsx`, `GeoStrategist.tsx`, `CompetitorMonitor.tsx`, `social-analysis`, `what-if`
- تحديث `engine-logos.tsx` (شعار Kimi)
- تعديل صيغة GEO Trust Score لتقسم على 9 بدلاً من 8

### 3) إعادة كتابة محتوى الصفحات (بدون mock data، الكل عبر `useI18n`)
- **`index.tsx`**: Hero جديد + بطاقات 11 أداة + 3 خطوات (Input/Process/Output) + دمج `HowItWorks`
- **`guide.tsx`**: أدلة نصية تفصيلية لكل أداة مع أمثلة مكتوبة
- **`tools.$slug.tsx`**: 5 صفحات هبوط (analyze, suggest, compare, geo_strategist, brand_boost) مع زر "ابدأ الآن"

### 4) تحقق نهائي
- فحص build لا يحوي أخطاء
- التأكد من أن `attachSupabaseAuth` مسجّل في `src/start.ts`
- مراجعة بصرية للوحة الأدمن (التابات الثلاث: المستخدمون / تسعير الخطط / السجل)

## ملاحظات
- لا يوجد تغيير على قاعدة البيانات (البنية جاهزة من المهاجرات السابقة)
- جميع النصوص ثلاثية اللغة (AR/EN/KU)
- لا قيم افتراضية للتسعير — الأدوات غير المسعّرة تُرجع 402

## الترتيب
1 → 2 → 3 → 4
