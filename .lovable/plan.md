# خطة التنفيذ الشاملة

## 1) CMS كامل للنصوص والمحتوى (Content Studio)

**جدول جديد `site_content`**
```
key text PK         -- مثل: home.hero.title, tool.brand_boost.tab.outreach
namespace text      -- home | tool:<key> | header | footer | page:<slug>
ar text, en text, ku text
updated_by uuid, updated_at timestamptz
```
+ GRANT + RLS (read: anon/auth; write: admin فقط).

**Resolver واحد `useContent(key, fallback)`**:
- يقرأ من `site_content` (cache في localStorage + realtime invalidate)
- يرجع للـ `i18n` الحالي كـ fallback (لا كسر للموجود)
- جميع المكونات تستبدل `t("…")` تدريجياً بـ `useContent("…", t("…"))`

**سكربت bootstrap لمرة واحدة** يمشي على ملف `src/lib/i18n.tsx` ويحقن كل المفاتيح الحالية في `site_content` (ar/en/ku) فيظهرون فوراً في لوحة الإدارة.

**تبويب جديد في `admin.tsx` → "Content Studio"** يحتوي:
- بحث + فلترة حسب namespace (الواجهة الرئيسية، الهيدر، الفوتر، كل أداة على حدة، الفوتر، صفحات مخصصة…).
- محرر جدول بثلاث خانات (ar/en/ku) لكل مفتاح.
- زر **"ترجمة تلقائية"** لكل صف أو دفعة → يستدعي `translateText` serverFn الموجود مسبقاً.
- زر **"إنشاء صفحة جديدة"**: يفتح حوار (slug + عنوان + محتوى Markdown) → يخزن في جدول `custom_pages` ويظهر تلقائياً تحت route ديناميكي `/p/$slug` بكل اللغات (مع ترجمة تلقائية للنسخ الفارغة).

**تبويبات الأدوات الداخلية**: كل tab key يُسجّل في `site_content` بـ namespace=`tool:<toolKey>` فيمكن تعديل تسميته بكل اللغات من Content Studio.

**التحكم في الهيدر** (إخفاء/إظهار الوكيل + روابط):
- توسيع `app_settings.key='header_config'` إلى `{ show_agent: bool, show_pricing: bool, extra_links: [{href,label_ar,label_en,label_ku}], extra_phones: [{number, desc_ar, desc_en, desc_ku}] }`
- لوحة جديدة في الإدارة "Header & Navigation" مع زر ترجمة تلقائية لأي وصف.
- `SiteHeader.tsx` و `contact.tsx` يقرؤون منها.

## 2) التصدير لكل أداة + ربط مع منشئ التقارير

- توسيع `app_settings.key='export_config'` إلى:
  ```
  { mode: "per_tool" | "report_only" | "both",
    per_tool_enabled: { [toolKey]: boolean } }
  ```
- لوحة إدارة جديدة "Exports" تتيح:
  - وضع موحّد (التصدير من منشئ التقارير فقط) أو
  - تفعيل/تعطيل التصدير لكل أداة على حدة.
- مكوّن `<ExportButtons>` يقرأ الإعداد ويظهر/يختفي تلقائياً.
- كل أداة لا تحتوي تصديراً تحصل على `<ExportButtons>` + زر **"إرسال إلى منشئ التقارير"** (يخزن المخرج في `report_drafts` جديد).

## 3) تطابق لغة الواجهة ولغة المخرجات

**المشكلة**: تبويبات الأدوات (مثل تعزيز العلامة) تبقى بلغة قديمة بعد تغيير اللغة.

**الإصلاح**:
- كل لوحة أداة (`BrandBoostAgent`, `CompetitorCompare`, `AIVisibility`, `AppliedRanking`, `PostSuggester`, …) تستبدل أي نص ثابت بـ `useContent`/`t` المرتبط بـ `lang` reactive.
- إضافة `useEffect` يعيد فحص أسماء التبويبات + النتائج المخزنة عند تغيير `lang`، ويستدعي `translateText` تلقائياً للنتائج النصية القديمة (toggle: "ترجم النتائج إلى لغة الواجهة").
- مراجعة كل ملفات `src/components/*` و `src/routes/*` لاستئصال السلاسل العربية المباشرة (≈ 40 ملف) وتحويلها لمفاتيح `site_content`.

## 4) منطق الإدراك والنية الاستباقي (Cognitive Layer)

**جدول جديد `user_intent_profile`**
```
user_id uuid PK
specialty, brand_name, brand_keywords  -- موجود في profiles، يُرفع هنا
detected_intent jsonb     -- { primary_goal, audience, gap, opportunity, urgency }
context_summary text      -- ملخص متراكم (آخر 10 تشغيلات)
last_signals jsonb        -- مدخلات/مخرجات آخر 10 أدوات
updated_at timestamptz
```

**Middleware جديد `withCognition`** يُلف حول كل tool serverFn:
1. **قبل التشغيل**: يستدعي Lovable AI (`gemini-2.5-flash`) بـ JSON schema لاستخراج:
   - النية الأساسية (نمو/أزمة/استكشاف منافس/إطلاق منتج…)
   - الجمهور المستهدف
   - الفجوة المحتملة
   - الفرصة الاستباقية
2. **يحقن** هذا السياق في system prompt كل أداة (يعزز جودة المخرج لكل الأدوات دون استثناء).
3. **بعد التشغيل**: يحدّث `context_summary` + `last_signals` (طي تدريجي بـ summarizer).
4. **يعيد للأداة** حقل `proactive_next_step` يُعرض كـ بطاقة CTA في نهاية كل نتيجة:
   _"بناءً على هدفك (X) والفجوة (Y) — ننصح بتشغيل أداة Z الآن"_ مع زر مباشر.

**لوحة إدارة جديدة "User Intelligence"**:
- جدول بكل المستخدمين + النية المُكتشفة + ملخص السياق + آخر 10 إشارات.
- بحث/فلترة حسب specialty / intent / urgency.
- زر "أعد فحص النية" لمستخدم معين.

**Insights عامة**: tab "Cognitive Insights" يعرض clusters: أكثر النوايا شيوعاً، أكثر الفجوات تكراراً، الفرص الجماعية.

---

## التفاصيل التقنية (للمراجعة)

**ملفات جديدة**:
- `supabase/migrations/*_content_cms.sql` — `site_content`, `custom_pages`, `report_drafts`, `user_intent_profile` (+ GRANT + RLS + triggers updated_at)
- `src/lib/content.ts` — `useContent()` + cache + realtime
- `src/lib/cognition.server.ts` — `withCognition` middleware + intent extractor
- `src/lib/cognition.functions.ts` — `detectIntent`, `getUserIntelligence` (admin), `refreshUserIntent`
- `src/routes/p.$slug.tsx` — صفحات مخصصة ديناميكية
- `src/components/admin/ContentStudioTab.tsx`
- `src/components/admin/HeaderConfigTab.tsx`
- `src/components/admin/ExportConfigTab.tsx`
- `src/components/admin/UserIntelligenceTab.tsx`
- `src/components/ProactiveNextStep.tsx` — البطاقة الاستباقية في نهاية كل أداة
- `scripts/bootstrap-content.ts` — يهجّر مفاتيح i18n الحالية إلى site_content

**ملفات تُعدَّل**:
- `src/routes/admin.tsx` — 4 تبويبات جديدة
- `src/lib/i18n.tsx` — يبقى كـ fallback؛ يتكامل مع `useContent`
- `src/components/SiteHeader.tsx` — إخفاء الوكيل/روابط ديناميكية
- `src/components/ExportButtons.tsx` — يقرأ `export_config`
- كل ملف API tool في `src/routes/api/*.ts` — يُلف بـ `withCognition`
- كل لوحات الأدوات: استبدال السلاسل المباشرة بـ `useContent`

**التكلفة الزمنية المتوقعة**: تنفيذ على دفعتين — (أ) CMS + الهيدر + التصدير + تطابق اللغة، (ب) طبقة الإدراك والنية. أوصي بالموافقة على الخطة كاملة ثم تنفيذ الدفعة (أ) أولاً للتحقق قبل الدفعة (ب).

هل أبدأ بالتنفيذ؟ أو تريد تعديل أي قسم قبل الانطلاق؟
