# خطة: ملف Excel لتحليل تكاليف منصة معروف

سأُنشئ ملف `maaroof-cost-analysis.xlsx` في `/mnt/documents/` يحتوي على 7 أوراق عمل مترابطة بالكامل عبر صيغ Excel (لا أرقام ثابتة)، بحيث يستطيع المستخدم تغيير أي افتراض في ورقة الإدخالات وتتحدث كل الأرقام تلقائياً.

## الأوراق

### 1) `Inputs` — لوحة الافتراضات (خلايا زرقاء قابلة للتعديل)
- عدد المستخدمين النشطين، نسبة المتزامن، عدد الطلبات/مستخدم/يوم
- متوسط Input/Output Tokens لكل طلب
- سعر صرف الدولار، هامش الربح المستهدف %
- معامل الذروة (Peak factor) لحساب 24 ساعة

### 2) `Infrastructure` — البنية التحتية الشهرية
| البند | المزود | التكلفة الشهرية USD |
|---|---|---|
| الاستضافة (Lovable / Cloudflare Workers) | Lovable | حسب الخطة |
| قاعدة البيانات + Storage + Auth (Lovable Cloud) | Supabase | متغير |
| النطاق `geoiraq.com` | Registrar | ~12/سنة |
| Firecrawl (web scraping) | Firecrawl | per credit |
| SEMrush API | SEMrush | per call |
| Email/Notifications | - | - |

### 3) `AI Models` — كتالوج أسعار النماذج (من `provider_rates`)
كل نموذج متاح في Lovable AI Gateway مع:
- Input price / 1M tokens
- Output price / 1M tokens
- Use case (افتراضي/متقدم/صور/صوت)
- مثال: تكلفة طلب نموذجي (1K in + 2K out)

يشمل: Gemini 3 Flash, Gemini 2.5 Pro/Flash, GPT-5/mini/nano, Nano Banana, GPT-image-2، إلخ.

### 4) `Tools Cost` — تكلفة كل أداة لكل تشغيل
الـ 17 أداة من `tool-catalog.ts` (analyze, suggest, compare, feasibility, bizdev, research, visibility, brand_boost, ... , maaroof):
- النموذج المستخدم
- متوسط Tokens (in/out)
- استدعاءات Firecrawl/SEMrush
- التكلفة الفعلية USD لكل تشغيل = صيغة مرتبطة بـ AI Models + Infrastructure

### 5) `Scenario 100 Users` — السيناريو المطلوب
ثلاث حالات جنباً إلى جنب:
- **A) أداة واحدة بكثرة**: 100 × N طلب/يوم على أداة `analyze` مثلاً
- **B) كل الأدوات يومياً**: 100 × توزيع طبيعي عبر 17 أداة
- **C) ذروة 24 ساعة متزامنة**: تطبيق Peak factor

لكل حالة: تكلفة يومية / شهرية / سنوية + تكلفة لكل مستخدم + هامش الربح المقترح للسعر.

### 6) `Examples` — أمثلة مبسّطة بالعربي
3-5 سيناريوهات شارحة، مثل:
- "أحمد استخدم تحليل GEO 5 مرات اليوم → كم كلفنا؟"
- "شركة من 20 موظف كل واحد عمل دراسة جدوى → الفاتورة"
- مقارنة: نفس المهمة على Gemini Flash مقابل GPT-5

### 7) `Summary` — لوحة تنفيذية
- إجمالي التكلفة الشهرية للبنية الثابتة
- نقطة التعادل (كم مستخدم مدفوع لتغطية التكاليف)
- مخطط: التكلفة مقابل عدد المستخدمين

## التفاصيل التقنية

- المصادر: قراءة `provider_rates` و `tool_pricing_catalog` و `subscription_plans` من قاعدة البيانات للأرقام الفعلية، ثم بناء الملف بـ `openpyxl`.
- الألوان: أزرق = إدخال، أسود = صيغة، أخضر = رابط بين أوراق، أصفر = افتراض رئيسي.
- التنسيق: `$#,##0.00` للعملة، `0.0%` للنسب، أعمدة عريضة، عناوين عربية + إنجليزية.
- إعادة حساب الصيغ عبر `recalculate_formulas.py` ثم التحقق من عدم وجود `#REF!`/`#DIV/0!`.
- تسليم عبر `<presentation-artifact>` لمعاينة وتنزيل مباشر.

## المخرج النهائي
`/mnt/documents/maaroof-cost-analysis.xlsx` — قابل للتعديل، كل الافتراضات في `Inputs`، الباقي صيغ ديناميكية.
