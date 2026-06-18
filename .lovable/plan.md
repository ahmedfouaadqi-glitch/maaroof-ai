
## المرحلة B — استكمال «معروف»

المرحلة A اكتملت (الجداول + orchestrator + `/api/maaroof` SSE + واجهة `/maaroof` مع شريط الموقع وكشف IP). الآن نُكمل بقية معايير القبول.

## 1) دمج مع الوكيل القديم
- **بانر في `/agent`**: شريط أعلى الصفحة "جرّب وكيلنا الجديد معروف — تخطيط متعدد الخطوات + ذاكرة طويلة + كل أدوات GEO" مع زر للذهاب لـ `/maaroof`. قابل للإخفاء (localStorage).
- **رابط في `SiteHeader`**: عنصر قائمة "معروف ✨" بجانب "الوكيل".
- **رابط من `/index`** (الصفحة الرئيسية) لمن لم يجرّبه بعد.

## 2) صفحة ذاكرة معروف `/maaroof/memory`
- جدول للذكريات الحالية (kind, content, importance, last_accessed).
- إجراءات: حذف، تعديل importance، حذف الكل.
- زر "تذكّر هذا" يدوي لإضافة fact/preference.
- يستخدم RLS الموجود (المستخدم يرى ويعدّل بياناته فقط).

## 3) تكامل مع لوحة الأدمن
في `SystemHealthTab` (موجود): قسم جديد **«Maaroof»**:
- إجمالي الـ runs آخر 7 أيام، متوسط التكلفة، نسبة الفشل.
- أعلى 10 أهداف من حيث التكلفة (لاكتشاف الإساءة).
- تنبيه إن تجاوز متوسط التكلفة عتبة (مثلاً $0.50).
- جدول آخر 20 run مع: المستخدم، الهدف، الحالة، steps، USD، الوقت.

في `AdminFinanceTab` (إن وُجد، وإلا نضيف بطاقة في `SystemHealthTab`):
- إيرادات Maaroof = SUM(`token_ledger.usd_cost` WHERE `meta->>'maaroof_run_id' IS NOT NULL`).
- التكلفة الحقيقية = SUM(`maaroof_runs.total_usd`).
- الهامش.

## 4) تتبع التكلفة عبر `token_ledger`
حالياً المرحلة A تحفظ التكلفة في `maaroof_runs.total_usd` فقط. نضيف:
- بعد كل استدعاء أداة داخل orchestrator، نسجّل صفاً في `token_ledger` عبر `enrichLedger` (الموجود في `system-health.functions.ts` أو نستخدم `chargeTokens` للأدوات الفعلية).
- الـ meta يحتوي `{ maaroof_run_id, step_index, tool, geo }`.
- استدعاءات LLM (planner/reflector/final) تُسجَّل بـ tool_key=`maaroof.llm`.

## 5) تحسينات UX على `/maaroof`
- **حفظ خيار اللغة والنطاق الجغرافي تلقائياً** كـ `preference` في `maaroof_memory` (الآن يُحفظ فقط بعد done — ننقله لبدء الجلسة).
- **تحميل جلسة سابقة**: النقر على جلسة من sidebar يعرض رسائلها (قراءة من `maaroof_messages`).
- **زر "تصدير PDF"** للإجابة النهائية (يستخدم `src/lib/exports.ts` الموجود).
- **إعادة محاولة عند خطأ 402/429**: رسالة واضحة + زر "أعد المحاولة" أو "ترقية الخطة".
- **تركيز تلقائي** على textarea عند فتح الصفحة وبعد كل جلسة.

## 6) تحسينات backend
- **حد الـ trial**: حالياً 5/يوم. نضيف رسالة عربية واضحة + رابط `/pricing`.
- **حماية ضد goal فارغ/طويل جداً**: max 2000 char.
- **timeout** على كل استدعاء أداة (45 ثانية) لمنع الـ run المعلّق.
- **fallback model**: إن فشل Gemini 2.5 Pro بـ 429، حاول `google/gemini-2.5-flash`.

## ما يبقى دون تغيير
- مخطط قواعد البيانات (المرحلة A كافية).
- `/agent` القديم وعقوده.
- الـ16 endpoint.
- `tokens.server.ts` و`chargeTokens`.

## معايير القبول النهائية
1. زائر `/agent` يرى بانر «معروف» ويستطيع الانتقال بنقرة.
2. `/maaroof/memory` تعرض ذكريات المستخدم وتسمح بحذف/تعديل.
3. `SystemHealthTab` يحتوي قسم Maaroof مع الإحصاءات والتنبيهات.
4. كل استدعاء أداة داخل run يظهر صفاً في `token_ledger` مع `maaroof_run_id`.
5. تحميل جلسة سابقة من sidebar يعرض رسائلها كاملة.
6. زر تصدير PDF يعمل على الإجابة النهائية.
7. لا كسر للوكيل القديم أو الأدوات.

## ترتيب التنفيذ (دفعة واحدة)
1. بانر `/agent` + رابط Header.
2. تكامل `token_ledger` في orchestrator + fallback model + timeout.
3. صفحة `/maaroof/memory`.
4. تحميل جلسة سابقة + تصدير PDF في `/maaroof`.
5. قسم Maaroof في `SystemHealthTab`.
