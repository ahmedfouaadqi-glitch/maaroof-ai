# خطة تأمين لوحة الإدارة

الثغرة الحرجة المتبقية: لوحة الإدارة تنفذ ~35 عملية كتابة حساسة مباشرة من المتصفح عبر `supabase.from(...).insert/update/delete` معتمدةً فقط على فحص `isAdmin` في React. الحماية الفعلية الوحيدة الآن هي سياسات RLS — نقطة فشل واحدة.

## 1) إنشاء `src/lib/admin.functions.ts`

ملف server functions، كل دالة محمية بـ `requireSupabaseAuth` + فحص دور `admin` على الخادم، ثم تنفذ الكتابة عبر `supabaseAdmin` (مستوردًا داخل `.handler` بـ `await import`).

نمط موحّد:
```ts
const requireAdmin = async (ctx) => {
  const { data } = await ctx.supabase.from('user_roles')
    .select('role').eq('user_id', ctx.userId).eq('role', 'admin').maybeSingle();
  if (!data) throw new Response('Forbidden', { status: 403 });
};
```

الدوال المطلوبة (مجمَّعة حسب الجدول):

| الدالة | الجدول | المستخدم في |
|---|---|---|
| `adminGrantRole` / `adminRevokeRole` | `user_roles` | admin.tsx، AdminTokensPanel |
| `adminPatchProfile` | `profiles` (تحديثات الحصص/الباقات/الأجهزة) | admin.tsx (8 مواضع)، AdminTokensPanel |
| `adminUpsertPlan` / `adminTogglePlan` / `adminDeletePlan` / `adminCreatePlan` | `subscription_plans` | admin.tsx، AdminPlansMatrixPanel، AdminPlanPricingPanel |
| `adminUpsertToolPlanAccess` | `tool_plan_access` | AdminPlansMatrixPanel، AdminPlanPricingPanel |
| `adminUpdateSubscriptionRequest` | `subscription_requests` + `profiles` + `user_agent_subscriptions` (موافقة/رفض طلب) | admin.tsx |
| `adminGrantAgentSubscription` / `adminPatchAgentSubscription` | `user_agent_subscriptions` | admin.tsx |
| `adminSetAppSetting` | `app_settings` | admin.tsx (تفعيل الوكيل عامًا) |

## 2) استبدال نداءات الكتابة المباشرة

في الملفات التالية، استبدال كل `await supabase.from(X).insert/update/delete` بنداء `useServerFn(adminX)`:
- `src/routes/admin.tsx` (~25 موضع كتابة)
- `src/components/admin/AdminTokensPanel.tsx` (3 مواضع)
- `src/components/admin/AdminPlansMatrixPanel.tsx` (3 مواضع)
- `src/components/admin/AdminPlanPricingPanel.tsx` (2 مواضع)

**القراءات تبقى كما هي** — RLS الحالية تحمي الـ SELECT للأدمن فقط.

## 3) إغلاق التحذيرات الأمنية المقصودة

- `manage_security_finding` بـ `ignore` لـ `has_role` و `ensure_trial_subscription` مع تبرير: مطلوبتان بتصميم الـ RLS وتدفق التجربة المجانية.
- تحديث `security memory` لتسجيل هذا.

## 4) التحقق

- إعادة فحص أمني — يجب ألا يبقى سوى تحذير الإضافة في `public` (مقبول).
- فتح لوحة الإدارة كأدمن والتأكد من أن كل الأزرار تعمل (منح دور، تعديل خطة، موافقة طلب اشتراك).
- اختبار سلبي: محاولة استدعاء serverFn من حساب غير-admin → 403.

## الملفات

- **جديد:** `src/lib/admin.functions.ts`
- **معدّل:** `src/routes/admin.tsx`، `src/components/admin/AdminTokensPanel.tsx`، `AdminPlansMatrixPanel.tsx`، `AdminPlanPricingPanel.tsx`
- **لا تغيير على قاعدة البيانات.** لا migrations.
