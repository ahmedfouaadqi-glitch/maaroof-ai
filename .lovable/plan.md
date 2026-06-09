## إكمال نظام تعدد العملات

### المتبقي
1. **`NewPlanModal` في `AdminPlansMatrixPanel.tsx`** — يستخدم حقول `price_iqd` / `price_usd` القديمة. سأستبدلها بـ `PricesEditor` (مع `default_currency`) ليتطابق مع باقي اللوحة.

2. **تبويب Agent addons في `src/routes/admin.tsx` (~سطر 806)** — نموذج إنشاء/تعديل الإضافات لا يزال يستخدم سعر ثابت. سأضيف `PricesEditor` + اختيار العملة الافتراضية، وأمرّر `prices` و `default_currency` إلى `adminUpsertAgentAddon`.

3. **عرض أسعار الـ Agent addons للمستخدم** — أي مكان يعرض سعر الإضافة (مثل `SubscribeModal` أو صفحة الـ agent) سيستخدم `pickPrice` + `formatMoney` مع `useCountry`، مع عرض "≈ $X" عند اختلاف العملة عن USD.

4. **تحقق سريع**:
   - إنشاء خطة جديدة بعملات متعددة من النموذج → تظهر صحيحة في الشبكة وفي `/pricing`.
   - تعديل إضافة agent بعملة SAR + USD افتراضي → مستخدم من السعودية يرى SAR، من غيرها يرى USD.
   - تشغيل `supabase--linter` للتأكد من عدم وجود تحذيرات جديدة.

### الملفات المتأثرة
- `src/components/admin/AdminPlansMatrixPanel.tsx` (NewPlanModal فقط)
- `src/routes/admin.tsx` (تبويب Agent addons)
- `src/components/SubscribeModal.tsx` أو ما يعادله لعرض سعر الإضافة (عند الحاجة)

لا تغييرات على قاعدة البيانات أو على server functions — الأعمدة والـ schemas جاهزة من الجولة السابقة.
