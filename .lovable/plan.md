
# Wave 4 — تحكّم شامل بظهور كل شيء لكل مستخدم + شريط وحدات محسّن

## 1) إصلاح فوري: إخفاء/إيقاف الأدوات لا يُطبَّق

**السبب:** `per_user_tool_overrides[toolKey].enabled=false` يُحترَم فقط داخل `tokens.server.ts` عند الشحن، أمّا بطاقات الأدوات في `/agent`, `/dashboard`, `/tools/$slug` فتُعرَض دائماً من `TOOL_CATALOG` مباشرةً.

## 2) منظومة "Visibility Profile" لكل مستخدم

عمود JSON جديد على `profiles`:

```
ui_visibility jsonb DEFAULT '{}'::jsonb
-- مثال:
{
  "tools":      { "analyze": true,  "brand_boost": false, ... },
  "agent":      { "command": true,  "run_targets": false, "visibility": true },
  "widgets":    { "tokens_bar": true, "cost_badge": true, "progress_bar": true,
                  "results_export": false, "history": true, "alerts_bell": true,
                  "handoff_menu": false, "engines_orbit": true, ... },
  "pages":      { "dashboard": true, "agent": true, "tools": true, "guide": true }
}
```

**المنطق:** غياب المفتاح = ظاهر افتراضياً (back-compat). `false` صريح = مخفي.

### Server function موحّدة
`src/lib/visibility.functions.ts`:
- `getMyVisibility()` — يدمج `ui_visibility` + قيود الخطة + override الأدوات + سعر كل أداة المُحلّ.
- يُعيد:
```ts
{
  tools: { [key]: { visible, enabled, tokens_per_use, usd_per_use, label_override? } },
  widgets: { [key]: boolean },
  pages: { [key]: boolean }
}
```

### Hook + Provider عميل
`src/lib/visibility.tsx` — `<VisibilityProvider>` في `__root.tsx`، يكشف:
- `useToolVisibility(key)` → `{ visible, enabled, price }`
- `useWidgetVisible(key)` → boolean
- `usePageVisible(key)` → boolean (مع redirect إلى `/` لو ممنوع)

### نقاط التطبيق
- `agent.tsx`, `dashboard.tsx`, `tools.$slug.tsx`: فلترة بطاقات الأدوات.
- `tools.$slug.tsx`: redirect إذا `tools[slug].visible=false`.
- `SiteHeader.tsx`, `AlertsBell.tsx`, `HandoffMenu.tsx`, `EnginesOrbit.tsx`, `ExportButtons.tsx`, ... : إخفاء كامل عند `widgets.X=false`.
- `CostBadge.tsx`: عرض السعر الفعلي للمستخدم من `useToolVisibility(key).price` (override → plan → "غير مفعّل").

## 3) شريط الوحدات المحسّن (Tokens Bar)

مكوّن جديد `src/components/TokensBar.tsx`:

```
┌──────────────────────────────────────────────────┐
│ 🪙 رصيدك: 1,250 / 5,000        اليوم: 120/500    │
│ ▓▓▓▓▓▓▓▓░░░░░░░░░░  25%        ▓▓▓▓░░░░░░░ 24%  │
│ الشهر: 2,100/20,000  •  تجديد خلال 12 يوم        │
└──────────────────────────────────────────────────┘
```

**ميزات:**
- ثلاث progress bars: balance / daily / monthly (لون متدرّج: أخضر/أصفر/أحمر).
- توقّع نضوب الرصيد ("≈ 8 أيام بمعدّل استخدامك").
- زر "ترقية" يظهر تلقائياً تحت 20%.
- يحترم `widgets.tokens_bar` (إخفاء كامل) و `profiles.hide_usage_counter` (الأرقام فقط).
- بطاقة صغيرة في `dashboard` + شريط مدمج في `SiteHeader`.

**تحكّم الإدارة:** كل القيم تُعدَّل من `AdminUsersTokensPanel` (balance, daily/monthly limits, used today/month, hide_usage_counter, widgets.tokens_bar).

## 4) واجهة الإدارة: تبويب "ظهور الواجهة" داخل drawer المستخدم

في drawer إدارة المستخدم — تبويب رابع **"ما يراه المستخدم"** بثلاث أقسام checkbox tree:

```
☑ الأدوات (16)              [إلغاء الكل] [الكل]
  ☑ تحليل GEO       السعر: [10] tokens  [____] USD
  ☐ Brand Boost     السعر: [50] tokens  [____] USD  ← مخفي
  ☑ مولّد المنشورات   السعر: [5 ] tokens  [____] USD
  ...

☑ ميزات الوكيل (3)
  ☑ أمر مباشر
  ☐ تشغيل الأهداف   ← مخفي
  ☑ فحص الظهور

☑ عناصر الواجهة (12)
  ☑ شريط الوحدات (tokens_bar)
  ☑ شارة التكلفة على البطاقات (cost_badge)
  ☑ شريط التقدّم أثناء التشغيل (progress_bar)
  ☐ أزرار التصدير (results_export)
  ☑ سجل التشغيلات (history)
  ☑ جرس الإشعارات (alerts_bell)
  ☐ قائمة Handoff بين الأدوات (handoff_menu)
  ☑ شاشة محركات AI الدوّارة (engines_orbit)
  ...

☑ الصفحات
  ☑ /dashboard   ☑ /agent   ☑ /tools   ☐ /guide
```

- كل صف: checkbox + (للأدوات) حقلَي السعر inline.
- زر "حفظ" يكتب `ui_visibility` + `per_user_tool_overrides` معاً في transaction واحد.
- زر "نسخ من خطة..." لاستيراد إعدادات افتراضية من خطة موجودة.
- زر "إعادة للوضع الافتراضي" يمسح overrides ويعود لخطة المستخدم.

## 5) سجل التكاليف الطبيعي بالواجهة

- `CostBadge` يعرض السعر بصيغة بشرية: **"5 وحدات"** أو **"$0.15"** أو **"مجاناً"** أو **"غير متاح"**.
- داخل كل أداة قبل التشغيل: tooltip صغير "ستُستهلك X وحدة من رصيدك (يتبقّى Y)".
- بعد التشغيل: toast "تم خصم X وحدة • رصيدك الجديد Y".

## ملفات جديدة / معدَّلة

| الملف | العمل |
|---|---|
| migration | `profiles.ui_visibility jsonb` |
| `src/lib/visibility.functions.ts` | جديد — server fn |
| `src/lib/visibility.tsx` | جديد — Provider + hooks |
| `src/components/TokensBar.tsx` | جديد |
| `src/components/CostBadge.tsx` | تحديث للسعر المُحلّ |
| `src/components/admin/AdminUserVisibilityTab.tsx` | جديد — التبويب الرابع |
| `src/components/admin/AdminTokensPanel.tsx` | دمج التبويب الجديد في الـ drawer |
| `src/routes/__root.tsx` | إضافة `VisibilityProvider` |
| `src/routes/agent.tsx` `dashboard.tsx` `tools.$slug.tsx` | فلترة بالـ visibility |
| `src/components/SiteHeader.tsx` `AlertsBell.tsx` `HandoffMenu.tsx` `ExportButtons.tsx` `EnginesOrbit.tsx` | احترام `widgets.*` |

## ترتيب التنفيذ

1. Migration `ui_visibility` + helper SQL.
2. `visibility.functions.ts` + Provider + hooks.
3. تطبيق على بطاقات الأدوات (إصلاح bug الإخفاء فوراً).
4. `AdminUserVisibilityTab` (شجرة الـ checkboxes الكاملة).
5. `TokensBar` الجديد + إدماجه.
6. تحديث `CostBadge` + toasts الطبيعية.
7. تطبيق `widgets.*` على بقية المكوّنات.

هل أبدأ؟
