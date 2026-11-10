# تحديث بيانات مساحة MAAROOF AI (الخطوة 3)

الهدف: أن تسأل أدوات الظهور والكلمات المحركات العشرة عن معروف بقطاعه وسوقه الصحيحين، دون لصق يدوي.

## ما سيتغير (في سجل مساحة MAAROOF AI فقط)
- القطاع: «منصة تحسين محركات البحث التوليدي (GEO) — Generative Engine Optimization Platform» بدل «SEO GEO SGE AEO SGEO GSEO».
- السوق: Global (عالمي).
- الكلمات المستهدفة: GEO، AEO، SGE، SGEO، GSEO، SEO، Generative Engine Optimization، AI Engine Visibility، LLM Citations، Zero-Click Search، تحسين محركات الذكاء الاصطناعي، معروف.
- بطاقة الحقيقة: استبدال سوق «Lebanon» بـ Global، مع إبقاء بقية الحقول كما هي.

## ما لن يتغير
- الحساب الأساسي ومساحات العملاء الأخرى (مثل Mengotti) لا تُمس.
- لا تغيير في بنية الجداول ولا في الكود ولا صفحة الهبوط، ولا نشر.

## التحقق
- قراءة السجل بعد التحديث للتأكد من القيم.
- التنبيه: أثر كامل على أداة الكلمات يتطلب دمج PR #52 في main.

## تفاصيل تقنية
- تحديث بيانات واحد على `workspaces` حيث `id = ec917124-818c...` (المعرّف الكامل يُقرأ أولاً): `brand_summary`، `country='Global'`، `keywords`، و`entity_truth_card = jsonb_set(..., '{market}', '"Global"')`.
- يُنفذ عبر أداة تعديل البيانات لا الترحيل.
