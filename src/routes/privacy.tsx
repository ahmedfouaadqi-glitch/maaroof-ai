import { createFileRoute, Link } from "@tanstack/react-router";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Privacy Policy · GEO-Iraq" }] }),
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
        <h1 className="font-display text-4xl font-bold text-gradient">{t("privacy_title")}</h1>
        <div className="mt-6 space-y-4 text-foreground/85" dangerouslySetInnerHTML={{ __html: c }} />
        <div className="mt-10"><Link to="/" className="text-sm text-primary hover:underline">← {t("back_home")}</Link></div>
      </article>
    </div>
  );
}

const content = {
  ar: `
<p>تحترم منصة <strong>GEO-Iraq</strong> (جزء من نظام معروف) خصوصيتك وتلتزم بحماية بياناتك.</p>
<h2>البيانات التي نجمعها</h2>
<ul>
<li>بيانات الحساب: البريد الإلكتروني، الاسم.</li>
<li>المحتوى الذي تُرسله للتحليل أو الاقتراح.</li>
<li>سجل الاستخدام (التحليلات والاقتراحات والتواريخ).</li>
</ul>
<h2>كيف نستخدم بياناتك</h2>
<ul>
<li>تشغيل أدوات التحليل والاقتراح.</li>
<li>تحسين دقة التقييمات (بشكل مجمّع ومجهول الهوية).</li>
<li>إدارة اشتراكك والتواصل بخصوصه.</li>
</ul>
<h2>مشاركة البيانات</h2>
<p>لا نبيع بياناتك. نستخدم مزودي خدمة موثوقين لتشغيل المنصة (استضافة، ذكاء اصطناعي) ضمن اتفاقيات سرية.</p>
<h2>التخزين المؤقت (Caching)</h2>
<p>قد نخزّن بصمة (hash) لنصوصك المحلَّلة لتسريع التحاليل المتكررة وتقليل الكلفة، دون ربطها ببيانات هوية شخصية.</p>
<h2>حقوقك</h2>
<p>يمكنك طلب حذف حسابك وبياناتك في أي وقت عبر التواصل معنا على واتساب: <strong>+9647733570130</strong>.</p>
<h2>الكوكيز</h2>
<p>نستخدم تخزيناً محلياً لإدارة الجلسة وتفضيلات اللغة فقط.</p>
<p class="text-sm text-muted-foreground">آخر تحديث: 2026</p>
`,
  en: `
<p><strong>GEO-Iraq</strong> (part of the Marouf system) respects your privacy and is committed to protecting your data.</p>
<h2>Data we collect</h2>
<ul>
<li>Account data: email, name.</li>
<li>Content you submit for analysis or suggestion.</li>
<li>Usage history (analyses, suggestions, timestamps).</li>
</ul>
<h2>How we use your data</h2>
<ul>
<li>Run the analysis and suggestion tools.</li>
<li>Improve scoring accuracy in aggregate, anonymized form.</li>
<li>Manage your subscription and communicate about it.</li>
</ul>
<h2>Data sharing</h2>
<p>We do not sell your data. We use trusted service providers (hosting, AI) under confidentiality agreements.</p>
<h2>Caching</h2>
<p>We may store a hash of analyzed text to accelerate repeat analyses and reduce cost, without linking it to personal identifiers.</p>
<h2>Your rights</h2>
<p>You can request deletion of your account and data at any time via WhatsApp: <strong>+9647733570130</strong>.</p>
<h2>Cookies</h2>
<p>We use local storage only for session and language preference.</p>
<p class="text-sm text-muted-foreground">Last updated: 2026</p>
`,
  ku: `
<p>پلاتفۆڕمی <strong>GEO-Iraq</strong> (بەشێک لە سیستەمی مەعروف) ڕێز لە نهێنیپارێزیت دەگرێت.</p>
<h2>زانیارییەکانی کۆدەکەینەوە</h2>
<ul>
<li>زانیاری هەژمار: ئیمەیڵ، ناو.</li>
<li>ناوەڕۆکی ناردراو بۆ شیکاری یان پێشنیار.</li>
<li>مێژووی بەکارهێنان.</li>
</ul>
<h2>چۆن بەکاریدەهێنین</h2>
<ul>
<li>کارپێکردنی ئامرازەکانی شیکاری و پێشنیار.</li>
<li>باشترکردنی وردی هەڵسەنگاندن بە شێوەی بێ ناسنامە.</li>
<li>بەڕێوەبردنی بەشداربوونەکەت.</li>
</ul>
<h2>هاوبەشی زانیاری</h2>
<p>زانیاریت نافرۆشین. خزمەتگوزاری دڵنیا بەکاردەهێنین (هۆستینگ، AI) لەژێر گرێبەستی نهێنی.</p>
<h2>کاش</h2>
<p>هاش (hash) ـی دەقەکانت پاشەکەوت دەکەین بۆ خێراکردنی شیکاری دووبارە، بێ گرێدان بە ناسنامە.</p>
<h2>مافەکانت</h2>
<p>دەتوانیت داوای سڕینەوەی هەژمارەکەت بکەیت لە ڕێگەی واتسئەپ: <strong>+9647733570130</strong>.</p>
<p class="text-sm text-muted-foreground">دوایین نوێکردنەوە: 2026</p>
`,
};
