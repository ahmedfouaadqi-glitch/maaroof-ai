## إكمال المتبقي + توضيح الرموز

### توضيح الرموز A و S (تبسيط فوري)
في لوحة المستخدمون والخطط كان يُكتب مثل `12A · 7S` — وهي اختصارات غامضة:
- **A = Analyses** (عدد التحليلات المُستهلكة هذا الشهر)
- **S = Suggestions** (عدد المنشورات/الاقتراحات المُولَّدة هذا الشهر)

سيتم استبدالها بصيغة واضحة ثلاثية اللغة:
- العربية: `12 تحليل · 7 منشور`
- الإنجليزية: `12 analyses · 7 posts`
- الكردية: `12 شیکاری · 7 پۆست`
مع `title` تلميح يشرح كل قيمة عند المرور بالماوس. الأماكن المستهدفة: `src/routes/admin.tsx:198` (سطر المستخدم) و `:532` (بطاقة الخطة).

### المرحلة A — ربط chargeTokens بكل المسارات (17 أداة)
لكل مسار في `src/routes/api/*` و`agent.server.ts`:
1. استدعاء `chargeTokens({ userId, toolKey })` بعد التحقق من الجلسة وقبل تنفيذ العمل.
2. عند `ok=false`:
   - `reason==="unpriced"` → 402 + `chargeFailureBody("unpriced")`.
   - `reason==="balance" | "daily_limit" | "monthly_limit"` → 402 + الرسالة المقابلة.
3. تمرير `runId` و`meta` بسيطة (model, input size) للسجل.
4. الأدوات: analyze, suggest, compare, feasibility, bizdev, research, visibility, brand_boost, company_email, applied_ranking, geo_strategist, competitor_monitor, social_analysis, what_if, brand_authority, geo_rewrite + agent.command, agent.run_targets, agent.visibility.

### المرحلة F-tail — شبكة أسعار الخطط (PlanToolGrid)
- تبويب "الخطط" يصبح: لكل خطة جدول كل أداة قابل للتحرير:
  - تفعيل/تعطيل، `tokens_per_use`، `usd_per_use` (عبر `CostInput` بوحدة `$/¢/m¢`)، `daily_quota`، `monthly_quota`.
  - شارة "غير مسعّرة" حمراء لكل خانة فارغة لإجبار الأدمن.
- زرّ "نسخ من كتالوج الاقتراحات" يملأ القيم تلقائياً (يحتاج موافقة الأدمن).

### المرحلة F-spend — تبويب "سجل التوكن"
- جدول لحظي من `token_ledger` مع فلاتر (مستخدم/أداة/تاريخ) + تصدير CSV/Excel عبر `ExportButtons`.
- لوحة ملخّص أعلى الصفحة: إجمالي اليوم/الشهر (توكن + $)، أعلى 5 أدوات وأعلى 5 مستخدمين.

### المرحلة C — Kimi محرك تاسع
- إضافة Kimi إلى مصفوفة المحركات في: `BrandPulseGauges`, `AIVisibility`, `GeoStrategist`, `CompetitorMonitor`, `social-analysis`, `what-if`.
- شعار وأيقونة في `engine-logos.tsx`.
- وزن متساوٍ في حساب GEO Trust Score (المجموع يصبح 9 بدل 8).

### المرحلة D — إعادة كتابة المحتوى
- `src/routes/index.tsx` — Hero + 11 بطاقة أداة + 3 خطوات (من الواقع، بلا بيانات تجريبية).
- `src/routes/guide.tsx` — دليل خطوة-بخطوة لكل أداة مع تلميحات وأمثلة مدخل/مخرج نصية.
- `src/routes/tools.$slug.tsx` — صفحة هبوط لكل أداة (5 slugs: brand-boost / visibility / competitor-monitor / what-if / report-builder) مع زر "ابدأ الآن".

### المرحلة E — HowItWorks نصي
- مكوّن `src/components/HowItWorks.tsx` لكل أداة: أيقونات Lucide + رسوم SVG/CSS بسيطة + مثال مدخل/مخرج. ثلاث لغات عبر `useI18n`. **بدون فيديو**.

### قاعدة البيانات
لا حاجة لتغييرات جديدة — كل البنية التحتية (token_ledger، v_user_tool_spend، numeric(12,6)) جاهزة من الدور السابق.

### ترتيب التنفيذ
1. توضيح A/S (تعديل سطرين).
2. PlanToolGrid + تبويب سجل التوكن (لوحة الأدمن الكاملة).
3. Kimi في GEO Trust Score.
4. ربط chargeTokens بالمسارات الـ17.
5. إعادة كتابة index/guide + صفحات tools.$slug.
6. HowItWorks النصي.

### ملاحظات
- كل النصوص الجديدة عبر `useI18n` (AR/EN/KU).
- ExportButtons (Excel/PDF/CSV) متاحة في تبويبات الأدمن وصفحات الأدوات.
- بدون أي بيانات تجريبية.
