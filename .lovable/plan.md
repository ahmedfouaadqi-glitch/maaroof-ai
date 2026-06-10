# Phase B — طبقة الإدراك والنية (Cognitive Layer)

Phase A اكتمل (CMS + Header + Export). الآن ننفّذ الطبقة الإدراكية الاستباقية لكل الأدوات.

## 1) قاعدة البيانات

جدول `user_intent_profile` موجود مسبقاً من Phase A migration (user_id, detected_intent jsonb, context_summary text, last_signals jsonb, updated_at). لا حاجة لتعديله — فقط نتأكد من الأعمدة ونضيف فهرس على `updated_at` إن لزم.

## 2) محرك الإدراك (server-side)

**`src/lib/cognition.server.ts`** (server-only helper):
- `extractIntent({ userId, toolKey, input, output })` — يستدعي `google/gemini-2.5-flash` بـ JSON schema صغير ومحدود (لتجنّب Gemini state limit):
  ```
  { primary_goal: enum[growth, crisis, competitor, launch, retention, exploration],
    audience: string(≤80),
    gap: string(≤120),
    opportunity: string(≤120),
    urgency: enum[low, medium, high],
    next_tool: string,           // toolKey مقترح
    next_reason_ar/en/ku: string(≤140) }
  ```
- `updateContextSummary(prev, newSignal)` — طي تدريجي (آخر 10 إشارات + ملخص نصّي ≤500 char).
- `buildSystemContext(profile)` — يحوّل الـ profile إلى prompt prefix يُحقن في كل أداة.

**`src/lib/cognition.functions.ts`** (createServerFn):
- `runCognition` — يُستدعى بعد انتهاء أي أداة، يحدّث `user_intent_profile` ويرجع `{ proactive_next_step }`.
- `getUserIntelligence` (admin only) — قائمة المستخدمين + النيات.
- `refreshUserIntent` (admin only) — إعادة فحص.

## 3) دمج في الأدوات

نقطتا تكامل لكل أداة:
- **قبل التشغيل**: serverFn الأداة يقرأ `user_intent_profile` ويحقن `buildSystemContext()` في الـ system prompt الحالي (سطر/فقرة إضافية، بدون كسر السلوك).
- **بعد التشغيل**: الواجهة (component) تستدعي `runCognition({ toolKey, inputSummary, outputSummary })` بشكل async (لا يحجب النتيجة) وتعرض `<ProactiveNextStep />` عند الانتهاء.

ملفات API المعدّلة (حقن السياق فقط، تغيير صغير في system prompt):
`brand-boost.ts, compare.ts, visibility.ts, applied-ranking.ts, suggest.ts, research.ts, bizdev.ts, feasibility.ts, brand-authority.ts, social-analysis.ts, competitor-monitor.ts, what-if.ts, geo-strategist.ts, analyze.ts, geo-rewrite.ts, company-email.ts`.

## 4) المكوّن الاستباقي

**`src/components/ProactiveNextStep.tsx`**:
بطاقة CTA تظهر أسفل نتيجة كل أداة:
> _"بناءً على هدفك ({primary_goal}) والفجوة ({gap}) — ننصح بتشغيل **{next_tool}** الآن"_
+ زر مباشر يفتح الأداة المقترحة عبر `tool-handoff.ts` الموجود.
النصوص بكل اللغات (تأتي من `next_reason_ar/en/ku`).

## 5) لوحة الإدارة

تبويبان جديدان في `admin.tsx`:

**A) User Intelligence** (`src/components/admin/UserIntelligenceTab.tsx`):
جدول: email | specialty | primary_goal | urgency | context_summary | last_run | actions (إعادة فحص).
بحث + فلترة حسب intent/urgency/specialty.

**B) Cognitive Insights** (`src/components/admin/CognitiveInsightsTab.tsx`):
- توزيع `primary_goal` (chart bars بسيطة)
- أكثر الفجوات تكراراً (top 10)
- أكثر الفرص الجماعية
- توزيع urgency

## 6) ربط مع المنطق الموجود

- `user-context.server.ts` الحالي يبقى — `cognition.server` يبني فوقه ولا يستبدله.
- `tool-handoff.ts` يُستخدم لزر "الخطوة التالية".
- نضيف namespace جديد في `site_content` بـ `cognition:*` للنصوص (عنوان البطاقة، التسميات، شارات urgency) — كلها قابلة للتعديل من Content Studio بكل اللغات.

## التفاصيل التقنية

**ملفات جديدة**:
- `src/lib/cognition.server.ts`
- `src/lib/cognition.functions.ts`
- `src/components/ProactiveNextStep.tsx`
- `src/components/admin/UserIntelligenceTab.tsx`
- `src/components/admin/CognitiveInsightsTab.tsx`

**ملفات معدّلة**:
- `src/routes/admin.tsx` — تبويبان جديدان.
- 16 ملف API tool — سطرين فقط لكل واحد (قراءة profile + حقن في system prompt).
- لوحات الأدوات الـ16 — استدعاء `runCognition` بعد النتيجة + عرض `<ProactiveNextStep />`.

**حقوق الوصول**: 
- `user_intent_profile`: select/update فقط للمستخدم نفسه + admin.
- جداول admin tabs تستخدم `has_role(auth.uid(), 'admin')`.

**التكلفة**: استدعاء واحد إضافي لـ `gemini-2.5-flash` بعد كل تشغيل أداة (تكلفة دقيقة، JSON صغير). يمكن تعطيله من admin عبر `app_settings.cognition_enabled` (سأضيفه كـ toggle).

## ملاحظات

- بطاقة الـ Proactive لن تظهر إذا كان النموذج غير واثق (urgency=low + ليس هناك next_tool).
- التحديث async ولا يبطئ تجربة المستخدم.
- النصوص تُولَّد بنفس لغة الواجهة (lang param يُمرَّر للمحرك).

هل أبدأ التنفيذ كاملاً؟
