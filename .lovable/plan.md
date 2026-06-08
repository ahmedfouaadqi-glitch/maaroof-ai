# Wave 4 — Continuation Plan

## 1) نقل "تحليل الظهور في محركات الذكاء" إلى "تعزيز العلامة التجارية"

- إزالة بطاقة/تبويب AI Visibility المستقلة من `/agent` ومن قائمة الأدوات.
- داخل `BrandBoostAgent.tsx` إضافة قسم جديد بعنوان **"تحليل الظهور في محركات الذكاء"** يستضيف `<VisibilityPanel embedded toolKey="brand" />`.
- تحديث الشرح (الوصف) ليكون موحّداً:
  - AR: "افحص ظهور علامتك في ChatGPT و Gemini و Perplexity وغيرها، واحصل على توصيات فورية لتعزيز حضورك ضمن حزمة تعزيز العلامة."
  - EN / KU مطابقتان.
- تحديث `tool-catalog.ts`: إزالة مفتاح `visibility` المستقل والإبقاء على `brand_boost` فقط (مع تحديث `agent.visibility` ليشير داخلياً إلى نفس الـ handler).
- تحديث الروابط في `tool-handoff.ts` و i18n keys (`ag_vis_*` تنتقل تحت `bb_vis_*`).
- إزالة عرض الكارد المكرر من `dashboard.tsx` و `tools.$slug.tsx` (slug=visibility يعيد توجيه إلى `/tools/brand-boost#visibility`).

## 2) دمج لوحات الإدارة في لوحة واحدة

دمج 4 لوحات في `admin.tsx` ضمن لوحة تبويبية واحدة باسم **"المستخدمون والصلاحيات والأسعار"**:

| التبويب الجديد | يحتوي |
|---|---|
| المستخدمون والـ Tokens | `AdminTokensPanel` (الحالي + تعديلات Wave 3) |
| شبكة أسعار الخطط | `AdminPlanPricingPanel` |
| الخطط والصلاحيات | `subscription_plans` + `tool_plan_access` (محرر موحّد) |
| الوكيل | إعدادات `agent_addons` + حدود `user_agent_subscriptions` |

- ملف موحّد جديد: `src/components/admin/AdminUsersAndPricingPanel.tsx` يحتوي على `<Tabs>` داخلية.
- مشاركة الـ context (قائمة المستخدمين، قائمة الأدوات من `TOOL_CATALOG`) عبر hook واحد `useAdminPricingContext()` لتجنّب جلب البيانات مرتين.
- في "إدارة" بجانب اسم المستخدم: Drawer واحد يفتح على 4 تبويبات (Tokens / الخطط / الأدوات / الوكيل) بدل drawerين منفصلين.

## 3) إكمال البنود السابقة بالترتيب

1. **Telegram BYOB** — تطبيق `saveUserTelegramBot()`، تحويل webhook إلى `/api/public/telegram/webhook/$botId.ts`، إزالة `process.env.TELEGRAM_BOT_TOKEN` من `agent.functions.ts` و `notify.server.ts`.
2. **OAuth حقيقي لكل مستخدم** — LinkedIn/TikTok/YouTube عبر App User Connector، Facebook/Instagram/X/WhatsApp ك "قريباً".
3. **تبويبات `/agent`** — فصل "المهام الحالية" عن "السجل السابق" بـ `<Tabs>` + i18n keys.

## ترتيب التنفيذ

1. نقل AI Visibility إلى Brand Boost + تحديث النصوص و i18n + حذف البطاقة القديمة.
2. دمج لوحات الإدارة في `AdminUsersAndPricingPanel.tsx` + ربطها في `admin.tsx`.
3. Telegram BYOB (migration للحقول الجديدة في `publish_channels.config` إن لزم).
4. OAuth (LinkedIn أولاً).
5. تبويبات `/agent`.
6. اختبار شامل.

## تفاصيل تقنية

- `BrandBoostAgent.tsx`: إضافة `<section id="visibility">` يحوي `VisibilityPanel` بـ `embedded` و `toolKey="brand"`.
- `admin.tsx`: استبدال 4 imports بـ import واحد `AdminUsersAndPricingPanel`.
- `tool-catalog.ts`: تعليم `visibility` بـ `deprecated: true` بدل حذفها لتجنّب كسر سجلات `token_ledger` القديمة؛ المفتاح يبقى مقبولاً في `chargeTokens` لكن يُعرض ضمن brand_boost في الواجهة.
- لا حاجة لـ migration جديد لـ schema — فقط تنظيم واجهة.

هل أنفّذ بهذا الترتيب؟