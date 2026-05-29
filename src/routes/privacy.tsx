import { createFileRoute, Link } from "@tanstack/react-router";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy · MAAROOF Ai" },
      { name: "description", content: "How MAAROOF Ai collects, uses and protects your data across the platform and AI Agent." },
      { property: "og:title", content: "Privacy Policy · MAAROOF Ai" },
      { property: "og:description", content: "How MAAROOF Ai handles your data." },
      { property: "og:url", content: "https://geoiraq.com/privacy" },
    ],
    links: [{ rel: "canonical", href: "https://geoiraq.com/privacy" }],
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
          <h1 className="font-display text-4xl font-bold text-gradient">{t("privacy_title")}</h1>
          <div className="mt-6 space-y-4 text-foreground/85" dangerouslySetInnerHTML={{ __html: c }} />
          <div className="mt-10"><Link to="/" className="text-sm text-primary hover:underline">← {t("back_home")}</Link></div>
        </article>
      </main>
    </div>
  );
}

const content = {
  ar: `
<p>تحترم منصة <strong>MAAROOF Ai</strong> (جزء من نظام معروف) خصوصيتك وتلتزم بحماية بياناتك.</p>
<h2>البيانات التي نجمعها</h2>
<ul>
<li>بيانات الحساب: البريد الإلكتروني، الاسم.</li>
<li>المحتوى الذي تُرسله للأدوات أو الوكيل (نصوص، روابط، أهداف).</li>
<li>سجل الاستخدام لكل أداة وللوكيل (عدد التشغيلات اليومي/الشهري، النوع، التاريخ).</li>
<li>بصمة جهاز تقنية (User-Agent، اللغة، الشاشة، المنطقة الزمنية) لربط الحساب بالجهاز ومنع إساءة الاستخدام.</li>
</ul>
<h2>كيف نستخدم بياناتك</h2>
<ul>
<li>تشغيل الأدوات والوكيل الذكي وفق الأهداف التي تُعرّفها.</li>
<li>احتساب الاستهلاك (عدد العمليات) مقابل خطتك وعرضه لك بشكل شفاف.</li>
<li>تحسين دقة التقييمات بشكل مجمّع ومجهول الهوية.</li>
<li>إدارة اشتراكك وحصصك وربط الأدوات بالخطة المناسبة.</li>
</ul>
<h2>الوكيل الذكي</h2>
<p>عند تشغيل الوكيل (مباشرة أو وفق جدول) نسجّل: الأمر/الهدف، الوقت، نتيجة التنفيذ، وعدد الوحدات المستهلكة. الوكيل لا يصل لبيانات أو حسابات خارج ما تمنحه له صراحة.</p>
<h2>مشاركة البيانات</h2>
<p>لا نبيع بياناتك. نستخدم مزودي خدمة موثوقين (استضافة، ذكاء اصطناعي، بحث على الويب) ضمن اتفاقيات سرية لتشغيل الأدوات والوكيل.</p>
<h2>التخزين المؤقت (Caching)</h2>
<p>قد نخزّن بصمة (hash) لنصوصك المحلَّلة لتسريع التحاليل المتكررة وتقليل الكلفة، دون ربطها ببيانات هوية شخصية.</p>
<h2>تطبيق الويب التقدمي (PWA)</h2>
<p>عند تثبيت المنصة كتطبيق، لا نجمع بيانات إضافية. التثبيت يستخدم فقط الملف المعياري <code>manifest.webmanifest</code>.</p>
<h2>حقوقك</h2>
<p>يمكنك طلب حذف حسابك وبياناتك وسجل الاستخدام في أي وقت عبر واتساب: <strong>+9647733570130</strong>.</p>
<h2>الكوكيز</h2>
<p>نستخدم تخزيناً محلياً لإدارة الجلسة وتفضيلات اللغة فقط.</p>
<p class="text-sm text-muted-foreground">آخر تحديث: 2026</p>
`,
  en: `
<p><strong>MAAROOF Ai</strong> (part of the Marouf system) respects your privacy and is committed to protecting your data.</p>
<h2>Data we collect</h2>
<ul>
<li>Account data: email, name.</li>
<li>Content you submit to tools or the Agent (text, URLs, targets).</li>
<li>Usage history for each tool and the Agent (daily/monthly run counts, type, timestamps).</li>
<li>Technical device fingerprint (User-Agent, language, screen, timezone) to bind your account to a device and prevent abuse.</li>
</ul>
<h2>How we use your data</h2>
<ul>
<li>Run tools and the Smart Agent according to targets you define.</li>
<li>Count usage against your plan and display it transparently.</li>
<li>Improve scoring accuracy in aggregate, anonymized form.</li>
<li>Manage your subscription, quotas, and tool-to-plan access.</li>
</ul>
<h2>Smart Agent</h2>
<p>When the Agent runs (manually or scheduled) we log: the command/target, timestamp, execution result, and units consumed. The Agent has no access to data or accounts beyond what you explicitly grant.</p>
<h2>Data sharing</h2>
<p>We do not sell your data. We use trusted service providers (hosting, AI, web search) under confidentiality agreements to power tools and the Agent.</p>
<h2>Caching</h2>
<p>We may store a hash of analyzed text to accelerate repeat analyses and reduce cost, without linking it to personal identifiers.</p>
<h2>Progressive Web App (PWA)</h2>
<p>Installing the platform as an app collects no additional data — it only uses the standard <code>manifest.webmanifest</code>.</p>
<h2>Your rights</h2>
<p>You can request deletion of your account, data and usage history at any time via WhatsApp: <strong>+9647733570130</strong>.</p>
<h2>Cookies</h2>
<p>We use local storage only for session and language preference.</p>
<p class="text-sm text-muted-foreground">Last updated: 2026</p>
`,
  ku: `
<p>پلاتفۆڕمی <strong>MAAROOF Ai</strong> (بەشێک لە سیستەمی مەعروف) ڕێز لە نهێنیپارێزیت دەگرێت.</p>
<h2>زانیارییەکان</h2>
<ul>
<li>زانیاری هەژمار: ئیمەیڵ، ناو.</li>
<li>ناوەڕۆکی ناردراو بۆ ئامرازەکان یان وەکیل (دەق، لینک، ئامانج).</li>
<li>مێژووی بەکارهێنان بۆ هەر ئامرازێک و وەکیل.</li>
<li>پەنجەمۆری ئامێر بۆ بەستنی هەژمار بە ئامێرەکەت.</li>
</ul>
<h2>چۆن بەکاریدەهێنین</h2>
<ul>
<li>کارپێکردنی ئامرازەکان و وەکیلی زیرەک بەپێی ئامانجەکانت.</li>
<li>ژماردنی بەکارهێنان بەپێی پلانەکەت و پیشاندانی ڕوون.</li>
<li>باشترکردنی هەڵسەنگاندن بە شێوەی بێ ناسنامە.</li>
<li>بەڕێوەبردنی بەشداربوون و کۆتاکان و بەستنی ئامراز بە پلان.</li>
</ul>
<h2>وەکیلی زیرەک</h2>
<p>کاتێک وەکیل کاردەکات: فەرمان/ئامانج، کات، ئەنجام و یەکەی بەکارهاتوو تۆمار دەکرێن. وەکیل دەستی ناگات بە زانیاری دەرەوەی ئەوەی تۆ پێی دەدەیت.</p>
<h2>هاوبەشی زانیاری</h2>
<p>زانیاریت نافرۆشین. خزمەتگوزاری دڵنیا بەکاردەهێنین لەژێر گرێبەستی نهێنی.</p>
<h2>کاش</h2>
<p>هاش (hash) ـی دەقەکانت پاشەکەوت دەکەین بۆ خێراکردن، بێ گرێدان بە ناسنامە.</p>
<h2>PWA</h2>
<p>دامەزراندنی پلاتفۆڕم وەک ئەپ هیچ زانیاریەکی زیاتر کۆناکاتەوە.</p>
<h2>مافەکانت</h2>
<p>داوای سڕینەوەی هەژمار و زانیاری دەکرێت لە ڕێگەی واتسئەپ: <strong>+9647733570130</strong>.</p>
<p class="text-sm text-muted-foreground">دوایین نوێکردنەوە: 2026</p>
`,
};
