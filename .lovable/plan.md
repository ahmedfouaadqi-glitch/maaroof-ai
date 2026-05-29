## المشكلة

- `src/routes/admin.tsx` هو صفحة `/admin` كاملة (لوحة المدير الرئيسية) ولا يستدعي `<Outlet />`.
- `src/routes/admin.pulse.tsx` يُعتبر تلقائياً ابناً لـ `admin.tsx` بحكم تسمية الملفات في TanStack Router.
- النتيجة: عند زيارة `/admin/pulse` يُطابَق الراوت لكن لا شيء يُعرض داخل الأب، فتبدو الصفحة فارغة ويختفي زر "نشاط نظام نبض / حفظ".

## الحل

فصل `admin.pulse` عن شجرة `admin` باستخدام لاحقة الشُّرطة السفلية (flat non-nested route):

1. **إعادة تسمية الملف**:
   - من: `src/routes/admin.pulse.tsx`
   - إلى: `src/routes/admin_.pulse.tsx`

   هذه اللاحقة `_` بعد اسم الجزء تخبر TanStack بأن الراوت ليس ابناً لـ `admin`، فيُعرض مستقلاً.

2. **تحديث `createFileRoute`** داخل الملف نفسه:
   - من: `createFileRoute("/admin/pulse")`
   - إلى: `createFileRoute("/admin_/pulse")`
   
   مع الإبقاء على المسار النهائي `/admin/pulse` كما هو (الـ `_` يُحذف من الـ URL).

3. **تحديث أي روابط** تشير إلى الصفحة (إن وُجدت) — `to="/admin/pulse"` يبقى صحيحاً لأن الـ URL لم يتغير.

## التحقق بعد التطبيق

- فتح `/admin/pulse` ⟵ يجب أن يظهر:
  - العنوان "نبض — لوحة الإدارة"
  - قسم **نشاط نظام نبض** مع checkbox "نبض نشط/موقوف" + قائمة فاصل الكشط + زر **حفظ**
  - بقية الأقسام (جسر geoiraq، المصادر، سجل الكشط)

## الملفات المتأثرة

- `src/routes/admin.pulse.tsx` ⟵ يُعاد تسميته إلى `src/routes/admin_.pulse.tsx` ويُحدَّث `createFileRoute`.
- `src/routeTree.gen.ts` يُعاد توليده تلقائياً.
