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
      { property: "og:url", content: "https://geoiraq.com/terms" },
    ],
    links: [{ rel: "canonical", href: "https://geoiraq.com/terms" }],
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
          <div className="mt-6 space-y-4 text-foreground/85" dangerouslySetInnerHTML={{ __html: c }} />
          <div className="mt-10"><Link to="/" className="text-sm text-primary hover:underline">← {t("back_home")}</Link></div>
        </article>
      </main>
    </div>
  );
}

const content = {
  ar: `
<p>باستخدامك منصة <strong>MAAROOF Ai</strong> (جزء من نظام معروف) فإنك توافق على الشروط التالية:</p>
<h2>1. الاستخدام المقبول</h2>
<ul>
<li>تستخدم المنصة لأغراض مشروعة فقط.</li>
<li>لا تُرسل محتوى يخالف القانون العراقي أو ينتهك حقوق الآخرين.</li>
<li>لا تحاول استغلال ثغرات أو إساءة استخدام واجهة الذكاء الاصطناعي أو الوكيل الذكي.</li>
<li>لا تستخدم أدوات أو الوكيل لإرسال رسائل غير مرغوبة (Spam) أو حصاد بيانات شخصية بدون إذن.</li>
</ul>
<h2>2. الحساب والاشتراك</h2>
<ul>
<li>أنت مسؤول عن سرية بيانات حسابك. يُربط الحساب بجهازك ببصمة تقنية لمنع إساءة الاستخدام.</li>
<li>الاشتراك المدفوع يُفعَّل عبر التواصل على واتساب وتأكيد الدفع.</li>
<li>الاشتراك غير قابل للاسترداد بعد التفعيل إلا بموجب سياستنا الداخلية.</li>
<li>يحق للسوبر أدمن ربط أدوات أو مزايا للوكيل بكل خطة، وتعديل الحصص الشهرية/اليومية لكل أداة.</li>
</ul>
<h2>3. الأدوات والوكيل الذكي والاستهلاك</h2>
<p>كل عملية تشغيل لأداة أو لميزة من ميزات الوكيل الذكي تستهلك عدداً من الوحدات من رصيدك الشهري حسب الجدول التالي:</p>
<ul>
<li>تحليل GEO، مولّد المنشورات، مقارنة المنافسين، إيميل شركات، أمر مباشر للوكيل، فحص الظهور في AI — <strong>1×</strong> لكل تشغيل.</li>
<li>دراسة جدوى، تطوير الأعمال، بحث ذكي، تشغيل الأهداف تلقائياً — <strong>2×</strong> لكل تشغيل.</li>
<li>تعزيز العلامة — <strong>3×</strong> لكل تشغيل.</li>
</ul>
<p>تظهر تكلفة كل أداة بشكل واضح في صفحة "كيف يعمل" وفي بطاقات الأدوات. الاستخدامات اليومية والشهرية مرئية في لوحة التحكم.</p>
<h2>4. الذكاء الاصطناعي والوكيل</h2>
<p>الأدوات والوكيل آليان وليسا محادثة بشرية. النتائج إرشادية ولا تُعدّ ضماناً تجارياً أو قانونياً. الوكيل قد ينشر/يحلّل تلقائياً وفق الأهداف التي تُعرّفها أنت، وأنت المسؤول عن صحة هذه الأهداف ومحتواها.</p>
<h2>5. تطبيق الويب التقدمي (PWA)</h2>
<p>يمكن تثبيت المنصة كتطبيق على جهازك. التثبيت لا يمنح صلاحيات إضافية ولا يجمع بيانات إضافية مقارنةً بالموقع.</p>
<h2>6. الملكية الفكرية</h2>
<p>المحتوى الذي تُدخله ملكك. نتائج التحليل والاقتراحات للاستخدام الشخصي/التجاري لحسابك.</p>
<h2>7. حدود المسؤولية</h2>
<p>لا تتحمل المنصة مسؤولية أضرار غير مباشرة ناتجة عن استخدامك، بما في ذلك قرارات اتُّخذت بناءً على مخرجات الأدوات أو الوكيل.</p>
<h2>8. التعديل</h2>
<p>قد نُحدّث هذه السياسة. يبقى استخدامك للمنصة موافقةً على آخر نسخة.</p>
<h2>9. التواصل</h2>
<p>للاستفسار: واتساب <strong>+9647733570130</strong>.</p>
<p class="text-sm text-muted-foreground">آخر تحديث: 2026</p>
`,
  en: `
<p>By using <strong>MAAROOF Ai</strong> (part of the Marouf system), you agree to the following:</p>
<h2>1. Acceptable Use</h2>
<ul>
<li>Use the platform for lawful purposes only.</li>
<li>Do not submit content that violates Iraqi law or others' rights.</li>
<li>Do not attempt to exploit or abuse the AI interface or Smart Agent.</li>
<li>Do not use tools or the Agent for spam or unauthorized personal data harvesting.</li>
</ul>
<h2>2. Account & Subscription</h2>
<ul>
<li>You are responsible for keeping your credentials confidential. Accounts are bound to a device fingerprint to prevent abuse.</li>
<li>Paid subscriptions are activated via WhatsApp after payment confirmation.</li>
<li>Subscriptions are non-refundable after activation unless our internal policy allows.</li>
<li>The super admin may link specific tools or agent features to each plan and adjust monthly/daily quotas per tool.</li>
</ul>
<h2>3. Tools, Smart Agent & Usage</h2>
<p>Each tool run or agent feature consumes units from your monthly allowance as follows:</p>
<ul>
<li>GEO Analysis, Post Generator, Competitor Compare, Company Outreach, Agent Command, AI Visibility — <strong>1×</strong> per run.</li>
<li>Feasibility Study, BizDev, Smart Research, Run Targets — <strong>2×</strong> per run.</li>
<li>Brand Boost — <strong>3×</strong> per run.</li>
</ul>
<p>Costs are shown on the "How it works" page and on each tool card. Daily and monthly usage is visible in the dashboard.</p>
<h2>4. AI & Agent</h2>
<p>Tools and the Agent are automated, not human chat. Results are advisory, not commercial or legal guarantees. The Agent may publish/analyze automatically based on targets you define; you are responsible for those targets and their content.</p>
<h2>5. Progressive Web App (PWA)</h2>
<p>The platform can be installed as an app on your device. Installation grants no extra permissions and collects no extra data beyond the website.</p>
<h2>6. Intellectual Property</h2>
<p>Content you submit remains yours. Analysis and suggestion results are for your personal/commercial use.</p>
<h2>7. Liability</h2>
<p>The platform is not liable for indirect damages from your use, including decisions made based on tool or agent output.</p>
<h2>8. Updates</h2>
<p>We may update this policy. Continued use constitutes acceptance of the latest version.</p>
<h2>9. Contact</h2>
<p>For inquiries: WhatsApp <strong>+9647733570130</strong>.</p>
<p class="text-sm text-muted-foreground">Last updated: 2026</p>
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
