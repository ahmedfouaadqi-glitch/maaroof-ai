السبب الحالي واضح من السجلات: صفحة `/pulse` تتعطل لأن `usePulseI18n()` يستدعي `useI18n()` خارج `I18nProvider`. صفحات الموقع الأخرى تلف نفسها بـ `I18nProvider` داخل route component، لكن صفحات نبض الجديدة لا تفعل ذلك، لذلك يظهر خطأ: `useI18n must be used inside I18nProvider`.

الخطة:
1. إضافة `I18nProvider` حول صفحات نبض التالية:
   - `/pulse`
   - `/pulse/$gov`
   - `/pulse/compare`
   - `/pulse/sources`
   - `/pulse/assistant`
   - `/admin/pulse`

2. لأن `PulseSubNav` يستخدم `useAuth()` لمعرفة هل المستخدم Admin، سألف صفحات نبض أيضاً بـ `AuthProvider` حتى لا يعتمد على `try/catch` حول hook، وسأبقي رابط لوحة المالك يظهر فقط للـ Admin.

3. تعديل `PulseSubNav` بشكل آمن: إزالة `try/catch` حول `useAuth()` واستخدامه مباشرة بعد ضمان وجود `AuthProvider`.

4. مراجعة سريعة لأي بقايا hydration في صفحة نبض مثل `toLocaleString()` داخل أول render إن وجدت، بحيث لا تظهر مشكلة جديدة بعد إصلاح المزود.

بعد التنفيذ، المفترض أن الضغط على "نبض" في البرفيو يفتح الصفحة بدل شاشة الخطأ.