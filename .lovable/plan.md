# خطة الموجة 4 — إكمال نظام الرؤية والإدارة

سأنفّذ ثلاث مراحل بالترتيب. كل مرحلة قابلة للاختبار لوحدها.

---

## المرحلة (أ) — تعميم الإخفاء على كل الموقع

**الهدف**: عند إخفاء أداة/widget/صفحة من الإدارة، تختفي فعلاً من كل واجهة المستخدم (وليس فقط dashboard/agent).

### الملفات
1. **`src/routes/tools.$slug.tsx`** — قبل عرض الأداة:
   - استدعاء `useVisibility()`
   - إذا `!isToolVisible(slug)` → عرض شاشة "هذه الأداة غير متاحة لحسابك" + زر العودة للوحة
   - منع تشغيل الـ API call أصلاً
2. **`src/routes/__root.tsx`** — حارس صفحات:
   - hook صغير `usePageGuard()` يقرأ المسار الحالي ويُعيد توجيه إذا `!isPageVisible(pageKey)` (dashboard/agent/tools/guide/pricing)
3. **لفّ المكونات بـ `<Widget k="...">`** في الأماكن المتبقية:
   - `SiteHeader.tsx` → `<Widget k="alerts_bell">` حول `<AlertsBell/>`
   - `dashboard.tsx` و `agent.tsx` → `<Widget k="engines_orbit">`, `<Widget k="specialty_banner">`, `<Widget k="tool_links">`, `<Widget k="handoff_menu">`, `<Widget k="results_export">`, `<Widget k="history">`
   - بطاقات النتائج داخل كل أداة → `<Widget k="results_export">` حول `ExportButtons`
   - شريط التقدم في الأدوات → `<Widget k="progress_bar">`
4. **`CostBadge` على كل بطاقة أداة** في `dashboard.tsx` و `tools.$slug.tsx`:
   - قراءة السعر الفعلي (override → plan → unpriced) عبر hook جديد `useToolPrice(key)` يقرأ من `profiles.per_user_tool_overrides` + خطة المستخدم
   - عرض السعر بشكل طبيعي تحت اسم الأداة

### اختبار
- إخفاء أداة من الإدارة → اختفاؤها من dashboard + tools/$slug + لا تظهر في agent
- إخفاء `tokens_bar` → يختفي الشريط من كل الصفحات

---

## المرحلة (ب) — شبكة الأسعار الموحّدة (Plans × Tools × Agent)

**الهدف**: شاشة واحدة تجمع كل الخطط والأدوات والوكيل في جدول واحد، مع إمكانية إضافة خطة جديدة وربطها فوراً.

### مكوّن جديد: `src/components/admin/AdminPlansMatrixPanel.tsx`
- جدول واحد:
  - **الصفوف**: كل أدوات `TOOL_CATALOG` (16) + ميزات الوكيل (3) + `agent_addons` (Trial/Pro/...)
  - **الأعمدة**: كل خطة من `subscription_plans` + عمود "+ خطة جديدة"
  - **كل خلية**:
    - checkbox `enabled`
    - حقل `tokens_per_use`
    - حقل `usd_per_use` (مع `formatUsd` للعرض)
- **زر "خطة جديدة"** → modal: name, price_iqd, price_usd, tokens_included → ينشئ `subscription_plans` ويضيف عمود فارغ
- **زر "حفظ الكل"** → batch upsert إلى `tool_plan_access` + `agent_addons`
- **زر "نسخ من خطة"** → نسخ كل قيم خطة إلى أخرى
- **hook**: `useAdminPlansMatrix()` يدمج 3 queries (plans + tool_plan_access + agent_addons)

### تعديل `admin.tsx`
- استبدال `AdminPlanPricingPanel` بـ `AdminPlansMatrixPanel` تحت تبويب "Plans & Pricing"
- (الإبقاء على الـ panel القديم كـ backup مؤقتاً، حذفه بعد التأكد)

---

## المرحلة (ج) — دمج Users + Tokens بدرج موحّد

**الهدف**: صف واحد لكل مستخدم، نقرة واحدة تفتح درج (Drawer) فيه كل التحكم.

### مكوّن جديد: `src/components/admin/AdminUsersTokensPanel.tsx`
- **جدول رئيسي**: email | plan | balance | used today | used month | devices | actions
- **بحث + فلترة** بالخطة/الحالة
- **عند الضغط على صف** → Drawer فيه 3 tabs:
  1. **Tokens & Usage**: balance, daily/monthly limits, used today/month, ledger صغير (آخر 20)
  2. **Plan & Permissions**: subscription_tier, expires_at, max_devices, role (admin/user)
  3. **Tools & Agent Visibility**:
     - قسم "Visibility" (موجود حالياً في AdminTokensPanel)
     - قسم "Per-tool overrides" (موجود حالياً): enabled + tokens_per_use + usd_per_use لكل أداة
- **حفظ واحد** يكتب لكل الجداول في transaction واحدة

### تعديل `admin.tsx`
- توحيد التبويبات إلى:
  - **Users** (الـ panel الجديد)
  - **Plans & Pricing** (الشبكة من المرحلة ب)
  - **Ledger**
  - الباقي كما هو

---

## ترتيب التنفيذ
1. (أ) الإخفاء الشامل + CostBadge على البطاقات — ~6 ملفات
2. (ب) AdminPlansMatrixPanel — ملف جديد + تعديل admin.tsx
3. (ج) AdminUsersTokensPanel — ملف جديد + تعديل admin.tsx + نقل قسم Visibility

## تفاصيل تقنية (للمراجعة)
- لا تغييرات على قاعدة البيانات — كل الأعمدة موجودة (`ui_visibility`, `per_user_tool_overrides`, `tool_plan_access`, `agent_addons`, `subscription_plans`)
- لا تغييرات على `tokens.server.ts` أو `charge_tokens` SQL
- `useToolPrice(key)` hook جديد في `src/lib/visibility.tsx` يدمج override + plan price
- استخدام `Drawer` من shadcn (`src/components/ui/drawer.tsx` موجود)

بعد موافقتك سأبدأ بالمرحلة (أ).
