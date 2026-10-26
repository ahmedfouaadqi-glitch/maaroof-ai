// Workspace spaces (company / product / client) + in-workspace founding interview.
// Reuses existing workspace + knowledge-space interview functions; no new billing path.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Building2, Package, Users, Plus, LoaderCircle, MessageSquareText, Check, CircleAlert, GitBranch, Trash2, ChevronDown, ChevronLeft } from "lucide-react";
import { listWorkspaces, createWorkspace, deleteWorkspace, ensureWorkspaceKnowledgeSpace, listInterviewQuestions } from "@/lib/workspaces.functions";
import { generateSpaceInterview, answerSpaceInterview } from "@/lib/teaching.functions";
import { getCostPreview, type CostPreview } from "@/lib/tokens.functions";
import { supabase } from "@/integrations/supabase/client";
import { allowedChildKinds, descendantIds, inferAccountKind, type SpaceKind, type StructureAnswers } from "@/lib/space-structure";
import { ACCOUNT_KINDS, type AccountKind } from "@/lib/account-kinds";

type L = "ar" | "en" | "ku";
type Ws = { id: string; name: string; space_kind: SpaceKind; parent_id: string | null; brand_url: string | null; language: L };
type Q = { id: string; question: string; answer: string | null; topic: string | null };

const T = {
  ar: { title: "مساحاتك", subsidiary: "شركة فرعية", del: "حذف", delConfirm: "سيتم حذف هذه المساحة وكل ما يتبعها. عدد المساحات المحذوفة:", company: "شركة", product: "منتج", client: "عميل", add: "إضافة", name: "الاسم", url: "رابط (اختياري)", save: "حفظ", cancel: "إلغاء", none: "لا توجد مساحة بعد. أجب عن الأسئلة لنقترح الهيكل المناسب.", limit: "بلغت الحد الأقصى لعدد المساحات في خطتك.", qs: ["هل تبيع منتجاً أو خدمة؟", "هل تدير حسابات عملاء؟", "هل لديك أكثر من منتج؟", "هل الحساب لشخص؟", "هل أنت جهة إعلامية؟"], suggest: "النوع المقترح", interview: "المقابلة التأسيسية", gen: "توليد الأسئلة من النماذج العشرة", cost: "الكلفة المتوقعة", balance: "رصيدك", tokens: "توكن", confirm: "موافق، ابدأ", answer: "إجابتك…", send: "حفظ الإجابة", answered: "تمت الإجابة", progress: "تمت الإجابة على", of: "من", noAnswer: "لم تجب", engines: "النماذج التي لم تُرجع سؤالاً", pickFirst: "اختر مساحة لبدء مقابلتها.", yes: "نعم", no: "لا", deep: "بعد الإجابة يمكنك تشغيل الفحص العميق من «نبض الحساب» بطلبك.", short: "الرصيد لا يكفي." },
  en: { title: "Your spaces", subsidiary: "Subsidiary", del: "Delete", delConfirm: "This space and everything under it will be deleted. Spaces removed:", company: "Company", product: "Product", client: "Client", add: "Add", name: "Name", url: "Link (optional)", save: "Save", cancel: "Cancel", none: "No space yet. Answer a few questions and we'll suggest a structure.", limit: "You reached your plan's space limit.", qs: ["Do you sell a product or service?", "Do you manage client accounts?", "More than one product?", "Is this account a person?", "Are you a media outlet?"], suggest: "Suggested type", interview: "Founding interview", gen: "Generate questions from the ten models", cost: "Expected cost", balance: "Balance", tokens: "tokens", confirm: "Approve and start", answer: "Your answer…", send: "Save answer", answered: "Answered", progress: "Answered", of: "of", noAnswer: "Unanswered", engines: "Models that returned no question", pickFirst: "Pick a space to start its interview.", yes: "Yes", no: "No", deep: "After answering, run the deep audit from the account pulse on request.", short: "Balance is not enough." },
  ku: { title: "شوێنەکانت", subsidiary: "کۆمپانیای لاوەکی", del: "سڕینەوە", delConfirm: "ئەم شوێنە و هەموو لقەکانی دەسڕێنەوە. ژمارە:", company: "کۆمپانیا", product: "بەرهەم", client: "کڕیار", add: "زیادکردن", name: "ناو", url: "بەستەر (ئارەزوومەندانە)", save: "پاشەکەوت", cancel: "پاشگەزبوونەوە", none: "هێشتا شوێن نییە. وەڵامی چەند پرسیارێک بدەوە.", limit: "گەیشتیتە سنووری پلانەکەت.", qs: ["بەرهەم یان خزمەتگوزاری دەفرۆشیت؟", "هەژماری کڕیاران بەڕێوە دەبەیت؟", "زیاتر لە بەرهەمێک؟", "هەژمارەکە بۆ کەسێکە؟", "دەزگای ڕاگەیاندنیت؟"], suggest: "جۆری پێشنیارکراو", interview: "چاوپێکەوتنی بنەڕەتی", gen: "دروستکردنی پرسیار لە دە مۆدێلەکە", cost: "تێچووی چاوەڕوانکراو", balance: "باڵانس", tokens: "تۆکن", confirm: "ڕازیم، دەست پێبکە", answer: "وەڵامەکەت…", send: "پاشەکەوتی وەڵام", answered: "وەڵامدراوە", progress: "وەڵامدراوە", of: "لە", noAnswer: "وەڵام نەدراوە", engines: "مۆدێلەکان کە پرسیاریان نەگەڕاندەوە", pickFirst: "شوێنێک هەڵبژێرە.", yes: "بەڵێ", no: "نەخێر", deep: "دوای وەڵامدانەوە پشکنینی قووڵ لە نەبزی هەژمار بکە.", short: "باڵانس بەس نییە." },
} as const;

const ICON: Record<SpaceKind, typeof Building2> = { company: Building2, subsidiary: GitBranch, product: Package, client: Users };
const KEY = "maaroof.active_workspace_id";

export function WorkspaceSpacesPanel({ lang, workspaceId = null, onWorkspaceChange }: { lang: L; workspaceId?: string | null; onWorkspaceChange?: (workspace: Ws | null) => void }) {
  const t = T[lang];
  const list = useServerFn(listWorkspaces);
  const create = useServerFn(createWorkspace);
  const remove = useServerFn(deleteWorkspace);
  const [profileKind, setProfileKind] = useState<AccountKind | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const ensure = useServerFn(ensureWorkspaceKnowledgeSpace);
  const listQ = useServerFn(listInterviewQuestions);
  const gen = useServerFn(generateSpaceInterview);
  const answerFn = useServerFn(answerSpaceInterview);
  const costFn = useServerFn(getCostPreview);

  const [items, setItems] = useState<Ws[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<{ kind: SpaceKind; parent: string | null } | null>(null);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [ans, setAns] = useState<StructureAnswers>({ sellsProduct: false, managesClients: false, multipleProducts: false, isPerson: false, isMedia: false });
  const suggested: AccountKind = useMemo(() => inferAccountKind(ans), [ans]);

  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [cost, setCost] = useState<CostPreview | null>(null);
  const [genBusy, setGenBusy] = useState(false);
  const [silent, setSilent] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await list();
      const arr = (res.items as unknown as Ws[]) || [];
      setItems(arr);
      setActive(workspaceId && arr.some((w) => w.id === workspaceId) ? workspaceId : null);
    } catch (e: any) { setError(String(e?.message || e)); } finally { setLoading(false); }
  }, [list, workspaceId]);
  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    setActive(workspaceId && items.some((w) => w.id === workspaceId) ? workspaceId : null);
  }, [workspaceId, items]);
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: p } = await supabase.from("profiles").select("account_kind").eq("id", u.user.id).maybeSingle();
      setProfileKind(((p as any)?.account_kind ?? null) as AccountKind | null);
    })();
  }, []);

  useEffect(() => {
    if (!active) { setSpaceId(null); setQuestions([]); return; }
    localStorage.setItem(KEY, active);
    let off = false;
    (async () => {
      try {
        const { spaceId: sid } = await ensure({ data: { workspaceId: active } });
        if (off) return;
        setSpaceId(sid);
        const r = await listQ({ data: { spaceId: sid } });
        if (!off) setQuestions(r.items as Q[]);
      } catch (e: any) { if (!off) setError(String(e?.message || e)); }
    })();
    return () => { off = true; };
  }, [active, ensure, listQ]);

  const companies = items.filter((w) => !w.parent_id);
  const childrenOf = (id: string) => items.filter((w) => w.parent_id === id);
  const accountKind: AccountKind | null = profileKind;

  async function removeSpace(id: string) {
    const ids = descendantIds(id, items);
    if (!window.confirm(`${t.delConfirm} ${ids.length}`)) return;
    setError(null);
    try {
      await remove({ data: { id } });
      if (active && ids.includes(active)) setActive(null);
      await reload();
    } catch (e: any) { setError(String(e?.message || e)); }
  }

  const renderNode = (w: Ws, depth: number): React.ReactNode => {
    const kids = childrenOf(w.id);
    const addKinds = allowedChildKinds(w.space_kind, accountKind);
    const open = !collapsed[w.id];
    return (
      <li key={w.id} className="space-y-1">
        <div className="flex items-center gap-1">
          {kids.length > 0 ? (
            <button type="button" aria-label="toggle" onClick={() => setCollapsed((c) => ({ ...c, [w.id]: open }))} className="rounded p-0.5 hover:bg-muted">
              {open ? <ChevronDown className="size-3" /> : <ChevronLeft className="size-3 rtl:rotate-0 ltr:rotate-180" />}
            </button>
          ) : <span className="w-4" />}
          <div className="flex-1"><SpaceRow w={w} active={active === w.id} onPick={() => {
            localStorage.setItem(KEY, w.id);
            setActive(w.id);
            onWorkspaceChange?.(w);
          }} label={kindLabel(w.space_kind)} /></div>
          <button type="button" aria-label={t.del} title={t.del} onClick={() => void removeSpace(w.id)} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="size-3.5" /></button>
        </div>
        {open && kids.length > 0 && <ul className="ms-5 space-y-1 border-s border-border ps-2">{kids.map((k) => renderNode(k, depth + 1))}</ul>}
        {addKinds.length > 0 && (
          <div className="ms-9 flex flex-wrap gap-x-3 gap-y-1">
            {addKinds.map((k) => (
              <button key={k} type="button" onClick={() => setForm({ kind: k, parent: w.id })} className="inline-flex items-center gap-1 text-xs text-primary hover:underline"><Plus className="size-3" />{t.add} {kindLabel(k)}</button>
            ))}
          </div>
        )}
      </li>
    );
  };

  async function submit() {
    if (!form || !name.trim()) return;
    setBusy(true); setError(null);
    try {
      let brand: string | undefined;
      if (url.trim()) brand = /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
      const res = await create({ data: { name: name.trim(), kind: form.parent ? (form.kind === "client" ? "client" : "brand") : "own", brand_url: brand, keywords: [], language: lang, space_kind: form.kind, parent_id: form.parent } as any });
      const w = res.workspace as unknown as Ws;
      setItems((p) => [w, ...p]); setActive(w.id);
      localStorage.setItem(KEY, w.id);
      onWorkspaceChange?.(w);
      setForm(null); setName(""); setUrl("");
    } catch (e: any) {
      setError(String(e?.message || "").startsWith("space_limit_reached") ? t.limit : String(e?.message || e));
    } finally { setBusy(false); }
  }

  async function prepareInterview() {
    setError(null);
    try { setCost(await costFn({ data: { toolKey: "teach_space.interview" } })); } catch (e: any) { setError(String(e?.message || e)); }
  }
  async function runInterview() {
    if (!spaceId) return;
    setGenBusy(true); setCost(null); setError(null);
    try {
      const r = await gen({ data: { spaceId, lang } });
      setSilent(r.engines.filter((e: any) => e.status !== "answered").map((e: any) => e.name));
      const q = await listQ({ data: { spaceId } });
      setQuestions(q.items as Q[]);
    } catch (e: any) { setError(String(e?.message || e)); } finally { setGenBusy(false); }
  }
  async function saveAnswer(id: string) {
    const text = (drafts[id] || "").trim();
    if (!text) return;
    try {
      await answerFn({ data: { interviewId: id, answer: text } });
      setQuestions((p) => p.map((q) => q.id === id ? { ...q, answer: text } : q));
      setDrafts((d) => ({ ...d, [id]: "" }));
    } catch (e: any) { setError(String(e?.message || e)); }
  }

  const answeredCount = questions.filter((q) => q.answer).length;
  const kindLabel = (k: SpaceKind) => t[k];

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-4 md:p-5">
      <h2 className="font-semibold">{t.title}</h2>
      {error && <p className="flex items-center gap-2 rounded-lg bg-destructive/10 p-2 text-xs text-destructive"><CircleAlert className="size-4" />{error}</p>}

      {loading ? <LoaderCircle className="size-4 animate-spin text-muted-foreground" /> : companies.length === 0 ? (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">{t.none}</p>
          {(["sellsProduct", "managesClients", "multipleProducts", "isPerson", "isMedia"] as const).map((k, i) => (
            <div key={k} className="flex items-center justify-between gap-2 text-sm">
              <span>{t.qs[i]}</span>
              <div className="flex gap-1">
                {[true, false].map((v) => (
                  <button key={String(v)} type="button" onClick={() => setAns((a) => ({ ...a, [k]: v }))} className={`rounded-md border px-2 py-1 text-xs ${ans[k] === v ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>{v ? t.yes : t.no}</button>
                ))}
              </div>
            </div>
          ))}
          <p className="text-xs">{t.suggest}: <strong>{ACCOUNT_KINDS.find((a) => a.key === suggested)!.label[lang]}</strong></p>
          <button type="button" onClick={() => setForm({ kind: "company", parent: null })} className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"><Plus className="size-3" />{t.add} {t.company}</button>
        </div>
      ) : (
        <ul className="space-y-2 text-sm">
          {companies.map((c) => renderNode(c, 0))}
        </ul>
      )}

      {form && (
        <div className="space-y-2 rounded-xl border border-border bg-background/60 p-3">
          <p className="text-xs font-semibold">{t.add} {kindLabel(form.kind)}</p>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.name} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={t.url} dir="ltr" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setForm(null)} className="rounded-lg px-3 py-1 text-xs hover:bg-muted">{t.cancel}</button>
            <button type="button" onClick={() => void submit()} disabled={!name.trim() || busy} className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1 text-xs text-primary-foreground disabled:opacity-50">{busy && <LoaderCircle className="size-3 animate-spin" />}{t.save}</button>
          </div>
        </div>
      )}

      <div className="space-y-3 border-t border-border pt-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><MessageSquareText className="size-4" />{t.interview}</h3>
        {!spaceId ? <p className="text-xs text-muted-foreground">{t.pickFirst}</p> : (
          <>
            {questions.length > 0 && <p className="text-xs text-muted-foreground">{t.progress} {answeredCount} {t.of} {questions.length}</p>}
            {!cost && !genBusy && <button type="button" onClick={() => void prepareInterview()} className="rounded-lg border border-border px-3 py-2 text-xs hover:bg-muted">{t.gen}</button>}
            {cost && (
              <div className="space-y-2 rounded-lg border border-border p-3 text-xs">
                <p>{t.cost}: <strong>{cost.total}</strong> {t.tokens} · {t.balance}: <strong>{cost.balance}</strong> {t.tokens}</p>
                {!cost.enough && <p className="text-destructive">{t.short}</p>}
                <div className="flex gap-2">
                  <button type="button" onClick={() => setCost(null)} className="rounded-lg px-3 py-1 hover:bg-muted">{t.cancel}</button>
                  <button type="button" onClick={() => void runInterview()} disabled={!cost.enough} className="rounded-lg bg-primary px-3 py-1 text-primary-foreground disabled:opacity-50">{t.confirm}</button>
                </div>
              </div>
            )}
            {genBusy && <LoaderCircle className="size-4 animate-spin text-primary" />}
            {silent.length > 0 && <p className="text-xs text-muted-foreground">{t.engines}: {silent.join("، ")}</p>}
            <ol className="space-y-2">
              {questions.map((q) => (
                <li key={q.id} className="rounded-lg border border-border p-3 text-sm">
                  <p className="font-medium">{q.question}</p>
                  {q.answer ? <p className="mt-1 flex items-start gap-1 text-xs text-muted-foreground"><Check className="mt-0.5 size-3 text-primary" />{q.answer}</p> : (
                    <div className="mt-2 flex gap-2">
                      <input value={drafts[q.id] || ""} onChange={(e) => setDrafts((d) => ({ ...d, [q.id]: e.target.value }))} placeholder={t.answer} className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs" />
                      <button type="button" onClick={() => void saveAnswer(q.id)} disabled={!(drafts[q.id] || "").trim()} className="rounded-lg bg-primary px-3 py-1 text-xs text-primary-foreground disabled:opacity-50">{t.send}</button>
                    </div>
                  )}
                </li>
              ))}
            </ol>
            {answeredCount > 0 && <p className="text-xs text-muted-foreground">{t.deep}</p>}
          </>
        )}
      </div>
    </div>
  );
}

function SpaceRow({ w, active, onPick, label }: { w: Ws; active: boolean; onPick: () => void; label: string }) {
  const Icon = ICON[w.space_kind] || Building2;
  return (
    <button type="button" onClick={onPick} className={`flex w-full items-center gap-2 rounded-lg p-2 text-start ${active ? "border border-primary/40 bg-primary/10" : "hover:bg-muted"}`}>
      <Icon className="size-4 shrink-0 text-primary" />
      <span className="flex-1 truncate">{w.name}</span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </button>
  );
}
