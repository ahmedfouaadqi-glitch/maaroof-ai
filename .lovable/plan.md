# خطة المراجعة والإصلاح الشاملة

## 1) ربط تتبّع التكلفة الحقيقية بكل الـ 16 endpoint

اليوم `enrichLedger` مربوط فقط بـ `analyze.ts` و `brand-boost.ts`. سأنشئ helper موحّد ثم أربطه بالباقي.

**ملف جديد:** `src/lib/ai-call.server.ts`
- دالة `callLovableAI({ userId, toolKey, runId, model, messages, ... })` تغلّف `fetch` إلى بوابة Lovable AI، تلتقط `usage.prompt_tokens` / `completion_tokens`، تستدعي `enrichLedger` تلقائياً، وترجع `{ json, usage, latencyMs, realUsdCost }`.
- نمط `TokenAcc` للأدوات متعددة الاستدعاءات (مثل brand-boost) مع `flush()` نهائي.

**تعديل 14 ملف routes/api:**
`suggest.ts, research.ts, compare.ts, feasibility.ts, bizdev.ts, visibility.ts, geo-strategist.ts, geo-rewrite.ts, applied-ranking.ts, brand-authority.ts, company-email.ts, social-analysis.ts, what-if.ts, competitor-monitor.ts` + `public/hooks/agent-runner.ts` + `src/lib/translate.functions.ts` + `src/lib/cognition.server.ts` + `src/lib/platform-probe.server.ts`.

استبدال كل `fetch(LOVABLE_AI_CHAT_COMPLETIONS_URL, …)` بـ `callLovableAI(...)`. لا تغيير في منطق `chargeTokens` أو الواجهة.

## 2) تبويب «System Health» في الأدمن

**ملف جديد:** `src/components/admin/SystemHealthTab.tsx` + تسجيله في `src/routes/admin.tsx`.

server fn: `src/lib/system-health.functions.ts` يفحص ويعرض:

| فحص | منطق |
|---|---|
| Endpoints غير مُقاسة | جدول endpoints التي لم يُسجَّل لها أي `meta.real_usd_cost` خلال آخر 30 يوم |
| هامش سالب | `tool_key` حيث `Σ real_usd_cost > Σ usd_cost` |
| توكن بلا سعر | محاولات `unpriced` (من `activity_log`) |
| أدوات بدون `enrichLedger` | scan ثابت لقائمة routes vs قائمة tool_keys في `token_ledger` |
| Firecrawl Spike | `firecrawl_usage` >120% من متوسط 7 أيام |
| RLS/GRANT مفقود | استعلام `information_schema` لجداول `public` بلا `GRANT SELECT … TO authenticated/service_role` |
| Quota لمستخدمين بلا metering | profiles بلا balance ولا limits |
| أخطاء 402 متكررة | تجميع آخر 7 أيام من السجل |

كل صف فيه «إصلاح موصى به» نصياً.

## 3) تنبيهات تلقائية للهامش السالب

**ملف جديد:** `src/lib/margin-alerts.server.ts`
- بعد كل `enrichLedger` ناجح: لو `real_usd_cost > usd_cost × 0.9` نُدرج صف في `user_notifications` للأدمن (نوع `margin_warning`) + جرس في `AlertsBell`.
- threshold قابل للتخصيص من `app_settings.margin_alert_ratio` (افتراضي 0.9).

## 4) احتساب تلقائي للسعر المقترح

في `AdminFinanceTab.tsx`:
- زر **«تطبيق السعر المقترح»** بجوار كل صف per-tool/per-user → يحدّث `per_user_tool_overrides` أو `tool_plan_access` بـ `usd_per_use = avg_real × 1.5` و `tokens_per_use = round(usd × 1000)`.
- زر جماعي **«تطبيق على كل الأدوات لخطة X»**.
- markup قابل للتخصيص (1.2× / 1.5× / 2× / مخصّص).
- يكتب صف audit في `activity_log`.

## 5) Agent مركزي (Manus-like)

**ملف جديد:** `src/routes/api/agent-orchestrator.ts` + `src/components/AgentOrchestrator.tsx` (تبويب جديد في `/agent`).

- يستخدم AI SDK `streamText` مع `tools` تغلّف كل أداة من الـ16 (`analyze`, `suggest`, `research`, …) كـ `tool({ inputSchema, execute })`.
- `stopWhen: stepCountIs(50)` للسماح بـ planning + execution + reflection.
- يخزّن المحادثة في جدول جديد `agent_runs` (`id, user_id, goal, steps jsonb[], status, total_usd, created_at`).
- يستفيد من نفس `callLovableAI` فيحصل على تتبّع تكلفة دقيق.
- UI: تدفّق `message.parts` يعرض كل tool call + نتيجته (مثل ChatGPT/Manus).

## 6) إصلاحات تجربة المستخدم في الأدوات

- توحيد رسائل 402 بصيغة موحّدة (toast + CTA لشحن التوكن) في كل الأدوات بدل سلاسل مبعثرة.
- إصلاح تحذير `DialogContent` بدون `Description` في `TokensBar` (إضافة `DialogDescription`).
- إكمال handoff للأدوات الناقصة في `HANDOFF_MAP` (geo-strategist, geo-rewrite, applied-ranking, brand-authority, what-if, social-analysis).
- زر «ترجمة» موحّد في كل النتائج الطويلة.

## 7) فحص الأمان وRLS

- تشغيل `security--run_security_scan` ومعالجة كل high/critical.
- migration واحد يضيف `GRANT` المفقود + يصلح أي policy ناقص للجداول الـ 38 الحالية.
- التأكد أن `agent_runs` الجديد يتبع نمط `GRANT … TO authenticated; GRANT ALL … TO service_role` + RLS بـ `auth.uid() = user_id`.

## 8) تقرير تكلفة Manus/Kimi (يُسلَّم داخل التبويب الجديد كـ Markdown)

### أ) تقدير بناء وكيل مشابه داخل مشروعك الحالي على Lovable

| البند | التفصيل | التقدير |
|---|---|---|
| تطوير (بمساعدة Lovable) | البنود 1–6 أعلاه | ~150–300 credit (يوم–يومان عمل) |
| تشغيل شهري — نموذج | `gemini-2.5-flash` عبر AI Gateway: $0.075/M in + $0.30/M out | لكل مهمة وكيل (~50K token in + 20K out × 10 خطوات) ≈ **$0.04–0.10 لكل مهمة** |
| تشغيل شهري — Firecrawl | 50 crawl/مهمة | ~$0.05/مهمة |
| Supabase / Cloud | حتى ~10K طلب/شهر | ضمن الـ free tier للـ Lovable Cloud |
| **الإجمالي/مستخدم نشط** (30 مهمة/شهر) | | **~$3–5/شهر تكلفة فعلية** → سعر بيع مقترح $9.99–$19.99 |

### ب) تقدير بناء منتج مستقل بمستوى Manus/Kimi تجارياً

| البند | التفصيل | التقدير |
|---|---|---|
| فريق MVP (3–6 شهور) | 2 ML eng + 2 full-stack + 1 designer + PM | **$300K – $700K** |
| البنية التحتية | GPU clusters (تدريب/تخصيص) + DB + observability | $30K–$100K/شهر |
| النماذج | إما استئجار (Anthropic/OpenAI/Google) أو تدريب open-source (Qwen/DeepSeek) | استئجار: $50K+/شهر عند 100K user · تدريب: $1M+ one-time |
| البحث والـ alignment | RLHF + سلامة + benchmarks | $200K–$500K |
| **MVP بمستوى Manus** | full-stack agent + browser tool + code tool + memory | **$1M – $3M في السنة الأولى** |
| **Kimi-level (long-context LLM + agent)** | يتطلب pretraining كامل | **$10M – $50M+** |

### ج) المقارنة المختصرة

> داخل Lovable يمكنك بناء **«Manus-lite»** على نماذج جاهزة بتكلفة تطوير = أقل من $100 ائتمان + تكلفة تشغيل $3–5/مستخدم/شهر. أما بناء Manus/Kimi كمنتج مستقل من الصفر فيتطلب $1M+ في السنة الأولى ($10M+ لمستوى Kimi). الفرق ليس في الكود بل في امتلاك النموذج وبنية GPU.

## الاستثناءات
- لا تغييرات على نظام `chargeTokens` أو RPC الحالي.
- لا حذف بيانات قديمة — الصفوف غير المُقاسة تبقى كـ audit trail.
- لا تغيير في مفاتيح API أو الـ secrets.

## معايير القبول
1. كل أداة بعد تشغيلها تكتب `real_usd_cost` في `token_ledger.meta`.
2. تبويب System Health يفتح ويعرض كل قسم.
3. هامش سالب يظهر تنبيه في `AlertsBell` خلال 60 ثانية.
4. زر «تطبيق السعر المقترح» يحدّث `per_user_tool_overrides` فعلياً.
5. `/agent` يشغّل خطة متعدّدة الأدوات بدون أخطاء، ويسجّل التكلفة الكلية.
6. تقرير التكلفة ظاهر داخل تبويب System Health.
