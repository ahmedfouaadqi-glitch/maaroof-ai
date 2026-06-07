## الهدف
ربط حسابات المستخدم الحقيقية على مواقع التواصل (وليس روابط مشاركة) + نظام موافقة مرن: المستخدم يحدّد لكل قناة هل يعمل الوكيل تلقائياً أو ينتظر موافقته قبل النشر.

---

## واقع OAuth لكل منصة (شفافية كاملة)

| القناة | الربط الحقيقي الممكن | السبب |
|---|---|---|
| **LinkedIn** | ✅ OAuth لكل مستخدم — حساب + صفحات الشركة | متاح عبر Lovable App User Connector |
| **TikTok** | ✅ OAuth لكل مستخدم | connector متاح |
| **Telegram** | ✅ ربط القناة/المجموعة عبر إضافة البوت كأدمن + deep link | bot-based |
| **YouTube** | ✅ OAuth (Google) لكل مستخدم — رفع فيديوهات/منشورات Community | عبر App User Connector (Google) |
| **Facebook / Instagram** | ⚠️ يتطلب **Meta App Review** (5-15 يوم انتظار) + Business verification — لن نوفّره الآن | لا API نشر مجاني بدون موافقة Meta |
| **X (Twitter)** | ⚠️ يتطلب اشتراك X API المدفوع ($200/شهر) لـ write scope | سياسة X الجديدة |
| **WhatsApp Business** | ⚠️ يتطلب Meta Business + رقم تجاري معتمد | مكلف ومعقد |

**القرار**: نطلق فوراً **LinkedIn + TikTok + Telegram + YouTube** بـ OAuth حقيقي لكل مستخدم. نضع Facebook/Instagram/X/WhatsApp كـ **"قريباً — بانتظار اعتماد Meta/X"** بدل إخفائها، حتى يعرف المستخدم بالخارطة.

---

## نظام الموافقة (Approval Mode)

عمود جديد في `publish_channels`:
```sql
approval_mode text NOT NULL DEFAULT 'manual'  -- 'auto' | 'manual'
```

- **manual** (افتراضي): الوكيل يولّد المنشور، يحفظه في `agent_tasks` بحالة `pending_approval`، يرسل إشعاراً للمستخدم بـ "اضغط ✅ للنشر أو ✏️ للتعديل أو ❌ للرفض".
- **auto**: الوكيل ينشر مباشرة بدون انتظار، حسب القواعد المحفوظة في `agent_targets` (التكرار، المواضيع، اللغة، الحد الأقصى يومياً).

كل قناة لها mode مستقل (يمكن LinkedIn=auto و Telegram=manual).

---

## Migration

```sql
ALTER TABLE public.publish_channels
  ADD COLUMN IF NOT EXISTS approval_mode text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS external_account_id text,   -- LinkedIn member URN, TikTok open_id, YouTube channelId
  ADD COLUMN IF NOT EXISTS scopes jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.agent_tasks
  ADD COLUMN IF NOT EXISTS approval_status text DEFAULT 'none',  -- 'none'|'pending'|'approved'|'rejected'
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approval_channel_id uuid REFERENCES public.publish_channels(id) ON DELETE SET NULL;

-- صندوق إشعارات داخل التطبيق
CREATE TABLE public.user_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,             -- 'analysis_done'|'approval_needed'|'post_published'|'alert'
  title text NOT NULL,
  body text,
  link text,                       -- e.g. /agent?task=<id>
  task_id uuid REFERENCES public.agent_tasks(id) ON DELETE CASCADE,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.user_notifications TO authenticated;
GRANT ALL ON public.user_notifications TO service_role;
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notifications" ON public.user_notifications
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_notif_user_unread ON public.user_notifications(user_id, read_at) WHERE read_at IS NULL;
```

---

## الملفات الجديدة

### Per-user OAuth infrastructure
- `src/integrations/lovable/appUserConnector.ts` (server) — `authorizeAppUserOAuth`, `callAsAppUser`
- `src/integrations/lovable/appUserConnectorClient.ts` (client) — `connectAppUser` popup helper

### Channel functions
- `src/lib/publish.functions.ts`:
  - `startLinkedInConnect(targetOrigin)` → popup OAuth → نحفظ `connection_id` + `external_account_id` (member URN) + scopes
  - `startTikTokConnect(targetOrigin)` → نفس النمط
  - `startYouTubeConnect(targetOrigin)` → عبر Google App User Connector
  - `startTelegramLink()` → deep link `t.me/<bot>?start=<token>`
  - `disconnectChannel({id})`
  - `setChannelApprovalMode({id, mode: 'auto'|'manual'})`
  - `approveTask({taskId, channelId, edits?})` → ينشر فوراً عبر `callAsAppUser`
  - `rejectTask({taskId})`
  - `listPendingApprovals()`
  - `listNotifications()`, `markNotificationRead({id})`

### Notification core
- `src/lib/notify.server.ts` — `notifyUser(userId, kind, title, body?, link?, taskId?)` يكتب في `user_notifications` ويرسل Telegram إن كانت القناة المفضلة.

### Webhook + UI
- `src/routes/api/public/telegram/webhook.ts` — `/start <token>` + استقبال أزرار "✅ نشر / ❌ رفض" inline keyboards
- `src/components/ChannelCard.tsx` — أيقونة، اسم، حالة، scopes، toggle (auto/manual)، زر اتصال/قطع
- `src/components/ApprovalQueue.tsx` — قائمة المنشورات المعلّقة في `/agent` مع أزرار ✅/✏️/❌
- `src/components/NotifyInbox.tsx` — جرس في الهيدر، badge للعدد غير المقروء
- `src/components/NotifyOnboardModal.tsx` — يظهر مرة عند `notify_onboarded=false`

---

## تعديل `src/routes/agent.tsx`

استبدال قسم القنوات بثلاثة أقسام:

```
┌─ 🔗 قنوات الربط (OAuth حقيقي) ──────────────────────┐
│ LinkedIn   ✅ علي القاضي · post,r_basicprofile │ [قطع] │
│            ◉ موافقة قبل النشر  ○ نشر تلقائي         │
│ TikTok     – غير متصل                          [اتصال] │
│ YouTube    – غير متصل                          [اتصال] │
│ Telegram   ✅ @ahmed_channel                   [قطع]  │
│            ◉ موافقة قبل النشر  ○ نشر تلقائي         │
└──────────────────────────────────────────────────────┘

┌─ ⏳ بانتظار موافقتك (3) ────────────────────────────┐
│ "هل تعرف أن…" → LinkedIn   [✅] [✏️] [❌]            │
│ ...                                                  │
└──────────────────────────────────────────────────────┘

┌─ ⏰ قريباً (بانتظار اعتماد Meta/X) ──────────────────┐
│ Facebook · Instagram · X · WhatsApp                  │
└──────────────────────────────────────────────────────┘
```

كل النماذج التقنية (token, api_key, webhook_url, chat_id يدوي) **محذوفة**.

---

## تعديل منطق الوكيل

في `src/lib/agent.functions.ts` → `runAgentNow`:
- بعد توليد منشور لكل هدف، نراجع `publish_channels` للمستخدم:
  - إن وُجدت قناة بـ `approval_mode='auto'` ومطابقة لهدف القناة → ننشر فوراً عبر `callAsAppUser`.
  - وإلا نضع `agent_tasks.approval_status='pending'` ونستدعي `notifyUser(kind:'approval_needed', link:'/agent#pending')`.

في Telegram webhook: عند ضغط زر inline "✅ نشر" → `callback_query` يستدعي `approveTask()` ويرسل تأكيداً.

---

## i18n
مفاتيح جديدة AR/EN/KU لكل النصوص الجديدة (Channel cards, Approval queue, Notify inbox, Onboarding modal).

---

## الأسرار المطلوبة (سأطلبها بعد الموافقة)
- `TELEGRAM_BOT_TOKEN` — من @BotFather
- `TELEGRAM_BOT_USERNAME` — مثل `MaaroofAiBot`
- LinkedIn / TikTok / YouTube App User Connector client IDs — تُربط من قائمة Connectors في Lovable (سأستخدم `standard_connectors--connect` لـ TikTok و Google عند الحاجة)

---

## ترتيب التنفيذ
1. Migration (الأعمدة + `user_notifications`)
2. ملفات OAuth الأساسية + `notify.server.ts`
3. Telegram webhook + `startTelegramLink` + طلب أسرار البوت
4. LinkedIn per-user OAuth (يحل محل الحساب المشترك)
5. TikTok + YouTube (إن وافق المستخدم على ربط connectors إضافية)
6. واجهة `/agent` الجديدة + Approval Queue + Notify Inbox
7. Onboarding modal + i18n
8. اختبار end-to-end (LinkedIn + Telegram)

اضغط **Implement plan** للبدء.
