# دمج وتطوير «تعزيز العلامة التجارية»

## 1) نقل البحث الذكي + تواصل الشركات إلى «تعزيز العلامة»

داخل `src/components/BrandBoostAgent.tsx` يصبح شريط التبويبات 7 أعمدة:

```text
Visibility | Research | Outreach | Run | Authority | Propagation | Logs
```

- `Visibility` ← `<VisibilityPanel embedded toolKey="brand" />` (كما هو).
- `Research` ← `<SmartResearch />` داخل غلاف خفيف (نزيل الـ Card الخارجي عبر شرط `embedded` بسيط، أو نتركه كما هو داخل التبويب).
- `Outreach` ← `<CompanyOutreach />` بنفس الأسلوب.
- نمرّر `brand` و `kw` كقيم ابتدائية حيث يدعم المكوّن ذلك (Outreach: تعبئة `company`، Research: تعبئة `query` من brand+kw عند التحميل الأوّل فقط، دون قفل الحقل).

### تنظيف لوحة التحكم `src/routes/dashboard.tsx`

- إزالة بطاقات `research` و `outreach` من شبكة الأدوات (مع إبقاء استيراد المكونين لأنهما يُستخدمان داخل Brand Boost).
- إزالة حالتَي `openTool === "research" | "outreach"` من المودال.
- الإبقاء على `TOOL_COST.research/outreach` لأن الفوترة تتم على مستوى الـ API.

النتيجة: نقطة دخول واحدة موحّدة لكل ما يخص العلامة التجارية.

## 2) إرجاع حقول الإدخال في تبويب الظهور

في `VisibilityPanel` نُلغي قاعدة "إخفاء الحقول عند تمرير `brand` من الأب".

- إزالة `controlled` كحاجز للحقول: الحقول تظهر دائماً ومُعبّأة مسبقًا بالـ `brandProp / kwProp` (قابلة للتعديل).
- `keywords` يصبح اختياريًا فعليًا: زر التشغيل يعتمد فقط على وجود `brand.trim()`.
- placeholder للكلمات المفتاحية يُضاف إليه «(اختياري)».
- عند التعديل اليدوي لا يُعاد الكتابة فوقه من props (نستخدم `useEffect` يضبط القيمة الأولية مرة واحدة).
- نص توضيحي صغير: «اسم العلامة إلزامي — الكلمات المفتاحية اختيارية وتُحسّن دقة الفحص».

## 3) بثّ حقيقي للعلامة إلى محركات الذكاء

محركات الذكاء لا تستقبل "حقن مباشر"؛ كلها تتعلم/تستجلب من الويب العام أو من فهارس محددة. الحل الواقعي = نشر محتوى رسمي مفهرَس + إجبار المحركات على رؤيته فورًا.

### خط الأنابيب الجديد (ينفّذ بضغطة زر «بث الآن»)

```text
Brand Boost output (injection_pack)
        │
        ▼
1) حفظ نسخة عامة في DB                 (table: brand_public_pages)
        │
        ▼
2) خدمة صفحة عامة مفهرسة                /b/$slug.html  +  /b/$slug.json
   – HTML نظيف + JSON-LD Organization/FAQPage
   – robots: index,follow + sitemap.xml تلقائي
        │
        ▼
3) إخبار محركات البحث فورًا             IndexNow (Bing/Yandex)
   – موجود بالفعل: src/lib/indexnow.server.ts
   – Bing index ≡ ما تقرأه Copilot + ChatGPT search + Perplexity
        │
        ▼
4) Ping Google                          GET /ping?sitemap=…  +  Search Console (المفتاح موجود)
        │
        ▼
5) قنوات الذكاء غير القابلة للحقن:      توليد منشورات جاهزة (X/LinkedIn/Reddit/Quora)
   – نسخة قصيرة + روابط للصفحة العامة
   – زر «نسخ» + Web Share API
        │
        ▼
6) جدولة تكرار البث                     pg_cron كل N أيام يعيد IndexNow + يحدّث الصفحة
```

### تفاصيل تقنية

- **جدول جديد** `brand_public_pages(user_id, slug unique, brand_name, lang, content_md, json_ld, qa_pairs jsonb, last_pinged_at, updated_at)` + RLS: المالك يكتب، العام يقرأ عبر `SECURITY DEFINER` function.
- **مسار عام جديد** `src/routes/b.$slug.tsx`: SSR صفحة كاملة مع `<head>` يحوي JSON-LD، canonical، og/twitter cards، hreflang. لا يستعمل auth.
- **API** `src/routes/api/brand-broadcast.ts` (POST، مع `requireSupabaseAuth`):
  1. ينشئ/يحدّث صفّ `brand_public_pages`.
  2. يستدعي `submitToIndexNow([publicUrl])` (الدالة موجودة).
  3. يستدعي Google ping + Search Console API (المفتاح متاح).
  4. يُرجع: `{ public_url, indexnow_status, google_status, social_drafts: { twitter, linkedin, reddit, quora } }`.
- **Sitemap**: تعديل `src/routes/sitemap[.]xml.ts` لإضافة `/b/<slug>` لكل صف نشط.
- **زر جديد داخل تبويب Run** بعد ظهور `injection_pack`:
  - «🚀 بثّ الآن» يفتح dialog يعرض المعاينة → عند التأكيد ينادي `/api/brand-broadcast`.
  - يعرض URL العام + نتائج IndexNow/Google + بطاقات «انسخ ونشر» لكل منصة اجتماعية.
- **Cron اختياري** (إعادة بثّ أسبوعي) عبر `set_brand_rebroadcast_cron(_hours, _anon)` على نمط `set_pulse_cron` السابق، يستدعي `/api/public/hooks/brand-rebroadcast` الذي يكرّر IndexNow لكل صفّ نشط.

### لماذا يعمل هذا فعلياً مع كل محرك

| المحرك | كيف يلتقط الصفحة |
|---|---|
| ChatGPT (Browse) / Copilot | فهرس Bing — IndexNow يدفع الـ URL خلال دقائق |
| Perplexity | يقرأ من Bing + Google + crawler خاص — صفحتنا قابلة للزحف |
| Gemini / Google AI Overviews | Google ping + Search Console + sitemap |
| Claude (web) | يستعمل Brave/Google — تصبح نتيجة قابلة للاستشهاد |
| Grok | فهرس X + ويب عام — نوفّر draft تغريدة تلقائية تربط للصفحة |
| DeepSeek / Mistral | crawler ويب عام — robots مفتوح + sitemap |

النتيجة: العلامة تصبح "حقيقة عامة موثّقة" يلتقطها كل محرك خلال أيام، بدل وعد بالنشر اليدوي.

## ملفات سيتم لمسها

- تعديل: `src/components/BrandBoostAgent.tsx` (تبويبات Research/Outreach + زر البثّ)
- تعديل: `src/components/AIVisibility.tsx` (إظهار الحقول دائمًا، keywords اختياري)
- تعديل: `src/routes/dashboard.tsx` (إزالة بطاقتي Research/Outreach)
- تعديل: `src/routes/sitemap[.]xml.ts` (إضافة /b/$slug)
- جديد: `src/routes/b.$slug.tsx` (الصفحة العامة المفهرسة)
- جديد: `src/routes/api/brand-broadcast.ts` (تشغيل البث)
- جديد (اختياري): `src/routes/api/public/hooks/brand-rebroadcast.ts` (cron)
- ترحيل DB: جدول `brand_public_pages` + RLS + GRANT + (اختياري) دالة `set_brand_rebroadcast_cron`.

## التكلفة (بدون تغيير سعر)

- `Visibility` يبقى 1 وحدة. `Brand Boost Run` يبقى 5 وحدات.
- `بث الآن` = 0 وحدات إضافية (يعيد استعمال آخر تقرير Brand Boost) — التكلفة الحقيقية على المالك = استدعاء IndexNow/Google (مجاني) + استضافة الصفحة (مشمولة).
- إن أراد المستخدم إعادة توليد المحتوى قبل البث → يدفع 5 وحدات Brand Boost كالمعتاد.
