## 1) لماذا تظهر آخر مهام الوكيل مع السجل القديم؟

السبب الذي رصدته في `src/routes/agent.tsx` السطر 116:
```ts
supabase.from("agent_tasks").select("*").eq("user_id", user.id)
  .order("created_at", { ascending: false }).limit(20);
```
- الاستعلام يجلب **كل المهام التاريخية** (آخر 20) بدون فلترة حسب الجلسة/التشغيل الحالي.
- لا يوجد تمييز بصري بين "مهام الجلسة الحالية" و"السجل السابق".
- بعد كل ضغطة "تشغيل الآن" يُحدّث `load()` فيختلط الجديد بالقديم في نفس القائمة.

**الإصلاح المقترح:**
- إضافة عمود `run_id uuid` و `run_started_at timestamptz` إلى `agent_tasks` (يُملأ في `runAgentNow`).
- تقسيم الواجهة إلى تبويبين: **"تشغيل حالي"** (مهام آخر `run_id`) و **"السجل"** (الباقي بترقيم صفحات).
- زر "مسح السجل" يحذف ما قبل آخر run.

---

## 2) تحليل الظهور (AI Visibility) — التأكد

موجود ويعمل:
- مكوّن `src/components/AIVisibility.tsx` يستدعي `/api/visibility`.
- في `agent.tsx` نوع المهمة `ai_visibility` يُعرض مع `visibility_percent` و `sentiment` (السطر 496-498).

**ما سنضيفه للتثبيت:**
- بطاقة "تحليل الظهور" بارزة أعلى صفحة `/agent` تعرض آخر نتيجة + زر "تشغيل الآن".
- إضافة `ai_visibility` كهدف افتراضي عند أول تشغيل للوكيل (إن لم يوجد).
- ربط نتيجة الظهور بإشعار `analysis_done` عبر `notifyUser`.

---

## 3) ربط جميع حسابات التواصل الاجتماعي (الحل الكامل)

**المبدأ:** نستخدم **Lovable App User Connector** (OAuth لكل مستخدم) للمنصات التي تدعمه، و **bot-based** لتيليجرام، ونعرض حالة شفافة للباقي.

| المنصة | الحل | الحالة |
|---|---|---|
| **LinkedIn** (شخصي + صفحات شركة) | App User Connector OAuth | ✅ متاح فوراً |
| **TikTok** | App User Connector OAuth | ✅ متاح فوراً |
| **YouTube** (Google) | App User Connector OAuth | ✅ متاح فوراً |
| **Telegram** (قنوات/مجموعات) | Bot + deep link `/start <token>` | ✅ يعمل (يحتاج `TELEGRAM_BOT_TOKEN`) |
| **Facebook Pages + Instagram Business** | Meta App Review (5-15 يوم) | ⏳ نضع زر "تقديم طلب الربط" يفتح تذكرة داخلية |
| **X (Twitter)** | يتطلب X API المدفوع ($200/شهر) | ⏳ نعرض "قريباً" + خيار "ادفع للتفعيل" |
| **WhatsApp Business** | Meta Business + رقم معتمد | ⏳ "قريباً" |
| **Threads / Reddit / Pinterest** | لا API نشر مجاني | 🔗 "نشر سريع" عبر intent URL (يفتح التطبيق مع المحتوى جاهز) |

### التنفيذ بالترتيب (Wave 4 continued):

1. **أسرار Telegram** — أطلب من المستخدم `TELEGRAM_BOT_TOKEN` و `TELEGRAM_BOT_USERNAME` من @BotFather، ثم تسجيل الـ webhook تلقائياً.
2. **LinkedIn per-user OAuth** — استبدال الحساب المشترك بـ `connectAppUser({connectorId:"linkedin"})` + حفظ `connection_id` في `publish_channels.external_account_id`.
3. **TikTok + YouTube** — نفس النمط (`standard_connectors--connect` لـ tiktok و google).
4. **مكوّن `SocialIntents.tsx`** — أزرار "نشر سريع" لـ WhatsApp/X/FB/Threads/Reddit/Pinterest تفتح intent URLs بعد كل منشور موافَق عليه.
5. **بطاقة "قريباً"** — Facebook/Instagram/X/WhatsApp مع شرح السبب وزر "اشترك بالتنبيه عند التوفر".
6. **تعديل `ChannelsPanel.tsx`** — تجميع الكل في 3 أقسام: (متصل / متاح للربط / قريباً).

---

## 4) نظام الموافقة قبل النشر (موجود — نكمل التكامل)

الجداول جاهزة (`approval_mode`, `approval_status`). نحتاج:
- زر toggle "تلقائي / موافقة يدوية" على كل بطاقة قناة.
- صف "بانتظار موافقتك" في `/agent` يستخدم `ApprovalQueue.tsx` (موجود).
- أزرار Telegram inline (✅/❌) في الـ webhook (موجودة) — نتأكد من ربطها بـ `approveAndPublish`.

---

## 5) ترتيب التنفيذ النهائي

1. Migration: `run_id` + `run_started_at` على `agent_tasks`.
2. تحديث `agent.tsx`: تبويب "تشغيل حالي / السجل" + بطاقة تحليل الظهور البارزة.
3. طلب أسرار Telegram + تسجيل webhook.
4. LinkedIn per-user OAuth (استبدال الحساب المشترك).
5. TikTok + YouTube App User OAuth.
6. `SocialIntents.tsx` للمنصات بدون API.
7. بطاقة "قريباً" + i18n AR/EN/KU.
8. اختبار end-to-end (تشغيل وكيل → ظهور + اقتراح منشور → موافقة → نشر على LinkedIn + Telegram).

اضغط **Implement plan** للبدء بالخطوة 1.