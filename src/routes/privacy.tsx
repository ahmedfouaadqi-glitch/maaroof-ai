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
  const c = content[(lang as "ar" | "en" | "ku")] || content.ar;
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

const content: Record<"ar" | "en" | "ku", string> = {
  ar: "<p>توضح هذه السياسة كيف تتعامل <strong>MAAROOF Ai</strong> مع بياناتك.</p>\n<h2>1. ما نجمعه</h2><ul><li>بيانات الحساب (الاسم والبريد) وبطاقة حقيقة الكيان التي تدخلها (الاسم الرسمي، الموقع، الحسابات، الأسواق).</li><li>الأهداف التي تكتبها ونتائج المهام والفحص العميق.</li><li>نطاقك الجغرافي الذي تختاره (الدولة، الإقليم، المحافظة، المدينة)، والدولة المستنتجة تقريبياً من الاتصال للترحيب واللغة.</li></ul>\n<h2>2. كيف نستخدمها</h2><ul><li>لتشغيل مهامك، وسؤال النماذج عن علامتك، وقياس حضورك وبناء التقارير.</li><li>لإعادة استخدام نتائج سابقة لك وتقليل الكلفة، ضمن حسابك فقط.</li><li>لا نبيع بياناتك، ولا نستخدمها لتدريب نماذج الذكاء الاصطناعي.</li></ul>\n<h2>3. المشاركة</h2><ul><li>تُرسل الأسئلة اللازمة فقط إلى مزوّدي النماذج لتنفيذ المهمة.</li><li>لا تُنشر بطاقتك العامة إلا إذا فعّلت ذلك.</li></ul>\n<h2>4. الحماية والتحكم</h2><ul><li>بياناتك محمية بصلاحيات تمنع وصول غيرك إليها.</li><li>يمكنك تعديل بياناتك أو طلب حذف حسابك في أي وقت عبر صفحة التواصل.</li></ul>",
  en: "<p>This policy explains how <strong>MAAROOF Ai</strong> handles your data.</p>\n<h2>1. What we collect</h2><ul><li>Account data (name, email) and the Entity Truth Card you enter (official name, website, accounts, markets).</li><li>The goals you write and the results of tasks and deep audits.</li><li>The location scope you choose (country, region, province, city), and an approximate country from your connection for the welcome and language.</li></ul>\n<h2>2. How we use it</h2><ul><li>To run your tasks, ask models about your brand, measure your presence and build reports.</li><li>To reuse your own earlier results and lower cost, only within your account.</li><li>We do not sell your data or use it to train AI models.</li></ul>\n<h2>3. Sharing</h2><ul><li>Only the questions needed for a task are sent to model providers.</li><li>Your public card is published only if you turn it on.</li></ul>\n<h2>4. Protection and control</h2><ul><li>Your data is protected so other users cannot access it.</li><li>You can edit your data or ask to delete your account at any time via the contact page.</li></ul>",
  ku: "<p>ئەم سیاسەتە ڕوون دەکاتەوە کە <strong>MAAROOF Ai</strong> چۆن مامەڵە لەگەڵ داتاکانت دەکات.</p>\n<h2>1. چی کۆدەکەینەوە</h2><ul><li>داتای هەژمار و کارتی ناسنامە.</li><li>ئامانجەکان و ئەنجامی ئەرکەکان.</li><li>شوێنی هەڵبژێردراو (وڵات، هەرێم، پارێزگا، شار) و وڵاتی نزیکەیی بۆ بەخێرهاتن.</li></ul>\n<h2>2. چۆن بەکاری دەهێنین</h2><ul><li>بۆ جێبەجێکردنی ئەرکەکانت و پێوانی دەرکەوتنت.</li><li>داتاکانت نافرۆشین و بۆ ڕاهێنانی مۆدێل بەکاری ناهێنین.</li></ul>\n<h2>3. هاوبەشکردن</h2><ul><li>تەنها پرسیارە پێویستەکان بۆ دابینکەرانی مۆدێل دەنێردرێن.</li></ul>\n<h2>4. پاراستن</h2><ul><li>دەتوانیت هەر کاتێک داوای سڕینەوەی هەژمارەکەت بکەیت.</li></ul>",
};
