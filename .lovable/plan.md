## الهدف
دمج تبويبَي **سجل التوكن (Ledger)** و **تكلفة المزوّدين (Provider Cost)** في عرض موحّد يُظهر، لكل عملية، التكلفة اليدوية المُحصَّلة من المستخدم مقابل التكلفة الحقيقية التي يدفعها الموقع، مع هامش الربح والتكلفة الفعلية لكل توكن.

## ما الذي يوجد فعلاً
- `token_ledger.usd_cost` = السعر اليدوي المُحصَّل من المستخدم (من override/الخطة).
- `token_ledger.meta.real_usd_cost` = تكلفة المزود الحقيقية بالدولار (محسوبة من `provider_rates`).
- `meta`: `provider`, `model`, `input_tokens`, `output_tokens`, `firecrawl_units`, `semrush_calls`, `latency_ms`, `endpoint`, `breakdown`.
- تبويبان منفصلان حالياً: **Ledger** يعرض المُحصَّل فقط، **Provider Cost** يعرض الحقيقي فقط.

## التغييرات

### 1) تبويب موحّد جديد: «المالية / Finance»
- إنشاء `src/components/admin/AdminFinanceTab.tsx` يدمج الاثنين في صفحة واحدة بأقسام:
  - **بطاقات ملخّص** (لليوم / 30 يوم):
    - مُحصَّل من المستخدمين (USD)
    - تكلفة حقيقية على الموقع (USD)
    - الهامش = مُحصَّل − حقيقي + نسبة %
    - عدد الطلبات + متوسط تكلفة/طلب (حقيقي)
    - متوسط تكلفة/توكن حقيقي = Σ real_usd_cost ÷ Σ (input+output tokens)
  - **حسب الأداة**: الأعمدة = الأداة، الطلبات، التوكنات، مُحصَّل $، حقيقي $، الهامش $، الهامش %، متوسط ms.
  - **حسب المستخدم**: الأعمدة = البريد، الطلبات، التوكنات، مُحصَّل $، حقيقي $، الهامش $.
  - **حسب المزوّد/النموذج**: مُحصَّل، حقيقي، طلبات.
  - **جدول العمليات الأخيرة الموحّد** (يستبدل جدولَي الـtab الحاليّين): الوقت، المستخدم، الأداة، المزوّد، النموذج، input/output tokens، Firecrawl units، **مُحصَّل $**، **حقيقي $**، **هامش $**، **$/1k tok**، ms، Run ID.
- مرشّحات: مدى زمني (7/30/90 يوم)، أداة، مستخدم، بحث نصّي.
- تصدير CSV واحد يحوي العمودين (مُحصَّل + حقيقي + هامش + per-token real).
- ألوان: مُحصَّل بلون primary، حقيقي بلون أصفر/برتقالي، هامش أخضر إن موجب وأحمر إن سالب.

### 2) دمج التبويبات في `src/routes/admin.tsx`
- استبدال التبوّيبين `"cost"` و `"ledger"` بتبويب واحد `"finance"` يستخدم `AdminFinanceTab`.
- ترجمة الاسم: «المالية الموحّدة» / "Finance" / «دارایی».
- حذف الاستيرادات غير المستخدمة `AdminLedgerPanel` و `ProviderCostTab` من `admin.tsx`، مع **الاحتفاظ بالملفّين** كما هما (في حال احتجناهما لاحقاً، وعدم كسر مراجع أخرى).

### تفاصيل تقنية (للمطوّر)
- لكل صف:
  - `charged = Number(row.usd_cost)`
  - `real = Number(row.meta?.real_usd_cost ?? row.meta?.breakdown ? (breakdown.ai+breakdown.firecrawl+breakdown.semrush) : 0)`
  - `tokensTotal = (meta.input_tokens||0)+(meta.output_tokens||0) || row.tokens`
  - `perTokenReal = tokensTotal ? real/tokensTotal*1000 : 0` (يُعرض كـ $/1k tok)
  - `margin = charged - real`، `marginPct = charged>0 ? margin/charged*100 : null`.
- لا تغييرات على قاعدة البيانات ولا على RLS ولا على أيّ API. واجهة فقط.

## ليس ضمن النطاق
- لا تعديل لمنطق التسعير أو لـ `recordSpend`/`enrichLedger`.
- لا تغيير لتبويبات أخرى (Users Pricing، Firecrawl، إلخ).
