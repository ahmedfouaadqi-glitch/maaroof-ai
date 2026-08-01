# Teach Once, Work Forever™ — مساحات المعرفة (ميزة إضافية للمشتركين)

## قرار: تطوير ودمج، لا إنشاء من الصفر

الفحص أظهر أن أجزاء كبيرة من المطلوب موجودة فعلاً، لذلك لن تُنشأ أنظمة موازية:

- `knowledge_nodes` / `knowledge_edges` (9 طبقات + confidence/quality/freshness) → طبقة المعرفة المهيكلة.
- `maaroof_memory` → الذاكرة الوقائعية لكل تشغيل.
- `platform_dna` + `hermes_founder_dna` → أنماط مجهولة الهوية + DNA المؤسِّس.
- `evidence_items`, `reality_records`, `trust_profiles`, `verification.server.ts` → التحقق والأدلة والثقة.
- `maaroof_agents` + `agents.server.ts` → الوكلاء الفرعيون والشخصية.
- `hermes_tasks` + `hermes.server.ts` → التقييم والاقتراحات.
- `tool-catalog.ts` + `tool_pricing_catalog` + `token_ledger` → التسعير والتكاليف.

الجديد فعلياً هو ما لا يوجد: **مساحة معرفة (Knowledge Space)** كوعاء له ملفاته وبرومباته و DNA وهوية علامته وصلاحياته والوكلاء المسموح لهم، **مركز استيراد ملفات**، و**خط تعلّم** يغذي الأنظمة أعلاه. كل ما نبنيه يُربط بها بدل استبدالها.

## ما سيُبنى

### 1. مساحات المعرفة (Knowledge Spaces)
جداول جديدة: `knowledge_spaces` (اسم، وصف، لغة، brand_identity، space_dna، سياسات، مالك، workspace)، `knowledge_space_assets` (الملفات/الروابط وحالة المعالجة)، `knowledge_space_agents` (أي وكيل يصل لأي مساحة + مستوى الوصول)، `knowledge_space_prompts` (مكتبة البرومبتات + Prompt DNA المستخلص).

كل عقدة معرفة ناتجة تُكتب في `knowledge_nodes` الحالي مع `space_id` — لا مخزن معرفة ثانٍ. RLS: المالك أو أعضاء مساحة العمل فقط؛ لا تسريب بين الحسابات.

### 2. أداة جديدة في الوكيل الذكي
مفتاح أداة جديد `teach_space` داخل `group: "agent"` في `tool-catalog.ts` (لا تعديل على الأدوات الـ16 القائمة)، مع `costPerRun`، `costProfile: "heavy"`، قدرات `knowledge_graph`/`document_analysis`، وسعر مستقل في `tool_pricing_catalog` + خصم عبر `charge_tokens` وتسجيل في `token_ledger`. تُظهر للمشتركين فقط عبر `tool_plan_access` (السعر يُحدد لاحقاً من لوحة الإدارة).

### 3. مركز الاستيراد
Bucket خاص (private) للملفات. المرحلة الأولى: Word، PDF، Markdown، TXT، RTF، Excel، CSV، PowerPoint، JSON، XML، HTML، ZIP، وروابط الويب (عبر Firecrawl الموجود). الصور/الصوت/الفيديو عبر النماذج متعددة الوسائط. مصادر خارجية (Notion، Drive، GitHub…) تُترك كمرحلة تالية بواجهة جاهزة لها.

### 4. خط التعلّم
Import → تصنيف → فهم → استخلاص معرفة → أدلة → تكرار → تعارض → علاقات → ربط بالغراف → تحقق → Reality → موافقة المالك عند الحاجة → تعلّم مؤسسي.
يُنفّذ عبر ملف خدمة جديد `src/lib/maaroof/teaching.server.ts` يستدعي `evidence.server.ts`، `verification.server.ts`، `reality.server.ts`، `trust.server.ts`، `knowledge.server.ts` الموجودة.

المخرجات المفهومة: أسلوب الكتابة، التواصل، القرار، Prompt DNA، Brand DNA، قواعد العمل، المنهجيات، المعايير — كأنواع عقد في الطبقات القائمة.

### 5. وضع المقابلة
عند نقص المعرفة، يطرح الوكيل أسئلة تكيّفية داخل محادثة `hermes_conversations`/`maaroof_messages` الحالية، والأجوبة تُحوّل عقداً معرفية.

### 6. لوحة التعلّم
تبويب جديد في واجهة الوكيل: تقدم التعلّم، ما تم تعلّمه لكل نوع، عدد المستندات، الثقة، الأدلة، Reality/Verification score، نمو المعرفة، وسجل زمني.

### 7. توريث الوكلاء الفرعيين
عند إنشاء وكيل فرعي في `agents.server.ts`، يورث المعرفة **المعتمدة فقط** من المساحات المسموح له بها، بإعدادات قابلة للتحكم.

### 8. Hermes
مهام تقييم دورية: جودة التعلّم، الفجوات، المهارات الناقصة، المعرفة القديمة → مقترحات للمؤسِّس فقط، بدون تعديل تلقائي للمعرفة الحرجة.

### 9. التصدير
تصدير ملف المعرفة/المهارات/الخط الزمني/Prompt DNA/Brand DNA بصيغ PDF، Word، Excel، CSV، JSON، Markdown، PowerPoint — بالعربية والإنجليزية والكردية عبر `exports.ts` الحالي.

## تفاصيل تقنية
- ترحيلات SQL للجداول الأربعة الجديدة + عمود `space_id` على `knowledge_nodes` + GRANT + RLS لكل جدول.
- دوال الخادم في `src/lib/teaching.functions.ts` (رفع، معالجة، موافقة، استعلام، تصدير) مع `requireSupabaseAuth`.
- المعالجة الطويلة تُقسَّم إلى خطوات قابلة للاستئناف بحالة على صف الأصل، لأن بيئة التشغيل بلا عمليات فرعية.
- ترجمة كاملة للنصوص الجديدة في `ar/en/ku`.
- توافق خلفي: لا حذف أو تغيير لأي جدول أو أداة قائمة.

## خارج نطاق هذه المرحلة
موصلات Notion/Drive/GitHub/Dropbox الفعلية، وتحديد السعر النهائي (يُضبط من لوحة الإدارة بعد التسليم).
