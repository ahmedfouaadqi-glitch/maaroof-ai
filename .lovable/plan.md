## الهدف

تعديل تنظيم الأدوات وتفعيل تجربة الوكيل الذكي دون أي اشتراك، مع الحفاظ على بقية الموقع كما هو.

---

### 1) نقل "تحليل الظهور" إلى قسم الأدوات

الوضع الحالي: نموذج "AI Visibility Check" مدمج داخل صفحة `/agent` (سطور 387–411 في `src/routes/agent.tsx`).

التغييرات:

- إنشاء مكوّن جديد `src/components/AIVisibility.tsx` يلفّ نفس منطق `runVisibility` ويستهلك `POST /api/visibility` ويعرض النتيجة بشكل واضح (Score / Sentiment / Platforms grid مع شعارات `ENGINES`).
- إضافة الأداة إلى:
  - `src/lib/tool-catalog.ts` (مفتاح `visibility` ضمن `group: "tools"`، تكلفة `1×`).
  - شبكة أدوات لوحة التحكم `src/routes/dashboard.tsx` (بطاقة جديدة + `openTool === "visibility"` في `Dialog`).
  - عرض كارت Marketing في `src/routes/index.tsx` (يأتي تلقائياً من `TOOL_CATALOG.map`).
- إزالة قسم Visibility الكامل من `src/routes/agent.tsx` (حالات `brand`, `keywords`, `visBusy`, `visMsg`, `runVisibility`، والـ block 387–411). يبقى تشغيل الوكيل التلقائي الذي يستخدم `task_type === "ai_visibility"` كما هو.
- إضافة مفاتيح الترجمة `vis_title / vis_desc / vis_brand_ph / vis_keywords_ph / vis_run` في `src/lib/i18n.tsx` بنفس صياغة `ag_vis_*` الحالية.

---

### 2) دمج "بحث الشركات" نقل كامل مع كافة المحلقات والتبويبات مع "البحث الذكي"

الوضع الحالي: `CompanyOutreach.tsx` فيه ثلاثة أوضاع (`search` / `email` / `brand`). الـ `search` يكرر منطق `SmartResearch.tsx`.

التغييرات في `src/components/SmartResearch.tsx`:

- إضافة Toggle جديد "نوع البحث": `web` (الحالي) | `company` (جديد).
- عند اختيار `company`: استدعاء نفس endpoint الحالي `/api/research` مع تمرير `mode: "company"` ويُضاف برومبت يطلب: ملف الشركة، الموقع الرسمي، قنوات التواصل، الأشخاص المفتاحيون، الفرص (يُعاد استخدام `include_channels` و `channel_types` الموجودين).
- تعديل بسيط في `src/routes/api/research.ts` لاحترام `mode === "company"` بإضافة جملة في system prompt (دون كسر شكل الاستجابة الحالي).

التغييرات في `src/components/CompanyOutreach.tsx`:

- حذف Tab `"search"` من `Mode` وإبقاء `email` و `brand` فقط (`type Mode = "email" | "brand"`).
- إزالة UI زر البحث ومخرجاته.
- بقاء الأداة كأداة "إيميل شركات" خالصة.

تحديث `src/lib/tool-catalog.ts`: إبقاء `company_email` ووصفه الجديد "صياغة إيميل تواصل" (بدون البحث).

---

### 3) تطوير "تعزيز العلامة التجارية في منصات الذكاء"

التغييرات في `src/components/BrandBoostAgent.tsx` و `src/routes/api/brand-boost.ts`:

أ. **تشخيص قبل التوصية**: قبل توليد الخطة، استدعاء داخلي لـ `/api/visibility` للحصول على `platforms[]` لكل محرك. حقن النتائج في برومبت Brand Boost ليصبح كل توصية مبنية على إشارة فعلية (score, evidence_basis, trust_signal) بدل نص عام.

ب. **مخرجات أغنى لكل منصة**:

- `current_signal` (موجود) + `target_signal` (جديد، مثلاً "Wikipedia article + 3 backlinks").
- `recommended_actions` (موجود) مع `priority: high|medium|low` و `effort: low|medium|high` لكل إجراء.
- `expected_lift_percent` (تقدير محافظ 0–30%).
- `kpis[]` (مؤشرات قابلة للقياس).
- `timeline_weeks` (1–12).

ج. **خطة 30 يوم موحّدة** (`roadmap_30d`): مصفوفة 4 أسابيع، كل أسبوع يحوي مهام موزّعة على المنصات المختارة.

د. **تحسينات UI**:

- شريط مقارنة قبل/بعد (current vs target signal) لكل منصة.
- بطاقات روزنامة أسبوعية للـ 30 يوم.
- زر "إعادة الفحص" يعيد تشغيل visibility ثم brand-boost في خطوة واحدة.
- استخدام شعارات `ENGINES` من `engine-logos.tsx` بدل النص.

هـ. **التصدير**: تحديث `buildExport` ليشمل الجداول الجديدة (kpis، roadmap).

---

### 4) تفعيل الوكيل الذكي بأقل الإمكانيات (وضع تجريبي)

الوضع الحالي: `/agent` يحجب أي مستخدم بدون `user_agent_subscriptions` (سطر 262 في `agent.tsx`)، و `/api/visibility` و `runAgentNow` يرفضان غير المشتركين.

تعريف "وضع التجربة" (Trial Mode):

- متاح لأي مستخدم مسجَّل دخوله (signed-in)، بدون شراء.
- حدود يومية: **3 مهام/يوم**، **20 مهمة/شهر**، **أهداف بحد أقصى 2**.
- بدون قنوات نشر (Telegram يبقى متاحاً يدوياً ولكن غير مفعّل تلقائياً).

التغييرات:

- **DB Migration**: إضافة سطر في `agent_addons` بـ `name: "Trial"`, `monthly_tasks: 20`, `daily_task_cap: 3`, `max_targets: 2`، و trigger أو دالة `ensure_trial_subscription(user_id)` تُنشئ `user_agent_subscriptions` تلقائياً عند أول دخول للمستخدم.
- بديل أبسط بدون trigger: في `src/routes/agent.tsx` داخل `load()`، إذا `!subData && !isAdmin` نُنشئ trial sub مباشرة عبر `supabase.from("user_agent_subscriptions").insert({ user_id, plan: "trial", status: "active", agent_addon_id: <trial_addon_id> })`.
- إزالة شاشة "no subscription" واستبدالها بـ Banner "أنت في وضع التجربة — 3 مهام/يوم" مع زر ترقية.
- في `src/routes/api/visibility.ts` و `src/lib/agent.server.ts`: الإبقاء على نفس عدّاد `tasks_used / tasks_used_today`. لا تغيير على منطق الكاب (الكاب الجديد يأتي من سجل Trial نفسه).
- إضافة Badge "Trial" في UI الوكيل (سطر 280+).

---

### نطاق المحافظة

- لا تغيير في الهوية البصرية أو الشعار أو i18n خارج المفاتيح المضافة.
- لا تغيير على `agent.functions.ts` ولا على `pulse.*` ولا على `routeTree.gen.ts`.
- شعارات المحركات الـ8 (`engine-logos.tsx`) تُستخدم كما هي.

## ملاحظات تقنية

- Endpoint `/api/visibility` يبقى كما هو — فقط يُستدعى من مكان جديد (مكوّن `AIVisibility`).
- `tool-catalog.ts`: أداة جديدة `visibility` تكلفتها `1×`، نفس آلية باقي الأدوات.
- ميرج CompanyOutreach + SmartResearch لا يكسر روابط `geo:reuse-research` لأن SmartResearch هو المضيف.
- Trial subscription record حقيقي في DB → لا حاجة لتعديل أي endpoint للتحقق.