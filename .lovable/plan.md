## الهدف
ترقية شعار **MAAROOF Ai** ليكون احترافياً في كامل الموقع، مع إضافة أنيميشن أنيق له، ووضعه في **منتصف قسم المدارات (EnginesOrbit)** بدل أيقونة `Cpu` الحالية.

## الخطوات

### 1) استبدال الصورة الحالية للشعار بنسخة نظيفة (شفافة)
- استخدام الصورة المرفوعة الجديدة `user-uploads://Gemini_Generated_Image_oyvzoxoyvzoxoyvz-2.png` كمصدر.
- توليد نسخة **PNG شفافة** (إزالة الخلفية البيضاء) عبر `imagegen--edit_image` مع `transparent_background: true`، وحفظها في:
  - `src/assets/maaroof-ai-logo.png` (تستبدل الحالية المستخدمة في الهيدر و التصدير)
  - `public/icon-512.png` (PWA / favicon)
  - `public/og-maaroof.png` (مع خلفية داكنة متناسقة مع الهوية لـ OG/Twitter)

### 2) تحسين عرض الشعار في `SiteHeader.tsx`
- إزالة الإطار الصغير `bg-background/40 ring-1 ring-border/60` الذي يخنق الشعار.
- تكبير الحجم إلى `size-12` مع `object-contain` ومسافة مناسبة، وإضافة هالة `drop-shadow` خفيفة بلون `--primary`.
- إضافة كلاس أنيميشن خفيف عند الظهور: `animate-fade-in` + تأثير `hover:scale-105` ناعم.

### 3) وضع الشعار في **منتصف EnginesOrbit** + أنيميشن احترافي
في `src/components/EnginesOrbit.tsx`:
- استبدال `<Cpu className="size-10 text-primary-foreground" />` داخل النواة المركزية بصورة `maaroofLogo`.
- تكبير النواة من `size-24` إلى `size-28 md:size-32` لتلائم الشعار.
- إضافة طبقات أنيميشن متعددة (CSS عبر `src/styles.css`):
  - **Float خفيف**: تذبذب رأسي بطيء (4s ease-in-out infinite).
  - **Glow نابض**: حلقة هالة حول الشعار تتنفس بلوني `--primary` و`--accent`.
  - **Conic shimmer**: حلقة دوارة بـ `conic-gradient` خلف الشعار (12s linear infinite) — تعطي إحساس "ذكاء يعمل".
  - **Pulse rings**: حلقتان متمددتان تخرجان من المركز كل 3s (مثل موجة رادار) لربط الشعار بالمحركات حوله.
- إبقاء شارة الاسم `t("brand")` تحت الشعار كما هي.

### 4) إضافة keyframes جديدة في `src/styles.css`
```css
@keyframes logo-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
@keyframes logo-glow  { 0%,100%{box-shadow:0 0 30px hsl(var(--primary)/.45)} 50%{box-shadow:0 0 60px hsl(var(--accent)/.55)} }
@keyframes logo-spin-slow { to { transform: rotate(360deg) } }
@keyframes radar-ping { 0%{transform:scale(.6);opacity:.7} 100%{transform:scale(2);opacity:0} }
```
وكلاسات utility مرافقة: `.logo-float`, `.logo-glow`, `.logo-conic`, `.radar-ping`.

### 5) فحص باقي مواضع الشعار
- `PrintAnalysisButton.tsx` ورأس PDF في `exports.ts`: تأكيد أن النسخة الشفافة تظهر جيداً على خلفية بيضاء (لا حاجة لتعديل غير تحديث المرجع — نفس المسار).
- لا تغيير على المنطق أو السيرفر.

## ملاحظات تقنية
- لن أعدّل `src/integrations/supabase/*` ولا `routeTree.gen.ts`.
- جميع الألوان عبر tokens (`--primary`, `--accent`) — لا ألوان مباشرة.
- الأنيميشن خفيفة لا تستنزف الأداء (CSS transforms + opacity فقط).
- يُحترم `prefers-reduced-motion` بتعطيل الـ float والـ ping عند تفعيله.
