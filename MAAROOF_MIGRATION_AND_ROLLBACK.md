# MAAROOF Migration and Rollback

## Migration

لا توجد migration لقاعدة البيانات في هذا الفرع. الدمج يعتمد على `maaroof_messages` الموجود لتسجيل manifest النواة، لذلك لا يحتاج إلى جدول جديد أو تعديل schema.

النشر المقترح هو رفع الفرع إلى GitHub ثم مزامنته داخل Lovable، مراجعة Preview، وتشغيل اختبار جلسة مصادق عليها. لا يُسمح بترقية Production قبل موافقة المستخدم الصريحة.

## Feature flag

التغيير التشغيلي الوحيد هو جعل `platform_evolution.execution_modes_enabled` يساوي `true` في القيم الافتراضية. هذا لا يفعّل simulation engine أو workflow graph أو quality score أو capability marketplace أو الطبقات التنفيذية المتقدمة. إذا كان إعداد `maaroof_settings` يحتوي قيمة صريحة، فتبقى قيمة قاعدة البيانات هي الحاكمة.

## Rollback

للتراجع البرمجي، أعد `execution_modes_enabled` إلى `false` وأزل kernel manifest changes من الفرع، أو أعد نشر commit `406cb31` من خلال Preview/Publish بعد مراجعة Lovable. لا تُحذف سجلات `maaroof_runs` أو `maaroof_messages`.

للتراجع التشغيلي السريع، يمكن تفعيل `kill_switch` من إعدادات MAAROOF الحالية، ثم مراجعة السجلات قبل إعادة فتح التشغيل. لا يُنصح بتعديل DNS أو Cloudflare أثناء هذا التراجع.

## حدود الترحيل

لم تتم إضافة Omni Router أو Browser Operator أو Google Drive أو مزود ذاكرة جديد. هذه القدرات تحتاج عقود provider واختبارات وصلاحيات منفصلة، ولا ينبغي تفعيلها بسبب وجود مواصفات فقط.
