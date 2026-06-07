## المرحلة 1 — إكمال البنود المتبقية من السابق

1. **Forgot Password**: زر "نسيت كلمة المرور" في `/auth` يستدعي `supabase.auth.resetPasswordForEmail` مع `redirectTo:/reset-password`. صفحة `/reset-password` موجودة.
2. **Kimi إضافة كاملة**: تحديث `BrandPulseGauges`, `AIVisibility`, `GeoStrategist`, `CompetitorMonitor`, `what-if`, `social-analysis` لاحتساب Kimi ضمن المحركات + ترجمات + ظهور في GEO Trust Score.
3. **محتوى موقع جديد**: إعادة كتابة `src/routes/index.tsx`, `src/routes/guide.tsx` بالكامل بدون بيانات تجريبية، خطوة بخطوة لكل أداة، مع ذكر التحسينات الجديدة (Social, Monitor, Strategist, What-If, Report Builder, Alerts, Kimi).
4. **فيديوهات تعريفية**: مكوّن `<HowItWorks />` + 5 فيديوهات قصيرة (videogen) لكل أداة + صفحات هبوط مبسطة `/tools/$slug` (brand-boost, ai-visibility, competitor-monitor, what-if, report-builder) مع روابط من الصفحة الرئيسية والـ guide.

---

## المرحلة 2 — لوحة المدير الموحّدة (Token + Pricing لحظي)

### قاعدة البيانات (Migration واحد)
- **توسيع `subscription_plans`**: أعمدة `monthly_tokens int`, `daily_tokens int`, `price_usd numeric(10,2)`.
- **توسيع `tool_plan_access`**: أعمدة `tokens_per_use int`, `usd_per_use numeric(10,4)`.
- **توسيع `profiles`**: `tokens_balance int default 0`, `tokens_monthly_limit int`, `tokens_daily_limit int`, `tokens_used_today int default 0`, `tokens_used_month int default 0`, `per_user_tool_overrides jsonb default '{}'` (هيكل: `{tool_key:{enabled,daily,monthly,tokens_per_use}}`).
- **جدول `token_ledger`** جديد: `(user_id, tool_key, tokens, usd_cost, run_id, created_at)` + RLS (المستخدم يقرأ سجلهُ، الأدمن يقرأ الكل، service_role يكتب).
- **جدول `tool_pricing_catalog`** افتراضي: `(tool_key, default_tokens, default_usd, model, notes)` لاستخدامه كمرجع التكلفة في الواجهة عند إنشاء خطة.
- إضافة `guard_profile_privileged_updates` لتشمل الحقول الجديدة (يستثني admin/service_role).
- GRANTs كاملة + RLS لكل جدول جديد.

### Backend
- **`src/lib/tokens.server.ts`**: `chargeTokens({userId, toolKey, runId})` تقرأ override → خطة → كتالوج، تتحقق من الرصيد اليومي/الشهري/الإجمالي، تخصم وتسجّل في `token_ledger`. ترجع `{ok, remaining, reason}`.
- **تعديل كل `src/routes/api/*` (analyze, suggest, compare, feasibility, bizdev, research, brand-boost, visibility, applied-ranking, social-analysis, competitor-monitor, geo-strategist, what-if)**: قبل التشغيل تستدعي `chargeTokens`؛ على فشل → 402 برسالة "رصيد التوكن غير كافٍ".
- **`src/lib/agent.server.ts`**: نفس آلية الخصم لكل مهمة وكيل ذكي.
- **`src/routes/api/admin/*` (مع `requireSupabaseAuth` + فحص دور admin)**:
  - `plans-upsert.ts` (CRUD خطط مع tools array)
  - `user-plan-assign.ts` (تفعيل خطة لمستخدم + ضبط الحصص/التوكن/الأدوات لهُ)
  - `user-tokens-grant.ts` (منح/سحب توكن).

### Frontend (`src/routes/admin.tsx` — إعادة هيكلة شاملة)
تبسيط إلى 4 تبويبات فقط:
1. **المستخدمون**: جدول + بحث + لكل صف "إدارة" → Drawer يدمج:
   - الخطة الحالية + تغييرها.
   - حصص يومية/شهرية (تحرير لحظي).
   - رصيد التوكن (منح/سحب).
   - مصفوفة الأدوات: تفعيل/تعطيل، عدد يومي، شهري، توكن لكل استخدام — كل تعديل يعرض **التكلفة الفورية (توكن + $)** أمام السطر و**الإجمالي** في الأسفل.
2. **الخطط**: قائمة + إنشاء/تعديل. لكل أداة في الخطة: toggle + daily + monthly + tokens/use + usd/use، مع badge تكلفة لحظي يستند إلى `tool_pricing_catalog`. ملخص أسفل الصفحة: "تكلفة المستخدم الواحد يومياً/شهرياً = X token ≈ $Y".
3. **الكتالوج**: تحرير `tool_pricing_catalog` (المرجع الذي تستند إليه الحسابات).
4. **السجلات**: عرض `token_ledger` (تصفية حسب مستخدم/أداة/تاريخ) + إحصاءات استهلاك.
- كل النصوص ar/en/ku عبر `i18n.tsx`.
- مكوّن مشترك `<CostBadge tokens usd />` يُظهر كلاهما حسب اللغة.

### واجهة المستخدم النهائية
- في الـ Dashboard: شريط رصيد التوكن (متبقي يومي/شهري/إجمالي) + تنبيه عند < 10%.
- كل بطاقة أداة تعرض تكلفة الاستخدام (token + $) قبل التشغيل.
- عند انعدام الرصيد: زر التشغيل معطّل + توجيه لترقية الخطة.

---

## التكاليف الافتراضية (مبدئية للكتالوج، قابلة للتعديل من الأدمن)
| الأداة | tokens | USD |
|---|---|---|
| analyze | 1500 | 0.003 |
| suggest | 1200 | 0.0025 |
| compare | 2500 | 0.005 |
| visibility | 2000 | 0.004 |
| brand-boost | 3000 | 0.006 |
| social-analysis | 1000 | 0.002 |
| competitor-monitor | 2000 | 0.004 |
| geo-strategist | 3000 | 0.006 |
| what-if | 2000 | 0.004 |
| applied-ranking | 1500 | 0.003 |
| agent-task | 2500 | 0.005 |

---

## ملفات

**جديدة**: `supabase/migrations/*_tokens_pricing.sql`, `src/lib/tokens.server.ts`, `src/routes/api/admin/{plans-upsert,user-plan-assign,user-tokens-grant,token-ledger}.ts`, `src/components/admin/{UserManagerDrawer,PlanEditor,CostBadge,PricingCatalogEditor,LedgerTable}.tsx`, `src/components/HowItWorks.tsx`, `src/routes/tools.$slug.tsx`, 5 فيديوهات في `src/assets/videos/`.

**معدّلة**: `src/routes/admin.tsx` (إعادة هيكلة كاملة), `src/routes/{auth,index,guide,dashboard}.tsx`, كل `src/routes/api/*.ts` (chargeTokens), `src/lib/agent.server.ts`, `src/lib/i18n.tsx`, `src/components/{AIVisibility,BrandPulseGauges,GeoStrategist,CompetitorMonitor,WhatIfSimulator,engine-logos}.tsx` (Kimi), `src/integrations/supabase/types.ts`.

---

## أسئلة قبل التنفيذ
1. هل أبدأ بـ **المرحلة 2 (الأدمن + التوكن)** فوراً لأنها الأهم، ثم المرحلة 1؟ أم بالترتيب أعلاه؟
2. هل التكاليف الافتراضية أعلاه مقبولة كنقطة بداية (يمكنك تعديلها لاحقاً من الكتالوج)؟
3. الفيديوهات: هل تريد توليدها بـ AI (videogen, 5×~$0.5) أم تكتفي بصور Lottie/GIF بسيطة الآن وترفع فيديوهاتك لاحقاً؟
