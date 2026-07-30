## الهدف

توحيد "المحركات التسعة" (ChatGPT, Gemini, Claude, Perplexity, Copilot, Grok, Mistral, DeepSeek, Kimi) عبر كل المشروع، مع جعل اختيار الموديل الفعلي يمرّ دائمًا عبر سجل الحوكمة (`ai_models` + `models.server.ts`) بدل الموديلات المثبتة يدويًا في كل ملف.

## الوضع الحالي (تم التحقق منه)

- خريطة المحركات التسعة موجودة في مكان واحد فقط: `src/routes/api/brand-boost.ts` (`PLATFORMS` + `PLATFORM_MODEL`) وبحدّ أقصى 5 محركات لكل تشغيل.
- قائمة العرض `ENGINES` مكرّرة في `src/components/engine-logos.tsx` بلا ربط بالموديلات.
- بقية المسارات (`analyze`, `suggest`, `compare`, `visibility`, `feasibility`, `research`, `bizdev`, `company-email`, `social-analysis`, `what-if`, `brand-authority`, `geo-strategist`, `applied-ranking`, `competitor-monitor`, `cms`, `translate`, `agent-runner`) تستخدم موديلًا واحدًا مكتوبًا نصيًا داخل الكود.
- سجل الحوكمة `models.server.ts` (`loadModelRegistry`, `selectModel`, `costOf`) موجود لكن لا يُستدعى من مسارات الأدوات.

## الخطة

### 1) مصدر حقيقة واحد للمحركات التسعة
- ملف جديد `src/lib/ai-engines.ts` (آمن للعميل): المفاتيح التسعة + الاسم + الشعار (يُعاد استخدام `engine-logos.tsx` بدل تكراره) + `proxy` + `defaultModel` + الحد حسب الخطة.
- تحديث `engine-logos.tsx` و`brand-boost.ts` ليقرأا من هذا الملف؛ لا نسخة ثانية.

### 2) محدِّد الموديل الموحّد
- ملف جديد `src/lib/ai-engines.server.ts`: دالة `resolveEngineModel(engineKey, phase)` تسأل `selectModel()` من سجل الحوكمة، وترجع الموديل المعتمد + السبب + التكلفة المتوقعة، مع الرجوع إلى `defaultModel` عند إطفاء الحوكمة أو غياب الصف.
- تسجيل الموديلات المستخدمة فعليًا في جدول `ai_models` عبر Migration (أسعار وقدرات وحالة) حتى تعمل الحوكمة والتكلفة الحقيقية.

### 3) التقييد حسب الخطة (المختار)
- Starter = 3 محركات، Pro = 6، Business = 9، مع تجاوز إداري.
- منطق مركزي `enginesAllowedForUser()` في الخادم (يقرأ `subscription_tier` كما في `tokens.server.ts`)، ويُستعمل في `brand-boost` وأي أداة متعددة المحركات.
- الواجهة تُظهر المحركات المقفلة بشارة "ترقية".

### 4) الربط في كل الأدوات
- كل مسار في `src/routes/api/*` يستبدل السلسلة النصية للموديل بـ `resolveEngineModel(...)`، ويحافظ على نفس منطق الشحن والتسجيل (`chargeTokens`, `_el`) لكن بالموديل المُختار الفعلي والتكلفة من السجل.
- الأدوات ذات الطابع "متعدد المحركات" (`compare`, `visibility`, `brand-boost`, `applied-ranking`, `competitor-monitor`) تستقبل `engines[]` من الواجهة وتشغّل المحركات المسموح بها فقط.
- `tool-catalog.ts`: `preferredModels` تصبح تلميحًا للحوكمة لا قيمة نهائية.

### 5) الواجهة
- مكوّن مشترك `EngineSelector` (اختيار متعدد + شعارات + شارات proxy/مقفل + تقدير تكلفة)، يُدمج في `BrandBoostAgent`, `CompetitorCompare`, `AIVisibility`, `AppliedRanking`.
- النتائج تعرض بوضوح أي محرك حقيقي وأيها بديل (proxy).

### 6) لوحة الإدارة
- في `MaaroofIntelligenceCenter` / `ModelDecisionPanels`: جدول "المحركات التسعة ← الموديل المعتمد" مع صحة وتكلفة كل موديل وإمكانية تغيير الربط من `ai_models`.

## تفاصيل تقنية

- Migration واحد: إدراج صفوف `ai_models` للموديلات المستخدمة + عمود/حقل ربط `engine_key` (أو `capabilities.engine_keys`) لتخزين ربط المحرك بالموديل، مع GRANTs المناسبة.
- لا تغيير في عقود الاستجابة الحالية للـ APIs؛ فقط إضافة حقول `engine`, `model_used`, `proxy` داخل النتائج.
- كل نداء يبقى على `LOVABLE_AI_CHAT_COMPLETIONS_URL` عبر `lovable-ai.ts` (لا مزود جديد).
- التنفيذ على دفعات: (أ) البنية والسجل، (ب) الأدوات متعددة المحركات، (ج) بقية الأدوات، (د) الواجهة والإدارة.
