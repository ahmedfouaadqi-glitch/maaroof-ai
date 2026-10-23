import { useEffect, useState } from "react";
import { Globe, LoaderCircle, ShieldCheck, ShieldOff, CheckCircle2, XCircle, Ban } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { withPreviewAuth } from "@/lib/api-client";
import { isUrlAllowed } from "@/lib/delegated-browser";
import { BrowserViewer, type BrowserView } from "./BrowserViewer";

type L = "ar" | "en" | "ku";
const tr = (l: L, ar: string, en: string, ku: string) => (l === "en" ? en : l === "ku" ? ku : ar);
const card = "rounded-2xl border border-border bg-card p-4 shadow-sm md:p-5";

async function call(method: "GET" | "POST", body?: unknown) {
  const t = (await supabase.auth.getSession()).data.session?.access_token || "";
  const r = await fetch(withPreviewAuth("/api/delegated-browser"), {
    method, headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { ok: r.ok, json: await r.json().catch(() => ({})) };
}

const ERR: Record<string, [string, string, string]> = {
  outside_grant: ["الرابط خارج النطاقات التي فوّضتها — رُفض.", "Link is outside the domains you granted — refused.", "بەستەرەکە دەرەوەی ڕێگەپێدانە."],
  forbidden_action: ["هذه العملية ممنوعة (كلمات مرور، شراء، نشر، إرسال نماذج).", "This action is not allowed (passwords, purchases, publishing, forms).", "ئەم کارە ڕێگەپێنەدراوە."],
  no_active_grant: ["لا يوجد تفويض فعّال.", "No active permission.", "ڕێگەپێدانی چالاک نییە."],
  step_limit: ["بلغت الحد الأقصى للخطوات في هذه الجلسة.", "Step limit reached for this session.", "سنووری هەنگاوەکان."],
};

export function DelegatedBrowserPanel({ lang, initialDomain, initialPurpose }: { lang: L; initialDomain?: string; initialPurpose?: string }) {
  const [grant, setGrant] = useState<any>(null);
  const [cost, setCost] = useState(0);
  const [steps, setSteps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [domains, setDomains] = useState(initialDomain || "");
  const [minutes, setMinutes] = useState(30);
  const [purpose, setPurpose] = useState(initialPurpose || "");
  const [url, setUrl] = useState("");
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [links, setLinks] = useState<string[]>([]);
  const [confirmUrl, setConfirmUrl] = useState<string | null>(null);
  const [history, setHistory] = useState<BrowserView[]>([]);
  const [hIdx, setHIdx] = useState(0);

  const load = async () => { const r = await call("GET"); setGrant(r.json.grant || null); setSteps(r.json.steps || []); setCost(Number(r.json.cost_per_page) || 0); setLoading(false); };
  useEffect(() => { void load(); }, []);

  const doGrant = async () => {
    setBusy(true); setMsg("");
    const r = await call("POST", { action: "grant", domains: domains.split(/[\s,،]+/).filter(Boolean), minutes, purpose });
    if (!r.ok) setMsg(tr(lang, "أدخل نطاقاً عاماً صحيحاً مثل example.com", "Enter a valid public domain like example.com", "دۆمەینێکی دروست بنووسە"));
    await load(); setBusy(false);
  };
  const revoke = async () => { setBusy(true); await call("POST", { action: "revoke" }); setLinks([]); await load(); setBusy(false); };
  const read = async (target: string) => {
    setConfirmUrl(null); setBusy(true); setMsg("");
    const r = await call("POST", { action: "read", url: target, instruction, visual: true });
    if (r.ok && r.json.step) { const v: BrowserView = { url: target, screenshot: r.json.screenshot || null, markdown: r.json.markdown || r.json.step.excerpt || "", links: r.json.links || [], title: r.json.step.title }; setHistory((h) => { const next = [...h.slice(0, hIdx + 1), v]; setHIdx(next.length - 1); return next; }); setUrl(target); }
    const e = r.json.step?.error || r.json.error;
    if (!r.ok && e) { const m = ERR[e]; setMsg(m ? tr(lang, ...m) : tr(lang, "تعذّرت قراءة الصفحة.", "Could not read the page.", "نەتوانرا بخوێنرێتەوە.")); }
    setLinks(r.json.links || []);
    await load(); setBusy(false);
  };

  if (loading) return <div className={card}><LoaderCircle className="size-5 animate-spin" /></div>;
  const left = grant ? Math.max(0, Math.round((new Date(grant.expires_at).getTime() - Date.now()) / 60000)) : 0;

  return (
    <div className="space-y-4">
      <section className={card}>
        <h2 className="flex items-center gap-2 text-lg font-bold"><Globe className="size-5 text-primary" />{tr(lang, "المتصفح المفوّض", "Delegated browser", "وێبگەڕی ڕێگەپێدراو")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{tr(lang,
          "يقرأ معروف الصفحات نيابة عنك من خوادم المنصة فقط، داخل المواقع التي تسمح بها ولمدة محددة. لا يصل إلى متصفحك أو حساباتك، ولا يدخل كلمات مرور، ولا يشتري أو ينشر أو يرسل نماذج.",
          "Maaroof reads pages for you from the platform's servers only, within sites you allow and for a limited time. It never touches your browser or accounts, never enters passwords, buys, publishes or submits forms.",
          "معروف تەنها لە ماڵپەڕە ڕێگەپێدراوەکان و بۆ ماوەیەکی دیاریکراو پەڕەکان دەخوێنێتەوە.")}</p>
      </section>

      {!grant ? (
        <section className={`${card} grid gap-3`}>
          <label className="text-sm font-semibold">{tr(lang, "المواقع المسموح بها (حتى 5)", "Allowed sites (up to 5)", "ماڵپەڕە ڕێگەپێدراوەکان")}</label>
          <input dir="ltr" value={domains} onChange={(e) => setDomains(e.target.value)} placeholder="example.com, blog.example.com" className="rounded-xl border border-border bg-background px-3 py-2 text-sm" />
          <label className="text-sm font-semibold">{tr(lang, "الغرض", "Purpose", "مەبەست")}</label>
          <input value={purpose} onChange={(e) => setPurpose(e.target.value)} className="rounded-xl border border-border bg-background px-3 py-2 text-sm" />
          <label className="text-sm font-semibold">{tr(lang, "مدة الجلسة", "Session length", "ماوە")}</label>
          <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="rounded-xl border border-border bg-background px-3 py-2 text-sm">
            {[15, 30, 60, 120].map((m) => <option key={m} value={m}>{m} {tr(lang, "دقيقة", "min", "خولەک")}</option>)}
          </select>
          <button disabled={busy || !domains.trim()} onClick={doGrant} className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50">
            <ShieldCheck className="size-4" />{tr(lang, "أمنح تفويضاً مؤقتاً للقراءة فقط", "Grant temporary read-only permission", "ڕێگەپێدانی کاتی")}
          </button>
          {msg && <p className="text-sm text-destructive">{msg}</p>}
        </section>
      ) : (
        <>
          <section className={`${card} flex flex-wrap items-center justify-between gap-3`}>
            <div className="text-sm">
              <div className="font-semibold text-success">{tr(lang, "تفويض فعّال", "Permission active", "ڕێگەپێدان چالاکە")} · {left} {tr(lang, "دقيقة متبقية", "min left", "خولەک ماوە")}</div>
              <div dir="ltr" className="text-muted-foreground">{grant.domains.join(" · ")}</div>
            </div>
            <button onClick={revoke} disabled={busy} className="flex items-center gap-2 rounded-xl border border-destructive/40 px-3 py-2 text-sm font-semibold text-destructive"><ShieldOff className="size-4" />{tr(lang, "إلغاء التفويض الآن", "Revoke now", "هەڵوەشاندنەوە")}</button>
          </section>

          <BrowserViewer lang={lang} history={history} index={hIdx} onIndex={setHIdx} busy={busy} onOpen={(u) => setConfirmUrl(u)} isAllowed={(u) => isUrlAllowed(u, grant.domains)} />

          <section className={`${card} grid gap-3`}>
            <label className="text-sm font-semibold">{tr(lang, "تعليمتك لهذه الخطوة", "Your instruction for this step", "ڕێنمایی")}</label>
            <input value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder={tr(lang, "مثال: اقرأ صفحة الخدمات واستخرج العناوين", "e.g. read the services page", "")} className="rounded-xl border border-border bg-background px-3 py-2 text-sm" />
            <input dir="ltr" value={url} onChange={(e) => setUrl(e.target.value)} placeholder={`https://${grant.domains[0]}/`} className="rounded-xl border border-border bg-background px-3 py-2 text-sm" />
            <button disabled={busy || !url.trim()} onClick={() => setConfirmUrl(url.trim())} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50">{tr(lang, "مراجعة الخطوة", "Review step", "پێداچوونەوە")}</button>
            {confirmUrl && (
              <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">
                <p>{tr(lang, "سيقرأ معروف هذه الصفحة فقط (قراءة دون أي تفاعل):", "Maaroof will only read this page (no interaction):", "تەنها ئەم پەڕەیە دەخوێنرێتەوە:")}</p>
                <p dir="ltr" className="my-1 break-all font-mono text-xs">{confirmUrl}</p>
                <p className="text-xs text-muted-foreground">{tr(lang, "الكلفة", "Cost", "تێچوون")}: {cost} {tr(lang, "توكن — تُخصم عند نجاح القراءة فقط", "tokens — charged only if the read succeeds", "توکن — تەنها لە سەرکەوتندا")}</p>
                <div className="mt-2 flex gap-2">
                  <button onClick={() => read(confirmUrl)} className="rounded-lg bg-primary px-3 py-1.5 font-semibold text-primary-foreground">{tr(lang, "تنفيذ الخطوة", "Run step", "ئەنجامدان")}</button>
                  <button onClick={() => setConfirmUrl(null)} className="rounded-lg border border-border px-3 py-1.5">{tr(lang, "تراجع", "Cancel", "پاشگەزبوونەوە")}</button>
                </div>
              </div>
            )}
            {busy && <LoaderCircle className="size-5 animate-spin text-primary" />}
            {msg && <p className="text-sm text-destructive">{msg}</p>}
            {links.length > 0 && (
              <div>
                <p className="mb-1 text-sm font-semibold">{tr(lang, "روابط مكتشفة داخل النطاق — اختر الخطوة التالية:", "Links found in scope — pick the next step:", "بەستەرە دۆزراوەکان:")}</p>
                <ul className="max-h-48 space-y-1 overflow-auto text-xs" dir="ltr">
                  {links.map((l) => <li key={l}><button onClick={() => { setUrl(l); setConfirmUrl(l); }} className="break-all text-start text-primary hover:underline">{l}</button></li>)}
                </ul>
              </div>
            )}
          </section>
        </>
      )}

      {steps.length > 0 && (
        <section className={card}>
          <h3 className="mb-2 font-bold">{tr(lang, "سجل الخطوات", "Step log", "تۆماری هەنگاوەکان")}</h3>
          <ol className="space-y-2">
            {steps.map((s) => (
              <li key={s.id} className="rounded-xl border border-border p-3 text-sm">
                <div className="flex items-center gap-2">
                  {s.status === "ok" ? <CheckCircle2 className="size-4 text-success" /> : s.status === "refused" ? <Ban className="size-4 text-warning" /> : <XCircle className="size-4 text-destructive" />}
                  <span className="font-semibold">{s.title || s.url}</span>
                  <span className="ms-auto text-xs text-muted-foreground">{new Date(s.created_at).toLocaleTimeString()}</span>
                </div>
                {s.instruction && <p className="mt-1 text-xs text-muted-foreground">{s.instruction}</p>}
                {s.excerpt && <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-xs">{s.excerpt}</p>}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
