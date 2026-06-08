## التنفيذ بالترتيب (موجة 4 — استكمال)

### ١) Telegram "أحضر بوتك" (Bring-Your-Own-Bot) — لأن لا بوت مركزي

كل مستخدم يربط بوته الشخصي بثلاث نقرات:

**واجهة `ChannelsPanel.tsx`:**
```
١) أنشئ بوتاً مع @BotFather → [نسخ /newbot]
٢) الصق Token: [_____] · Username: [_____]  [حفظ]
٣) [فتح البوت]  → t.me/<bot>?start=<linkToken>
```

**تقنياً:**
- Server fn `saveUserTelegramBot({token, username})`:
  - يتحقق عبر `getMe`.
  - يستخرج `botId = token.split(":")[0]`.
  - يحفظ في `publish_channels.config = { bot_token, bot_username, bot_id, link_token }`.
  - يسجّل webhook خاص بالبوت: `setWebhook` → `/api/public/telegram/webhook/<botId>`.
- Route جديد `src/routes/api/public/telegram/webhook/$botId.ts` (splat) — يبحث القناة بـ `bot_id` ويقرأ الـ token من config.
- نحذف الاعتماد على `process.env.TELEGRAM_BOT_TOKEN` في `agent.functions.ts` و `notify.server.ts` — كله من config.

---

### ٢) لوحة الإدارة — Tokens: تحكم متقدم لكل مستخدم

في `AdminTokensPanel.tsx` (موجود) داخل نافذة "إدارة" لكل مستخدم، نضيف:

**أ) عمود "مفعّلة" لكل أداة:**
- Toggle switch (مفعّل/مخفي) يضبط `per_user_tool_overrides[tool].enabled`.
- في الباك: `tokens.server.ts` يفحص هذه القيمة — إن `false` ترفض المكالمة بـ `tool_disabled_for_user`.
- في الفرونت: `tool-catalog.ts` و `dashboard.tsx` و `tools.$slug.tsx` تخفي/تعطّل البطاقة عند `enabled === false`.

**ب) تعديل أرقام الاستخدام الحالي (`tokens_used_today`, `tokens_used_month`):**
- حقلان جديدان قابلان للتعديل في رأس النافذة بجانب الرصيد.
- زر "تصفير اليوم" و "تصفير الشهر".
- زر "إخفاء عداد الاستخدام" — يضبط `profiles.hide_usage_counter = true` فلا يظهر للمستخدم في شريط الوحدات.

**ج) Migration بسيطة (عمود واحد فقط):**
```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hide_usage_counter boolean NOT NULL DEFAULT false;
```
(الـ `enabled` و `tokens_used_*` و `per_user_tool_overrides` موجودة سلفاً — لا migration لها).

**د) تحديث شريط الوحدات في الواجهة:**
- `SiteHeader.tsx` (أو حيث يُعرض الرصيد): يخفي العداد عند `hide_usage_counter=true`.
- يضيف badge "🔒 أداة مخفية" بجانب الأدوات المعطّلة في الـ dashboard.

---

### ٣) تبويب "تشغيل حالي / السجل" + تحليل الظهور البارز (من خطة سابقة — متبقي)

- بطاقة "تحليل الظهور" بارزة أعلى `/agent` تعرض آخر نتيجة + زر "تشغيل الآن".
- مفاتيح i18n: `ag_tab_current`, `ag_tab_history`, `ag_no_current_tasks` (AR/EN/KU).

---

### ٤) ربط حسابات OAuth الحقيقية (متبقي)

- **LinkedIn** per-user عبر App User Connector (يستبدل الحساب المشترك).
- **TikTok** + **YouTube** نفس النمط.
- **Facebook / Instagram / X / WhatsApp** بطاقة "قريباً" مع شرح السبب.
- **Threads / Reddit / Pinterest** أزرار Intent (تفتح التطبيق بالمحتوى جاهز).

---

## ترتيب التنفيذ النهائي

1. **Migration**: `profiles.hide_usage_counter`.
2. **AdminTokensPanel**: إضافة عمود `enabled` toggle + حقول تعديل `tokens_used_today/month` + toggle إخفاء العداد.
3. **Backend**: `tokens.server.ts` يفحص `enabled=false` ويرفض.
4. **شريط الوحدات + Dashboard**: يحترم `hide_usage_counter` ويخفي الأدوات المعطّلة.
5. **Telegram BYOB**: webhook متعدد البوتات + `saveUserTelegramBot` + UI ثلاث خطوات.
6. **`/agent`**: بطاقة تحليل الظهور البارزة + i18n keys.
7. **LinkedIn per-user OAuth** (App User Connector).
8. **TikTok + YouTube** OAuth.
9. **بطاقة "قريباً"** + أزرار Intent للباقي.
10. **اختبار end-to-end**.

اضغط **Implement plan** للبدء بالخطوة 1.