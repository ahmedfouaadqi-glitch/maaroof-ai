## Phase B-2 — تعميم الطبقة الإدراكية على بقية الأدوات

تم في Phase B تركيب `<ProactiveNextStep />` في `BrandBoostAgent` فقط. الآن نُعمّمها على باقي الأدوات الـ15، مع التأكد أن كل أداة تُرسل ملخصات صحيحة للمحرك الإدراكي (`runCognition`) وتعرض البطاقة الاستباقية بنفس لغة الواجهة.

### 1) الأدوات المستهدفة (15)
`SmartResearch`, `CompetitorCompare`, `AIVisibility`, `AppliedRanking`, `PostSuggester`, `BizDev`, `FeasibilityStudy`, `SocialAnalysis`, `CompetitorMonitor`, `WhatIfSimulator`, `GeoStrategist`, `CompanyOutreach` (company_email), `BrandAuthority`(عبر packs), `GeoRewrite` (داخل المكوّن المناسب), `Sandbox/analyze`.

### 2) نمط الدمج الموحّد لكل مكوّن
في كل ملف مكوّن أداة، بعد كتلة عرض النتيجة:
```tsx
<ProactiveNextStep
  toolKey="<tool_key>"
  inputSummary={shortInputString}
  outputSummary={shortOutputString}
  handoffText={textForNextTool}
  hidden={!result}
/>
```
- `toolKey` يطابق المفاتيح في `KNOWN_TOOLS` داخل `cognition.functions.ts`.
- `inputSummary` ≤ 2000 char (يُقصّ).
- `outputSummary` ≤ 4000 char (مختصر من الحقول الأهم: title/summary/score/recommendations).
- `handoffText` نص مقترح للأداة التالية (إن لم يُمرَّر، يستخدم `outputSummary`).

### 3) helper مشترك
إنشاء `src/lib/cognition-summary.ts` (client-safe) — دوال صغيرة:
- `summarizeInput(obj, max=1500)` — يجمع الحقول النصّية ويقصّ.
- `summarizeOutput(obj, max=3500)` — نفس الشيء للنتائج (يتعامل مع arrays/objects/markdown).
هكذا لا يتكرّر الكود في كل مكوّن.

### 4) ضمان تطابق اللغة (نقطة 3 من طلب المستخدم)
- `<ProactiveNextStep />` يقرأ `useI18n().lang` ويعرض `next_reason_{lang}`.
- نتأكد أن `runCognition` يستقبل `lang` ويُمرّره لـ `extractIntent` ليولّد الحقول الثلاثة (`next_reason_ar/en/ku`) — حالياً موجودة لكن نضيف معامل `lang` صريح كاحتياط ونحقن "respond in {lang}" في الـ system prompt للمحرك.

### 5) منع الازدواجية والضوضاء
- البطاقة مخفية تلقائياً إذا `urgency=low` بدون `next_tool` (موجود مسبقاً).
- نضيف debounce بسيط داخل `ProactiveNextStep` (يستخدم `outputSummary` كمفتاح effect) لمنع نداءات متعددة لنفس النتيجة — موجود جزئياً، نتأكد أن المفتاح هو hash مختصر بدل النص الكامل.

### 6) Admin توجيه عام
في `UserIntelligenceTab` نضيف زر صغير "تعطيل لمستخدم محدد" يكتب في `user_intent_profile.detected_intent.disabled=true` — يحترمها `runCognition`.

### 7) لا تغييرات على Server prompts للأدوات
حقن `specialtyHint(ctx, lang)` المُعزَّز بـ `buildIntentHint` تم بالفعل في `user-context.server.ts`. الأدوات التي تستخدم `getUserContext` ستحصل تلقائياً على سياق النية بدون تعديل كل ملف API.

**الأدوات التي لا تستخدم `getUserContext` بعد** (نضيف سطرين فقط: استدعاء `getUserContext` + إلحاق `specialtyHint` بـ system prompt): سنفحصها سريعاً ونحدّث ما يلزم — متوقع 4-6 ملفات API صغيرة.

### الملفات

**جديد**:
- `src/lib/cognition-summary.ts`

**معدّل (إضافة `<ProactiveNextStep />`)**:
- `src/components/SmartResearch.tsx`
- `src/components/CompetitorCompare.tsx`
- `src/components/AIVisibility.tsx`
- `src/components/AppliedRanking.tsx`
- `src/components/PostSuggester.tsx`
- `src/components/BizDev.tsx`
- `src/components/FeasibilityStudy.tsx`
- `src/components/SocialAnalysis.tsx`
- `src/components/CompetitorMonitor.tsx`
- `src/components/WhatIfSimulator.tsx`
- `src/components/GeoStrategist.tsx`
- `src/components/CompanyOutreach.tsx`
- `src/components/Sandbox.tsx` (analyze)

**معدّل (إن لزم — حقن السياق إذا غير مفعّل)**:
- 4-6 ملفات `src/routes/api/*.ts` (سطرين لكل واحد).

**معدّل (تحسينات صغيرة)**:
- `src/lib/cognition.functions.ts` — قبول `lang` اختياري.
- `src/components/admin/UserIntelligenceTab.tsx` — زر تعطيل لمستخدم.

### تأكيد قبل التنفيذ
هل أبدأ التعميم على الأدوات الـ13 المذكورة دفعة واحدة؟
