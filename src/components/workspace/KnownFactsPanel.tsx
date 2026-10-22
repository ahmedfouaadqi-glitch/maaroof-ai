import { useEffect, useState } from "react";
import { BookOpenCheck, LoaderCircle, Trash2, Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { freshFacts, interviewFacts, canBroadcast, type Fact } from "@/lib/knowledge-facts";

type L = "ar" | "en" | "ku";
const tr = (l: L, ar: string, en: string, ku: string) => (l === "en" ? en : l === "ku" ? ku : ar);
type Row = Fact & { id?: string; broadcast?: boolean };

/** What Maaroof actually knows, with source and date for every item. */
export function KnownFactsPanel({ lang }: { lang: L }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [filter, setFilter] = useState<"all" | "task" | "interview" | "profile">("all");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: kf }, { data: iv }, { data: p }] = await Promise.all([
        (supabase as any).from("knowledge_facts").select("id, source, fact, confidence, created_at, expires_at, broadcast").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
        supabase.from("knowledge_space_interviews").select("question, answer, answered_at, created_at").eq("user_id", user.id).limit(100),
        supabase.from("profiles").select("entity_type, hq_country, target_markets, entity_links, entity_facts, entity_verified_at, entity_updated_at, created_at").eq("id", user.id).maybeSingle(),
      ]);
      const out: Row[] = [...freshFacts((kf || []) as Row[]), ...interviewFacts((iv || []) as any)];
      const pr: any = p || {};
      const at = pr.entity_updated_at || pr.created_at || new Date().toISOString();
      const conf = pr.entity_verified_at ? "evidence" : "hypothesis";
      if (pr.entity_type) out.push({ source: "profile", fact: `${tr(lang, "نوع الكيان", "Entity type", "جۆر")}: ${pr.entity_type}`, confidence: conf, created_at: at });
      if (pr.hq_country) out.push({ source: "profile", fact: `${tr(lang, "بلد المقر", "HQ country", "وڵات")}: ${pr.hq_country}`, confidence: conf, created_at: at });
      if (Array.isArray(pr.target_markets) && pr.target_markets.length) out.push({ source: "profile", fact: `${tr(lang, "الأسواق المستهدفة", "Target markets", "بازاڕەکان")}: ${pr.target_markets.join("، ")}`, confidence: conf, created_at: at });
      const links = pr.entity_links && typeof pr.entity_links === "object" ? Object.values(pr.entity_links).filter((v) => typeof v === "string") : [];
      if (links.length) out.push({ source: "profile", fact: `${tr(lang, "الروابط الرسمية", "Official links", "بەستەرەکان")}: ${links.join(" · ")}`, confidence: conf, created_at: at });
      if (Array.isArray(pr.entity_facts)) for (const f of pr.entity_facts.slice(0, 10)) { const t = typeof f === "string" ? f : f?.text || f?.value; if (t) out.push({ source: "profile", fact: String(t), confidence: conf, created_at: at }); }
      setRows(out.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))));
    })().catch(() => setRows([]));
  }, [user?.id, lang]);

  const del = async (id: string) => {
    await (supabase as any).from("knowledge_facts").delete().eq("id", id);
    setRows((r) => (r || []).filter((x) => x.id !== id));
  };

  const toggleBroadcast = async (r: Row) => {
    const on = !r.broadcast;
    if (on && !window.confirm(tr(lang, `سيظهر هذا النص في بطاقة السلطة العامة التي تقرؤها زواحف الذكاء الاصطناعي:\n\n${r.fact}\n\nهل توافق على البث؟`, `This text will appear on your public brand card read by AI crawlers:\n\n${r.fact}\n\nApprove broadcast?`, `ئەم دەقە لە کارتی گشتی دەردەکەوێت:\n\n${r.fact}\n\nڕازیت؟`))) return;
    const { error } = await (supabase as any).from("knowledge_facts").update({ broadcast: on }).eq("id", r.id);
    if (!error) setRows((rs) => (rs || []).map((x) => (x.id === r.id ? { ...x, broadcast: on } : x)));
  };

  const SRC: Record<string, string> = { task: tr(lang, "من المهام", "From tasks", "لە ئەرکەکان"), interview: tr(lang, "من المقابلة", "From interview", "لە چاوپێکەوتن"), profile: tr(lang, "من الملف الشخصي", "From profile", "لە پرۆفایل") };
  const list = (rows || []).filter((r) => filter === "all" || r.source === filter);

  return (
    <section className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-sm md:p-5">
      <h2 className="mb-1 flex items-center gap-2 font-semibold"><BookOpenCheck className="size-5 text-primary" />{tr(lang, "ما يعرفه معروف عنك", "What Maaroof knows", "ئەوەی معروف دەیزانێت")}</h2>
      <p className="mb-3 text-xs text-muted-foreground">{tr(lang, "تُستخدم هذه المعلومات كسياق في مهامك القادمة لتقليل التكرار. ما لم يُوثّق يظهر كفرضية.", "Used as context in your next tasks to avoid repetition. Unverified items are marked as hypotheses.", "وەک سیاق بەکاردێت.")}</p>
      <div className="mb-3 flex flex-wrap gap-2">
        {(["all", "task", "interview", "profile"] as const).map((k) => (
          <button key={k} onClick={() => setFilter(k)} className={`rounded-full border px-3 py-1 text-xs ${filter === k ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>{k === "all" ? tr(lang, "الكل", "All", "هەموو") : SRC[k]} ({(rows || []).filter((r) => k === "all" || r.source === k).length})</button>
        ))}
      </div>
      {rows !== null && !rows.some((r) => r.source === "profile") && <p className="mb-3 rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs">{tr(lang, "معروف لا يعرف هويتك بعد. أكمل «بطاقة حقيقة الكيان» من الإعدادات (نوع الكيان، بلد المقر، الأسواق، الروابط الرسمية) لتظهر هنا كمعلومات عنك. ما لم يُتحقق منه يبقى فرضية.", "Maaroof doesn't know your identity yet. Complete the Entity Truth Card in Settings (type, HQ country, markets, official links). Unverified items stay hypotheses.", "بطاقەی ناسنامە تەواو بکە لە ڕێکخستنەکان.")}</p>}
      {rows === null ? <LoaderCircle className="size-5 animate-spin text-muted-foreground" /> : list.length === 0 ? (
        <p className="text-sm text-muted-foreground">{tr(lang, "لا شيء بعد. أكمل المقابلة أو نفّذ مهمة، أو أكمل بطاقة الكيان في ملفك الشخصي.", "Nothing yet. Answer the interview, run a task, or complete your entity card.", "هێشتا هیچ.")}</p>
      ) : (
        <ul className="space-y-2">
          {list.map((r, i) => (
            <li key={r.id || i} className="rounded-xl border border-border bg-background p-3 text-sm">
              <p className="leading-6">{r.fact}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <span className="rounded-full bg-muted px-2 py-0.5">{SRC[r.source]}</span>
                <span className={`rounded-full px-2 py-0.5 ${r.confidence === "evidence" ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>{r.confidence === "evidence" ? tr(lang, "موثّق", "Evidence", "بەڵگەدار") : tr(lang, "فرضية", "Hypothesis", "گریمانە")}</span>
                <span>{new Date(r.created_at).toLocaleDateString()}</span>
                {r.id && canBroadcast(r) && <button onClick={() => toggleBroadcast(r)} className={`flex items-center gap-1 rounded-full border px-2 py-0.5 ${r.broadcast ? "border-primary bg-primary/10 text-primary" : "border-border"}`}><Radio className="size-3" />{r.broadcast ? tr(lang, "مبثوثة — إيقاف", "Broadcasting — stop", "بڵاوکراوە — ڕاگرتن") : tr(lang, "اعتمدها للبث", "Approve for broadcast", "پەسەندی بکە")}</button>}
                {r.id && <button onClick={() => del(r.id!)} className="ms-auto text-destructive" aria-label="delete"><Trash2 className="size-3.5" /></button>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
