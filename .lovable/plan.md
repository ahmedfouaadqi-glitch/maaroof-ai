## الهدف
استبدال الشعار والاسم الحالي "GEO-Iraq / جيو-العراق" بالعلامة الجديدة **MAAROOF Ai** في كل اللغات والمواضع (الواجهة، التذييل، الـ SEO، التصدير، PWA)، مع إبقاء "GEO-Iraq" نصاً مصغّراً تحت الاسم/الشعار الجديد كإشارة للعلامة السابقة، وتحديث الألوان لتنسجم مع الهوية البصرية للشعار الجديد (أزرق نفطي عميق + ذهبي دافئ).

## الخطوات

### 1) إضافة أصول الشعار الجديد
- نسخ الصورة المرفوعة إلى `src/assets/maaroof-ai-logo.png` (للاستخدام في الهيدر والتصدير).
- نسخة مربّعة/أيقونة إلى `public/icon-512.png` (استبدال الأيقونة الحالية) لكي تظهر في PWA وفي علامة التبويب.
- نسخة OG (1200×630) إلى `public/og-maaroof.png` للمشاركة على الشبكات.

### 2) تحديث الهوية اللونية في `src/styles.css`
موائمة الـ tokens مع ألوان الشعار:
- `--primary` → أزرق تكنولوجي عميق مأخوذ من الشعار
- `--accent` → ذهبي/كهرماني دافئ
- `--cyber` و`--cyber-glow` وتدرّجات `--gradient-cyber` / `--gradient-text` و`--shadow-glow` تُعاد معايرتها على نفس العائلة
- `--background` يبقى داكناً ولكن مع لمسة أكثر نفطية لتنسجم مع الشعار

### 3) استبدال الاسم في الترجمات والـ UI
- في `src/lib/i18n.tsx`:
  - `brand` يصبح **MAAROOF Ai** في كل اللغات (EN/AR/KU) — الاسم الإنكليزي ثابت كما طلبت.
  - `footer` و`whatsapp_msg` وأي ذكر للاسم القديم يُحدّث.
- في `src/components/SiteHeader.tsx`: استبدال الأيقونة `Cpu` بصورة الشعار الجديد، وإظهار:
  - السطر الأول: **MAAROOF Ai** (font-display، أكبر)
  - السطر الثاني (مصغّر، مكتوم اللون): **GEO-Iraq** كإشارة للعلامة السابقة
- استبدال كل ظهور لـ "GEO-Iraq / جيو-العراق / GeoIraq" في الملفات التالية بـ MAAROOF Ai مع الحفاظ على ذكر "(formerly GEO-Iraq)" / "(سابقاً: جيو-العراق)" في التذييل فقط:
  `src/routes/__root.tsx`, `index.tsx`, `pricing.tsx`, `guide.tsx`, `contact.tsx`, `privacy.tsx`, `terms.tsx`, `auth.tsx`, `reset-password.tsx`, `profile.tsx`, `dashboard.tsx`, `agent.tsx`, `admin.tsx`, `admin_.pulse.tsx`, `u.$username.ts`, `sitemap[.]xml.ts`, `src/lib/pulse-i18n.ts`, `src/components/PrintAnalysisButton.tsx`.

### 4) تحديث الـ SEO وميتاداتا الجذر (`src/routes/__root.tsx`)
- `title`, `og:title`, `twitter:title` → "MAAROOF Ai · Become the Source AI Trusts"
- `og:site_name`, `apple-mobile-web-app-title` → "MAAROOF Ai"
- `og:image` / `twitter:image` → الصورة الجديدة `/og-maaroof.png`
- `theme-color` → اللون الأساسي الجديد
- JSON-LD: `name` للـ WebSite يصبح "MAAROOF Ai"، و`brand` يبقى "MAAROOF Ai" مع `alternateName: "GEO-Iraq"`.

### 5) تحديث PWA والملفات العامة
- `public/manifest.webmanifest`: `name` و`short_name` و`description` → MAAROOF Ai.
- `public/llms.txt`: تحديث الاسم والوصف مع الإبقاء على ذكر GEO-Iraq كاسم سابق.
- `public/robots.txt`: تحديث أي تعليق فيه الاسم.

### 6) التصدير (PDF/Excel) — إضافة الشعار
في `src/lib/exports.ts`:
- تحويل `src/assets/maaroof-ai-logo.png` إلى base64 (import as URL ثم fetch→dataURL أو import مباشر) لاستخدامه في رأس الـ PDF.
- ثوابت `BRAND` تصبح "MAAROOF Ai" و`SITE` يبقى `geoiraq.com` حالياً (الدومين لم يتغير).
- في توليد PDF: إدراج الشعار أعلى الصفحة، السطر الأول الاسم الجديد بخط بارز، السطر الثاني مصغّر "formerly GEO-Iraq".
- في Excel: إضافة صف رأس بالاسم الجديد + سطر صغير بالاسم السابق.
- تحديث نصوص الـ Disclaimer لتذكر MAAROOF Ai (مع إبقاء الإشارة "formerly GEO-Iraq" مرة واحدة).
- نفس المعالجة في `src/lib/pulse-export.ts` و`src/components/PrintAnalysisButton.tsx` (رأس الطباعة).

### 7) فحص نهائي
- مراجعة الـ preview على المسارات الرئيسية (/, /pricing, /guide, /pulse, /admin) للتأكد من أن الهيدر يعرض الشعار الجديد + الاسم المصغّر القديم.
- توليد PDF تجريبي من زر التصدير للتحقق من ظهور الشعار.

## ملاحظات تقنية
- الدومين والمسارات (`geoiraq.com`) لن تتغير في هذه المهمة — فقط الاسم المرئي والشعار.
- يبقى "GEO-Iraq" مرئياً كـ "العلامة السابقة" في: الهيدر (سطر مصغّر تحت الاسم)، التذييل، رأس التصدير. لا يظهر في عناوين الصفحات أو الـ SEO meta.
- لن أعدّل `src/integrations/supabase/*` ولا `src/routeTree.gen.ts`.
