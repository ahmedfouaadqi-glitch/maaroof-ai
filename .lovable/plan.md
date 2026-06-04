
## 1) كيف تُنتَج نتائج "الظهور في محركات الذكاء" داخل أداة "تعزيز العلامة"

الأداة الحالية (`src/routes/api/brand-boost.ts`) لا تستجوب ChatGPT/Gemini/Claude/...إلخ مباشرةً (لا توجد APIs عامة موحّدة لكل المحرّكات بصيغة "أعطني ما تعرفه"). الآلية الفعلية المطبَّقة:

- **Step 1 — جمع أدلة حقيقية من الويب المفتوح** عبر **Firecrawl Search** (مفتاح `FIRECRAWL_API_KEY`) باستعلامات `brand + keywords + market` ثم `"brand" reviews/about/official`. النتائج (عنوان + URL + مقتطف) تُستخدم كـ "Evidence" مرقّمة [1]…[n].
- **Step 2 — Probe لكل منصّة عبر Lovable AI Gateway**: لكل منصّة يوجد موديل مُكافِئ في `PLATFORM_MODEL`:
  - ChatGPT → `openai/gpt-5-mini` (مباشر)
  - Gemini → `google/gemini-2.5-flash` (مباشر)
  - Copilot → `openai/gpt-5-nano` (proxy)
  - Perplexity → `google/gemini-2.5-flash` (proxy، مع تأريض بأدلة Firecrawl)
  - Claude → `openai/gpt-5-mini` (proxy)
  - Grok → `openai/gpt-5-nano` (proxy)
  - Mistral / DeepSeek → `google/gemini-2.5-flash-lite` (proxy)
  
  يُسأل كل موديل: "ماذا تعرف عن brand X؟" ويُعتبر جوابه "إشارة المنصّة الحالية". المنصّات المُعلَّمة `proxy: true` لا نستطيع استجوابها مباشرةً، لذا نستخدم موديل من نفس العائلة ونُعرّف المستخدم بذلك في الواجهة (شارة "proxy").
- **Step 3 — خطة لكل منصّة** عبر `google/gemini-2.5-flash`، تُدمج إجابة الـprobe مع الأدلة المرقّمة وتُولِّد: قراءة الإشارة، أساس التغذية المُحتمل، إجراءات، محتوى مقترح، و**injection_pack** جاهز للنشر (مقال Markdown + Q&A + JSON-LD).

**خلاصة شفافة للمستخدم**: النسب ليست "كم مرة ذكرك ChatGPT الحقيقي" — بل (أ) ماذا قال نموذج مكافئ الآن، و(ب) ما الذي يُحتمل أن يُغذّيه استناداً لأدلة Firecrawl حقيقية. هذا ما تسمح به البنية التحتية للمحرّكات اليوم.

## 2) التكاليف التفصيلية

**على مالك الموقع (لكل تشغيل واحد لأداة Brand Boost بـ 5 منصّات):**

| البند | الاستهلاك التقريبي |
|---|---|
| Firecrawl Search (استعلامان × ~6 نتائج) | ~2 search credits |
| Probes: 5 نداءات chat (~600 tokens لكل واحد) | عبر Lovable AI Gateway — تُحسب من Workspace credits |
| Plan generation: 1 نداء gemini-2.5-flash (~4-6K tokens مدخل + ~3K tokens خرج) | عبر Lovable AI Gateway |
| **إجمالي تقريبي**: 6 نداءات AI + 2 Firecrawl لكل تشغيل |

أسعار Lovable AI Gateway تُخصم من رصيد credits الخاص بـworkspaceك (Settings → Workspace → Usage). كل workspace يحصل على **$1 رصيد AI مجاني شهرياً** (حتى مطلع 2026)، ثم تُحسب بالاستهلاك. أرخص موديل مُستخدَم (`gemini-2.5-flash-lite`) ~$0.075/1M input، وأغلى (`gpt-5-mini`) ~$0.25-$2/1M.

**على المستخدم النهائي (داخل التطبيق):**
- يُخصم **5 من رصيده الشهري `monthly_analyses_used`** (ثابت في `BRAND_BOOST_COST = 5`).
- يجب أن يكون لديه: `is_subscribed = true` (وغير منتهي) أو تفعيل خاص `quota_overrides.brand_boost = "on"` من الإدارة.
- إن وصل سقف الـquota → خطأ `subscription_required` (402).
- "تحليل الظهور" (الأداة المنفصلة حالياً) يخصم **1 تحليل** فقط من `monthly_analyses_used`.

## 3) تحسينات أداة "تعزيز العلامة في منصات الذكاء"

سأطبّق التحسينات التالية على `BrandBoostAgent.tsx` و `api/brand-boost.ts`:

1. **إعادة تشغيل لمنصّة واحدة** (Re-run single platform) بدل إعادة كل المنصّات.
2. **مؤشّر شفافية**: شارة واضحة "موديل مباشر" vs "proxy ~ family" مع تلميحة تشرح للمستخدم لماذا.
3. **مقارنة قبل/بعد**: حفظ آخر تشغيل في `brand_boost_runs` (موجود) وإضافة عرض diff للنسبة و للإشارة لكل منصّة بين آخر تشغيلَين.
4. **زر "نسخ كل الـinjection pack"** (Markdown + Q&A + JSON-LD مجمّعة) + زر تنزيل ملف `.md`.
5. **تحسين Evidence**: إضافة تصنيف للأدلة (موقع رسمي / مراجعة / خبر / مرجع ويكيبيديا) عبر تصنيف بسيط بالـURL/المجال، وإبراز "غاب" (no Wikipedia, no LinkedIn, no GMB) كقائمة "فجوات المصادر".
6. **اقتراح كلمات مفتاحية تلقائياً** عند تركها فارغة، باستعمال أول استعلام Firecrawl.
7. **معالجة 402 (Credits exhausted)** بصورة واضحة في الواجهة مع زر "إضافة رصيد".
8. **Cache لـ24 ساعة** على نفس (brand + keywords + lang + scope) لتفادي خصم 5 credits على نفس الاستعلام المتكرّر.

## 4) دمج "تحليل الظهور" كتبويب داخل "تعزيز العلامة"

التغييرات:

- **`BrandBoostAgent.tsx`**: إضافة تبويب جديد أول `<TabsTrigger value="visibility">` يستضيف مكوّن جديد `<VisibilityPanel>` (مأخوذ من `AIVisibility.tsx` لكن يشارك حقلَي brand/kw مع باقي التبويبات).
- ترتيب التبويبات بعد الدمج: **Visibility → Run → Authority → Propagation → Logs** (5 أعمدة بدل 4).
- `<VisibilityPanel>` يستخدم نفس `brand`/`kw`/`outLang`/`scope` الموجودة في الـstate الأب، ويُنادي `/api/visibility` (لا تغيير في الـbackend، يكلّف 1 تحليل فقط).
- نتيجة الـVisibility تُعرض داخل التبويب نفسه (النسبة الكلية + بطاقات المنصّات الـ8 + التوصيات + ExportButtons).
- **حذف الأداة المستقلة** من `dashboard.tsx`: إزالة `<ToolCard ... visibility>` لأنها صارت تبويباً.
- **`tool-catalog.ts`**: الإبقاء على `visibility` (للـbilling/admin gates) لكن حذف بطاقتها من الـdashboard.
- **`agent.tsx`**: لا تغيير (يبقى استخدامه داخل صفحة الوكيل كما هو).

### الملفات المتأثرة
- `src/components/BrandBoostAgent.tsx` (تبويب جديد + تحسينات #3)
- `src/components/AIVisibility.tsx` → يبقى للاستخدام في `/agent`، ويُستخرَج منه `<VisibilityPanel>` قابل للتضمين
- `src/routes/api/brand-boost.ts` (re-run منصّة واحدة، cache، تصنيف evidence)
- `src/routes/dashboard.tsx` (إزالة بطاقة Visibility المستقلة)
- لا توجد تغييرات DB لازمة.

### ملاحظة
لن أُغيّر تكلفة Brand Boost (تبقى 5) ولا تكلفة Visibility (تبقى 1) إلا إذا طلبتَ ذلك صراحةً.
