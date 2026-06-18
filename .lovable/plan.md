
## الهدف
بناء **الوكيل الذكي «معروف»** — Orchestrator احترافي بنمط Manus (Plan→Act→Reflect) + ذاكرة طويلة Kimi-like، يعمل **عالمياً** (وليس العراق فقط) فوق الأدوات الـ16 القائمة، بدون كسر الوكيل الحالي.

## الهوية
- **الاسم:** معروف (Maaroof) — "وكيلك الذكي للتسويق الرقمي والـ GEO حول العالم"
- يظهر في system prompt، header، sidebar، empty state، تذييل التقارير

## النطاق الجغرافي (العالمي)

### كشف موقع المستخدم
- **IP geolocation** عند بدء كل run عبر Cloudflare headers المتاحة في Worker:
  - `request.headers.get('cf-ipcountry')` → كود الدولة (IQ, SA, US, …)
  - `cf-ipcity`, `cf-iplongitude`, `cf-iplatitude` (إن وُجدت)
- Fallback: استدعاء `ipapi.co/json` أو `ip-api.com` إن لم تتوفر headers
- النتيجة تُحفظ في `maaroof_runs.detected_geo jsonb`

### اختيار يدوي
- في واجهة `/maaroof`: قائمة منسدلة "النطاق الجغرافي" مع:
  - **تلقائي (حسب IP)** — افتراضي
  - **دولة محددة** — Combobox بكل دول العالم (ISO 3166-1)
  - **مدينة محددة** — text input اختياري
  - **عالمي** — بدون قيد جغرافي
- الاختيار يُحفظ في `maaroof_runs.geo_scope jsonb`: `{country, city, mode}`
- يُحفظ كتفضيل دائم في `maaroof_memory` (kind=preference) ليُستدعى تلقائياً في الـ runs التالية

### استخدام النطاق في التخطيط والتنفيذ
- يُحقن في system prompt: "موقع المستخدم: {country}, {city}. خطط أهدافاً ملائمة لهذا السوق (لغة، عملة، منافسون، قنوات)"
- يُمرر كمعامل `geo` إلى كل أداة تدعم النطاق (analyze, research, geo-strategist, visibility, compare, applied-ranking)
- التقارير تُترجم وتُكتب باللغة المناسبة (عربي للدول العربية، إنجليزي افتراضياً، أو حسب تفضيل المستخدم)

## 1) قاعدة البيانات (Migration واحدة)

### جداول جديدة
- **`maaroof_runs`**: `id, user_id, goal, status, plan jsonb, detected_geo jsonb, geo_scope jsonb, language text, total_usd, total_tokens, model, started_at, finished_at`
- **`maaroof_memory`**: `id, user_id, run_id nullable, kind (fact|preference|task_result|summary), content text, embedding vector(768), importance int, created_at, last_accessed_at`
- **`maaroof_messages`**: `id, run_id, role, parts jsonb, tokens, usd, created_at`

### الصلاحيات
- `pgvector` extension
- GRANT (`authenticated` + `service_role`) للجداول الثلاثة
- RLS: المالك فقط + admin
- ivfflat index على `maaroof_memory.embedding`

## 2) طبقة التنسيق `src/lib/maaroof/`

- **`geo-detector.server.ts`** (جديد): يقرأ Cloudflare headers + fallback إلى ipapi
- **`planner.server.ts`**: Gemini 2.5 Pro، يستقبل goal + geo + memory → خطة JSON
- **`executor.server.ts`**: ينفذ الـ16 endpoint عبر AI SDK tools، يمرر `geo` لكل أداة
- **`reflector.server.ts`**: تقييم كل 3-5 خطوات
- **`memory.server.ts`**: recall/remember/summarize عبر embeddings
- **`cost-tracker.server.ts`**: enrichLedger بعد كل خطوة، يجمع في `maaroof_runs.total_usd`

### `src/routes/api/maaroof.ts` (جديد)
- POST مع `streamText` + tools + `stepCountIs(50)` + `toUIMessageStreamResponse`
- يستدعي `detectGeo(request)` أول شيء
- system prompt يبدأ بهوية معروف + الموقع المكتشف
- نموذج: `google/gemini-2.5-pro` افتراضي

## 3) الواجهة `/maaroof`

- AI Elements (Conversation, Message, Tool, PromptInput, Shimmer)
- **Header**: شعار معروف + الاسم + التكلفة الجارية + عدد الخطوات + الوقت
- **شريط الموقع**: 🌍 "العراق، بغداد (تلقائي)" مع زر تغيير → modal اختيار يدوي
- **message.parts**: plan قابلة للطي، tool-call مع icon، tool-result مضغوط، reflection ملون
- **Sidebar**: runs سابقة + رابط ذاكرة معروف
- **Empty state**: "مرحباً، أنا معروف. حددت موقعك: {country}. ما الهدف؟"
- زر إيقاف (AbortController)

### `/maaroof/memory` (مرحلة B)
- عرض ذاكرة معروف + حذف/تعديل

## 4) الذاكرة الطويلة (Kimi-like)
- قبل كل run: `recall(userId, goal)` يجلب أعلى 10 ذكريات + التفضيلات الجغرافية → system prompt
- بعد كل run: `summarize()` يحفظ ملخص + تفضيلات مكتشفة (دولة، لغة، صناعة)
- LRU عند تجاوز 1000 ذكرى/مستخدم

## 5) تتبع التكلفة الحقيقية
- كل LLM call عبر `callLovableAI` المركزي
- كل tool execution → صف في `token_ledger` مع `meta.maaroof_run_id` + `meta.geo`
- `maaroof_runs.total_usd` = SUM real cost

## 6) الأمان والحدود
- `requireSupabaseAuth` على كل server fns
- Trial: 5 runs/يوم
- باقي الخطط: محسوبة من `total_usd` ضمن حد شهري قابل للضبط من الأدمن
- لا تُسرَّب headers أو IP المستخدم في الواجهة (تُخزَّن server-side فقط)

## التفاصيل التقنية

| العنصر | القيمة |
|---|---|
| نموذج التخطيط | `google/gemini-2.5-pro` |
| نموذج المهام الحرجة | `openai/gpt-5` |
| Embedding | `google/gemini-embedding-001` (768d) |
| Geo detection | Cloudflare `cf-ipcountry` + ipapi.co fallback |
| stopWhen | `stepCountIs(50)` |
| UI | AI Elements + streamText |

## ما لا يتغير
- `/agent` القديم وجداوله
- الـ16 endpoint وعقودها (نضيف معامل `geo` اختيارياً، backward-compatible)
- `chargeTokens`, `tool_plan_access`, `per_user_tool_overrides`
- `SystemHealthTab`, `AdminFinanceTab` (نضيف قسم Maaroof فقط)

## معايير القبول
1. `/maaroof` يكشف موقع المستخدم من IP تلقائياً ويعرضه
2. المستخدم يستطيع تغيير الدولة/المدينة يدوياً، والتفضيل يُحفظ
3. الخطة والأدوات تتكيف مع النطاق الجغرافي (لغة، سوق، منافسون)
4. streaming كامل لـ plan/tool/reflection
5. التكلفة الحقيقية تُحفظ لحظياً
6. الذاكرة الطويلة تعمل عبر runs متعددة
7. الـ16 أداة كلها متاحة كـ tools لمعروف
8. الوكيل القديم يعمل بدون كسر
9. RLS + GRANT صحيحة

## تنفيذ على مرحلتين
- **A (هذا الـ build):** Migration + geo-detector + maaroof backend + `/maaroof` UI مع شريط الموقع + ذاكرة + تتبع تكلفة + هوية
- **B (لاحق):** صفحة ذاكرة، export PDF، تكامل عميق مع AdminFinanceTab، تعديل الخطة وسط التنفيذ
