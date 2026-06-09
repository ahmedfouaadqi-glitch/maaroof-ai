# دعم تعدد العملات في الخطط والإضافات والأدوات

اليوم: `subscription_plans` يحتوي عمودين فقط `price_iqd` و `price_usd`، `agent_addons` يحتوي `price_iqd` فقط، و `tool_plan_access` يحتوي `usd_per_use`. لا يوجد ربط بين عملة العرض وموقع المستخدم.

الهدف: تسمح الإدارة بإدخال السعر بأي عملة تختارها (IQD/USD/SAR/AED/EGP/EUR…) مع تحديد عملة العرض الافتراضية للخطة/الإضافة/الأداة. العميل يرى السعر بعملة بلده (Cloudflare `cf-ipcountry`) إن وُجد سعر لها، وإلا يقع إلى عملة الخطة الافتراضية ثم USD.

## 1) قاعدة البيانات (migration واحدة)

- إضافة على `subscription_plans`:
  - `prices jsonb not null default '{}'::jsonb` — خريطة `{ "USD": 9.99, "IQD": 15000, "SAR": 37 }`
  - `default_currency text not null default 'USD'`
- نفس الإضافة على `agent_addons` و `tool_plan_access` (لتسعير الأداة الواحدة لكل خطة).
- backfill: نسخ `price_usd`→`prices.USD` و `price_iqd`→`prices.IQD` و `usd_per_use`→`prices.USD`. الأعمدة القديمة تبقى للتوافق (للقراءة فقط، تُهمل لاحقًا).
- جدول مرجعي صغير `country_currency (country_code text pk, currency text not null)` مع بذرة افتراضية (IQ→IQD، SA→SAR، AE→AED، EG→EGP، JO→JOD، KW→KWD، QA→QAR، BH→BHD، OM→OMR، LB→LBP، MA→MAD، DZ→DZD، TN→TND، LY→LYD، TR→TRY، GB→GBP، EU→EUR، باقي الدول→USD).
- GRANT للقراءة العامة (`anon`+`authenticated`) للجدول المرجعي وللحقول الجديدة (موجودة أصلاً ضمن سياسات الجداول الحالية). RLS الحالية تكفي.

## 2) كتالوج العملات في الواجهة

ملف جديد `src/lib/currencies.ts`:
- قائمة ~15 عملة: code, symbol, name_ar/en, locale, decimals.
- `formatMoney(amount, currency, locale)` يستخدم `Intl.NumberFormat`.
- `pickPrice(prices, userCountry, defaultCurrency)` يرجّع `{ amount, currency }` بالأولوية: عملة بلد المستخدم → default_currency → USD → أول مفتاح متاح.
- خريطة `COUNTRY_CURRENCY` مرآة محلية للجدول المرجعي (لتفادي fetch إضافي).

## 3) لوحة الإدارة

- `AdminPlanPricingPanel.tsx` و `AdminPlansMatrixPanel.tsx`:
  - استبدال حقلي IQD/USD المنفصلين بمحرّر صفوف ديناميكي: اختيار العملة من قائمة + إدخال المبلغ + زر حذف + زر "+ إضافة عملة".
  - حقل `Default currency` (select) — يظهر العرض الافتراضي حين لا تتوفر عملة المستخدم.
  - نفس المحرّر داخل خلية كل أداة في المصفوفة (`tool_plan_access.prices` بدل `usd_per_use`).
- `admin.tsx` (تبويب Agent addons): نفس المحرّر لـ `agent_addons.prices`/`default_currency`.

## 4) Server functions

تحديث في `src/lib/admin.functions.ts`:
- إضافة `prices: z.record(z.string().regex(/^[A-Z]{3}$/), z.number().min(0)).optional()` و `default_currency: z.string().regex(/^[A-Z]{3}$/).optional()` إلى schemas: `planPayload`, `addonPayload`, `tpaRow`, `tpaPatch`.
- لا حاجة لدوال جديدة — المسارات الموجودة (`adminUpdatePlan` / `adminCreatePlan` / `adminUpdateAddon` / `adminUpsertToolPlanAccess` / `adminUpsertSingleToolPlanAccess`) ستمرّر الحقول الجديدة.

## 5) واجهة المستخدم (عرض الأسعار)

- `src/routes/pricing.tsx`:
  - استدعاء `useCountry()` (موجود)، ثم لكل خطة/إضافة: `pickPrice(p.prices, country, p.default_currency)` و عرض `formatMoney(...)`.
  - تحديث نصوص واتساب/SMS لتستخدم العملة المختارة بدل `pr_iqd` الثابت.
  - شارة صغيرة بجانب السعر: `Approx. {USD value}` عند اختلاف العملة عن USD، يُحسب من `prices.USD` إن وُجد (بدون أي API صرف خارجي).
- أي مكون آخر يعرض سعر خطة (`SubscribeModal.tsx`, شارات في tools) يمرّ بنفس `pickPrice`/`formatMoney`.

## 6) القراءات

كل قراءات `subscription_plans` و `agent_addons` و `tool_plan_access` في الواجهة تُضاف لها الأعمدة `prices, default_currency` ضمن `select(...)`. يبقى `price_iqd/price_usd/usd_per_use` كاحتياط للقراءة فقط حتى نتأكد من تكامل البيانات.

## 7) التحقق

- Migration approved → backfill تلقائي → فحص أن كل خطة لها `prices` غير فارغة.
- فتح `/admin` كأدمن: إضافة عملة جديدة لخطة، حفظ، ثم زيارة `/pricing` من حساب مستخدم → السعر يظهر بالعملة المتوقعة.
- اختبار geo: تغيير الدولة يدويًا عبر `CountryProvider` → السعر يتبدّل فورًا.
- اختبار fallback: خطة بدون سعر بعملة بلد المستخدم → يعرض `default_currency`.

## الملفات

- **Migration:** أعمدة جديدة + جدول `country_currency` + backfill.
- **جديد:** `src/lib/currencies.ts`.
- **معدّل:** `src/lib/admin.functions.ts`، `src/components/admin/AdminPlanPricingPanel.tsx`، `src/components/admin/AdminPlansMatrixPanel.tsx`، `src/routes/admin.tsx` (تبويب الإضافات)، `src/routes/pricing.tsx`، `src/components/SubscribeModal.tsx`.

## ملاحظات

- لا تحويل عملات في الخادم — الأسعار التي تدخلها الإدارة هي القيم الفعلية لكل عملة (تحكم كامل، بلا ضجيج أسعار صرف متذبذبة).
- الأعمدة القديمة `price_iqd/price_usd/usd_per_use` لا تُحذف الآن؛ يمكن حذفها في migration لاحقة بعد التأكد من عدم استخدامها.
