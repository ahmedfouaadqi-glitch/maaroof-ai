# Wave 4 — Continuation Plan

أكمل بالترتيب البنود المتبقية من الموجة 4 مع التركيز على البيانات الحقيقية فقط (لا تقدير ولا تخمين ولا تجريبي).

## 1) قنوات النشر — Social Publishing (تفعيل وتبسيط)

نقاط فعلية فقط، لا توجد قنوات وهمية أو "قريباً":

- **Telegram** — موجودة فعلياً عبر `publish_channels` (Bot Token + Chat ID) مع زر "اختبار الإرسال".
- **WhatsApp** — رابط `https://wa.me/?text=...` (يعمل فوراً، بدون OAuth).
- **X / Twitter** — رابط `https://twitter.com/intent/tweet?text=...` (يعمل فوراً).
- **LinkedIn** — عبر موصّل Lovable الموجود (`linkedin` connector) — استدعاء `v2/ugcPosts` من server function. يظهر فقط عند ربط الحساب من قبل المسؤول.
- **Facebook / Instagram** — يُحذفان نهائياً من الواجهة (لا OAuth الآن = لا قناة).

تبسيط واجهة `/agent` و `BrandBoost` و `PostSuggester`:

- بطاقة لكل قناة نشطة فقط مع زر "نشر الآن".
- إزالة الحقول التقنية (webhook خام، api_key عام).

## 2) المواقع / المواضيع المراقبة — Real Data Only

في `CompetitorMonitor` و `agent_targets` و `competitor_watch`:

- **حذف كل البيانات التقديرية**: إزالة الأعمدة/الحقول التي تعرض قيم تقديرية مثل "Estimated traffic"، "Mock score"، "Sample data".
- **مصادر حقيقية فقط**:
  - استخراج المحتوى عبر **Firecrawl** (المفتاح متوفر).
  - بيانات SEO عبر **Google Search Console** (الموصّل مربوط).
  - بيانات منافسة عبر **Semrush** (متوفرة كأدوات).
- إذا لم يتوفر مصدر حقيقي لحقل معين → يظهر "—" بدلاً من رقم مفبرك.
- زر "تحليل الآن" يستدعي serverFn حقيقي يخزن النتيجة في `competitor_alerts` مع timestamp.
- واجهة بطاقات مبسطة في `/profile`: (اسم الهدف، نوع — موقع/كلمة مفتاحية، آخر فحص، الحالة، أزرار: تحليل / إيقاف / حذف).

## 3) الوكيل الذكي على طراز Manus — Tool-Calling حقيقي

استبدال `SYSTEM_AGENT` الحالي بـ AI SDK `streamText` + `tool()`:

أدوات حقيقية (لا تخمين):

- `scrapeUrl(url)` → Firecrawl
- `searchKeyword(keyword)` → Semrush
- `analyzeCompetitor(domain)` → Semrush + Firecrawl
- `generatePost(topic, lang)` → Gemini
- `publishToTelegram(text)` / `publishToWhatsApp(text)` / `publishToX(text)` / `publishToLinkedIn(text)` — مع `needsApproval: true` للنشر
- `saveTarget(type, value)` → كتابة في `agent_targets`

التدفق:

- المستخدم يكتب أمراً واحداً → الوكيل ينفذ تلقائياً (`stepCountIs(50)`).
- كل خطوة تظهر كبطاقة (Tool call + Result) في الواجهة.
- كل خطوة تستهلك من حصة الوكيل (`charge_tokens('agent_step')`).
- النموذج: `google/gemini-2.5-flash` عبر Lovable AI Gateway.

## 4) ربط الحصص بالخطط (Admin only)

- تحديث `agent.server.ts` بحيث `checkAndConsume` يقرأ الحدود من `subscription_plans.agent_daily_cap` / `agent_monthly_cap` / `agent_max_targets` (تمت إضافتها في الموجة السابقة).
- `agent_addons` يبقى للتوافق الخلفي فقط (قراءة عند عدم وجود خطة).
- لا يمكن للمستخدم تغيير حصصه — فقط الأدمن من `AdminPlanPricingPanel`.

## 5) التحقق

- تشغيل اختبار يدوي لـ Telegram (إرسال رسالة اختبارية).
- التأكد من أن `/tools/ai-visibility` يعمل والـ link من `/agent` يصل إليه.
- التحقق من ترجمة كل النصوص الجديدة في `i18n.tsx` (ar/en/ku).

## ملفات ستُعدّل

- `src/routes/agent.tsx` — واجهة Manus chat + بطاقات قنوات نشطة فقط
- `src/lib/agent.functions.ts` + جديد `src/lib/agent-tools.server.ts` — أدوات الوكيل الحقيقية
- `src/lib/agent.server.ts` — `checkAndConsume` يقرأ من `subscription_plans`
- `src/components/CompetitorMonitor.tsx` — حذف الحقول التقديرية، بطاقات مبسطة
- `src/routes/profile.tsx` — قسم Targets المبسط
- `src/components/PostSuggester.tsx` + `BrandBoost.tsx` — أزرار نشر مباشر (WhatsApp/X) + LinkedIn عبر connector
- `src/lib/publish.functions.ts` (جديد) — `publishToLinkedIn` عبر connector gateway
- `src/lib/i18n.tsx` — مفاتيح جديدة بثلاث لغات

## أسئلة قبل التنفيذ

1. **LinkedIn**: هل تريد ربط موصّل LinkedIn الآن (يحتاجك توافق على الربط من نافذة Lovable) أم  تكتفي بـ Telegram + WhatsApp + X  نعم يتم ربط وتسهيله ُ للمستخدم بدون تعقيدات . فقط؟ 
2. **النشر التلقائي للوكيل**: عند تنفيذ أمر مثل "اكتب منشوراً وانشره"، هل تريد:
  - (أ) موافقة يدوية قبل كل نشرة، أم 
  - (ب) نشر مباشر بدون مراجعة؟ الاثنان معاً
3. **حصة الوكيل القديمة (`agent_addons`)**: نحذفها نهائياً بعد التحويل، أم نُبقيها مخفية كنسخة احتياطية؟