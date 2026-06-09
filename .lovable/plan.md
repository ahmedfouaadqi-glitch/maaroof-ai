## تطبيق تعدد العملات على تبويب الخطط (Plans)

### المشكلة
تبويب **Plans** في `src/routes/admin.tsx` (دالة `PlansTab` و `PlanRow`) لا يزال يستخدم حقل `price_iqd` فقط للقراءة والكتابة، بينما باقي اللوحات (المصفوفة، الإضافات، أسعار الأدوات) تدعم العملات المتعددة.

### التغييرات في `src/routes/admin.tsx`

1. **`PlansTab.create`** — استبدال القيم الافتراضية لاستخدام `prices: { USD: 0 }` و `default_currency: "USD"` بدل `price_iqd: 0`.

2. **`PlanRow` (وضع العرض)** — بدل عرض `{plan.price_iqd} IQD` ثابت، استخدم `pickPrice(plan.prices, userCountry, plan.default_currency)` + `formatMoney` لإظهار سعر العملة المختارة (مع الرجوع إلى `price_iqd`/`price_usd` القديمة كاحتياط للسجلات القديمة).

3. **`PlanRow` (وضع التحرير)** — استبدال حقل `Price (IQD)` بمحرر `PricesEditor` كامل (مع `default_currency` radio). تمرير `prices` (بعد `normalizePrices`) و `default_currency` ضمن الـ patch المُرسَل إلى `adminUpdatePlan`.

4. **Hook بسيط**: استخدام `useI18n().lang` و `useCountry()` داخل `PlanRow` لاختيار العرض، تماماً كما في `AdminPlansMatrixPanel`.

### التحقق
- إنشاء خطة جديدة من هذا التبويب → ترى `USD: 0` افتراضياً وتستطيع إضافة IQD/SAR/AED.
- تحرير خطة موجودة → الأسعار القديمة (`price_iqd`) تظهر تلقائياً في المحرر كقيمة IQD ابتدائية إن لم يوجد `prices`.
- العرض للزائر في `/pricing` لم يتغير لأنه يعتمد بالفعل على `prices` / `default_currency`.

### الملفات
- `src/routes/admin.tsx` فقط (دوال `PlansTab` و `PlanRow`).
- لا تغييرات على قاعدة البيانات أو على `admin.functions.ts` (الـ schema يقبل `prices` و `default_currency` بالفعل).
