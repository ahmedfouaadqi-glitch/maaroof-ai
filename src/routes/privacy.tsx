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
<p><strong>MAAROOF Ai</strong>, part of the Maaroof system, respects your privacy. This policy describes data that may be processed when you use the website, workspace, skills, tools and AI Agent. Editorial review date: 17 October 2026.</p>
<h2>Data we collect</h2>
<ul>
<li>Account data: email, name.</li>
<li>Content you submit to tools or the Agent (text, URLs, targets).</li>
<li>Usage history for each tool and the Agent (daily/monthly run counts, type, timestamps).</li>
<li>Technical and security information, such as browser/device details, language, timezone and network information where available, to operate the service, diagnose issues and prevent abuse. These signals alone do not establish a person’s identity.</li>
<li>Profile, organization or brand details, keywords and preferences you choose to save.</li>
<li>Balance, plan, quota and charging records needed to operate your account and account for usage.</li>
</ul>
<h2>How we use your data</h2>
<ul>
<li>Run tools and the Smart Agent according to targets you define.</li>
<li>Count usage against your plan and display it transparently.</li>
<li>Improve service quality and analyze performance. This does not mean every record is automatically anonymized.</li>
<li>Manage your subscription, quotas, and tool-to-plan access.</li>
</ul>
<h2>Smart Agent</h2>
<p>When the Agent or a skill runs, its goal, instructions, inputs, outputs, execution records and usage cost may be processed. After you save your profile, the system may use available account and profile context to personalize the service, subject to account permissions and enabled features. Do not submit passwords, secret keys or unnecessary personal data.</p>
<h2>Data sharing</h2>
<p>We do not sell your data. Inputs needed for a task may be sent to infrastructure, AI, search or external tool providers used by the feature you request or that execution requires. Those providers may process data under their own terms and policies. We cannot guarantee that every external provider handles data identically; avoid submitting highly sensitive data unless necessary and authorized.</p>
<h2>Caching</h2>
<p>The platform may use caching and execution logs to reduce latency and cost, depending on the feature. Converting text to a hash alone does not guarantee that all data is anonymous or impossible to associate with other context.</p>
<h2>Progressive Web App (PWA)</h2>
<p>Installing the platform as an app collects no additional data — it only uses the standard <code>manifest.webmanifest</code>.</p>
<h2>Your rights</h2>
<p>You may request access, correction or deletion of your account and data through the channels on our <a href="/contact">Contact page</a>. Some records may be retained as needed for security, accounting or legal obligations where applicable. This policy does not promise immediate removal from backups or external providers’ records.</p>
<h2>Cookies</h2>
<p>The platform uses local storage or cookies for session management and interface preferences, and may use caching or other technical storage depending on enabled features. Browser controls can manage storage, although disabling necessary storage may affect service functionality.</p>
<h2>Policy updates and contact</h2>
<p>This policy may change as features, service providers or operational requirements change. The revised version will be published on this page with an updated review date. For privacy questions or data requests, use the channels listed on the Contact page.</p>
<p class="text-sm text-muted-foreground">Editorial review: 17 October 2026. This wording does not replace specialist legal review or independently verify every technical practice.</p>
`,
  ku: `
<p>پلاتفۆڕمی <strong>MAAROOF Ai</strong>، کە بەشێکە لە سیستەمی مەعروف، ڕێز لە تایبەتمەندییەکەت دەگرێت. ئەم سیاسەتە جۆرەکانی زانیاری ڕوون دەکاتەوە کە لە کاتی بەکارهێنانی ماڵپەڕ، شوێنی کار، شارەزاییەکان، ئامرازەکان و وەکیلی زیرەکدا لەوانەیە پرۆسێس بکرێن. دوایین پێداچوونەوەی دەقی: ١٧ی ئۆکتۆبەری ٢٠٢٦.</p>
<h2>زانیارییەکان</h2>
<ul>
<li>زانیاری هەژمار: ئیمەیڵ، ناو.</li>
<li>ناوەڕۆکی ناردراو بۆ ئامرازەکان یان وەکیل (دەق، لینک، ئامانج).</li>
<li>مێژووی بەکارهێنان بۆ هەر ئامرازێک و وەکیل.</li>
<li>زانیاری تەکنیکی و ئاسایش، وەک زانیاری وێبگەڕ و ئامێر، زمان، ناوچەی کاتی و زانیاری تۆڕ لە کاتی بەردەستبوون، بۆ کارپێکردن و چارەسەری کێشەکان و ڕێگریکردن لە بەکارهێنانی خراپ. ئەم نیشانانە بە تەنها ناسنامەی کەسێک پشتڕاست ناکەنەوە.</li>
<li>زانیاری پرۆفایل، دامەزراوە یان براند، وشە سەرەکییەکان و هەڵبژاردەکان کە هەڵدەبژێریت پاشەکەوت بکرێن.</li>
<li>زانیاری باڵانس، پلان، سنووری بەکارهێنان و تۆماری پارەدان بۆ کارپێکردنی هەژمارەکەت.</li>
</ul>
<h2>چۆن بەکاریدەهێنین</h2>
<ul>
<li>کارپێکردنی ئامرازەکان و وەکیلی زیرەک بەپێی ئامانجەکانت.</li>
<li>ژماردنی بەکارهێنان بەپێی پلانەکەت و پیشاندانی ڕوون.</li>
<li>باشترکردنی کوالێتی خزمەتگوزاری و شیکردنەوەی کارایی. ئەمە واتای ئەوە نییە کە هەموو تۆمارێک بە شێوەی ئۆتۆماتیکی بێ ناسنامە دەبێت.</li>
<li>بەڕێوەبردنی بەشداربوون و کۆتاکان و بەستنی ئامراز بە پلان.</li>
</ul>
<h2>وەکیلی زیرەک</h2>
<p>کاتێک وەکیل یان شارەزاییەک کاردەکات، ئامانج، ڕێنمایی، داتا و ئەنجام و تۆماری جێبەجێکردن و تێچووی بەکارهێنان لەوانەیە پرۆسێس بکرێن. دوای پاشەکەوتکردنی پرۆفایلەکەت، سیستەم لەوانەیە زانیاری بەردەست لە هەژمار و پرۆفایلەکەت بۆ گونجاندنی خزمەتگوزاری بەکاربهێنێت، بە پێی دەسەڵات و تایبەتمەندییە چالاکەکان. وشەی نهێنی، کلیلی نهێنی یان زانیاری کەسی ناپێویست مەنووسە.</p>
<h2>هاوبەشی زانیاری</h2>
<p>زانیارییەکانت نافرۆشین. داتای پێویست بۆ ئەرکێک لەوانەیە بۆ دابینکەرانی ژێرخانە، AI، گەڕان یان ئامرازی دەرەکی بنێردرێت. ئەو دابینکەرانە لەوانەیە بە پێی مەرج و سیاسەتی خۆیان داتا پرۆسێس بکەن. ناتوانین شێوازی پاراستنی هەموو دابینکەرێکی دەرەکی یەکسان مسۆگەر بکەین؛ زانیاری زۆر هەستیار مەنووسە مەگەر پێویست و ڕێگەپێدراو بێت.</p>
<h2>کاش</h2>
<p>بەپێی تایبەتمەندییە بەکارهاتووەکان، پلاتفۆڕم لەوانەیە کاش و تۆماری جێبەجێکردن بەکاربهێنێت بۆ کەمکردنەوەی کات و تێچوو. گۆڕینی دەق بۆ hash بە تەنها واتای ئەوە نییە کە هەموو داتا بێ ناسنامە یان ناپەیوەندیدارە بە زانیارییەکانی تر.</p>
<h2>PWA</h2>
<p>پلاتفۆڕم لەوانەیە local storage یان cookie بۆ بەڕێوەبردنی دانیشتن و هەڵبژاردەی زمان بەکاربهێنێت، و بەپێی تایبەتمەندییە چالاکەکان کاش یان شێوازی تەکنیکی تر بەکاربهێنێت. ڕێکخستنەکانی وێبگەڕ دەتوانن بەڕێوەبردنی ئەم زانیارییانە بکەن، بەڵام لابردنی زانیاری پێویست لەوانەیە کاری خزمەتگوزاری تێکبدات.</p>
<h2>مافەکانت</h2>
<p>دەتوانیت داوای دەستگەیشتن، ڕاستکردنەوە یان سڕینەوەی هەژمار و زانیارییەکانت لە ڕێگەی کەناڵەکانی پەیوەندی لە <a href="/contact">پەڕەی پەیوەندی</a> بکەیت. لەوانەیە هەندێک تۆمار بۆ ئاسایش، ژمێریاری یان پابەندی یاسایی، ئەگەر پێویست بێت، بهێڵدرێتەوە. ئەم سیاسەتە سڕینەوەی دەستبەجێ لە backup یان لە سیستەمی دابینکەرانی دەرەکی مسۆگەر ناکات.</p>
<h2>نوێکردنەوەی سیاسەت و پەیوەندی</h2>
<p>لەوانەیە ئەم سیاسەتە بە هۆی گۆڕانی تایبەتمەندی، دابینکەری خزمەتگوزاری یان پێداویستییەکانی کار نوێ بکرێتەوە. وەشانی نوێ لەم پەڕەیەدا بڵاودەکرێتەوە. بۆ پرسیار یان داواکاری تایبەتمەندی، کەناڵەکانی پەیوەندی بەکاربهێنە.</p>
<p class="text-sm text-muted-foreground">دوایین پێداچوونەوەی دەقی: ١٧ی ئۆکتۆبەری ٢٠٢٦. ئەم دەقە جێگای پێداچوونەوەی یاسایی پسپۆڕ ناگرێتەوە و بە تەنها پشتڕاستی هەموو کردارە تەکنیکییەکان ناکات.</p>
<p class="text-sm text-muted-foreground">دوایین نوێکردنەوە: 2026</p>
`,
};
