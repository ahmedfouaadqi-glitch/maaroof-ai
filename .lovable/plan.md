
هذا تحديث كبير يحوّل المنصة من Landing Page تجريبية إلى SaaS كامل. سأنفذه على مراحل متتابعة.

## المرحلة 1 — إصلاحات سريعة في الواجهة (بدون Backend)

1. **النقطة 2 في "كيفية العمل"**: إعادة صياغة بسيطة بدون كشف المحرك:
   - بدلاً من "DeepSeek + Gemini يحللان..." → "نقوم بتحليل المنشور وفق معايير GEO الحديثة وإعطائك تقريراً مفصلاً."
2. **تغيير النص**: "وحدة من منظومة معروف للذكاء التجاري" → "جزء من نظام معروف" في الترجمات الثلاث.
3. **رسائل الذكاء**: تأكيد أن المنصة ليست شات/محادثة — تعديل النصوص الواصفة للـ Sandbox والـ Suggester لتقول "أداة تحليل واقتراح" وليس "اسأل الذكاء".

## المرحلة 2 — تفعيل Lovable Cloud + قاعدة البيانات

تفعيل Cloud وإنشاء الجداول:

```
profiles            (id, email, full_name, created_at, trial_used_count, is_subscribed, subscription_tier, subscription_expires_at)
user_roles          (user_id, role: 'admin'|'user')          -- منفصل لمنع تصعيد الصلاحيات
analyses            (id, user_id, input_text, input_hash, score, authority, local, citation, lang, created_at)
suggestions         (id, user_id, mode: 'text'|'image'|'improve', input, output, lang, created_at)
analysis_cache      (input_hash PK, result jsonb, created_at) -- Context Caching لتوفير الكلفة
subscription_plans  (id, name, price_iqd, duration_days, features jsonb, active)
subscription_requests (id, user_id, plan_id, status: 'pending'|'approved'|'rejected', whatsapp_contacted_at, created_at)
activity_log        (id, user_id, action, metadata jsonb, created_at)
```

مع RLS صارمة + دالة `has_role()` SECURITY DEFINER.

## المرحلة 3 — نظام التجربة والتسجيل

- **2 محاولات مجانية فقط** بدون تسجيل (تتبع عبر localStorage + IP-fingerprint).
- بعد المحاولتين: شاشة "سجّل بالبريد لتفعيل تجربتك" → Email/Password مع تأكيد البريد إلزامي.
- بعد التأكيد: المستخدم يحصل على عدد محاولات إضافي محدود (مثلاً 3 تحليلات + 2 اقتراحات شهرياً) ضمن الخطة المجانية.
- للوصول الكامل: زر "اشترك الآن" → نموذج طلب → فتح واتساب على `+9647733570130` تلقائياً مع رسالة جاهزة، وتسجيل الطلب في `subscription_requests`.

## المرحلة 4 — لوحة Super Admin (`/admin`)

محمية بـ `_authenticated` + `has_role(admin)`. تحوي:
- **نظرة عامة**: إحصائيات (مستخدمون، تحليلات، طلبات اشتراك معلّقة).
- **المستخدمون**: بحث، عرض نشاط، تعليق/تفعيل، تعيين أدمن.
- **الاشتراكات**: عرض/إنشاء/تعديل/حذف الخطط (`subscription_plans`).
- **طلبات الاشتراك**: قبول/رفض، عند القبول يُحدَّث `is_subscribed` و `subscription_expires_at`.
- **سجل النشاط**: عرض `activity_log` مع فلترة.
- **إحصائيات الذكاء**: عدد التحليلات، نسبة Cache hit، أكثر اللغات استعمالاً.

## المرحلة 5 — صفحات قانونية

- `/privacy` — سياسة الخصوصية (3 لغات).
- `/terms` — سياسة الاستخدام (3 لغات).
- روابط في الفوتر.

## المرحلة 6 — تقليل الاستهلاك (Cost Optimization)

- **Context Cache**: قبل أي استدعاء AI، نفحص `analysis_cache` بـ SHA-256 للنص. لو موجود → نرجع النتيجة فوراً بدون API call.
- استعمال `google/gemini-2.5-flash-lite` (الأرخص) للتحليل البسيط، و`gemini-3-flash` فقط للاقتراح المعقّد/الصور.
- حد أقصى للـ tokens في الـ prompt و output.
- Rate limiting لكل user (X طلب/دقيقة).
- Debounce على واجهة الإدخال.

## المرحلة 7 — مزايا إضافية مقترحة

أقترح:
1. **GEO Score History** — رسم بياني لتطور درجات المستخدم عبر الزمن.
2. **Bulk Analyzer** — رفع CSV/قائمة منشورات لتحليلها دفعة واحدة (للمشتركين).
3. **Competitor Snapshot** — إدخال رابط/نص منافس ومقارنته بمنشورك.
4. **Iraqi Keyword Library** — مكتبة جاهزة بالكلمات المفتاحية العراقية المهمة (محافظات، جهات، عبارات سياقية).
5. **Export PDF Report** — تصدير تقرير احترافي للتحليل (للمشتركين).
6. **Telegram/WhatsApp Alerts** — تنبيه عند انتهاء الاشتراك أو توفّر ميزة جديدة.
7. **Referral System** — كل مستخدم يحصل على رصيد إضافي عند دعوة صديق يسجّل.
8. **Public GEO Leaderboard** — أفضل المنشورات المُحلَّلة (بإذن صاحبها) لبناء سلطة المنصة.

## المرحلة 8 — الحفاظ على الهوية

كل العمل ضمن نفس Tech-Noir theme، نفس الألوان (`oklch`)، نفس الخطوط (Noto Kufi Arabic / Vazirmatn / Inter)، نفس glow & gradients.

---

## ملاحظات تقنية

- TanStack Start + Lovable Cloud (Supabase تحت الغطاء — لن أذكر هذا الاسم للمستخدم).
- جميع الـ AI calls عبر `createServerFn` مع middleware للتحقق من الجلسة + الاشتراك + الكاش.
- لوحة الأدمن تستعمل `requireSupabaseAuth` + `has_role` تحقّق على مستوى السيرفر (ليس فقط الواجهة).

---

## أسئلة قبل التنفيذ

1. **خطط الاشتراك** — هل عندك أسعار/مدد محددة الآن، أم أنشئ خطة افتراضية (مثلاً: شهري 25,000 د.ع، سنوي 250,000 د.ع) وتعدّلها لاحقاً من لوحة الأدمن؟
2. **حدود الخطة المجانية بعد التسجيل** — 3 تحليلات + 2 اقتراحات شهرياً مناسبة؟ أم أرقام أخرى؟
3. **المزايا الإضافية** — أيّها أنفّذ الآن مع الحزمة الأساسية؟ أقترح: PDF Export + GEO History + Iraqi Keywords. الباقي مرحلة لاحقة.
4. **حساب الأدمن الأول** — ما البريد الذي ستستعمله ليُعيَّن أدمن أوتوماتيكياً عند أول تسجيل؟

أكّد لي الإجابات (أو قل "نفّذ بافتراضاتك") وأبدأ فوراً.
