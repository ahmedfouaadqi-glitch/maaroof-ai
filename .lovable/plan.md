# حالة الوكيل والقنوات والأوامر

## ✅ مكتمل في صفحة `/agent`
- **"أعطِ الوكيل أمراً"** (`ag_cmd_title`) — مربع نصي + `runAgentCommand` + اختيار اللغة + رسائل نجاح/فشل + خصم من الحصة (`checkAndConsume`) ✅
- **قنوات النشر** — `ChannelsPanel` (Telegram + LinkedIn) مع التحقق + وضع تلقائي/يدوي ✅
- **تشغيل الوكيل** — `runAgentNow` لكل الأهداف أو هدف محدد، نشر تلقائي للقنوات في وضع auto، إشعارات ✅
- **طابور الموافقة** — `ApprovalQueue` للمنشورات المعلقة ✅
- **تحليل الظهور** — `runVisibility` عبر `/api/visibility` ✅
- **بوابات الرؤية** — `vis.isAgentFeatureVisible("command" / "visibility")` مطبّقة ✅

## ⚠️ البنود الأربعة المتبقية (بالترتيب)

### 1) Toast بعد خصم التوكنز في صفحات الأدوات
في `PostSuggester`, `CompetitorCompare`, `AIVisibility`, `BrandBoostAgent` — عند نجاح الاستدعاء استخراج `balance/charged` من الرد وإطلاق:
```ts
toast.success(`تم خصم ${charged} — الرصيد: ${balance}`)
```
وعند 402 يكفي ما يفعله `api-client` حالياً.

### 2) بوابات `<Widget>` المتبقية
- `src/routes/tools.$slug.tsx` → لف شريط التقدم بـ `<Widget k="progress_bar">`
- `src/routes/dashboard.tsx` → لف بطاقات السجل بـ `<Widget k="history">`

### 3) تنظيف `usePageGuard()` المكرر
- نقل النداء مرة واحدة إلى `src/routes/__root.tsx`
- حذف النداءات اليدوية من `dashboard.tsx`, `agent.tsx`, `tools.$slug.tsx`, `guide.tsx`, `pricing.tsx`

### 4) اختبار فعلي في المتصفح
- `/admin` → فتح Drawer المستخدم، تعديل الخطة/الرصيد، حفظ، التحقق من `tokens-changed`
- `/tools/analyze` → تشغيل أداة، التحقق من toast الخصم وتحديث `TokensBar` فوراً
- إخفاء صفحة من `ui_visibility` والتحقق من إعادة التوجيه

## ملاحظة
لا تغييرات في قاعدة البيانات. كل التعديلات في الواجهة فقط.
