# خطة الموجة 3 — التنفيذ بالترتيب

## 1) الصفحة الرئيسية — تحديث "9 منصات" واختصار
**`src/routes/index.tsx` + `src/lib/i18n.tsx`:**
- استبدال كل ذكر لـ "8 منصات" / "8 AI" بـ "9 منصات" (ar/en/ku) — مراجعة كاملة لمفاتيح: `hero_*`, `feature_*`, `compare_*`, `cta_*`.
- إضافة Kimi إلى أي قائمة شعارات/أوصاف في Hero.
- **اختصار:** الإبقاء فقط على Hero + EnginesOrbit + CTA. الأقسام التفصيلية (How it works, Features الطويلة، Pricing teaser) تُنقل إلى صفحاتها (`/guide`, `/pricing`, `/how`) أو تُحذف إن مكررة.
- النص "نُغذّي علامتك في 8 منصات…" يصبح "9 منصات".

## 2) اللغات الثلاث — تدقيق كامل
- مسح `src/lib/i18n.tsx` لكشف أي مفتاح ناقص في `en` أو `ku` (يقع fallback إلى ar).
- إضافة الترجمات الناقصة لكل الصفحات: index, dashboard, profile, guide, contact, pricing, admin, terms, privacy, agent + كل مكونات الأدوات.
- التحقق من نصوص الأزرار والـtooltips داخل المكونات (`SpecialtyBanner`, `CountryBadge`, `ReportBuilder`, إلخ).

## 3) `dashboard.tsx`
- حذف فقرة الشرح أسفل عنوان "أدواتك" — يبقى العنوان فقط.
- "تعمل ضمن تخصصك" (`SpecialtyBanner`): تأكيد أنه يستخدم `t()` لكل النصوص ويتغير مع اللغة.
- **حذف "طلبات الاشتراك"** نهائياً من dashboard (أي بطاقة/زر/قسم متبقٍ).

## 4) نصوص ومحتوى الأدوات
- تحديث `title/description/help` لكل أداة في `src/lib/tool-catalog.ts` + `i18n.tsx` لتعكس الوظيفة الفعلية بدقة (ar/en/ku).
- تحديث `ToolHelpBanner` لكل أداة بشرح أوضح وأقصر.

## 5) منشئ التقارير `ReportBuilder.tsx` — تحسين بصري
- إعادة تصميم المعاينة: بطاقات نظيفة، رؤوس واضحة، تباين أفضل، استخدام design tokens.
- **حذف:** قسم "تحليلات GEO" وقسم "سجل النشاط" (غير مفهومَين).
- **المخططات:** إضافة تبديل بين 3 أوضاع — أعمدة / خطي / رادار — مع زر تبديل واضح، الرادار للمقارنة بين 9 منصات.

## 6) إدارة المحتوى — لوحة موحّدة وأسهل
إنشاء `/admin/content` جديدة:
- جدول واحد يعرض كل المفاتيح النصية (مأخوذة من i18n) مع 3 أعمدة: ar / en / ku.
- بحث + فلترة حسب الصفحة/المكون.
- تعديل inline؛ عند الحفظ:
  - يُخزَّن في جدول جديد `content_overrides (key, lang, value)`.
  - **ترجمة تلقائية:** عند تعديل لغة واحدة، استدعاء Lovable AI لترجمة للغتَين الأخريَين تلقائياً، يظهر اقتراح قابل للتعديل قبل الحفظ.
- `i18n.tsx` يُدمج `content_overrides` فوق الترجمات الأساسية.
- **schema جديد:** `content_overrides` + grants + RLS (admin only write, public read).

## 7) الوكيل `/agent` + `agent.functions.ts` — تفعيل حقيقي
- مراجعة `agent.server.ts`: التأكد من أن المهام تُنفَّذ فعلياً (لا mock/stub).
- ربط بـ Lovable AI Gateway للتشغيل الحقيقي.
- صفحة `/agent`: تطبيق نفس قواعد التحديث (نصوص i18n كاملة، حذف export buttons، شارة دولة).
- جدولة المهام عبر `agent_tasks` تعمل فعلياً مع cron عبر `/api/public/hooks/agent-runner`.

## 8) دمج الوكيل والصلاحيات في شبكة الأسعار
- توسيع `subscription_plans` و `tool_plan_access`:
  - إضافة عمود `agent_addon_id` (FK → `agent_addons`) لكل خطة، يحدد حدود الوكيل (مهام/يوم، مهام/شهر، تكلفة).
  - شبكة `/admin → الخطط` تعرض الآن: الأدوات (16) + الوكيل، بنفس صفوف الأسعار.
- إضافة أعمدة per-tool في الشبكة: `enabled / daily_limit / monthly_limit / cost_units / geo_scope_required`.
- التعديل من نفس اللوحة يحفظ في `tool_plan_access`.
- صفحة `/admin/agent` لإدارة `agent_addons` (إضافة/حذف باقات الوكيل) — مرتبطة بنفس الشبكة.

## 9) Theme — الوضع الليلي/النهاري
خياران، يحتاج قرار المستخدم:
- **A) تحسين:** مراجعة `styles.css` لتباين أفضل في الوضع الفاتح (الحالي ضعيف)، تثبيت ظلال، تحسين أداء `ThemeToggle`.
- **B) حذف:** إزالة `ThemeToggle` نهائياً، تثبيت الوضع الداكن فقط.

## 10) التحقق النهائي
- بحث شامل عن السلاسل: `"8"`, `"ثماني"`, `"eight"`, `"Iraq"`, `"عراق"`, `"طلب اشتراك"`, `"ExportButtons"`, `"PrintAnalysisButton"` — تنظيف ما تبقّى.
- اختبار يدوي لكل صفحة بثلاث لغات.
- التأكد أن "1 وحدة" مخفية افتراضياً ويتم إظهارها فقط بعد تخصيص الإدارة.

## تفاصيل تقنية
- **Schema جديد:**
  - `content_overrides (id, key text, lang text, value text, updated_at, updated_by)` + index على `(key, lang)`.
  - `subscription_plans.agent_addon_id uuid REFERENCES agent_addons(id)`.
  - `tool_plan_access` يضيف: `daily_limit int`, `monthly_limit int`, `geo_required bool` (إن لم تكن موجودة).
- **i18n loader:** تعديل `useI18n` لتحميل `content_overrides` عند bootstrap (cache في React Query) ودمجها فوق القاموس الأساسي.
- **AI translation:** استخدام `google/gemini-2.5-flash` عبر `lovable-ai.ts` للترجمة التلقائية.
- **منشئ التقارير:** استخدام `recharts` (موجود) لإضافة `LineChart` و `RadarChart` بجانب `BarChart` الحالي.

## أسئلة قبل البدء
- **Theme**: تحسين أم حذف كامل للوضع الفاتح؟
- **ترتيب التنفيذ**: هل أبدأ بـ (1-4 نصوص+لغات) ثم (5-6 تقارير+content admin) ثم (7-8 وكيل+صلاحيات) ثم (9-10 theme+QA)؟
- **content_overrides**: هل توافق على الجدول الجديد + الترجمة التلقائية بالـAI؟
