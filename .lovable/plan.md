## تقييم تقريرك — ما هو صحيح وما المتبقي

تقريرك دقيق إلى حد بعيد. الإصلاحات السابقة فعّالة:

- ✅ **4.1 وصول الذكاء الاصطناعي المجاني** — تم فعلًا. `translateText` الآن يستخدم `requireSupabaseAuth` ويستهلك من `chargeTokens`. لا يمكن استدعاؤه بدون توكن صالح.
- ✅ **4.2 إعادة التوجيه المفتوحة** — تم. اختبارك يثبت ذلك: `validateSearch` يرفض `https://evil.com` ويستبدلها بـ `/dashboard`.
- ✅ **4.3 SECURITY DEFINER** — تمت إزالة `PUBLIC` من الخمس دوال. الفحص الحالي يظهر تحذيرَين فقط متبقيَين، وهما **مقصودان**: `has_role` و `ensure_trial_subscription` يجب أن يكونا قابلين للاستدعاء من `authenticated` (الأول تستخدمه سياسات RLS نفسها، والثاني هو تدفق التجربة المجانية للمستخدم المسجل). الفاحص يحذّر من أي دالة `SECURITY DEFINER` يستطيع المستخدم المسجَّل استدعاءها، لكن هذا التصميم آمن لأن منطق الدالتين لا يكشف بيانات الغير.
- ✅ **4.4 الإضافة في `public`** — مقبولة بوعي.

## لكن الفحص الجديد كشف ثغرة لم تكن في تقريرك الأصلي (خطيرة)

**`src/routes/admin.tsx` — تصعيد صلاحيات محتمل:**
لوحة الإدارة تنفذ كل العمليات الحساسة (إضافة دور admin، تعديل خطط الاشتراك، منح اشتراكات يدوية، تعديل حصص المستخدمين) **مباشرة من المتصفح** عبر `supabase.from(...).insert/update` معتمدةً فقط على فحص `isAdmin` في React. أي مستخدم مسجَّل يستطيع تجاوز الواجهة واستدعاء PostgREST مباشرة من `curl`. الحماية الحقيقية الوحيدة حاليًا هي سياسات RLS في قاعدة البيانات — وهذا "نقطة فشل واحدة": أي تعديل ترحيلي خاطئ في المستقبل يفتح الباب فورًا.

## الخطة

### 1) تحويل عمليات لوحة الإدارة إلى Server Functions (CRITICAL)
ملف جديد `src/lib/admin.functions.ts` يحتوي على دوال محمية بـ `requireSupabaseAuth` + فحص دور `admin` على الخادم قبل كل كتابة:
- `adminGrantRole` / `adminRevokeRole` — كتابة على `user_roles`
- `adminUpsertPlan` / `adminDeletePlan` — كتابة على `subscription_plans`
- `adminUpsertAddon` / `adminGrantManualSubscription` — كتابة على `agent_addons` و `user_agent_subscriptions`
- `adminPatchProfile` — تعديل الحصص/الباقات في `profiles`
- `adminUpsertToolPricing` / `adminUpsertToolPlanAccess` — كتابة على جداول التسعير

كل دالة تبدأ بـ:
```ts
.middleware([requireSupabaseAuth])
.handler(async ({ context, data }) => {
  const { data: roles } = await context.supabase
    .from('user_roles').select('role').eq('user_id', context.userId);
  if (!roles?.some(r => r.role === 'admin'))
    throw new Response('Forbidden', { status: 403 });
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  // ... do the write via supabaseAdmin
});
```

ثم استبدال جميع نداءات `supabase.from(...)` للكتابة في `admin.tsx` وملفات `src/components/admin/*` بـ `useServerFn(adminX)`. القراءات تبقى كما هي (RLS تحميها).

### 2) توثيق التحذيرَين المقصودَين وإغلاقهما في سجل الفاحص
- استدعاء `manage_security_finding` بـ `ignore` لكلٍّ من `has_role` و `ensure_trial_subscription` مع شرح أن استدعاء `authenticated` مطلوب بالتصميم.
- تحديث `security memory` لتسجيل هذا القرار صراحةً (حتى لا يعيد الفاحص رفعها لاحقًا).

### 3) التحقق
- إعادة تشغيل الفحص الأمني — يجب أن تبقى فقط: تحذير الإضافة في `public` (مقبول).
- اختبار يدوي بسيط: محاولة `curl` على PostgREST لإدراج دور admin بتوكن مستخدم عادي — يجب أن ترفضها RLS (والآن الكود لم يعد يحاول الكتابة المباشرة أصلًا).

### الملفات المتأثرة
- **جديد:** `src/lib/admin.functions.ts`
- **معدّل:** `src/routes/admin.tsx` و `src/components/admin/AdminLedgerPanel.tsx` و `AdminPlanPricingPanel.tsx` و `AdminPlansMatrixPanel.tsx` و `AdminTokensPanel.tsx` (استبدال الكتابات المباشرة بنداءات serverFn).
- **سجل الأمان:** تحديث `security memory` + تعليم تحذيرَي `SECURITY DEFINER` كمقبولَين.
- **لا تغيير على قاعدة البيانات.**

### لماذا "بقيت" ثغرات بعد الإصلاح السابق؟
سببان:
1. ثغرة لوحة الإدارة لم تكن مكتشفة في الجولة السابقة — الفاحص أضاف قاعدة جديدة (`ADMIN_CLIENT_SIDE_AUTH_ONLY`) تكتشف الاعتماد على `isAdmin` في الواجهة فقط.
2. تحذيرَا `SECURITY DEFINER` المتبقيان مقصودان وآمنان، لكن الفاحص لا يستطيع التمييز — يجب تعليمهما يدويًا كمقبولَين مع تبرير مكتوب.
