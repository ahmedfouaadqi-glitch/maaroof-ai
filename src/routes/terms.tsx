import { createFileRoute, Link } from "@tanstack/react-router";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [{ title: "Terms of Use · GEO-Iraq" }] }),
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
      <article className="prose prose-invert mx-auto max-w-3xl px-4 py-12 md:px-6">
        <h1 className="font-display text-4xl font-bold text-gradient">{t("terms_title")}</h1>
        <div className="mt-6 space-y-4 text-foreground/85" dangerouslySetInnerHTML={{ __html: c }} />
        <div className="mt-10"><Link to="/" className="text-sm text-primary hover:underline">← {t("back_home")}</Link></div>
      </article>
    </div>
  );
}

const content = {
  ar: `
<p>باستخدامك منصة <strong>GEO-Iraq</strong> (جزء من نظام معروف) فإنك توافق على الشروط التالية:</p>
<h2>1. الاستخدام المقبول</h2>
<ul>
<li>تستخدم المنصة لأغراض مشروعة فقط.</li>
<li>لا تُرسل محتوى يخالف القانون العراقي أو ينتهك حقوق الآخرين.</li>
<li>لا تحاول استغلال ثغرات أو إساءة استخدام واجهة الذكاء الاصطناعي.</li>
</ul>
<h2>2. الحساب والاشتراك</h2>
<ul>
<li>أنت مسؤول عن سرية بيانات حسابك.</li>
<li>الاشتراك المدفوع يُفعَّل عبر التواصل على واتساب وتأكيد الدفع.</li>
<li>الاشتراك غير قابل للاسترداد بعد التفعيل إلا بموجب سياستنا الداخلية.</li>
</ul>
<h2>3. الذكاء الاصطناعي</h2>
<p>أدوات التحليل والاقتراح آلية وليست محادثة. النتائج إرشادية ولا تُعدّ ضماناً تجارياً أو قانونياً.</p>
<h2>4. الملكية الفكرية</h2>
<p>المحتوى الذي تُدخله ملكك. نتائج التحليل والاقتراحات للاستخدام الشخصي/التجاري لحسابك.</p>
<h2>5. حدود المسؤولية</h2>
<p>لا تتحمل المنصة مسؤولية أضرار غير مباشرة ناتجة عن استخدامك.</p>
<h2>6. التعديل</h2>
<p>قد نُحدّث هذه السياسة. يبقى استخدامك للمنصة موافقةً على آخر نسخة.</p>
<h2>7. التواصل</h2>
<p>للاستفسار: واتساب <strong>+9647733570130</strong>.</p>
`,
  en: `
<p>By using <strong>GEO-Iraq</strong> (part of the Marouf system), you agree to the following:</p>
<h2>1. Acceptable Use</h2>
<ul>
<li>Use the platform for lawful purposes only.</li>
<li>Do not submit content that violates Iraqi law or others' rights.</li>
<li>Do not attempt to exploit or abuse the AI interface.</li>
</ul>
<h2>2. Account & Subscription</h2>
<ul>
<li>You are responsible for keeping your credentials confidential.</li>
<li>Paid subscriptions are activated via WhatsApp after payment confirmation.</li>
<li>Subscriptions are non-refundable after activation unless our internal policy allows.</li>
</ul>
<h2>3. AI Tools</h2>
<p>The analysis and suggestion tools are automated, not chat. Results are advisory and not commercial or legal guarantees.</p>
<h2>4. Intellectual Property</h2>
<p>Content you submit remains yours. Analysis and suggestion results are for your personal/commercial use.</p>
<h2>5. Liability</h2>
<p>The platform is not liable for indirect damages from your use.</p>
<h2>6. Updates</h2>
<p>We may update this policy. Continued use constitutes acceptance of the latest version.</p>
<h2>7. Contact</h2>
<p>For inquiries: WhatsApp <strong>+9647733570130</strong>.</p>
`,
  ku: `
<p>بە بەکارهێنانی <strong>GEO-Iraq</strong> (بەشێک لە سیستەمی مەعروف) ڕەزامەندیت لەسەر ئەم مەرجانە:</p>
<h2>1. بەکارهێنانی پەسەند</h2>
<ul>
<li>پلاتفۆڕم تەنها بۆ مەبەستی یاسایی بەکاربێنە.</li>
<li>ناوەڕۆکی پێچەوانەی یاسای عێراق یان مافی کەسانی تر مەنێرە.</li>
</ul>
<h2>2. هەژمار و بەشداربوون</h2>
<ul>
<li>تۆ بەرپرسیاریت لە پاراستنی زانیاری هەژمارەکەت.</li>
<li>بەشداربوونی پارەدراو لە ڕێگەی واتسئەپەوە چالاک دەکرێت.</li>
</ul>
<h2>3. ئامرازەکانی AI</h2>
<p>ئامرازەکانی شیکاری و پێشنیار ئۆتۆماتیکن، نەک گفتوگۆ. ئەنجامەکان ڕاسپاردەن نەک گرێبەستی یاسایی.</p>
<h2>4. مافی موڵکی</h2>
<p>ناوەڕۆکی ناردراو ماڵی تۆیە. ئەنجامەکان بۆ بەکارهێنانی کەسی/بازرگانی هەژمارەکەتە.</p>
<h2>5. سنووری بەرپرسیاری</h2>
<p>پلاتفۆڕم بەرپرسی زیانی ناڕاستەوخۆ نییە.</p>
<h2>6. نوێکردنەوە</h2>
<p>دەکرێت ئەم سیاسەتە نوێ بکەینەوە. بەردەوامبوونی بەکارهێنان واتە ڕەزامەندی.</p>
<h2>7. پەیوەندی</h2>
<p>واتسئەپ: <strong>+9647733570130</strong>.</p>
`,
};
