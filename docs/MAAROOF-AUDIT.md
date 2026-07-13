# معروف — تدقيق شامل للنظام والأدوات

> آخر تحديث: يوليو 2026 · اللغة: عربي + مصطلحات تقنية إنكليزية.
> هذا الملف مرجع مركزي لفهم "معروف" (الوكيل الذكي) وكل الأدوات المرتبطة به،
> وخارطة الفجوات المؤولة لخطة التطوير.

---

## 1. عمارة النظام الحالية

### 1.1 خارطة تدفق `معروف`

```text
┌──────────────────────────────────────────────────────────────────┐
│  المستخدم في  /maaroof  يكتب هدفاً + يختار workspace/جغرافيا      │
└────────────────────┬─────────────────────────────────────────────┘
                     │  POST /api/maaroof  (SSE stream)
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│  src/routes/api/maaroof.ts                                        │
│  1) Bearer auth → admin.auth.getUser()                            │
│  2) getMaaroofSettings() → kill switch/model/limits               │
│  3) resolveToolCost + chargeTokens  (يعامل معروف كأداة عادية)     │
│  4) detectGeoFromRequest (CF headers/IP)                          │
│  5) يُنشئ ReadableStream ويستدعي runMaaroof()                     │
└────────────────────┬─────────────────────────────────────────────┘
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│  src/lib/maaroof/orchestrator.server.ts        (Plan → Act → Reflect)
│                                                                   │
│  A) INSERT maaroof_runs (status=running)                          │
│  B) recall() ← maaroof_memory   (LRU مرجّح بالأهمية)              │
│  C) PLAN     → Gemini (planner_model من maaroof_settings)         │
│  D) EXECUTE  → لكل خطوة يستدعي /api/<tool> داخلياً                 │
│  E) REFLECT  → كل 3 خطوات                                          │
│  F) FINAL    → Markdown بلغة المستخدم                              │
│  G) INSERT token_ledger لكل خطوة + الجولة الكلية                   │
│  H) remember() ← maaroof_memory (summary + geo preference)         │
└────────────────────┬─────────────────────────────────────────────┘
                     │  SSE events: run, phase, plan, tool_call,
                     │  tool_result, reflection, final, done, error
                     ▼
              MaaroofStage.tsx  (الواجهة البصرية)
```

### 1.2 قنوات التكلفة والحصص

| مرحلة | مصدر التكلفة | يُسجَّل في | يخصم من |
|---|---|---|---|
| استدعاء معروف نفسه | `resolveToolCost("maaroof")` → `chargeTokens` | `token_ledger` (`tool_key=maaroof`) | `profiles.tokens_balance` + daily/monthly |
| كل استدعاء أداة داخلية | `enrichLedger` من `tool-quality.server.ts` | `token_ledger` (`tool_key=maaroof.<tool>`) | لا خصم إضافي (المعروف دفع مسبقاً) |
| استدعاء LLM (planner/reflector) | من `usage` في رد Lovable AI Gateway | `token_ledger` (`tool_key=maaroof.llm`) | لا خصم — تكلفة مزود |
| Fallback trial | `settings.trial_daily_cap` من `maaroof_settings` | `maaroof_runs` count | لا خصم |

### 1.3 اكتشاف الجغرافيا

- `detectGeoFromRequest` يقرأ رؤوس Cloudflare: `cf-ipcountry`, `cf-ipcity`.
- ثم `effectiveGeo(detected, scope)` يدمج مع اختيار المستخدم (auto/country/city/world).
- النتيجة تُحقن في الـ system prompt (`buildSystemPrompt`) لتوجيه الخطة (اللغة، العملة، المنافسين، القنوات).
- تُحفظ في `maaroof_runs.detected_geo` + `geo_scope`.

### 1.4 الذاكرة الحالية (`maaroof_memory`)

- **الأنواع:** `fact | preference | task_result | summary`.
- **الاسترجاع:** ترتيب بالأهمية ثم بآخر وصول (LRU مرجّح). يحدَّث `last_accessed_at` عند كل قراءة.
- **السقف:** 1000 صف/مستخدم — يُقلَّم الأقل أهمية والأقدم وصولاً.
- **الفجوة الحرجة:** لا يوجد بحث دلالي (embeddings) — كل شيء chronological/importance-based فقط. الذاكرة ليست "ذكية" بعد.

---

## 2. جرد الأدوات الـ17

| # | Key | الاسم | ملفات الواجهة | Endpoint | يستدعي LLM | مقاسة؟¹ | Handoff² | ترجمة | جاهزية | فجوات |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `analyze` | تحليل GEO | `AIVisibility.tsx` | `/api/analyze` | ✔ | ✔ | ✔ | ✔ | 95% | يحتاج تخزين cache أطول |
| 2 | `suggest` | مولّد المنشورات | `PostSuggester.tsx` | `/api/suggest` | ✔ | ✔ | ✔ | ✔ | 95% | — |
| 3 | `compare` | مقارنة المنافسين | `CompetitorCompare.tsx` | `/api/compare` | ✔ | ✔ | ✔ | ✔ | 90% | لا export مباشر |
| 4 | `feasibility` | دراسة جدوى | `FeasibilityStudy.tsx` | `/api/feasibility` | ✔ | ✔ | ✔ | ✔ | 90% | — |
| 5 | `bizdev` | تطوير الأعمال | `BizDev.tsx` | `/api/bizdev` | ✔ | ✔ | ✔ | ✔ | 90% | — |
| 6 | `research` | بحث ذكي | `SmartResearch.tsx` | `/api/research` | ✔ | ✔ | ✔ | ✔ | 90% | يعتمد Firecrawl (تكلفة متغيرة) |
| 7 | `visibility` | تحليل الظهور | `AIVisibility.tsx` (مشترك) | `/api/visibility` | ✔ | ✔ | ✔ | ✔ | 90% | — |
| 8 | `brand_boost` | تعزيز العلامة | `BrandBoostAgent.tsx` | `/api/brand-boost` | ✔ متعدد | ✔ (TokenAcc) | ⚠ جزئي | ✔ | 85% | UI report يمكن تحسينها |
| 9 | `company_email` | إيميل شركات | `CompanyOutreach.tsx` | `/api/company-email` | ✔ | ⚠ غير مقاسة كاملاً | ✔ | ✔ | 75% | لا enrichLedger |
| 10 | `applied_ranking` | الترتيب التطبيقي | `AppliedRanking.tsx` | `/api/applied-ranking` | ✔ | ⚠ | ✔ | ✔ | 75% | لا enrichLedger |
| 11 | `geo_strategist` | إستراتيجي GEO | `GeoStrategist.tsx` | `/api/geo-strategist` | ✔ | ✔ | ✔ | ✔ | 90% | — |
| 12 | `competitor_monitor` | مراقبة المنافسين | `CompetitorMonitor.tsx` | `/api/competitor-monitor` | ✔ | ⚠ | ✔ | ✔ | 70% | لا تنبيهات push، لا cron حالياً |
| 13 | `social_analysis` | تحليل الظهور الاجتماعي | `SocialAnalysis.tsx` | `/api/social-analysis` | ✔ | ⚠ | ✔ | ✔ | 70% | — |
| 14 | `what_if` | محاكاة What-If | `WhatIfSimulator.tsx` | `/api/what-if` | ✔ | ⚠ | ✔ | ✔ | 70% | — |
| 15 | `brand_authority` | حزمة سلطة العلامة | `BrandBoostAgent.tsx` (بديل) | `/api/brand-authority` | ✔ متعدد | ⚠ | ✔ | ✔ | 70% | تحتاج audit تكلفة حقيقية |
| 16 | `geo_rewrite` | إعادة كتابة GEO | خارجي/تلقائي | `/api/geo-rewrite` | ✔ | ⚠ | ✔ | ✔ | 75% | لا واجهة مستقل |
| 17 | **`maaroof`** | الوكيل الذكي | `MaaroofPage` + `MaaroofStage` | `/api/maaroof` (SSE) | ✔ orchestrator | ✔ | — | ✔ | 80% | لا workspaces، لا subagents، لا schedules |

¹ **مقاسة** = تُسجَّل `real_usd_cost` في `token_ledger.meta` من رد الـ gateway (يحصل عبر `enrichLedger` في `tool-quality.server.ts`). حالياً `analyze/suggest/compare/feasibility/bizdev/research/visibility/brand_boost/geo_strategist` فقط.
² **Handoff** = تظهر في `tool-handoff.ts` كأداة يمكن الانتقال إليها من أخرى.

### 2.1 ملخص الفجوات على مستوى الأدوات

- **7 أدوات غير مقاسة بالكامل** (`company_email`, `applied_ranking`, `competitor_monitor`, `social_analysis`, `what_if`, `brand_authority`, `geo_rewrite`) — أي أنّ التكلفة الحقيقية في Finance تظهر لها كـ *Unmetered*.
- **لا cron حالياً** لأي أداة (فقط `agent-runner` جزئي).
- **لا واجهة موحّدة لعرض تاريخ الاستخدام** لكل أداة بتفاصيل التكلفة الحقيقية.

---

## 3. جرد لوحة الإدارة (`/admin`)

من `src/routes/admin.tsx` + مكونات `src/components/admin/`:

| Tab | حالة | ملاحظات |
|---|---|---|
| Finance (`AdminFinanceTab`) | ✔ فعّال | يعرض التكلفة الحقيقية vs المحصّلة، مع اقتراحات تسعير — **يشير Unmetered للصفوف القديمة** |
| Tokens (`AdminTokensPanel`) | ✔ فعّال | إدارة الأرصدة |
| Ledger (`AdminLedgerPanel`) | ✔ فعّال | عرض `token_ledger` مع فلاتر |
| Plans Matrix (`AdminPlansMatrixPanel`) | ✔ فعّال | خطط × أدوات — يشمل `maaroof` |
| Plan Pricing (`AdminPlanPricingPanel`) | ✔ | تحرير أسعار الخطط |
| Provider Cost (`ProviderCostTab`) | ✔ | من `provider_rates` |
| Content Studio (`ContentStudioTab`) | ✔ | إدارة CMS |
| Header Config | ✔ | |
| Export Config | ✔ | |
| Firecrawl Monitor | ✔ | يعرض `firecrawl_usage` |
| System Health (`SystemHealthTab`) | ✔ فعّال | يكشف endpoints غير المقاسة + margins سالبة + إحصائيات معروف |
| Cognitive Insights | ✔ | ملخصات `user_intent_profile` |
| User Intelligence | ✔ | ملفات مستخدمين + ذاكرة |
| Maaroof (`MaaroofAdminTab`) | ✔ فعّال | Overview / Runs / Memory / Controls |

### 3.1 فجوات لوحة الإدارة

- **لا زر تحميل CSV لسجل مستخدم واحد** (planned Phase 2.هـ).
- **لا لوحة MCP** (planned Phase 4).
- **لا لوحة Workspaces** (planned Phase 2).
- **لا لوحة Schedules** (planned Phase 2).

---

## 4. جداول DB المرتبطة

### 4.1 عائلة `maaroof_*`

- `maaroof_runs` — جلسة واحدة (goal, plan, status, tokens, usd, geo, model).
- `maaroof_messages` — رسائل داخل الجلسة (role: user/plan/tool_call/tool_result/reflection/assistant).
- `maaroof_memory` — ذاكرة طويلة (kind, content, importance, last_accessed_at).
- `maaroof_settings` — إعدادات ديناميكية (kill_switch, planner_model, max_steps, timeout, trial cap, system_prompt_extra, enabled_tools).

### 4.2 عائلة `agent_*` (نظام قديم للـ agent مع الأهداف والمهام)

- `agent_addons` — باقات (Trial/…) بحدود مهام يومية/شهرية.
- `agent_targets` — أهداف قابلة للتشغيل التلقائي.
- `agent_tasks` — مهام مفردة مع `approval_status` و `run_id`.
- `user_agent_subscriptions` — اشتراك المستخدم في addon + عداد المستهلك.

**ملاحظة معمارية:** هذا النظام يسبق معروف الحالي. الخطة تدمجهما تحت مظلة **workspaces + schedules** الجديدة.

### 4.3 عائلة التكلفة

- `token_ledger` — الأساس الوحيد للمالية. `meta.real_usd_cost` يظهر عند القياس، لا يظهر للأدوات القديمة (Unmetered).
- `provider_rates` — أسعار كل مودل (in/out per 1M tokens).
- `firecrawl_usage` — استهلاك Firecrawl.
- `tool_pricing_catalog` + `tool_plan_access` — التسعير لكل أداة/خطة.

### 4.4 عائلة الذكاء السلوكي

- `user_intent_profile` — نية مستخدم متراكمة (detected_intent, context_summary, last_signals).
- `activity_log` — سجل الأحداث.

---

## 5. الفجوات المرتّبة بالأولوية (خارطة الطريق)

### أولوية 1 — إتمام معروف كمنصة وكلاء (المرحلة 2 من الخطة)

| الفجوة | الأثر | الحل |
|---|---|---|
| لا فصل بيانات لعميل واحد يخدم عدة علامات | مستحيل لوكالات إعلانات استخدامه | جدول `workspaces` + `workspace_id` في `maaroof_runs/memory` |
| لا وكلاء فرعيون | خطط طويلة تستهلك موارد وتفشل | `parent_run_id` + `subagent.server.ts` |
| لا تشغيل تلقائي مجدول | «راقب المنافس كل ساعة» مستحيل | جدول `maaroof_schedules` + pg_cron → `agent-runner` |
| ذاكرة ليست دلالية | استدعاء غير دقيق لسياق قديم | إضافة embeddings (مرحلة تالية) |

### أولوية 2 — إعادة تنظيم `/maaroof` (المرحلة 3)

| الفجوة | الحل |
|---|---|
| الصفحة متشعبة | Layout 3 أعمدة (sidebar + stage + composer) |
| لا ربط يدوي بالأدوات | `ManualToolChips` تُمرّر `force_tools` للـ planner |
| بطاقات وبنرات ليست من الوكيل | نُرجعها إلى `/dashboard` و `/tools` |

### أولوية 3 — إتمام قياس كل الأدوات (خارج نطاق هذه الجلسة)

- تعميم `enrichLedger` على الـ7 أدوات المتبقية.
- إضافة تنبيهات آلية عند margin سالب.

### أولوية 4 — MCP الخارجية (المرحلة 4 توثيق فقط)

انظر §6 أدناه.

---

## 6. MCP — الوضع الحالي والقرار المطلوب

### 6.1 نوعان مختلفان تماماً

| النوع | من يستعمله | متى | مثال |
|---|---|---|---|
| **MCP في Lovable Editor** | أنا (Lovable agent) وقت البناء | فقط في المحادثة معك هنا | Notion لقراءة سياق تصميم، Linear لسحب issues |
| **MCP في تطبيقك (runtime)** | معروف داخل الموقع لصالح المستخدم النهائي | كل تشغيل وكيل | Notion لكتابة تقرير في workspace المستخدم، PostHog لسحب أرقامه |

**المستهدف في هذه الخطة هو النوع الثاني فقط.**

### 6.2 قائمة MCP servers الرسمية المتاحة (يمكن ربطها بمعروف لاحقاً)

| Server | Auth | تكلفة الاشتراك المضاف | فائدة داخل معروف |
|---|---|---|---|
| Notion | OAuth 2.1 | مجاني (حساب المستخدم) | كتابة تقارير، سحب استراتيجيات محفوظة |
| Linear | OAuth | مجاني | فتح issues تلقائية للفريق |
| PostHog | OAuth/API key | مجاني | سحب تحليلات لتغذية `analyze` |
| Atlassian (Jira/Confluence) | OAuth | مجاني/مدفوع | إدارة مهام + وثائق |
| Sentry | OAuth | مجاني | مراقبة أخطاء منتج المستخدم |
| Canva | OAuth | مجاني | توليد تصاميم لمنشورات `suggest` |
| Miro | OAuth | مجاني | خرائط ذهنية |
| Amplitude | OAuth | مجاني | تحليلات متقدمة |
| Hex | OAuth | مجاني | notebooks بيانات |
| n8n | API key | Self-hosted | workflows مخصصة |
| Sanity | OAuth | مجاني | CMS للعلامات |

### 6.3 لماذا لا نربطها فوراً؟

ربط MCP في **runtime التطبيق** يتطلب لكل خدمة:

1. تسجيل OAuth client في Lovable (`supabase--configure_oauth_server` + client لكل مزود).
2. جدول `mcp_connections` (id, user_id/workspace_id, provider, tokens, scope, state) + RLS.
3. صفحة "Connections" في التطبيق لموافقة المستخدم لكل خدمة.
4. تحميل الأدوات ديناميكياً في `runMaaroof` عبر `@ai-sdk/mcp` `createMCPClient` + `client.tools()`.
5. تحديث `tool-catalog` ليعرف الأدوات الخارجية للتسعير.

هذا مشروع بحجم مرحلة 2 كاملة — لذلك أُجّل تنفيذه لجلسة تالية بعد قرارك.

### 6.4 قرار البنية المطلوب منك

| الخيار | من يوصّل؟ | العزل | التعقيد |
|---|---|---|---|
| **أ) MCP لكل مستخدم** | كل مستخدم نهائي يوصّل حسابه الخاص | كامل (tokens لكل user) | عالٍ — يحتاج OAuth flow كامل |
| **ب) MCP إدارية فقط** | Owner واحد (أنت) لكل الموقع | لا عزل — كل المستخدمين يشاركون نفس البيانات | منخفض |
| **ج) هجين** | مزودان محددان (Notion/PostHog) للمستخدمين + الباقي إدارية | جزئي | متوسط |

**التوصية:** (أ) للمزودين الذين تُخزَّن فيهم بيانات المستخدم النهائي (Notion/Linear/Jira/PostHog)، لأنك لا تستطيع خلط أعمال عملاء مختلفين في نفس Notion workspace. (ب) للمزودين الإداريين البحتين لا تنطبق هنا.

---

## 7. ملخص جاهزية النظام

| منطقة | جاهزية |
|---|---|
| الأدوات الـ16 (وظيفياً) | 85% |
| قياس تكلفة حقيقية | 55% (9/17 مقاسة بالكامل) |
| لوحة الإدارة | 90% |
| معروف كوكيل مفرد | 80% |
| معروف كمنصة (workspaces + subagents + schedules) | 0% ← هدف هذه الجلسة |
| ربط MCP خارجية | 5% (توثيق فقط) |
| ذاكرة دلالية | 20% (LRU بالأهمية فقط) |

**النتيجة الإجمالية:** ~65% نحو منتج "منصة وكلاء تنفيذيين" كامل. المرحلة 2 من الخطة ترفعها إلى ~85%.

---

## 8. مسرد المصطلحات

- **Workspace**: مساحة عمل معزولة (علامة تجارية أو عميل) داخل حساب مستخدم واحد.
- **Sub-agent**: run فرعي مستقل يُشغَّل من خطة أب لتنفيذ خطوات متوازية.
- **Schedule**: جدولة تشغيل تلقائي لبرومب محفوظ بتردد محدد لمدة معينة.
- **Approval mode**: `per_run` (يسأل قبل كل تشغيل) / `auto_within_quota` (يشغّل تلقائياً حتى نفاد الحصة) / `first_time_then_auto`.
- **Real cost**: `token_ledger.meta.real_usd_cost` من `usage` في رد Lovable AI Gateway.
- **Unmetered**: صف قديم لا يحمل `real_usd_cost` — لا يُحتسب في تحليل الهامش.
