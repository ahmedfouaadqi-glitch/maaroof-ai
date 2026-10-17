import { createFileRoute, Link } from "@tanstack/react-router";
import DOMPurify from "isomorphic-dompurify";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Use · MAAROOF Ai" },
      { name: "description", content: "Terms governing use of MAAROOF Ai tools, AI Agent and subscriptions." },
      { property: "og:title", content: "Terms of Use · MAAROOF Ai" },
      { property: "og:description", content: "Terms of use for MAAROOF Ai." },
      { property: "og:url", content: "https://maaroofai.com/terms" },
    ],
    links: [{ rel: "canonical", href: "https://maaroofai.com/terms" }],
  }),
  component: () => (
    <I18nProvider>
      <Page />
    </I18nProvider>
  ),
});

function Page() {
  const { t, lang } = useI18n();
  const c = content[lang];
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main>
        <article className="prose prose-invert mx-auto max-w-3xl px-4 py-12 md:px-6">
          <h1 className="font-display text-4xl font-bold text-gradient">{t("terms_title")}</h1>
          <div className="mt-6 space-y-4 text-foreground/85" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(c) }} />
          <div className="mt-10"><Link to="/" className="text-sm text-primary hover:underline">← {t("back_home")}</Link></div>
        </article>
      </main>
    </div>
  );
}

const content = {
  ar: `
<p>توضح هذه الشروط قواعد الوصول إلى <strong>MAAROOF Ai</strong>، وهي جزء من نظام معروف، واستخدام مساحات العمل والمهارات والأدوات والوكيل الذكي. باستخدام المنصة، توافق على هذه الشروط بالقدر الذي يسمح به القانون. تاريخ آخر مراجعة تحريرية: 17 أكتوبر 2026.</p>
<h2>1. الاستخدام المقبول</h2>
<ul>
<li>تستخدم المنصة لأغراض مشروعة فقط.</li>
<li>لا تُرسل محتوى يخالف القانون العراقي أو ينتهك حقوق الآخرين.</li>
<li>لا تحاول استغلال ثغرات أو إساءة استخدام واجهة الذكاء الاصطناعي أو الوكيل الذكي.</li>
<li>لا تستخدم أدوات أو الوكيل لإرسال رسائل غير مرغوبة (Spam)، أو جمع بيانات شخصية دون أساس قانوني أو إذن مناسب، أو تجاوز ضوابط الوصول والحدود التقنية.</li>
<li>لا ترفع معلومات سرية أو شخصية لا تملك صلاحية معالجتها أو مشاركتها مع مزودي الخدمة الذين تتطلبهم المهمة.</li>
</ul>
<h2>2. الحساب والاشتراك</h2>
<ul>
<li>أنت مسؤول عن حماية بيانات تسجيل الدخول وعن الأنشطة المنفذة من حسابك. قد تُعالج معلومات تقنية وسجلات أمان للمساعدة في منع إساءة الاستخدام.</li>
<li>الاشتراك المدفوع يُفعَّل عبر التواصل على واتساب وتأكيد الدفع.</li>
<li>تخضع الرسوم والاستردادات لشروط الخطة وشروط الدفع وأي قواعد إلزامية واجبة التطبيق. لا يجوز تفسير هذه العبارة على أنها إلغاء لحقوق لا يسمح القانون بالتنازل عنها.</li>
<li>يحق للسوبر أدمن ربط أدوات أو مزايا للوكيل بكل خطة، وتعديل الحصص الشهرية/اليومية لكل أداة.</li>
</ul>
<h2>3. الأدوات والوكيل الذكي والاستهلاك</h2>
<p>قد يستهلك تشغيل المهارات والأدوات والوكيل وحدات من رصيد الحساب وفق السعر والحدود المعروضة أو المحددة لحسابك. قد تختلف الكلفة بحسب الأداة وعدد العمليات والنماذج والفحص المباشر وسياسة الخطة. التقدير السابق للتشغيل إرشادي وليس بالضرورة التكلفة النهائية الشاملة.</p>
<ul>
<li>تحليل GEO، مولّد المنشورات، مقارنة المنافسين، إيميل شركات، أمر مباشر للوكيل، فحص الظهور في AI — <strong>1×</strong> لكل تشغيل.</li>
<li>دراسة جدوى، تطوير الأعمال، بحث ذكي، تشغيل الأهداف تلقائياً — <strong>2×</strong> لكل تشغيل.</li>
<li>تعزيز العلامة — <strong>3×</strong> لكل تشغيل.</li>
</ul>
<p>تُعرض تقديرات الاستهلاك والحدود المتاحة في الواجهة حيثما تدعمها الميزة، وتظل عملية التحقق والتحصيل على الخادم هي المرجع عند التنفيذ. لا تضمن المنصة أن كل تقدير مسبق يتنبأ بكل استدعاء داخلي أو تكلفة مزود خارجي.</p>
<h2>4. الذكاء الاصطناعي والوكيل</h2>
<p>الأدوات والمهارات والنماذج أنظمة آلية وقد تنتج معلومات ناقصة أو غير دقيقة أو قديمة. النتائج مساعدة وليست ضماناً تجارياً أو مالياً أو قانونياً أو طبياً أو مهنياً. تحقّق من المعلومات المهمة من مصادر مناسبة قبل الاعتماد عليها. أي نشر أو إرسال أو إجراء خارجي يجب أن يخضع للصلاحيات والتأكيدات المتاحة في الميزة؛ وأنت مسؤول عن مراجعة المدخلات والنتائج والإجراءات التي تعتمدها.</p>
<h2>5. النماذج ومزودو الخدمات الخارجيون</h2>
<p>قد تستخدم المنصة نماذج ومزودي خدمات من جهات خارجية. يخضع توفرها وزمن استجابتها ومخرجاتها لظروف الخدمة وسياساتها، وقد تتغير أو تتوقف. عرض اسم أو شعار مزود لا يعني الشراكة أو الاعتماد أو التأييد من جانبه.</p>
<h2>6. تطبيق الويب التقدمي (PWA)</h2>
<p>يمكن تثبيت المنصة كتطبيق على جهازك. التثبيت لا يمنح صلاحيات إضافية ولا يجمع بيانات إضافية مقارنةً بالموقع.</p>
<h2>7. الملكية الفكرية</h2>
<p>المحتوى الذي تُدخله ملكك. نتائج التحليل والاقتراحات للاستخدام الشخصي/التجاري لحسابك.</p>
<h2>8. حدود المسؤولية</h2>
<p>لا تتحمل المنصة مسؤولية أضرار غير مباشرة ناتجة عن استخدامك، بما في ذلك قرارات اتُّخذت بناءً على مخرجات الأدوات أو الوكيل.</p>
<h2>9. التعديل</h2>
<p>قد نُحدّث هذه السياسة. يبقى استخدامك للمنصة موافقةً على آخر نسخة.</p>
<h2>10. التواصل</h2>
<p>للاستفسار: واتساب <strong>+9647733570130</strong>.</p>
<p class="text-sm text-muted-foreground">آخر مراجعة تحريرية: 17 أكتوبر 2026. يُنصح بمراجعة قانونية قبل اعتماد الشروط نهائياً.</p>
`,
  en: `
<p>These terms govern access to <strong>MAAROOF Ai</strong>, part of the Maaroof system, including workspaces, skills, tools and the AI Agent. By using the platform, you agree to these terms to the extent permitted by applicable law. Editorial review date: 17 October 2026.</p>
<h2>1. Acceptable Use</h2>
<ul>
<li>Use the platform for lawful purposes only.</li>
<li>Do not submit content that violates Iraqi law or others' rights.</li>
<li>Do not attempt to exploit or abuse the AI interface or Smart Agent.</li>
<li>Do not use tools or the Agent for spam, collecting personal data without an appropriate lawful basis or permission, or bypassing access controls and technical limits.</li>
<li>Do not submit confidential or personal information that you are not authorized to process or share with providers required for the task.</li>
</ul>
<h2>2. Account & Subscription</h2>
<ul>
<li>You are responsible for protecting your credentials and activity performed through your account. Technical information and security logs may be processed to help prevent abuse.</li>
<li>Paid subscriptions are activated via WhatsApp after payment confirmation.</li>
<li>Fees and refunds are subject to the plan terms, payment conditions and any mandatory applicable rules. Nothing in this clause removes rights that cannot legally be waived.</li>
<li>The super admin may link specific tools or agent features to each plan and adjust monthly/daily quotas per tool.</li>
</ul>
<h2>3. Tools, Smart Agent & Usage</h2>
<p>Runs of skills, tools and the Agent may consume units according to the price and limits shown or configured for your account. Cost may vary by tool, number of operations, models, live checks and plan policy. A pre-run estimate is indicative and may not represent the final all-inclusive cost.</p>
<ul>
<li>GEO Analysis, Post Generator, Competitor Compare, Company Outreach, Agent Command, AI Visibility — <strong>1×</strong> per run.</li>
<li>Feasibility Study, BizDev, Smart Research, Run Targets — <strong>2×</strong> per run.</li>
<li>Brand Boost — <strong>3×</strong> per run.</li>
</ul>
<p>Usage estimates and remaining limits are shown where the interface supports them. Server-side validation and charging remain authoritative at execution. A pre-run estimate cannot necessarily predict every internal tool call or external provider cost.</p>
<h2>4. AI & Agent</h2>
<p>Tools, skills and models are automated systems and may produce incomplete, inaccurate or outdated information. Outputs are advisory and are not commercial, financial, legal, medical or professional guarantees. Verify important information using appropriate sources. External publishing, sending or other actions must follow the permissions and confirmations available in the feature; you are responsible for reviewing inputs, outputs and actions you approve.</p>
<h2>5. Models and third-party providers</h2>
<p>The platform may use models and services provided by third parties. Availability, response time and outputs depend on provider conditions and policies and may change or stop. Displaying a provider name or mark does not imply partnership, endorsement or approval.</p>
<h2>6. Progressive Web App (PWA)</h2>
<p>The platform can be installed as an app on your device. Installation grants no extra permissions and collects no extra data beyond the website.</p>
<h2>7. Intellectual Property</h2>
<p>Content you submit remains yours. Analysis and suggestion results are for your personal/commercial use.</p>
<h2>8. Liability</h2>
<p>The platform is not liable for indirect damages from your use, including decisions made based on tool or agent output.</p>
<h2>9. Updates</h2>
<p>We may update this policy. Continued use constitutes acceptance of the latest version.</p>
<h2>10. Contact</h2>
<p>For inquiries: WhatsApp <strong>+9647733570130</strong>.</p>
<p class="text-sm text-muted-foreground">Editorial review: 17 October 2026. Specialist legal review is recommended before final adoption.</p>
`,
  ku: `
<p>بە بەکارهێنانی <strong>MAAROOF Ai</strong> (بەشێک لە سیستەمی مەعروف) ڕەزامەندیت لەسەر ئەم مەرجانە:</p>
<h2>1. بەکارهێنانی پەسەند</h2>
<ul>
<li>پلاتفۆڕم تەنها بۆ مەبەستی یاسایی بەکاربێنە.</li>
<li>ناوەڕۆکی پێچەوانەی یاسای عێراق یان مافی کەسانی تر مەنێرە.</li>
<li>ئامرازەکان یان وەکیلی زیرەک بۆ سپام یان کۆکردنەوەی زانیاری کەسی بێ ڕێگەپێدان بەکارمەهێنە.</li>
</ul>
<h2>2. هەژمار و بەشداربوون</h2>
<ul>
<li>تۆ بەرپرسیاریت لە پاراستنی زانیاری هەژمارەکەت. هەژمار بە پەنجەمۆری ئامێرەکەت دەبەسترێتەوە.</li>
<li>بەشداربوونی پارەدراو لە ڕێگەی واتسئەپەوە چالاک دەکرێت.</li>
<li>سوپەر ئەدمن دەتوانێت ئامراز یان تایبەتمەندی وەکیل بۆ هەر پلانێک ببەستێتەوە و کۆتای مانگانە/ڕۆژانە دیاری بکات.</li>
</ul>
<h2>3. ئامرازەکان، وەکیلی زیرەک و بەکارهێنان</h2>
<p>هەر کارپێکردنێکی ئامراز یان تایبەتمەندی وەکیل یەکەی مانگانە بەکاردەهێنێت:</p>
<ul>
<li>شیکاری GEO، دروستکەری پۆست، بەراوردکردنی ڕکابەران، ئیمەیڵی کۆمپانیا، فەرمانی وەکیل، پشکنینی دەرکەوتن — <strong>1×</strong>.</li>
<li>لێکۆڵینەوەی شیاو، گەشەپێدانی کار، گەڕانی زیرەک، جێبەجێکردنی ئامانجەکان — <strong>2×</strong>.</li>
<li>بەهێزکردنی براند — <strong>3×</strong>.</li>
</ul>
<p>تێچوون لە پەڕەی «چۆن کاردەکات» و لە کارتی هەر ئامرازێک دیارە.</p>
<h2>4. AI و وەکیل</h2>
<p>ئامرازەکان و وەکیل ئۆتۆماتیکن، نەک گفتوگۆ. ئەنجامەکان ڕاسپاردەن. وەکیل بەپێی ئامانجەکانی تۆ بڵاودەکاتەوە/شی دەکات و تۆ بەرپرسی.</p>
<h2>5. PWA</h2>
<p>پلاتفۆڕم وەک ئەپ دەکرێت دابمەزرێنرێت. دامەزراندن هیچ ڕێگەپێدانێکی زیاتر نادات.</p>
<h2>6. مافی موڵکی</h2>
<p>ناوەڕۆکی ناردراو ماڵی تۆیە. ئەنجامەکان بۆ بەکارهێنانی کەسی/بازرگانی هەژمارەکەتە.</p>
<h2>7. سنووری بەرپرسیاری</h2>
<p>پلاتفۆڕم بەرپرسی زیانی ناڕاستەوخۆ نییە.</p>
<h2>8. نوێکردنەوە</h2>
<p>دەکرێت ئەم سیاسەتە نوێ بکەینەوە.</p>
<h2>9. پەیوەندی</h2>
<p>واتسئەپ: <strong>+9647733570130</strong>.</p>
<p class="text-sm text-muted-foreground">دوایین نوێکردنەوە: 2026</p>
`,
};
