# MAAROOF Migration and Rollback

## Migration

لا توجد migration لقاعدة البيانات في هذا الفرع. الدمج يعتمد على `maaroof_messages` الموجود لتسجيل manifest النواة، لذلك لا يحتاج إلى جدول جديد أو تعديل schema.

الفرع مرفوع إلى GitHub للمراجعة اللاحقة فقط. بناءً على توجيه المستخدم الحالي، لا يتم الدخول إلى Lovable أو إرسال طلبات إليه أو تنفيذ أي مزامنة/Preview هناك ضمن هذه المرحلة. لا يُسمح بترقية Production قبل مراجعة مستقلة وموافقة المستخدم الصريحة.

## Feature flag

التغيير التشغيلي النهائي يبقي `platform_evolution.execution_modes_enabled` يساوي `false` في القيم الافتراضية. لا يفتح simulation أو recommendation أو execution عالمياً، ولا يفعّل simulation engine أو workflow graph أو quality score أو capability marketplace أو الطبقات التنفيذية المتقدمة. إذا كان إعداد `maaroof_settings` يحتوي قيمة صريحة، فتبقى قيمة قاعدة البيانات هي الحاكمة.

## Rollback

التصحيح البرمجي الحالي يعيد `execution_modes_enabled` إلى `false` في Commit `7aea692`. وللتراجع الكامل، أزل تغييرات kernel manifest من فرع المراجعة أو أعد الفرع إلى نقطة الأساس بعد مراجعة مستقلة. لا تُحذف سجلات `maaroof_runs` أو `maaroof_messages` ولا يُلمس `main`.

للتراجع التشغيلي السريع، يمكن تفعيل `kill_switch` من إعدادات MAAROOF الحالية، ثم مراجعة السجلات قبل إعادة فتح التشغيل. لا يُنصح بتعديل DNS أو Cloudflare أثناء هذا التراجع.

## حدود الترحيل

لم تتم إضافة Omni Router أو Browser Operator أو Google Drive أو مزود ذاكرة جديد. هذه القدرات تحتاج عقود provider واختبارات وصلاحيات منفصلة، ولا ينبغي تفعيلها بسبب وجود مواصفات فقط.
