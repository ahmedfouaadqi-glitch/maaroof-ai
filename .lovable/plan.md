# خطة التحسين الشاملة

تركيز على ثلاث طبقات: **نظام التصميم (الجذر)**، **صفحة الأدوات والنتائج**، **الكرافيك والأنميشن**.

## 1) نظام التصميم — مستوحى من شعار MAAROOF Ai

استخراج الألوان من `src/assets/maaroof-ai-mark.png` (إنديغو عميق + سماوي/بنفسجي متوهج + ذهبي خفيف للأكسنت) وإعادة بناء `src/styles.css`:

- إعادة معايرة `--primary` و`--accent` و`--cyber*` لتطابق درجات الشعار بدقة (oklch).
- إضافة طبقة سطوح متدرجة: `--surface-1/2/3` بدل الاعتماد على `card/muted` فقط، لإعطاء عمق احترافي.
- خطوط: **Instrument Serif** للعناوين + **Work Sans** للجسم، مع fallback عربي (`Noto Kufi Arabic`, `Vazirmatn`). تحميلها عبر `<link>` في `src/routes/__root.tsx` (لا `@import` لروابط في styles.css).
- درجات ظلال/توهج جديدة: `--shadow-soft`, `--shadow-glow-strong`, `--ring-focus` متسقة عبر الموقع.
- تحديث `--gradient-hero` و`--gradient-text` بألوان الشعار، وإضافة `--gradient-border` (conic) للبطاقات المميزة.
- توحيد `--radius` على نظام (sm/md/lg/xl/2xl) واستخدامه بانتظام.

## 2) صفحة الأدوات `src/routes/tools.$slug.tsx`

إعادة تصميم بنية الصفحة لتبدو كتطبيق SaaS احترافي:

```text
┌─────────────────────────────────────────────────────┐
│  Sticky Sub-header: [icon] اسم الأداة · CostBadge · │
│                     [Run] [Reset] [Export] [Share]  │
├──────────────┬──────────────────────────────────────┤
│ Sidebar      │  Tabs: نظرة · المدخلات · النتائج ·   │
│ (الأدوات)    │        السجل · المساعدة              │
│ + بحث ⌘K    │  ────────────────────────────────    │
│ + مفضلة      │  Panel content (مع skeleton/empty/   │
│              │   error حالات احترافية)              │
└──────────────┴──────────────────────────────────────┘
```

تفاصيل:
- **Sidebar تبديل سريع** بين الأدوات بدون مغادرة الصفحة (مع تصنيفات: تحليل/توليد/مراقبة).
- **بحث `⌘K`** عبر `cmdk` (موجود في shadcn) لفتح أي أداة.
- **التبويبات** sticky تحت الهيدر مع underline متحرك.
- **عرض النتائج**: بطاقات منظمة (Summary cards + Details accordion + Sources list) بدل json خام؛ ExportButtons في كل قسم.
- **حالات**: Skeleton أثناء التحميل، Empty state مصور، Error مع زر إعادة المحاولة.
- **شريط تقدم** للعمليات الطويلة + زر إلغاء.
- حفظ آخر تبويب نشط في localStorage (موجود — يبقى).
- **موبايل**: Sidebar يتحول إلى Drawer سفلي، التبويبات scrollable أفقياً.

## 3) الصفحة الرئيسية والأقسام الرئيسية

- **Hero** (`src/routes/index.tsx`): تجديد التركيب — عنوان Instrument Serif كبير + sub-headline + CTA مزدوج + بصريات (Globe/EnginesOrbit) متناسبة مع الشبكة، Gradient mesh هادئ، RTL متقن.
- **SiteHeader**: شفافية ذكية على scroll، تحت scroll = blur + border، فوق = شفاف. زر CTA بارز.
- **Pricing / Guide / Maaroof**: مواءمة spacing وtypography مع النظام الجديد دون تغيير الوظائف.
- توحيد بطاقات الميزات على نمط واحد (نفس padding/radius/hover).

## 4) الكرافيك والأنميشن (مستوى 3 — متوازن)

- **Framer Motion** (موجود) لـ:
  - دخول الأقسام: `fade-in + slide-up` خفيف عند scroll (IntersectionObserver).
  - تبديل التبويبات: cross-fade 200ms.
  - بطاقات: hover-lift دقيق (translateY -2px + shadow-glow).
  - أرقام/إحصائيات: count-up.
- **Micro-interactions**: ripple على الأزرار الرئيسية، underline متحرك في الروابط (`story-link`).
- **Background**: Aurora/Grid Pattern خفيف من MagicUI خلف الهيرو + شبكة dot-pattern في الأقسام الداخلية.
- **EnginesOrbit / MaaroofGlobe**: تنعيم الحركة، تقليل CPU، إيقاف عند `prefers-reduced-motion`.
- **Page transitions**: fade خفيف بين الراوتس.

## 5) PWA + RTL polish

- مراجعة `theme_color` و`background_color` في `public/manifest.webmanifest` ليطابقا اللون الجديد.
- ضمان أن كل المكونات الجديدة `dir="rtl"`-safe (logical properties: `ms/me/ps/pe`).

---

## ملفات ستُعدّل (تقدير)

- `src/styles.css` — إعادة بناء tokens + gradients + shadows.
- `src/routes/__root.tsx` — تحميل الخطوط.
- `src/routes/tools.$slug.tsx` — البنية الجديدة (sidebar + tabs + result panels).
- `src/components/SiteHeader.tsx` — سلوك scroll + بحث ⌘K.
- `src/routes/index.tsx` — تجديد Hero والأقسام.
- `src/components/EnginesOrbit.tsx`, `MaaroofGlobe.tsx` — تنعيم الأنميشن.
- مكونات مشتركة جديدة: `ToolShell.tsx`, `ResultCard.tsx`, `EmptyState.tsx`, `SectionReveal.tsx`.
- `public/manifest.webmanifest` — لون الثيم.

## خارج النطاق (لن يُلمس)

- المنطق الخلفي وserver functions.
- مخطط قاعدة البيانات وRLS.
- محتوى المقالات/الأدلة.

---

**هل أبدأ التنفيذ بهذا الترتيب؟** (1) نظام التصميم → (2) صفحة الأدوات → (3) الرئيسية → (4) الأنميشن → (5) لمسات PWA/RTL.
