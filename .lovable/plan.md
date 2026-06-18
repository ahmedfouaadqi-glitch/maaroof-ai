# خطة تحسين معروف: مسرح بصري + إدارة كاملة

## القسم 1 — استبدال تيار JSON الخام بمسرح بصري تفاعلي

### 1.1 مكون `MaaroofStage` جديد
ملف: `src/components/maaroof/MaaroofStage.tsx`

يستبدل قسم البطاقات (`EventCard`) الحالي بمسرح بصري ذي طبقتين:

**الطبقة الخلفية — كرة أرضية SVG تفاعلية** (`MaaroofGlobe.tsx`)
- كرة أرضية SVG خفيفة (بدون مكتبات ثقيلة، مسارات قارات مبسّطة من مصدر TopoJSON محلي صغير) تدور ببطء.
- إضاءة الدولة المختارة:
  - وضع `auto` → الدولة المكتشفة من IP تتوهج بلون `--primary` ونبضة `pulse`.
  - وضع `country` → الدولة المختارة تتوهج، والباقي مُعتم.
  - وضع `world` → جميع الدول تتوهج بشكل خافت ومتموّج.
- نقاط مضيئة فوق الدول التي يستخدمها الوكيل (من نتائج الأدوات geo_rewrite/applied-ranking…).

**الطبقة الأمامية — تأثير ماتريكس انتقائي** (`MatrixRain.tsx`)
- `<canvas>` خفيف يرسم أحرفًا عربية/إنجليزية متساقطة بلون `--primary` بشفافية 15%.
- يبدأ فقط أثناء `running` ويتوقف فور `done`.
- كثافة الأحرف تتناسب مع عدد الأدوات الجارية (1–16).

**طبقة "بطاقات الخطوات" العائمة**
- بدلًا من JSON خام: كل خطوة في الخطة تظهر كـ **بطاقة دائرية صغيرة** على مدار الكرة الأرضية (orbit) باسم الأداة وأيقونتها.
- الحالات بصريًا:
  - `planning` → دوران الكرة + ماتريكس خفيف + شيمر "أخطّط…"
  - `tool_call` → البطاقة تنبض بلون أصفر، خط ضوئي (beam) يربطها بالدولة.
  - `tool_result` ok → تتحول لأخضر مع علامة ✓.
  - `tool_result` fail → حمراء مع ✕ ورجّة قصيرة.
  - `reflection` → موجة بنفسجية تنتشر من المركز.
  - `final` → الكرة تتوقف، البطاقات تتلاشى، يظهر النص النهائي في لوحة سفلية.
- زر سفلي صغير "عرض السجل الخام (JSON)" يفتح Drawer للمطوّرين فقط.

**المايكروإنتراكشن**
- Hover على بطاقة خطوة → tooltip بـ`reason` + `input` المختصر.
- نقر على دولة على الكرة → ضبط `geoMode=country` و`country=code`.
- شريط تقدم دائري حول الكرة يعكس `currentStep / totalSteps`.

### 1.2 تكامل مع `maaroof.tsx`
- استبدال `<div ref={scrollRef}>...EventCard...</div>` (السطور 225-242) بـ `<MaaroofStage events={events} running={running} geoMode={geoMode} country={country} detected={detected} onPickCountry={...} finalText={finalText} onExport={exportFinal} />`.
- الإبقاء على شريط الإدخال والـ geo bar الحاليين.
- الإبقاء على `EventCard` كمكوّن داخلي للـ Drawer الخام فقط.

### 1.3 الأداء والاحترام
- بدون Three.js؛ SVG + Canvas 2D فقط.
- احترام `prefers-reduced-motion`: إيقاف ماتريكس + دوران الكرة، إبقاء الإضاءة الثابتة.
- RTL-friendly، يعمل على الموبايل (الكرة تصغر تلقائيًا).

## القسم 2 — ربط معروف بلوحة الإدارة بشكل كامل

### 2.1 تبويب جديد "Maaroof" في `/admin`
تعديل `src/routes/admin.tsx`:
- إضافة `"maaroof"` إلى `Tab` union واللوحة.
- مكون جديد `src/components/admin/MaaroofAdminTab.tsx` بأربع أقسام فرعية (sub-tabs):

**أ. لوحة الحكم Overview**
- KPIs آخر 7/30 يومًا: عدد الجلسات، نجاح/فشل، متوسط الخطوات، إجمالي التكلفة USD، الهامش (التكلفة الفعلية vs الرسوم).
- توزيع جغرافي: أكثر 10 دول استخدامًا (من `detected_geo` + `geo_scope`).
- أكثر 10 أدوات استدعاءً ومعدلات نجاحها.
- منحنى يومي للتكلفة والاستخدام.

**ب. الجلسات Runs**
- جدول كامل لكل `maaroof_runs` مع فلترة (status, user, country, تاريخ، تكلفة min/max).
- صف قابل للنقر → Drawer يعرض كل `maaroof_messages` للجلسة مع نفس `MaaroofStage` (read-only).
- إجراءات للأدمن: **إنهاء قسري** لجلسة عالقة، **إعادة تشغيل**، **حذف**، **تعليم كمشكلة**.

**ج. الذاكرة Memory**
- جدول `maaroof_memory` لكل المستخدمين مع بحث.
- إجراءات: حذف، تعديل importance، تصدير CSV.
- إعدادات عامة: حد LRU الافتراضي (1000)، TTL.

**د. التحكم والحدود Controls**
- محرّر إعدادات في جدول جديد `maaroof_settings` (key/value JSON):
  - `trial_daily_cap` (افتراضي 5)
  - `tool_timeout_ms` (افتراضي 45000)
  - `max_steps` (افتراضي 12)
  - `max_goal_chars` (افتراضي 2000)
  - `planner_model` / `fallback_model`
  - `enabled_tools[]` — قائمة الأدوات الـ16 مع toggle لتعطيل أي منها مؤقتًا.
  - `system_prompt_extra` — نص يُلحَق بالـ system prompt.
  - `kill_switch` — تعطيل معروف بالكامل (يعيد 503 برسالة عربية).
- زر "حفظ" → upsert في `maaroof_settings` مع تسجيل في `audit log`.

### 2.2 جدول الإعدادات والقراءة من Orchestrator
- migration: جدول `maaroof_settings (key text primary key, value jsonb, updated_at, updated_by)` مع GRANT + RLS (قراءة `authenticated`، كتابة `admin` فقط عبر `has_role`).
- `orchestrator.server.ts`: قراءة الإعدادات في بداية كل run (مع كاش 60 ثانية)، تطبيق `kill_switch` + `enabled_tools` + `tool_timeout_ms` + `max_steps` + الـ system prompt الإضافي.
- `api/maaroof.ts`: تطبيق `trial_daily_cap` و`max_goal_chars` من الإعدادات بدل القيم الصلبة.

### 2.3 ربط الذاكرة الإدارية بـ `SystemHealthTab` الحالي
الإبقاء على قسم Maaroof في `SystemHealthTab` (موجود من المرحلة B) لكن مع رابط "إدارة كاملة →" يفتح التبويب الجديد.

## القسم 3 — ما الذي لا يتغيّر
- API endpoint `/api/maaroof` (نفس الـ SSE contract).
- مخطط `maaroof_runs/messages/memory`.
- صفحة `/maaroof/memory` للمستخدم العادي.
- الأدوات الـ16 و`token_ledger`.

## تفاصيل تقنية

**ملفات جديدة:**
- `src/components/maaroof/MaaroofStage.tsx`
- `src/components/maaroof/MaaroofGlobe.tsx` (SVG + countries paths مبسّط)
- `src/components/maaroof/MatrixRain.tsx` (canvas)
- `src/components/maaroof/StepOrbit.tsx`
- `src/components/admin/MaaroofAdminTab.tsx` (+ sub: Overview/Runs/Memory/Controls)
- `src/lib/maaroof/settings.server.ts` (قراءة/كتابة + كاش)
- `supabase/migrations/<ts>_maaroof_settings.sql`

**ملفات معدّلة:**
- `src/routes/maaroof.tsx` — استبدال قسم الـ stream بالـ Stage.
- `src/routes/admin.tsx` — إضافة تبويب maaroof.
- `src/lib/maaroof/orchestrator.server.ts` — قراءة الإعدادات وتطبيقها.
- `src/routes/api/maaroof.ts` — kill_switch + إعدادات ديناميكية.

**تسلسل التنفيذ:**
1. migration إعدادات + قراءتها في orchestrator (لا يغيّر السلوك إذا لم توجد).
2. `MaaroofStage` + Globe + Matrix + تكامله في `/maaroof`.
3. `MaaroofAdminTab` بأقسامه الأربعة.
4. اختبار: جلسة كاملة من البداية للنهاية + تعطيل أداة من الأدمن ورؤية الأثر مباشرة.

**معايير القبول:**
- لا يظهر JSON خام في `/maaroof` افتراضيًا — مسرح بصري + بطاقات + كرة تضيء.
- نقر دولة على الكرة يضبط النطاق فورًا.
- في الأدمن: يمكن تعطيل أداة، تغيير `trial_daily_cap`، تفعيل kill_switch، وتظهر النتائج في الجلسة التالية.
- جدول الجلسات في الأدمن يفتح إعادة تشغيل المسرح لأي جلسة سابقة.
- يحترم prefers-reduced-motion ويعمل على الموبايل.
