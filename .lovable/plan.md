## الهدف
تبسيط ربط القنوات في `/agent` → `ChannelsPanel` عبر **OAuth بضغطة واحدة** لجميع المنصات الاجتماعية الرئيسية، مع إخفاء الإعدادات المتقدمة وإعادة تصميم الواجهة كبطاقات.

## القنوات المدعومة

| القناة | آلية الربط | ملاحظات |
|---|---|---|
| **LinkedIn** | OAuth (App User Connector) | scopes: `w_member_social`, `openid`, `profile` |
| **Google** (Gmail/Calendar) | OAuth (App User Connector) | scopes حسب الحاجة |
| **Facebook** (Pages) | OAuth (App User Connector) | scopes: `pages_manage_posts`, `pages_read_engagement` |
| **Instagram** (Business) | OAuth عبر Facebook Login | يتطلب حساب Instagram Business مرتبط بصفحة Facebook — هذا قيد من Meta لا يمكن تجاوزه |
| **X / Twitter** | OAuth 2.0 (App User Connector) | scopes: `tweet.read`, `tweet.write`, `users.read` |
| **Telegram** | تدفق مبسّط (لا OAuth) | زر يفتح BotFather + لصق التوكن + اختبار فوري |

> **ملاحظة Meta**: Instagram لا يدعم نشر مباشر للحسابات الشخصية — فقط حسابات Business عبر Facebook Graph API. سنوضح هذا للمستخدم في الواجهة.

---

## الخطوات

### 1) ربط الـ Connectors في الـ Workspace (مرة واحدة)
استدعاء `standard_connectors--connect` لكل من: `linkedin`, `google`, `facebook`, `x` (إذا متاح). إذا لم يتوفر connector رسمي لقناة ما → fallback يدوي للتوكن (مع رابط مباشر للحصول عليه).

### 2) البنية التحتية للـ OAuth
- `src/integrations/lovable/appUserConnector.ts` (خادم) — `authorizeAppUserOAuth` + `callAsAppUser`
- `src/integrations/lovable/appUserConnectorClient.ts` (متصفح) — `connectAppUser` (نافذة منبثقة + postMessage)

### 3) جدول `user_channel_connections` (migration)
```
user_id, provider (linkedin|google|facebook|instagram|x|telegram),
connection_id, account_name, account_id, scopes, meta jsonb, connected_at
```
+ RLS (المستخدم يدير اتصالاته فقط) + GRANT لـ `authenticated` و `service_role`.

### 4) Server Functions (`src/lib/channels.functions.ts`)
- `startConnect({provider, targetOrigin})` → يستدعي `authorizeAppUserOAuth` بـ `connectorId` و scopes حسب المنصة
- `saveChannelConnection({provider, connectionId, accountName})` → حفظ بعد نجاح OAuth
- `listMyChannels()` → القنوات المتصلة للمستخدم
- `disconnectChannel(id)`
- `publishTo({provider, content, mediaUrl?})` → router موحّد:
  - LinkedIn → `POST /v2/ugcPosts`
  - Facebook → `POST /{page-id}/feed`
  - Instagram → `POST /{ig-user-id}/media` ثم `/media_publish`
  - X → `POST /2/tweets`
  - Telegram → `sendMessage`
- `saveTelegramToken(token)` → اختبار `getMe` ثم حفظ

### 5) إعادة تصميم `ChannelsPanel`
- **بطاقات قنوات** (6 منصات) بدل النموذج اليدوي:
  - شعار المنصة + اسم القناة
  - حالة **غير متصل** → زر كبير "اتصل بـ X"
  - حالة **متصل** → اسم الحساب + شارة خضراء + زر "قطع الاتصال"
- زر OAuth يستدعي `connectAppUser` → نافذة منبثقة → عند النجاح يحفظ ويحدّث القائمة
- زر Telegram → Dialog مبسّط (حقل توكن + رابط BotFather + "اختبار وحفظ")
- Instagram يعرض تنبيه: "يتطلب حساب Instagram Business مرتبط بصفحة Facebook"
- "إعدادات متقدمة" خلف `<Collapsible>` (الـ webhook secrets، اختيار chat IDs، scopes إضافية)

### 6) تحديث منطق النشر في الوكيل
- `runAgentNow` / `runAgentCommand` يقرأ القنوات من `user_channel_connections`
- يستدعي `publishTo({provider, content})` الموحّد بدل الفروع المتعددة

---

## الملفات المتأثرة
- **جديد**: `appUserConnector.ts`, `appUserConnectorClient.ts`, `channels.functions.ts`, migration واحدة
- **تعديل**: `ChannelsPanel.tsx` (تصميم كامل), `agent.tsx` (استخدام `publishTo`), منطق النشر الداخلي

## ما لن يتغير
- منطق `runAgentCommand`, `ApprovalQueue`, Visibility — فقط طبقة "القنوات" تُبسَّط
- جدول `publish_channels` القديم يبقى للتوافق

## التحقق
- لكل منصة: ضغط "اتصل" → نافذة OAuth → اسم الحساب يظهر مع شارة خضراء
- Telegram: لصق توكن → اختبار → حفظ فوري
- Instagram: رسالة واضحة إذا الحساب ليس Business
- تشغيل أمر الوكيل → النشر يعمل عبر جميع القنوات المتصلة
