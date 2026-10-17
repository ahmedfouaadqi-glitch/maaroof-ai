import { createFileRoute, Link } from "@tanstack/react-router";
import DOMPurify from "isomorphic-dompurify";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy · MAAROOF Ai" },
      { name: "description", content: "How MAAROOF Ai collects, uses and protects your data across the platform and AI Agent." },
      { property: "og:title", content: "Privacy Policy · MAAROOF Ai" },
      { property: "og:description", content: "How MAAROOF Ai handles your data." },
      { property: "og:url", content: "https://maaroofai.com/privacy" },
    ],
    links: [{ rel: "canonical", href: "https://maaroofai.com/privacy" }],
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
          <div className="mt-6 space-y-4 text-foreground/85" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(c) }} />
          <div className="mt-10"><Link to="/" className="text-sm text-primary hover:underline">← {t("back_home")}</Link></div>
        </article>
      </main>
    </div>
  );
}

const content = {
  ar: `
<p>تحترم منصة <strong>MAAROOF Ai</strong>، وهي جزء من نظام معروف، خصوصيتك. توضّح هذه السياسة أنواع البيانات التي قد تُعالج عند استخدام الموقع ومساحة العمل والمهارات والأدوات والوكيل الذكي. تاريخ آخر مراجعة لهذه الصياغة: 17 أكتوبر 2026.</p>
<h2>البيانات التي نجمعها</h2>
<ul>
<li>بيانات الحساب: البريد الإلكتروني، الاسم.</li>
<li>المحتوى الذي تُرسله للأدوات أو الوكيل (نصوص، روابط، أهداف).</li>
<li>سجل الاستخدام لكل أداة وللوكيل (عدد التشغيلات اليومي/الشهري، النوع، التاريخ).</li>
<li>بيانات تقنية وسجلات أمان وتشغيل، مثل معلومات المتصفح والجهاز واللغة والمنطقة الزمنية وعناوين الشبكة عند توفرها، لأغراض تشغيل الخدمة وتشخيص الأعطال ومنع إساءة الاستخدام. لا تُستخدم هذه البيانات لإثبات هوية الشخص بمفردها.</li>
<li>بيانات الملف الشخصي والجهة أو العلامة التجارية والكلمات المفتاحية والتفضيلات التي تختار حفظها.</li>
<li>بيانات الرصيد والخطة والحصص وسجلات التحصيل اللازمة لتشغيل الحساب ومحاسبة الاستخدام.</li>
</ul>
<h2>كيف نستخدم بياناتك</h2>
<ul>
<li>تشغيل الأدوات والوكيل الذكي وفق الأهداف التي تُعرّفها.</li>
<li>احتساب الاستهلاك (عدد العمليات) مقابل خطتك وعرضه لك بشكل شفاف.</li>
<li>تحسين جودة الخدمة وتحليل الأداء؛ ولا يعني ذلك أن كل معالجة أو سجل يصبح مجهول الهوية تلقائياً.</li>
<li>إدارة اشتراكك وحصصك وربط الأدوات بالخطة المناسبة.</li>
</ul>
<h2>الوكيل الذكي</h2>
<p>عند تشغيل الوكيل أو إحدى المهارات، قد تُعالج الأهداف والتعليمات والمدخلات والنتائج وسجلات التنفيذ والتكلفة. بعد حفظ الملف الشخصي، قد يستخدم النظام البيانات المتاحة في الحساب وسياق الملف لتخصيص الخدمة وفهم احتياجات المستخدم، وفق صلاحيات الحساب والميزات المفعّلة. لا ينبغي إرسال كلمات مرور أو مفاتيح سرية أو بيانات شخصية لا تحتاجها المهمة.</p>
<h2>مشاركة البيانات</h2>
<p>لا نبيع بياناتك. قد تُرسل المدخلات اللازمة إلى مزودي خدمات البنية التحتية والذكاء الاصطناعي والبحث أو الأدوات الخارجية التي يطلبها المستخدم أو يتطلبها التنفيذ. قد تخضع هذه البيانات لشروط وسياسات مزود الخدمة المعني. لا يمكن ضمان أن كل مزود خارجي يعالج البيانات بالطريقة نفسها؛ لذا تجنّب إدخال بيانات شديدة الحساسية ما لم تكن ضرورية ومصرحاً بها.</p>
<h2>التخزين المؤقت (Caching)</h2>
<p>قد تستخدم المنصة التخزين المؤقت أو سجلات التشغيل لتقليل زمن الاستجابة والتكلفة، وفق الميزة المستخدمة. لا يعني تحويل النص إلى بصمة أو hash وحده أن جميع البيانات مجهولة الهوية أو يستحيل ربطها بسياق آخر.</p>
<h2>تطبيق الويب التقدمي (PWA)</h2>
<p>عند تثبيت المنصة كتطبيق، لا نجمع بيانات إضافية. التثبيت يستخدم فقط الملف المعياري <code>manifest.webmanifest</code>.</p>
<h2>حقوقك</h2>
<p>يمكنك طلب الوصول إلى بياناتك أو تصحيحها أو حذف حسابك وبياناته عبر قنوات التواصل المنشورة في صفحة <a href="/contact">الاتصال</a>. قد نحتفظ ببعض السجلات للمدة اللازمة للأمان أو المحاسبة أو الالتزامات القانونية، حيث ينطبق ذلك. لا تُعد هذه السياسة وعداً بحذف فوري من النسخ الاحتياطية أو سجلات مزودي الخدمات الخارجيين.</p>
<h2>الكوكيز</h2>
<p>تستخدم المنصة التخزين المحلي أو ملفات تعريف الارتباط اللازمة للجلسة وتفضيلات الواجهة، وقد تستخدم التخزين المؤقت أو وسائل تقنية أخرى بحسب الميزات المفعّلة. راجع إعدادات المتصفح لإدارة التخزين، مع العلم أن تعطيل الضروري منه قد يؤثر في عمل الخدمة.</p>
<h2>تحديث السياسة والتواصل</h2>
<p>قد تتغير هذه السياسة عند إضافة ميزات أو مزودي خدمة أو متطلبات تشغيلية. ستُنشر النسخة المعدّلة على هذه الصفحة مع تحديث تاريخ المراجعة. للاستفسار أو طلب متعلق بالبيانات، استخدم قنوات التواصل المنشورة في صفحة الاتصال.</p>
<p class="text-sm text-muted-foreground">آخر مراجعة تحريرية: 17 أكتوبر 2026. هذه الصياغة لا تحل محل مراجعة قانونية متخصصة ولا تؤكد وحدها أن جميع الممارسات التقنية قد تم التحقق منها.</p>
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
