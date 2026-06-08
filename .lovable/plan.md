## Wave 5 — إكمال البنود الستة بالترتيب

### 1) لوحة `AdminUsersTokensPanel` الكاملة
- ملف جديد: `src/components/admin/AdminUsersTokensPanel.tsx`
- جدول رئيسي: email, plan, balance, used today/month, max_devices, دور
- بحث + فلتر (plan, role, نشط/منتهي)
- نقر على صف → `Drawer` (من `ui/drawer`) بثلاث تبويبات:
  - **Tokens & Usage**: balance, daily/monthly limits, آخر 20 سطر من `token_ledger`, زر "إضافة/خصم توكنز" → INSERT في `token_ledger` + UPDATE balance
  - **Plan & Permissions**: `subscription_tier`, `subscription_expires_at`, `is_subscribed`, `max_devices`, role (admin/user)
  - **Tools & Agent Visibility**: تحرير `ui_visibility` (tools/agent/widgets/pages) + `per_user_tool_overrides` (سعر/تعطيل لكل أداة لهذا المستخدم تحديداً)
- Save واحد يكتب: `profiles` + `user_roles` بدفعة واحدة
- استبدل التبويب الحالي في `admin.tsx` بهذه اللوحة

### 2) تطبيق `<Widget>` على بقية المكوّنات
لفّ بالـ `<Widget k="...">` المناسب في موضع الاستخدام:
- `HandoffMenu` → `handoff_menu`
- `ExportButtons` → `results_export`
- `EnginesOrbit` → `engines_orbit` (في `dashboard.tsx`)
- `SpecialtyBanner` → `specialty_banner`
- `ToolLinksManager` → `tool_links`
- شريط التقدم في `tools/$slug.tsx` → `progress_bar`
- بطاقات النتائج / `history` → `history`

### 3) `CostBadge` داخل `tools/$slug.tsx`
- استدعاء `useToolPrice(toolKey)` أعلى الصفحة
- عرض `CostBadge` بجانب زر التشغيل قبل الضغط
- بعد الاستجابة: `toast` بـ "تم خصم X توكن — الرصيد المتبقي Y" (يقرأ من نتيجة `charge_tokens`)

### 4) بوابة الصفحات على `__root.tsx`
- إنشاء hook `usePageGuard()` في `src/lib/visibility.tsx`:
  - يقرأ المسار الحالي → يحوّله لـ `PageKey` (dashboard/agent/tools/guide/pricing)
  - إذا `!isPageVisible(key)` → `navigate({ to: "/" })`
- استدعاؤه مرة واحدة في `__root.tsx` بدل تكراره في كل صفحة (إزالة الحراسة اليدوية من `dashboard.tsx`/`agent.tsx`)
- تغطية `tools`, `guide`, `pricing` تلقائياً

### 5) واجهة `per_user_tool_overrides`
- مغطّاة داخل تبويب "Tools & Agent Visibility" في `AdminUsersTokensPanel` (البند 1):
  - لكل أداة: checkbox تفعيل + `tokens_per_use` + `usd_per_use` (override خاص بهذا المستخدم)
  - زر "إعادة للسعر الافتراضي" يحذف المفتاح من JSON
- بعد الحفظ: استدعاء `clearToolPriceCache(userId)` ليُحدّث `useToolPrice` فوراً

### 6) اختبار فعلي
بعد كل بند: التحقق من
- البناء بلا أخطاء TypeScript
- فحص الكونسول والشبكة عبر `read_console_logs` / `read_network_requests`
- جلسة الـ replay للتأكد من السلوك البصري (الإخفاء الفعلي، toast الخصم، حماية الصفحات)

### تفاصيل تقنية
- لا migrations جديدة — كل الأعمدة موجودة (`ui_visibility`, `per_user_tool_overrides`, `token_ledger`).
- جميع كتابات المسؤول من المتصفح بـ `supabase` العادي (RLS يسمح للأدمن عبر `has_role`).
- نسخة `clearToolPriceCache(userId)` لتفريغ الذاكرة بعد كل تعديل سعر فردي.
- استخدام `Drawer` و `Tabs` من `@/components/ui` الموجودة.
