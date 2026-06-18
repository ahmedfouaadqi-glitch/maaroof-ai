
## 1) ربط معروف بمنظومة الإدارة (Header + Users/Permissions/Pricing)

الهدف: يصبح "معروف" أداة قياسية ضمن النظام — تظهر في الهيدر بحسب الإعدادات، وفي شبكة الخطط × الأدوات، وضمن صلاحيات المستخدم الفردية، ويُدار سعرها وحدّها مثل أي أداة.

### أ. إضافة معروف لكاتالوج الأدوات
- في `src/lib/tool-catalog.ts`: إضافة عنصر جديد بمفتاح `maaroof` (label_ar/en/ku، أيقونة، وصف، `category: "agent"`).
- النتيجة التلقائية:
  - يظهر في **شبكة الخطط × الأدوات** (`AdminPlansMatrixPanel`) فيقدر الأدمن يفعّل/يعطّل معروف لكل خطة.
  - يظهر في **صلاحيات المستخدم الفردية** (`per_user_tool_overrides` داخل `profiles`) عبر لوحة المستخدمين الحالية.
  - يظهر في **التسعير** (`tool_pricing_catalog` + `PricesEditor`) فيُحدَّد سعر الجلسة بالعملات المدعومة.

### ب. الهيدر والروابط
- في `src/lib/content.ts` (`useHeaderConfig`): إضافة علم `show_maaroof` (افتراضي `true`).
- في `src/components/admin/HeaderConfigTab.tsx`: تبديل لإظهار/إخفاء رابط معروف.
- في `src/components/SiteHeader.tsx` (سطر 64 و127): استبدال الشرط الحالي بـ `auth?.user && hdr.show_maaroof && hasAccess("maaroof")` — يستخدم helper موجود في صلاحيات الأدوات.

### ج. بوّابة الوصول في الـ API
- في `src/routes/api/maaroof.ts`: قبل بدء التشغيل، فحص:
  1. `maaroof_settings.kill_switch` (موجود).
  2. وصول المستخدم للأداة عبر دالة موجودة (نفس الدالة المستخدمة لبقية الأدوات في `tool-plan-access`)، وإلا 403 برسالة "هذه الأداة غير متاحة في خطتك".
  3. خصم التوكنات عبر `charge_tokens` بمفتاح `maaroof` (بدل/إضافةً للسقف اليومي التجريبي الحالي).
- في `src/lib/maaroof/orchestrator.server.ts`: تمرير `tool_key="maaroof"` عند تسجيل token_ledger النهائي (موجود جزئياً) ليظهر في لوحة المالية تحت اسم معروف بدل أدوات فرعية فقط.

### د. تبويب لوحة الإدارة
- لا حاجة لتبويب جديد — `MaaroofAdminTab` موجود. لكن نضيف رابط ضمنه «اضبط السعر/الخطط» يفتح:
  - `users_pricing → pricing` لشبكة الخطط.
  - `users_pricing → tokens` للسعر.
  حتى يفهم الأدمن أن التحكم الكامل في "الأسعار/الخطط/الصلاحيات" يجري من نفس المكان الموحّد.

---

## 2) إعادة تصميم الكرة الأرضية (`MaaroofGlobe.tsx`)

المشاكل الحالية: لون رصاصي مسطّح، نقاط سوداء صغيرة، خطوط شبكة باهتة، بدون عمق أو إضاءة، بدون قارات حقيقية.

### التصميم الجديد (سينمائي، Manus-grade)
طبقات (من الخلف للأمام):
1. **خلفية نجوم متحركة** — `<defs>` بتشتيت 80 نقطة عشوائية حول الكرة، وميض خفيف عبر `<animate opacity>`.
2. **هالة الغلاف الجوي** — حلقة خارجية بـ `radial-gradient` من `primary` لشفاف، مع `feGaussianBlur` كبير لإحساس التوهج.
3. **الكرة الأساسية** — تدرّج كروي عميق:
   - مركز الإضاءة (35%, 30%) بلون `hsl(220 70% 25%)` لون محيط مضيء.
   - الحواف `hsl(230 80% 8%)` لظل كروي.
   - حلقة لمعان (specular highlight) بيضاء شفافة عند الزاوية العلوية اليسرى.
4. **القارات الحقيقية** — استبدال نقاط الدول بـ `<path>` لخريطة عالم مبسّطة (TopoJSON خفيف ~15KB من `world-atlas/countries-110m`، نضيفها كملف JSON ثابت). تُرسم بإسقاط Orthographic مع نفس دوران الكرة:
   - لون افتراضي: `hsl(var(--primary) / 0.25)` مع stroke `hsl(var(--primary) / 0.5)`.
   - الدولة المختارة (`highlightCountry`): تعبئة `hsl(var(--primary))` + توهج (`filter: url(#m-glow)`) + نبض.
   - الدول النشطة (`activeCountries`): تعبئة `hsl(var(--accent) / 0.7)`.
   - في `worldMode`: موجة لون تنتشر من الاستواء.
5. **خط النهار/الليل (Terminator)** — قطع ناقص شفاف يتحرك بطيئاً لإيهام دوران الأرض حول الشمس.
6. **خطوط الطول/العرض** — أرفع وأخف (opacity 0.04) فقط للعمق، بدون ضوضاء بصرية.
7. **أقواس الاتصال** — عند وجود `activeCountries` متعددة: قوس بدل (Bézier) يربط بين الدولة المختارة وكل دولة نشطة، مع تأثير «رسم تدريجي» (`stroke-dasharray` + `animate`).
8. **بطاقة تسمية الدولة** — بدلاً من نص صغير أسفل، Tooltip متحرك يتبع الدولة المختارة مع اسمها وعدد الأحداث.

### اعتبارات تقنية
- التوكنات الدلالية فقط (`--primary`, `--accent`, `--background`, `--foreground`) — حذف جميع `hsl(220 ...)` الصلبة.
- استيراد TopoJSON عبر `bun add topojson-client` + ملف `countries-110m.json` في `src/components/maaroof/world-110m.json`.
- إسقاط Orthographic مكتوب يدوياً (موجود `lonLatToOrtho`) — نوسّعه لرسم مسارات polygon مع clipping للنصف الخلفي للكرة.
- احترام `prefers-reduced-motion`: إيقاف الدوران والنبض والأقواس، إبقاء التوهج فقط.
- الأداء: الرسم بـ SVG واحد، لا canvas؛ memoize للمسارات بحسب `Math.round(rot)` لكل 2°.

### الملفات المتأثرة
- إعادة كتابة كاملة لـ `src/components/maaroof/MaaroofGlobe.tsx`.
- جديد: `src/components/maaroof/world-110m.json` (تحميل مرة من `world-atlas`).
- جديد: `src/components/maaroof/projection.ts` (دوال projection + path builder).
- لا تغيير على `MaaroofStage.tsx` (نفس الواجهة `highlightCountry/activeCountries/onPickCountry`).

---

## ملخص الملفات
**يُعدَّل:** `src/lib/tool-catalog.ts`، `src/lib/content.ts`، `src/components/admin/HeaderConfigTab.tsx`، `src/components/SiteHeader.tsx`، `src/routes/api/maaroof.ts`، `src/lib/maaroof/orchestrator.server.ts`، `src/components/admin/MaaroofAdminTab.tsx`، `src/components/maaroof/MaaroofGlobe.tsx`.
**يُنشأ:** `src/components/maaroof/world-110m.json`، `src/components/maaroof/projection.ts`.
**يُضاف كحزمة:** `topojson-client`.

## معايير القبول
- معروف يظهر/يختفي من الهيدر حسب `show_maaroof` ووصول الخطة.
- مستخدم بخطة لا تشمل معروف يحصل على 403 من `/api/maaroof` ولا يرى الرابط.
- تعديل السعر من Tokens/Pricing matrix ينعكس على الفوترة في `token_ledger`.
- الكرة تعرض قارات حقيقية، إضاءة كروية، توهج وأقواس، بدون أي لون مكتوب يدوياً.
