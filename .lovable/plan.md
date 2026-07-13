
## نطاق هذه الجلسة (حسب أولوياتك)

مركّز على المحاور **4 → 2/7 → 6 → 5** كما اخترت. لا نلمس ما هو خارجها.

---

## المرحلة 1 — كيف يعمل معروف الآن + ملف التوثيق الشامل (المحور 4)

**المخرَج:** ملف Markdown واحد `docs/MAAROOF-AUDIT.md` (قابل للتحميل) + شرح موازٍ في الشات.

يغطي:
1. **العمارة الحالية لمعروف** بدياغرام نصي:
   - `/maaroof` → `POST /api/maaroof` (SSE) → `runMaaroof` (Plan → Act → Reflect) → استدعاء داخلي لأي من الأدوات الـ16 عبر `toolPath()` → تسجيل في `maaroof_runs/messages/memory` + `token_ledger`.
   - تدفّق التكاليف والحصص عبر `resolveToolCost` / `chargeTokens`.
   - كشف الجغرافيا (`detectGeoFromRequest`) وتأثيره على البرومب.
2. **جرد الأدوات الـ17** (16 + معروف) مع لكل أداة:
   - الحالة: مقاسة/غير مقاسة، مربوطة بـ handoff، مربوطة بـ token_ledger، لديها ترجمة.
   - نسبة جاهزية 0-100% + الفجوات الحرجة.
3. **جرد لوحات الإدارة** (14 tab): ما يعمل، ما ناقص، ما مكرر.
4. **جرد جداول DB الرئيسية** المرتبطة بالوكيل (`maaroof_*`, `agent_*`, `user_agent_subscriptions`, `token_ledger`, `user_intent_profile`).
5. **قائمة الفجوات المرتّبة بالأولوية** — تُصبح خارطة المراحل التالية.

---

## المرحلة 2 — منصة Workspaces + وكلاء فرعيون + تشغيل تلقائي (المحور 2 + 7)

### 2.أ — DB: Workspaces (علامات/عملاء)

هجرة جديدة تضيف:

```text
workspaces
  id, owner_id → auth.users, name, kind ('own'|'client'|'brand'),
  brand_url, brand_summary (نتيجة crawl أولى), keywords text[],
  language, country, city, meta jsonb, created_at
workspace_members            (لتشارك لاحقاً — owner فقط الآن)
  workspace_id, user_id, role ('owner'|'editor'|'viewer')
```

- تعديل `maaroof_runs` / `maaroof_memory` / `agent_tasks`: إضافة `workspace_id` (nullable للتوافق الرجعي).
- GRANT + RLS محكمة (owner_id فقط).
- تعديل `has_role`/سياسات القراءة بحيث تُقيَّد الذاكرة والجلسات على مستوى workspace.

### 2.ب — واجهة Workspaces داخل `/maaroof`

- شريط جانبي علوي: تبديل workspace + زر «+ علامة/عميل جديد».
- عند إنشاء workspace: يُطلَق **crawl تمهيدي مرة واحدة** (Firecrawl عبر endpoint موجود) لبناء `brand_summary` وحفظه كذاكرة `preference` عالية الأهمية.
- كل ما يجري داخل معروف (goals, memory, runs) ينحصر بالـ workspace النشط.

### 2.ج — الوكلاء الفرعيون (Sub-agents)

في `src/lib/maaroof/orchestrator.server.ts`:

- بعد PLAN، إذا تجاوزت الخطة N خطوات أو تضمنت أهدافاً متوازية → المُخطط يُقسّمها إلى `subplans[]`.
- كل subplan يُشغَّل كـ **child run** يُخزَّن في `maaroof_runs` مع `parent_run_id` (عمود جديد).
- المخطط الأب ينتظر نتائج الأبناء ثم يجمّعها في الإجابة النهائية.
- عرض التدرّج في `MaaroofStage` كشجرة بسيطة (أب → أبناء).

### 2.د — التشغيل التلقائي الذكي

قرار «هل نحتاج auto-run؟» يُتّخذ في ثلاث طبقات (حسب إجابتك):

1. **البرومب صريح** («راقب المنافس كل ساعة لمدة 24 ساعة») → الوكيل يستخرج الجدول.
2. **الوكيل يستنتج** أن المهمة تستفيد من التكرار → يقترح خطة تلقائية ويسأل المستخدم قبل الحفظ.
3. **يسأل المستخدم صراحة** إن لم يكن واضحاً.

جدول جديد `maaroof_schedules`:
```text
id, workspace_id, user_id, prompt, plan_template jsonb,
cadence ('once'|'hourly'|'daily'|'weekly'|'custom_cron'),
starts_at, ends_at, max_runs, runs_done,
approval_mode ('per_run'|'auto_within_quota'|'first_time_then_auto'),
status ('active'|'paused'|'exhausted'|'cancelled')
```

**التنفيذ الخلفي** — pg_cron يستدعي `/api/public/hooks/agent-runner` (موجود جزئياً) كل 5 دقائق:
- يجلب schedules المستحقة والنشطة.
- لكل جدولة: يتحقق من حصة الاشتراك (`user_agent_subscriptions.tasks_used` + tokens + `chargeTokens`).
- إن كافية → يُشغّل run جديد كـ subagent مستقل بنفس منطق `runMaaroof`.
- إن غير كافية → status = `exhausted` + إشعار للمستخدم.

هذا يحقق: «يعمل حتى وإن كان المستخدم غير موجود، معتمداً على الاشتراك».

### 2.هـ — سجل التنفيذ لكل مستخدم (قابل للتحميل)

- إضافة زر «تحميل السجل CSV» في لوحة الإدارة لكل مستخدم:
  - يبني CSV من `maaroof_runs` + `token_ledger` (mtool_key بادئته `maaroof.*`) للفترة المطلوبة.
- إضافة تبويب داخل صفحة المستخدم بالإدارة يعرض runs الأخيرة + التكلفة الحقيقية.

---

## المرحلة 3 — إعادة تنظيم `/maaroof` كمنصة وكلاء تنفيذيين (المحور 6)

إعادة هيكلة `src/routes/maaroof.tsx` إلى layout بثلاثة أقسام واضحة:

```text
┌────────────────────────────────────────────────────────────┐
│ Header: Workspace switcher · Language · Geo · Cost badge   │
├──────────────┬─────────────────────────────────────────────┤
│ Left sidebar │  Main stage (MaaroofStage)                  │
│              │                                             │
│ • Runs       │  ┌─── Composer ─────────────────────────┐   │
│ • Schedules  │  │ Prompt textarea                       │   │
│ • Memory     │  │ Manual tools (chips) — «ربط أدوات»   │   │
│ • Sub-agents │  │ Run / Save as schedule / Save prompt │   │
│              │  └───────────────────────────────────────┘  │
└──────────────┴─────────────────────────────────────────────┘
```

- **الربط اليدوي بالأدوات**: أسفل الـcomposer، شرائح chips للأدوات الـ16. عند اختيار المستخدم أداة/أدوات محددة، تُمرَّر للـplanner كـ`force_tools` وتُلزَمها الخطة.
- **حذف من الصفحة** كل ما ليس وكيلاً (مثلاً بطاقات ترويج ملفات المستخدم/بنرات SEO) وإرجاعها لأقسامها الطبيعية (dashboard / tools).
- الحفاظ على `MaaroofStage` الحالي بدون كسر.

---

## المرحلة 4 — ربط MCP الخارجية (المحور 5) — نطاق مضبوط لهذه الجلسة

خطوتان فقط الآن:

1. **قسم في التوثيق** يشرح:
   - الفرق بين MCP في وضع Lovable (يساعدني كـ agent وقت البناء) و **MCP في الوقت التشغيلي** داخل تطبيق المستخدم.
   - قائمة الـ MCP servers الرسمية المتاحة (Notion, Linear, PostHog, Atlassian, Sentry, Canva, Miro…) مع تكلفة كل واحدة + طبيعة OAuth.
   - لماذا لا نستطيع «توصيلها فوراً» لكل مستخدم نهائي دون تفعيل OAuth 2.1 على Supabase لكل خدمة.
2. **قرار البنية** ملخّص للاختيار قبل التنفيذ الفعلي في جلسة تالية:
   - أ) MCP كأدوات لمعروف فقط (كل مستخدم يوصّل حسابه) — يتطلب `ai-sdk-mcp-client` pattern + connection registry.
   - ب) MCP كأدوات إدارية فقط (owner واحد) — أسرع لكنه محدود.
   - ج) هجين.

التنفيذ الفعلي لربط MCP يبقى لخطة منفصلة بعد اختيارك من (أ/ب/ج). سبب هذا التأجيل: كل MCP يحتاج OAuth + جدول Connections + UI موافقة، وهو مشروع بحجم المرحلة 2.

---

## التفاصيل التقنية

**ملفات ستُنشأ:**
- `docs/MAAROOF-AUDIT.md`
- Migration: `workspaces`, `workspace_members`, `maaroof_schedules`, أعمدة `workspace_id` + `parent_run_id`.
- `src/lib/maaroof/workspaces.server.ts` (CRUD + brand bootstrapping).
- `src/lib/maaroof/scheduler.server.ts` (استحقاق + تشغيل subagent).
- `src/lib/maaroof/subagent.server.ts` (فصل منطق subplan عن orchestrator).
- `src/components/maaroof/WorkspaceSwitcher.tsx`
- `src/components/maaroof/ScheduleDialog.tsx`
- `src/components/maaroof/ManualToolChips.tsx`
- `src/components/admin/MaaroofUserRunsPanel.tsx` (يُضاف داخل `MaaroofAdminTab` القائم).
- تعديل: `src/routes/maaroof.tsx`, `src/routes/api/maaroof.ts`, `src/lib/maaroof/orchestrator.server.ts`, `src/routes/api/public/hooks/agent-runner.ts`.

**قواعد أمان تُطبَّق:**
- GRANTs كاملة على كل جدول جديد + RLS بـ `auth.uid() = owner_id` أو عبر `workspace_members`.
- `has_role(admin)` policy موازية لكل جدول جديد.
- لا تجاوز للحصص: كل run فرعي أو schedule يمر عبر `chargeTokens` قبل التنفيذ.
- pg_cron يستدعي endpoint public لكنه يتحقق من HMAC signature (سنولّد سراً بـ `generate_secret`).

**التكاليف والقياس:**
- كل child run يسجَّل في `token_ledger` بـ `run_id = parent_run_id` لتجميع تكلفة الجلسة الأم.
- schedules تسجَّل بـ meta `{schedule_id, cadence}` ليظهر «تكلفة الأتمتة» منفصلة في Finance.

**ما لا نغيّره في هذه الجلسة:**
- منطق الأدوات الـ16 نفسها.
- تسعير الخطط.
- تصميم المكونات البصرية الأخرى خارج `/maaroof`.
- ربط MCP الفعلي (توثيق فقط).

---

## الترتيب الزمني داخل الجلسة

1. المرحلة 1 (توثيق) — أولاً لأنه يوجّه ما بعده.
2. المرحلة 2 (workspaces + subagents + schedules) — الحصة الأكبر.
3. المرحلة 3 (إعادة تنظيم `/maaroof`) — يعتمد على 2.
4. المرحلة 4 (MCP توثيق + قرار).

بعد الموافقة، أبدأ بالمرحلة 1 (كتابة `docs/MAAROOF-AUDIT.md`) فوراً.
