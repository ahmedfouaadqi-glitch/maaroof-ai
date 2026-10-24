import { useEffect, useState } from "react";
import { BookOpenCheck, LoaderCircle, Trash2, Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { freshFacts, interviewFacts, canBroadcast, ownerIdentity, type Fact } from "@/lib/knowledge-facts";
import { ACCOUNT_KINDS } from "@/lib/account-kinds";

type L = "ar" | "en" | "ku";
const tr = (l: L, ar: string, en: string, ku: string) => (l === "en" ? en : l === "ku" ? ku : ar);
type Row = Fact & { id?: string; broadcast?: boolean };

/** What Maaroof actually knows, with source and date for every item. */
export function KnownFactsPanel({ lang, workspaceId = null }: { lang: L; workspaceId?: string | null }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [owner, setOwner] = useState<any>(null);
  const [spaces, setSpaces] = useState<{ name: string; space_kind: string; parent_id: string | null }[]>([]);
  const [filter, setFilter] = useState<"all" | "task" | "interview" | "profile">("all");

  useEffect(() => {
    if (!user) return;
    (async () => {
      let factQuery = (supabase as any).from("knowledge_facts").select("id, source, fact, confidence, created_at, expires_at, broadcast, workspace_id").eq("user_id", user.id);
      factQuery = workspaceId ? factQuery.eq("workspace_id", workspaceId) : factQuery.is("workspace_id", null);
      let spacesQuery = (supabase as any).from("workspaces").select("name, space_kind, parent_id").eq("owner_id", user.id);
      spacesQuery = workspaceId ? spacesQuery.eq("parent_id", workspaceId) : spacesQuery.limit(100);
      const [{ data: kf }, { data: iv }, { data: p }, { data: ws }] = await Promise.all([
        factQuery.order("created_at", { ascending: false }).limit(50),
        workspaceId ? Promise.resolve({ data: [] as any[] }) : supabase.from("knowledge_space_interviews").select("question, answer, answered_at, created_at").eq("user_id", user.id).limit(100),
        workspaceId ? (supabase as any).from("workspaces").select("id,name,kind,space_kind,parent_id,brand_url,brand_summary,keywords,profile,goals,success_metrics,country,created_at,updated_at").eq("id", workspaceId).eq("owner_id", user.id).maybeSingle() : supabase.from("profiles").select("full_name, brand_name, account_kind, specialty, entity_type, hq_country, target_markets, entity_links, entity_facts, entity_verified_at, entity_updated_at, created_at").eq("id", user.id).maybeSingle(),
        spacesQuery,
      ]);
      const raw: any = p || {};
      const pr: any = workspaceId ? { ...(raw.profile || {}), full_name: raw.name, brand_name: raw.profile?.brand_name || raw.name, account_kind: raw.kind, specialty: raw.brand_summary, entity_type: raw.profile?.entity_type || raw.space_kind || raw.kind, hq_country: raw.country, target_markets: raw.profile?.target_markets || [], entity_links: raw.profile?.entity_links || (raw.brand_url ? { website: raw.brand_url } : {}), entity_facts: raw.profile?.entity_facts || [], entity_verified_at: null, entity_updated_at: raw.updated_at, created_at: raw.created_at } : raw;
      setOwner(pr); setSpaces((ws || []) as any);
      const out: Row[] = [...freshFacts((kf || []) as Row[]), ...interviewFacts((iv || []) as any)];
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
  }, [user?.id, lang, workspaceId]);

  const del = async (id: string) => {
    await (supabase as any).from("knowledge_facts").delete().eq("id", id);
    setRows((r) => (r || []).filter((x) => x.id !== id));
  };

  /** Only the owner turns a hypothesis into evidence, explicitly. */
  const confirmFact = async (r: Row) => {
    if (!window.confirm(tr(lang, `تأكيد أن هذه المعلومة صحيحة؟\n\n${r.fact}`, `Confirm this is true?\n\n${r.fact}`, `پشتڕاستی دەکەیتەوە؟\n\n${r.fact}`))) return;
    const { error } = await (supabase as any).from("knowledge_facts").update({ confidence: "evidence" }).eq("id", r.id);
    if (!error) setRows((rs) => (rs || []).map((x) => (x.id === r.id ? { ...x, confidence: "evidence" } : x)));
  };

  const exportPack = () => {
    const lines = (rows || []).map((r) => `- [${r.confidence === "evidence" ? tr(lang, "موثّق", "Evidence", "بەڵگەدار") : tr(lang, "فرضية", "Hypothesis", "گریمانە")}] ${r.fact}`);
    const md = `# ${tr(lang, "حزمة معرفة معروف", "Maaroof knowledge pack", "زانیاری معروف")}\n\n${lines.join("\n")}\n`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([md], { type: "text/markdown;charset=utf-8" }));
    a.download = "maaroof-knowledge.md"; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
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
      {owner && (() => {
        const id = ownerIdentity(owner);
        const kind = ACCOUNT_KINDS.find((a) => a.key === owner.account_kind)?.label[lang];
        const LBL: Record<string, string> = { full_name: tr(lang, "الاسم", "Name", "ناو"), brand_name: tr(lang, "العلامة", "Brand", "براند"), account_kind: tr(lang, "طبيعة الحساب", "Account type", "جۆری هەژمار"), specialty: tr(lang, "التخصص", "Specialty", "پسپۆڕی"), hq_country: tr(lang, "المقر", "HQ", "بارەگا"), target_markets: tr(lang, "الأسواق", "Markets", "بازاڕ"), entity_links: tr(lang, "الروابط", "Links", "بەستەر") };
        const val = (k: string) => k === "account_kind" ? kind || owner.account_kind : Array.isArray(owner[k]) ? owner[k].join("، ") : owner[k] && typeof owner[k] === "object" ? Object.values(owner[k]).filter((v) => typeof v === "string").join(" · ") : String(owner[k]);
        const count = (k: string) => spaces.filter((s) => s.space_kind === k).length;
        const learned = (rows || []).filter((r) => r.source !== "profile").length;
        return (
          <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
            <p className="text-sm leading-7">
              {id.known.length === 0
                ? tr(lang, "معروف: لا أعرف عنك شيئاً موثّقاً بعد. أكمل بطاقتك أو أجب على المقابلة لأتعرّف عليك.", "Maaroof: I don't know anything documented about you yet. Complete your card or answer the interview.", "معروف: هێشتا هیچ نازانم دەربارەت.")
                : tr(lang, `معروف: هذا ما أعرفه عنك من ملفك${learned ? ` ومن ${learned} معلومة تعلّمتها من المقابلات والمهام` : ""}. لديك ${spaces.length} مساحة (${count("company")} شركة، ${count("client")} عميل، ${count("subsidiary")} فرعية، ${count("product")} منتج).`, `Maaroof: this is what I know about you from your profile${learned ? ` and ${learned} learned facts` : ""}. You have ${spaces.length} spaces (${count("company")} companies, ${count("client")} clients, ${count("subsidiary")} subsidiaries, ${count("product")} products).`, `معروف: ئەمە ئەوەیە دەیزانم. ${spaces.length} شوێنت هەیە.`)}
            </p>
            {id.known.length > 0 && <dl className="mt-3 grid gap-2 sm:grid-cols-2">{id.known.map((k) => <div key={k} className="rounded-lg bg-background p-2 text-xs"><dt className="text-muted-foreground">{LBL[k]} · {tr(lang, "من الملف الشخصي", "from profile", "لە پرۆفایل")} · {id.verified ? tr(lang, "موثّق", "evidence", "بەڵگەدار") : tr(lang, "فرضية", "hypothesis", "گریمانە")}</dt><dd className="mt-0.5 break-words font-medium">{val(k)}</dd></div>)}</dl>}
            <div className="mt-3 flex items-center gap-2 text-xs"><div className="h-1.5 flex-1 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${id.completeness}%` }} /></div><span>{tr(lang, "اكتمال المعرفة", "Completeness", "تەواوبوون")} {id.completeness}%</span></div>
            {id.missing.length > 0 && <p className="mt-2 text-xs text-muted-foreground">{tr(lang, "ينقصني", "Missing", "کەمە")}: {id.missing.map((k) => LBL[k]).join("، ")} — <a href="/workspace?tab=settings" className="text-primary underline">{tr(lang, "أكملها", "complete", "تەواوی بکە")}</a></p>}
          </div>
        );
      })()}
      <div className="mb-3 flex flex-wrap gap-2">
        {(rows || []).length > 0 && <button onClick={exportPack} className="order-last ms-auto rounded-full border border-primary/40 px-3 py-1 text-xs text-primary">{tr(lang, "تنزيل حزمة المعرفة", "Download knowledge pack", "داگرتنی زانیاری")}</button>}
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
                {r.id && r.confidence === "hypothesis" && <button onClick={() => confirmFact(r)} className="rounded-full border border-success/40 px-2 py-0.5 text-success">{tr(lang, "أؤكدها", "Confirm", "پشتڕاستی دەکەمەوە")}</button>}
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
