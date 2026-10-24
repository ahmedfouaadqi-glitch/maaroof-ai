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
  const c = content[(lang as "ar" | "en" | "ku")] || content.ar;
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

const content: Record<"ar" | "en" | "ku", string> = {
  ar: "<p>باستخدامك منصة <strong>MAAROOF Ai</strong> لتحسين الظهور في محركات الذكاء الاصطناعي التوليدي (GEO) فإنك توافق على ما يلي:</p>\n<h2>1. الخدمة</h2><ul><li>تعمل المنصة عبر مساحة عمل ذكية: تكتب هدفك، فيقترح الوكيل المهارات المناسبة ويسأل عشرة نماذج ذكاء اصطناعي ويقيس حضورك على محاور SEO وAEO وGEO وSGE وGSEO.</li><li>النتائج تقديرات مبنية على إجابات النماذج والمصادر المقروءة فعلاً، ولا نضمن ترتيباً أو ذكراً محدداً داخل أي نموذج.</li><li>لا نختلق أرقاماً أو مصادر؛ ما لم يُقَس يظهر بوضوح أنه لم يُقَس.</li></ul>\n<h2>2. الاستخدام المقبول</h2><ul><li>تستخدم المنصة لأغراض مشروعة ولعلامات تملكها أو مخوّل بإدارتها.</li><li>يُمنع إرسال الرسائل غير المرغوبة، أو جمع بيانات شخصية دون إذن، أو إساءة استخدام الوكيل.</li></ul>\n<h2>3. الرصيد والخصم</h2><ul><li>كل مهمة تعرض الكلفة التقديرية ورصيدك قبل التنفيذ، ولا تبدأ إلا بموافقتك.</li><li>الخصم يتم فقط بعد نجاح العملية؛ العمليات الفاشلة أو غير المقروءة لا تُحتسب.</li><li>تتاح المهارات حسب اشتراكك وإعدادات الإدارة، وقد يظهر بعضها بخيار «تواصل معنا».</li></ul>\n<h2>4. الحساب والاشتراك</h2><ul><li>أنت مسؤول عن سرية حسابك ودقة بيانات بطاقة حقيقة الكيان.</li><li>يُفعَّل الاشتراك المدفوع بعد تأكيد الدفع، ولا يُسترد بعد التفعيل إلا وفق سياستنا.</li></ul>\n<h2>5. التعديلات</h2><p>قد نحدّث هذه الشروط، ويعني استمرار استخدامك قبول التحديث.</p>",
  en: "<p>By using <strong>MAAROOF Ai</strong>, a platform for Generative Engine Optimization (GEO), you agree to the following:</p>\n<h2>1. The service</h2><ul><li>You write a goal in the workspace; the agent suggests skills, asks ten AI models and measures your presence on SEO, AEO, GEO, SGE and GSEO.</li><li>Results are estimates based on model answers and sources actually read; we do not guarantee any ranking or mention.</li><li>We never invent numbers or sources; anything not measured is clearly marked as such.</li></ul>\n<h2>2. Acceptable use</h2><ul><li>Use the platform lawfully and for brands you own or are authorised to manage.</li><li>No spam, no collecting personal data without consent, no abuse of the agent.</li></ul>\n<h2>3. Balance and charges</h2><ul><li>Every task shows the estimated cost and your balance before running, and only starts after you approve.</li><li>You are charged only after a successful run; failed or unread work is not charged.</li><li>Skills are available according to your plan and admin settings; some may show “Contact us”.</li></ul>\n<h2>4. Account and subscription</h2><ul><li>You are responsible for your account and the accuracy of your Entity Truth Card.</li><li>Paid plans activate after payment confirmation and are non-refundable after activation except under our policy.</li></ul>\n<h2>5. Changes</h2><p>We may update these terms; continued use means you accept the update.</p>",
  ku: "<p>بە بەکارهێنانی <strong>MAAROOF Ai</strong> بۆ باشترکردنی دەرکەوتن لە بزوێنەرە زیرەکەکان (GEO)، ڕازی دەبیت بەم خاڵانە:</p>\n<h2>1. خزمەتگوزاری</h2><ul><li>ئامانجەکەت دەنووسیت؛ بریکار کارامەیی پێشنیار دەکات، پرسیار لە دە مۆدێل دەکات و دەرکەوتنت لەسەر SEO، AEO، GEO، SGE و GSEO دەپێوێت.</li><li>ئەنجامەکان خەمڵاندنن و هیچ ڕیزبەندییەک گەرەنتی ناکرێت.</li><li>هیچ ژمارە یان سەرچاوەیەک دروست ناکرێت.</li></ul>\n<h2>2. بەکارهێنانی ڕێگەپێدراو</h2><ul><li>تەنها بۆ مەبەستی یاسایی و بۆ براندی خۆت.</li><li>نامەی ناخوازراو و کۆکردنەوەی داتای کەسی بێ ڕەزامەندی قەدەغەیە.</li></ul>\n<h2>3. باڵانس و بڕین</h2><ul><li>پێش هەر ئەرکێک تێچوو و باڵانسەکەت پیشان دەدرێت و تەنها دوای ڕەزامەندیت دەست پێدەکات.</li><li>تەنها دوای سەرکەوتن پارە دەبڕدرێت.</li></ul>\n<h2>4. هەژمار و بەشداریکردن</h2><ul><li>تۆ بەرپرسیاری نهێنی هەژمارەکەت و ڕاستی کارتی ناسنامەکەتی.</li></ul>\n<h2>5. گۆڕانکاری</h2><p>لەوانەیە ئەم مەرجانە نوێ بکەینەوە.</p>",
};
