
# الموجة 4 — تفعيل النشر، تبسيط المراقبة، تطوير الوكيل، ودمج الأسعار

## 1) قنوات النشر (`publish_channels` + `/agent` + tools)
- صفحة موحّدة `/profile` → تبويب "قنوات النشر" بدلاً من النموذج المعقّد الحالي.
- 3 قنوات مفعّلة فعلياً (server functions موجودة جزئياً):
  - **Telegram**: حقل واحد = Bot Token + Chat ID → زر "اختبار الإرسال" يستدعي `publishToTelegram`.
  - **WhatsApp** (cloud API link): رقم + نص جاهز → ينتج رابط `wa.me`.
  - **X/Twitter**: عبر intent URL (بدون OAuth — أبسط).
- زر "نشر" داخل كل أداة (Post Suggester، Brand Boost، Report Builder) يفتح قائمة القنوات النشطة فقط.
- إزالة الحقول الزائدة (webhook, api_key العامة) وتركها فقط حسب نوع القناة.

## 2) نقل "تحليل الظهور" (`AIVisibility`) من `/agent` نهائياً
- المشكلة: `/agent` لا يزال يعرض `<AIVisibility/>` بينما الأداة نُقلت إلى `/tools/ai-visibility`.
- الحل: حذف الاستيراد والعرض من `src/routes/agent.tsx`، وترك صفحة الوكيل لأمر الوكيل فقط (نقطة 4).

## 3) تبسيط المواقع/المواضيع والمراقبة
- `agent_targets` (المواقع/المواضيع): واجهة بطاقات بسيطة في `/profile` → تبويب "أهدافي":
  - إضافة سريعة: نوع (موقع/موضوع/منافس) + قيمة واحدة + زر "حفظ".
  - بطاقة لكل هدف بثلاثة أزرار: تحليل الآن / إيقاف المراقبة / حذف.
- `CompetitorMonitor`: تبسيط الأعمدة (اسم، آخر فحص، حالة، إجراء واحد).
- إزالة الحقول التقنية (cron expression، webhook خام) — يتولى النظام الجدولة تلقائياً يومياً.

## 4) تطوير الوكيل (`/agent`) ليكون شبيهاً بـ Manus
- استبدال `SYSTEM_AGENT` بنظام أدوات (tool-calling) عبر AI SDK.
- **الأدوات المتاحة للوكيل** (موجودة كـ server fns):
  - `analyzeUrl`, `suggestPost`, `runVisibility`, `runBrandBoost`, `runCompetitorMonitor`, `publishToTelegram`, `saveTarget`.
- استخدام `streamText` + `tool()` + `stepCountIs(50)` من AI SDK مع Lovable Gateway (`google/gemini-3-flash-preview`).
- واجهة `/agent`: محادثة streaming تعرض كل خطوة (أداة نُفّذت، نتيجة، خطوة تالية) كبطاقات.
- زر "نفّذ" واحد بدل النموذج الحالي.
- استهلاك tokens محسوب لكل خطوة عبر `chargeTokens(toolKey: "agent_step")`.

## 5+6) دمج أسعار/حصص الوكيل في شبكة الأسعار (الإدارة فقط)
- حالياً `agent_addons` + `user_agent_subscriptions` منفصلة عن `subscription_plans` + `tool_plan_access`.
- **الدمج**:
  - إضافة مفاتيح أدوات الوكيل (`agent_step`, `agent_visibility`, `agent_publish`, …) إلى `tool_pricing_catalog`.
  - في `AdminPlanPricingPanel` → قسم جديد "أدوات الوكيل الذكي" مع نفس واجهة `tool_plan_access` (سعر/توكن/تفعيل).
  - حقول جديدة في `subscription_plans`: `agent_daily_cap`, `agent_monthly_cap` (محرّرة من لوحة الإدارة فقط).
  - الكود في `checkAndConsume` يقرأ من `subscription_plans` بدل `agent_addons`.
  - **حظر تعديل المستخدم**: `guard_profile_privileged_updates` يمنع بالفعل، نضيف منعاً صريحاً لأي تعديل على حقول الحصص.
- إبقاء `agent_addons` كـ legacy عبر migration ترحيل بياناتها إلى `subscription_plans` ثم إخفاؤها من الواجهة.

## Migration المطلوبة
```sql
ALTER TABLE subscription_plans
  ADD COLUMN agent_daily_cap int,
  ADD COLUMN agent_monthly_cap int;
-- ترحيل من agent_addons
UPDATE subscription_plans p SET ... FROM agent_addons a WHERE ...;
```

## ملفات ستتأثر
- `src/routes/agent.tsx` (حذف AIVisibility + واجهة chat جديدة)
- `src/lib/agent.functions.ts` + جديد `src/lib/agent-tools.server.ts` (tool-calling عبر AI SDK)
- `src/routes/profile.tsx` (تبويبات: قنوات + أهدافي)
- `src/components/CompetitorMonitor.tsx` (تبسيط)
- `src/components/admin/AdminPlanPricingPanel.tsx` (قسم الوكيل)
- `src/lib/agent.server.ts` (`checkAndConsume` يقرأ من plans)
- migration: `subscription_plans` + ترحيل `agent_addons`

## أسئلة قبل التنفيذ
1. **قنوات النشر**: هل نكتفي بـ Telegram + WhatsApp link + X intent، أم تريد أيضاً Facebook/Instagram (تتطلب OAuth وأطول لتنفيذ)؟
2. **الوكيل الذكي (Manus-style)**: هل نسمح للوكيل بتنفيذ النشر تلقائياً (يحتاج موافقة `needsApproval` لكل نشر)، أم فقط يقترح والمستخدم يضغط نشر؟
3. **agent_addons**: هل نحذفها نهائياً بعد الترحيل، أم نُبقيها كنسخة احتياطية مخفية لمدة (آمن للبيانات الحالية)؟
