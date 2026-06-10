## 1) سؤال Kimi — هل في مشكلة؟

**لا توجد مشكلة فعلية.** تحققت من الكود:
- Kimi مُدرَج في كل القوائم (`PLATFORMS` التسع) في كل الأدوات: `brand-boost`, `compare`, `analyze`, `visibility`, `applied-ranking`, `competitor-compare`, `platform-probe`، إلخ.
- في `src/routes/api/brand-boost.ts` (سطر 25) Kimi مربوط بـ `google/gemini-2.5-flash-lite` مع `proxy: true`.

السبب: **Lovable AI Gateway ما يوفر موديل Moonshot/Kimi مباشر** (راجع كتالوج الموديلات — ما فيه أي موديل Moonshot). نفس الحال ينطبق على Claude و Grok و Mistral و DeepSeek — كلهم proxies لأن الـGateway لا يكشفهم مباشرة. وهذا هو السلوك المعتمد المُعلَن في الواجهة:
> "for closed platforms (ChatGPT, Claude, Copilot, DeepSeek, Mistral, Kimi) the bar is inferred from the real evidence layer".

**التوصية المهنية**: نُبقي Kimi proxy حالياً (لا يوجد بديل)، لكن **نوحّد طريقة الـproxy ونوضّحها للمستخدم**:
- Kimi طويل السياق وثنائي اللغة CN/EN، فالأنسب رفعه من `gemini-2.5-flash-lite` إلى `gemini-2.5-pro` (سياق أطول ومنطق أقوى) بدل lite الحالي — هذا أقرب لسلوكه الحقيقي.
- إضافة Tooltip في كروت النتائج عند Kimi (و باقي proxies) يوضّح: "محاكاة عبر موديل مكافئ — لا يوجد API عام لـKimi".

> ملاحظة: إن كان قصدك أن Kimi غير ظاهر/غير محسوب في أداة معينة، أرجو تحديد الأداة بالاسم لأن الفحص يُظهر أنه مربوط بكل الأدوات الحالية.

## 2) تعديل معلومات "اتصل بنا" من لوحة الإدارة

حالياً معلومات الاتصال **مكتوبة hardcoded** في الكود:
- `src/lib/whatsapp.ts` → رقم WhatsApp `9647733570130`
- `src/routes/contact.tsx` → الرقم المعروض `+964 773 357 0130`
- `src/routes/pricing.tsx` → `SUPPORT_EMAIL = "ahmedfouaad.qi@gmail.com"`
- `src/components/SubscribeModal.tsx` → نفس الرقم
- `src/lib/i18n.tsx` → `footer_contact` يحتوي الرقم في كل اللغات الثلاث

### الحل

تخزين كل المعلومات في `app_settings` تحت المفتاح `contact_info` (JSON)، وقراءتها من كل الصفحات.

**شكل البيانات**:
```json
{
  "whatsapp_number": "9647733570130",
  "phone_display": "+964 773 357 0130",
  "email": "ahmedfouaad.qi@gmail.com",
  "address_ar": "بغداد، العراق",
  "address_en": "Baghdad, Iraq",
  "address_ku": "بەغدا، عێراق",
  "working_hours_ar": "السبت – الخميس · 9 ص – 6 م",
  "working_hours_en": "Sat – Thu · 9 AM – 6 PM",
  "working_hours_ku": "شەممە – پێنجشەممە · ٩ ب.ن – ٦ د.ن",
  "facebook": "",
  "instagram": "",
  "twitter": "",
  "linkedin": "",
  "telegram": ""
}
```

### الملفات

**جديد**:
- `src/lib/contact-info.ts` — hook `useContactInfo()` يجلب من `app_settings`, مع defaults احتياطية (نفس القيم الحالية لتفادي أي انقطاع).

**يُعدَّل**:
- `src/routes/admin.tsx` — تبويب جديد **"معلومات الاتصال"** أو قسم داخل تبويب موجود، فيه فورم لتعديل كل الحقول أعلاه، يحفظ عبر `adminSetAppSetting({ key: "contact_info", value })` (الـserverFn موجود مسبقاً).
- `src/routes/contact.tsx` — يستهلك `useContactInfo()` بدل المتغيرات الثابتة، ويعرض العنوان وساعات العمل ووسائل التواصل الاجتماعي (إن وُجدت).
- `src/components/SubscribeModal.tsx` — يستخدم `useContactInfo()`.
- `src/routes/pricing.tsx` — `SUPPORT_EMAIL` ورقم WhatsApp من الـhook.
- `src/lib/whatsapp.ts` — تحويل `WHATSAPP_NUMBER` إلى دالة `getWhatsappNumber()` تقرأ من cache مُعبَّأ بـ `useContactInfo` (مع fallback ثابت).
- `src/components/SiteHeader.tsx` (إن كان يعرض الرقم) — نفس الـhook.
- `src/lib/i18n.tsx` — `footer_contact` يصبح template يقبل الرقم من الـhook.

### مخطط القاعدة

لا حاجة لـmigration — جدول `app_settings` موجود ويستخدم upsert على `key`. أول حفظ من الإدارة يُنشئ الصف تلقائياً.

### تجربة المستخدم في الإدارة

فورم بسيط مقسّم لأقسام:
1. **الاتصال المباشر** — WhatsApp number, phone display, email
2. **العنوان** — 3 حقول (ar/en/ku)
3. **ساعات العمل** — 3 حقول (ar/en/ku)
4. **شبكات التواصل** — Facebook, Instagram, Twitter/X, LinkedIn, Telegram (كلها اختيارية، تظهر فقط إن كانت معبّأة)

زر "حفظ" واحد، مع toast نجاح/فشل.

## الخلاصة
- **Kimi**: مربوط بالفعل كـproxy (وضع طبيعي للموديلات غير المتاحة في Gateway). الترقية المهنية: نقله من lite إلى gemini-2.5-pro + tooltip توضيحي.
- **معلومات الاتصال**: نقل من hardcoded إلى `app_settings` بتبويب إدارة كامل.
