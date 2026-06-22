# نظام أنميشن موحّد للموقع بالكامل

## الهدف
استبدال الأنميشنات المتفرقة (durations/easings عشوائية، حركات مكررة في كل مكون) بنظام واحد متّسق يحترم `prefers-reduced-motion`، ويُطبَّق على: التبويبات، الأزرار، التحميل (skeleton/spinner)، فتح/إغلاق الـ dialogs/sheets، ظهور الأقسام عند التمرير، وانتقالات الصفحات.

## 1) طبقة التوكنز (`src/styles.css`)
إضافة متغيّرات حركة موحّدة:
```
--motion-duration-fast: 150ms
--motion-duration-base: 240ms
--motion-duration-slow: 420ms
--motion-ease-standard: cubic-bezier(.2,.7,.2,1)
--motion-ease-emphasized: cubic-bezier(.2,.9,.1,1)
--motion-ease-exit: cubic-bezier(.4,.0,1,1)
```
+ بلوك `@media (prefers-reduced-motion: reduce)` يصفّر كل durations ويعطّل الـ transforms.

## 2) Keyframes/Utilities مشتركة (Tailwind v4 عبر `@theme` في styles.css)
- `fade-in`, `fade-in-up`, `scale-in`, `slide-in-right/left`, `shimmer`, `pulse-soft`
- utility classes: `.motion-safe-fade`, `.motion-press` (نقرة الأزرار: scale .98)، `.hover-lift`, `.reveal` (للظهور عند التمرير).

## 3) مكوّن `Reveal` موحّد
`src/components/motion/Reveal.tsx` يستخدم `IntersectionObserver` (بدون مكتبة جديدة) ويطبّق `fade-in-up` عند الظهور. يحلّ محل أي `framer-motion` متفرّق في الأقسام، ويُحترم فيه reduced-motion.

## 4) الأزرار (`src/components/ui/button.tsx`)
- `transition-[transform,background,box-shadow,opacity] duration-[var(--motion-duration-fast)] ease-[var(--motion-ease-standard)]`
- `active:scale-[.98]` + `hover:-translate-y-[1px]` للـ variant الأساسي
- حالة `loading`: spinner موحّد + `aria-busy`.

## 5) التبويبات (`src/components/ui/tabs.tsx` + استخدامها في `tools.$slug.tsx`)
- مؤشر متحرّك (underline) عبر `data-state=active` + `transition-all` بمدة `base`
- محتوى التبويب: `data-[state=inactive]:opacity-0 data-[state=active]:animate-fade-in` بدل cross-fades يدوية.

## 6) التحميل (Skeleton/Spinner)
- `src/components/ui/skeleton.tsx`: shimmer موحّد يعتمد التوكنز.
- مكوّن `Spinner` صغير موحّد يُستخدم في الأزرار والصفحات بدلاً من spinners مختلفة.

## 7) الـ Overlays (Dialog/Sheet/Drawer/Popover)
ضبط classes الـ Radix لتستخدم نفس التوكنز:
- enter: `fade-in` + `scale-in` (duration base)
- exit: `fade-out` + `scale-out` (duration fast, ease-exit)
- backdrop: fade فقط.

## 8) انتقالات الصفحات (Router-wide)
في `src/routes/__root.tsx` تغليف `<Outlet />` بـ `<div key={location.pathname} className="animate-fade-in">` لانتقال موحّد بين الصفحات (بدون مكتبة).

## 9) تطبيق على كل الصفحات/الأقسام
- `index.tsx` (Hero + الأقسام): استبدال أي حركات مخصّصة بـ `<Reveal>` + utilities.
- `tools.$slug.tsx`: tabs/cards/results عبر النظام الجديد.
- `pricing.tsx`, `guide.*`, `maaroof.tsx`, `contact.tsx`, `dashboard.tsx`, `admin.tsx`: تمرير الأقسام داخل `<Reveal>` وإزالة الـ inline animations المتكرّرة.
- مكوّنات: `EnginesOrbit`, `MaaroofGlobe`, `MatrixRain` تبقى كما هي لكن تُعطَّل تلقائياً عند reduced-motion عبر CSS guard.

## 10) Reduced Motion (إلزامي)
- CSS guard عام في `styles.css`.
- داخل `Reveal` نتحقّق من `window.matchMedia('(prefers-reduced-motion: reduce)')` ونعرض المحتوى فوراً بدون transform.

## الملفات المتأثرة
- `src/styles.css` (توكنز + keyframes + utilities + reduced-motion guard)
- جديد: `src/components/motion/Reveal.tsx`, `src/components/ui/spinner.tsx`
- تعديل: `src/components/ui/button.tsx`, `tabs.tsx`, `dialog.tsx`, `sheet.tsx`, `drawer.tsx`, `popover.tsx`, `skeleton.tsx`
- `src/routes/__root.tsx` (page transition)
- صفحات: `index.tsx`, `tools.$slug.tsx`, `pricing.tsx`, `guide*.tsx`, `maaroof.tsx`, `contact.tsx`, `dashboard.tsx`, `admin.tsx`

## خارج النطاق
- لا تغييرات على المنطق/الـ backend.
- لا إضافة مكتبات جديدة (نعتمد CSS + IntersectionObserver فقط).

هل أبدأ التنفيذ بهذا الترتيب: (1) التوكنز والـ utilities → (2) الأزرار/التبويبات/الـ overlays → (3) Reveal وانتقال الصفحات → (4) تمرير الأقسام في كل الصفحات؟
