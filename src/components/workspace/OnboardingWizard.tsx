// Six onboarding questions. Workspace answers are stored on that workspace; main-account storage remains unchanged.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type L = "ar" | "en" | "ku";
const Q: Record<L, { title: string; hint: string; save: string; saved: string; addFaq: string; q: string; a: string; fields: [string, string, string][] }> = {
  ar: { title: "أسئلة التهيئة (لحسابك أو لعميلك)", hint: "ستة أسئلة يستخدمها معروف في كل مهمة وفي ملفات llms.txt وJSON-LD وFAQPage. اكتب حقائق مؤكدة فقط.", save: "حفظ", saved: "حُفظت إجابات التهيئة", addFaq: "إضافة سؤال", q: "السؤال", a: "الجواب المعتمد",
    fields: [["brand", "الاسم التجاري الرسمي", "مثال: معروف للذكاء الاصطناعي"], ["aliases", "الأسماء البديلة والتهجئات (افصل بفاصلة)", "Maaroof Ai, معروف"], ["markets", "الأسواق المؤكدة فعلياً (افصل بفاصلة)", "العراق, لبنان"], ["facts", "أهم الحقائق والأرقام الموثقة (سطر لكل حقيقة)", "تأسست سنة ..."], ["competitors", "أبرز المنافسين (افصل بفاصلة)", ""], ["links", "الروابط الرسمية (سطر لكل رابط)", "https://..."]] },
  en: { title: "Onboarding questions (for you or a client)", hint: "Six answers Maaroof uses in every task and in llms.txt, JSON-LD and FAQPage files. Confirmed facts only.", save: "Save", saved: "Onboarding answers saved", addFaq: "Add question", q: "Question", a: "Approved answer",
    fields: [["brand", "Official brand name", ""], ["aliases", "Alternate names and spellings (comma separated)", ""], ["markets", "Confirmed markets (comma separated)", ""], ["facts", "Key verified facts and numbers (one per line)", ""], ["competitors", "Main competitors (comma separated)", ""], ["links", "Official links (one per line)", "https://..."]] },
  ku: { title: "پرسیارەکانی دەستپێکردن", hint: "شەش وەڵام کە معروف لە هەموو ئەرکێک و فایلەکانی llms.txt و JSON-LD بەکاریان دەهێنێت.", save: "پاشەکەوت", saved: "پاشەکەوت کرا", addFaq: "زیادکردنی پرسیار", q: "پرسیار", a: "وەڵام",
    fields: [["brand", "ناوی فەرمی براند", ""], ["aliases", "ناوە جیاوازەکان", ""], ["markets", "بازاڕە پشتڕاستکراوەکان", ""], ["facts", "ڕاستییە سەرەکییەکان", ""], ["competitors", "ڕکابەرە سەرەکییەکان", ""], ["links", "بەستەرە فەرمییەکان", "https://..."]] },
};

export function OnboardingWizard({ lang, workspaceId = null }: { lang: L; workspaceId?: string | null }) {
  const T = Q[lang] || Q.ar;
  const [uid, setUid] = useState<string | null>(null);
  const [v, setV] = useState<Record<string, string>>({});
  const [faqs, setFaqs] = useState<{ q: string; a: string }[]>([{ q: "", a: "" }]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      setUid(u.user.id);
      let ob: any = {};
      let brandName = "";
      if (workspaceId) {
        const { data, error } = await supabase.from("workspaces").select("name, onboarding").eq("id", workspaceId).eq("owner_id", u.user.id).maybeSingle();
        if (error) throw error;
        ob = (data as any)?.onboarding || {};
        brandName = ob.brand || (data as any)?.name || "";
      } else {
        const { data, error } = await supabase.from("profiles").select("brand_name, onboarding").eq("id", u.user.id).maybeSingle();
        if (error) throw error;
        ob = (data as any)?.onboarding || {};
        brandName = (data as any)?.brand_name || "";
      }
      setV({ brand: brandName, aliases: ob.aliases || "", markets: ob.markets || "", facts: ob.facts || "", competitors: ob.competitors || "", links: ob.links || "" });
      if (Array.isArray(ob.faqs) && ob.faqs.length) setFaqs(ob.faqs);
    })();
  }, [workspaceId]);

  if (!uid) return null;
  const save = async () => {
    setBusy(true);
    const { brand, ...rest } = v;
    const onboarding = { ...rest, brand: brand || "", faqs: faqs.filter((f) => f.q.trim() && f.a.trim()) };
    const { error } = workspaceId
      ? await supabase.from("workspaces").update({ onboarding }).eq("id", workspaceId).eq("owner_id", uid)
      : await supabase.from("profiles").update({ onboarding, ...(brand?.trim() ? { brand_name: brand.trim() } : {}) } as any).eq("id", uid);
    setBusy(false);
    error ? toast.error(error.message) : toast.success(T.saved);
  };
  const inp = "w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs";

  return (
    <section className="mb-4 rounded-2xl border border-primary/30 bg-card p-5">
      <h2 className="font-semibold">{T.title}</h2>
      <p className="mb-3 text-xs text-muted-foreground">{T.hint}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {T.fields.map(([k, label, ph]) => (
          <label key={k} className="space-y-1 text-xs">
            <span className="font-medium">{label}</span>
            {k === "facts" || k === "links"
              ? <textarea rows={3} className={inp} placeholder={ph} value={v[k] || ""} onChange={(e) => setV({ ...v, [k]: e.target.value })} dir={k === "links" ? "ltr" : undefined} />
              : <input className={inp} placeholder={ph} value={v[k] || ""} onChange={(e) => setV({ ...v, [k]: e.target.value })} />}
          </label>
        ))}
      </div>
      <div className="mt-3 space-y-2">
        {faqs.map((f, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-2">
            <input className={inp} placeholder={T.q} value={f.q} onChange={(e) => setFaqs(faqs.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))} />
            <input className={inp} placeholder={T.a} value={f.a} onChange={(e) => setFaqs(faqs.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))} />
          </div>
        ))}
        {faqs.length < 10 && <button type="button" onClick={() => setFaqs([...faqs, { q: "", a: "" }])} className="text-xs font-semibold text-primary">+ {T.addFaq}</button>}
      </div>
      <button type="button" disabled={busy} onClick={save} className="mt-4 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50">{T.save}</button>
    </section>
  );
}
