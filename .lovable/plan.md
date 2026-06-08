## Wave 6 — إكمال البنود الستة المتبقية بالترتيب

### 1) لوحة `AdminUsersTokensPanel` الموحّدة
ملف جديد: `src/components/admin/AdminUsersTokensPanel.tsx`
- جدول رئيسي: email, plan, balance, used today/month, max_devices, role + بحث/فلتر
- النقر على صف → `Drawer` (`@/components/ui/drawer`) بثلاث تبويبات (`Tabs`):
  - **Tokens & Usage**: عرض balance / daily / monthly، آخر 20 سطر من `token_ledger`، حقل "إضافة/خصم" → `INSERT` في `token_ledger` + `UPDATE profiles.tokens_balance`
  - **Plan & Permissions**: `subscription_tier`, `subscription_expires_at`, `is_subscribed`, `max_devices` + role (admin/user) عبر `user_roles`
  - **Tools & Agent Visibility**: تحرير JSON `ui_visibility` (tools/agent/widgets/pages) + جدول `per_user_tool_overrides` لكل أداة (enabled checkbox + `tokens_per_use` + `usd_per_use` + زر "إعادة للافتراضي")
- زر "حفظ" واحد يكتب: `profiles` + `user_roles` بتسلسل آمن
- بعد الحفظ: `clearToolPriceCache(userId)`
- إدراج تبويب جديد في `admin.tsx` يسمّى "المستخدمون والتوكنز" (لا يُحذف `AdminTokensPanel` الحالي — تبويب موازٍ)

### 2) واجهة `per_user_tool_overrides`
مغطّاة بالكامل داخل تبويب "Tools & Agent Visibility" في البند 1 — لا ملف منفصل.

### 3) `<Widget>` على المكوّنات المتبقية
- `SpecialtyBanner.tsx` → لفّ بـ `<Widget k="specialty_banner">` في موضع الاستخدام، أو فحص `useVisibility` داخل المكوّن
- شريط التقدّم في `tools/$slug.tsx` → `<Widget k="progress_bar">` (إن وُجد عنصر تقدّم)
- بطاقات `history` في `dashboard.tsx` → `<Widget k="history">`

### 4) Toast بعد خصم التوكنز في `tools/$slug.tsx`
- التحقق من مسار التشغيل الحالي للأداة (الزر `start now` يقود إلى `/dashboard`، فالخصم الفعلي يحدث في `dashboard`/API). سأضيف `toast` في **مواضع استدعاء `charge_tokens`** الفعلية (داخل المكوّنات التي تستدعي `/api/*`):
  - بعد استجابة ناجحة تحوي `balance` و`used_today`: `toast.success("تم خصم X — الرصيد: Y")`
  - في حالة `ok: false`: `toast.error` بسبب مفهوم (`daily_limit` / `monthly_limit` / `balance`)
- النطاق المبدئي: `PostSuggester`, `CompetitorCompare`, `AIVisibility`, `BrandBoostAgent` (المكوّنات التي تستدعي endpoints مدفوعة)

### 5) تنظيف الحراسة اليدوية + `usePageGuard` عام
- استدعاء `usePageGuard()` مرة واحدة في `__root.tsx` داخل `RootComponent`
- إزالة الاستدعاءات اليدوية من: `dashboard.tsx`, `agent.tsx`, `tools.$slug.tsx`, `guide.tsx`, `pricing.tsx`
- التحقق: `__root.tsx` يجب أن يبقى يحتوي `<Outlet />`

### 6) اختبار فعلي
- فحص الكونسول والشبكة (`read_console_logs` / `read_network_requests`) على `/admin` و`/tools/analyze` و`/dashboard`
- لقطة preview للتأكد من: ظهور التبويب الجديد، فتح `Drawer`، عمل `toast`، حماية صفحة مخفية بإعادة توجيه لـ `/`

### تفاصيل تقنية
- لا migrations جديدة — كل الأعمدة موجودة (`ui_visibility`, `per_user_tool_overrides`, `tokens_balance`, `token_ledger`).
- جميع كتابات الأدمن عبر `supabase` المتصفّح (RLS يسمح للأدمن عبر `has_role` و `guard_profile_privileged_updates`).
- `sonner` للـ toasts (مستورد من `sonner` مباشرة — لا `use-toast` في TanStack Start).
- استخدام `Drawer`, `Tabs`, `Input`, `Switch`, `Button` الموجودة في `@/components/ui`.
