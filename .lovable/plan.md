## الهدف
كل مستخدم يربط حساباته الشخصية بنفسه بنقرة واحدة من صفحة `/agent` → `ChannelsPanel`.

## آلية الربط لكل منصة

| القناة | الآلية | تجربة المستخدم |
|---|---|---|
| **LinkedIn** | App User OAuth | زر "اتصل بـ LinkedIn" → نافذة منبثقة → موافقة → اسم الحساب يظهر |
| **Google** (Gmail/Calendar) | App User OAuth | زر "اتصل بـ Google" → نافذة منبثقة → موافقة → البريد يظهر |
| **Telegram** | Bot link (الحالي مُبسَّط) | زر "اتصل بـ Telegram" → يفتح بوت → Start → ربط فوري |
| **Facebook** (Pages) | لصق Access Token | زر "اتصل" → Dialog فيه رابط مباشر لصفحة Meta لتوليد التوكن + حقل لصق + اختبار |
| **Instagram** (Business) | لصق Access Token | نفس تجربة Facebook (يستخدم نفس نظام Meta Graph) |
| **X / Twitter** | لصق Bearer Token | زر "اتصل" → Dialog فيه رابط لـ developer.twitter.com + حقل لصق + اختبار |

> **ملاحظة صريحة في الواجهة**: Facebook/Instagram/X لا تملك Connector جاهز في Lovable حالياً، لذلك ربطها يتطلب لصق توكن من حساب المطوّر الخاص بكل منصة. سنوضح هذا للمستخدم برابط مباشر وشرح من 3 خطوات داخل الـ Dialog.

---

## الخطوات التقنية

### 1) ربط الـ App Connectors اللازمة (مرة واحدة في الـ Workspace)
- `linkedin` connector (موجود مسبقاً)
- `google_mail` و `google_calendar` connectors (سأطلب الموافقة في build mode)
- ستوفر متغير `LINKEDIN_APP_USER_CONNECTOR_CLIENT_ID` و `GOOGLE_APP_USER_CONNECTOR_CLIENT_ID` تلقائياً

### 2) ملفات البنية التحتية
- `src/integrations/lovable/appUserConnector.ts` (server) — `authorizeAppUserOAuth`, `callAsAppUser`
- `src/integrations/lovable/appUserConnectorClient.ts` (browser) — `connectAppUser` (popup + postMessage)

### 3) Migration: تمديد جدول `publish_channels` الموجود
- إضافة أعمدة: `provider_account_id text`, `connection_id text`, `connected_via text` (oauth/manual/bot)
- توسيع `kind` لقبول: `facebook`, `instagram`, `x`, `gmail`
- لا تغيير في RLS (القائمة كافية: المستخدم يدير قنواته فقط)

### 4) Server Functions جديدة في `src/lib/channels.functions.ts`
- `startLinkedInConnect(targetOrigin)` → `authorizeAppUserOAuth` مع scopes النشر
- `startGoogleConnect(targetOrigin)` → نفس الفكرة لـ Gmail
- `saveOAuthConnection({provider, connectionId})` → يجلب اسم الحساب من المزوّد + يحفظ في `publish_channels`
- `saveManualToken({provider, token, accountLabel?, extra?})` → لـ FB/IG/X: يختبر التوكن (طلب `/me`) ثم يحفظ
- `publishViaConnection(channelId, text, mediaUrl?)` → router موحّد ينشر حسب نوع القناة

### 5) إعادة تصميم `ChannelsPanel.tsx`
- شبكة من 6 بطاقات بدل القائمة الحالية
- كل بطاقة: شعار + اسم المنصة + حالة (متصل ✓ مع اسم الحساب / غير متصل / قريباً)
- **متصل** → زر "فصل" + خيار "نشر تلقائي / موافقة قبل النشر" + خيار "استلم الإشعارات هنا"
- **غير متصل** → زر "اتصل" يفتح:
  - LinkedIn/Google → popup OAuth
  - Telegram → بوت في تبويب جديد (الحالي)
  - FB/IG/X → Dialog فيه: شرح + رابط مباشر للحصول على التوكن + حقل لصق + زر "اختبر واحفظ"
- "إعدادات متقدمة" خلف `<Collapsible>` (للـ Page ID, Instagram Business ID, إلخ)

### 6) تحديث منطق النشر
- `publishToTelegram` و `publishToLinkedIn` الحاليان يبقيان، نضيف:
  - `publishToLinkedInAsUser(connectionId, text)` → عبر `callAsAppUser`
  - `publishToFacebookPage(token, pageId, text)`, `publishToInstagram(token, igUserId, text, mediaUrl)`, `publishToX(bearer, text)`
- `runAgentNow` / `approveAndPublish` يقرأ القناة ثم يستدعي `publishViaConnection`

---

## ما لن يتغير
- منطق الوكيل (`runAgentCommand`), `ApprovalQueue`, جدول `agent_tasks`, نظام Tokens
- صفحات الأدوات الأخرى

## التحقق
- LinkedIn/Google: نقرة → popup → اسم الحساب يظهر بشارة خضراء
- Telegram: نقرة → بوت → Start → ربط فوري
- FB/IG/X: لصق توكن → اختبار يرجع اسم الحساب → حفظ
- تشغيل أمر الوكيل → النشر يعمل على القناة المتصلة
