// Micro-probe: let the user pick which of the nine engines to question live,
// see the expected cost against their balance, then show real answers.
import { useEffect, useMemo, useState } from "react";
import { Loader2, Radar, Lock } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useI18n } from "@/lib/i18n";
import { ENGINES } from "@/components/engine-logos";
import { EngineResponseFlow, type EngineAnswer } from "@/components/EngineResponseFlow";
import { getEngineEntitlement } from "@/lib/ai-engines.functions";
import { getCostPreview, type CostPreview } from "@/lib/tokens.functions";
import { apiFetch } from "@/lib/api-client";
import type { EngineKey } from "@/lib/ai-engines";
import type { GeoScope } from "@/lib/geo-scope.server";

const TX = {
  ar: { title: "تحقق فعلياً من النماذج", hint: "اختر النماذج التي تريد سؤالها الآن — كلها أو بعضها.", all: "الكل", none: "لا شيء", cost: "الكلفة المتوقعة", bal: "رصيدك", low: "رصيدك لا يكفي لهذا العدد من النماذج", run: "اسأل النماذج المختارة", mode: "طريقة التشغيل", instant: "فوري", notify: "إشعاري (يصلك إشعار عند الانتهاء)", locked: "غير متاح في باقتك", max: "الحد الأقصى", res: "إجابات فعلية من النماذج", rank: "ترتيبك", miss: "لم يذكر علامتك", free: "غير محسوب على رصيد" },
  en: { title: "Check live with the engines", hint: "Pick the engines to ask now — all or some.", all: "All", none: "None", cost: "Expected cost", bal: "Your balance", low: "Your balance is not enough for this many engines", run: "Ask the selected engines", mode: "Run mode", instant: "Instant", notify: "Notify (you get a notification when done)", locked: "Not in your plan", max: "Max", res: "Live answers from the engines", rank: "Your rank", miss: "Did not mention your brand", free: "Not metered" },
  ku: { title: "پشکنینی ڕاستەوخۆ لەگەڵ بزوێنەرەکان", hint: "ئەو بزوێنەرانە هەڵبژێرە کە دەتەوێت بپرسیت.", all: "هەموو", none: "هیچ", cost: "تێچووی چاوەڕوانکراو", bal: "باڵانسەکەت", low: "باڵانس بەس نییە", run: "پرسیار لە هەڵبژێردراوەکان", mode: "شێوازی کارکردن", instant: "دەستبەجێ", notify: "ئاگادارکردنەوە", locked: "لە پلانەکەتدا نییە", max: "زۆرترین", res: "وەڵامی ڕاستەقینە", rank: "پلەت", miss: "ناوی تۆی نەهێنا", free: "نەژمێردراو" },
};

type ProbeAnswer = { engine: string; mentioned: boolean; rank: number | null; answer: string; brands: string[] };

export function EngineProbePanel({ brand, keywords, scope }: { brand: string; keywords?: string; scope?: GeoScope }) {
  const { lang } = useI18n();
  const L = (lang === "en" || lang === "ku" ? lang : "ar") as "ar" | "en" | "ku";
  const T = TX[L];
  const entFn = useServerFn(getEngineEntitlement);
  const costFn = useServerFn(getCostPreview);
  const [allowed, setAllowed] = useState<EngineKey[] | null>(null);
  const [sel, setSel] = useState<EngineKey[]>([]);
  const [cost, setCost] = useState<CostPreview | null>(null);
  const [mode, setMode] = useState<"instant" | "notify">(() => {
    try { return (localStorage.getItem("run_mode:visibility.probe") as any) === "notify" ? "notify" : "instant"; } catch { return "instant"; }
  });
  const [busy, setBusy] = useState(false);
  const [answers, setAnswers] = useState<ProbeAnswer[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    entFn().then((e) => { setAllowed(e.allowed); setSel(e.allowed.slice(0, 3)); }).catch(() => setAllowed([]));
  }, []);

  const maxN = cost?.maxEngines ?? 9;
  useEffect(() => {
    if (!sel.length) { setCost(null); return; }
    costFn({ data: { toolKey: "visibility.probe", units: sel.length } }).then(setCost).catch(() => setCost(null));
  }, [sel.length]);

  useEffect(() => { try { localStorage.setItem("run_mode:visibility.probe", mode); } catch {} }, [mode]);

  function toggle(k: EngineKey) {
    setSel((p) => (p.includes(k) ? p.filter((x) => x !== k) : p.length >= maxN ? p : [...p, k]));
  }

  async function run() {
    if (!sel.length || busy) return;
    setBusy(true); setErr(null); setAnswers(null);
    try {
      const r = await apiFetch("/api/visibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand, keywords, lang: L, scope, probe_engines: sel, notify: mode === "notify" }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(String(j?.[L] || j?.error || r.status)); return; }
      setAnswers(j?.probe?.answers || []);
    } catch (e: any) { setErr(String(e?.message || e)); } finally { setBusy(false); }
  }

  const cards: EngineAnswer[] = useMemo(() => (answers || []).map((a) => ({
    key: a.engine as EngineKey,
    basis: "measured",
    score: a.rank ? Math.max(10, 100 - (a.rank - 1) * 15) : 0,
    verdict: a.rank ? `${T.rank}: #${a.rank}` : T.miss,
    text: a.answer,
    items: a.brands.slice(0, 5),
  })), [answers, L]);

  if (!brand.trim()) return null;

  return (
    <div className="rounded-xl border border-primary/30 bg-card/50 p-3 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-primary"><Radar className="size-4" /> {T.title}</div>
      <p className="text-xs text-muted-foreground">{T.hint}</p>
      <div className="flex flex-wrap gap-2">
        {ENGINES.map((e) => {
          const ok = allowed?.includes(e.key);
          const on = sel.includes(e.key);
          return (
            <button key={e.key} type="button" disabled={!ok} onClick={() => toggle(e.key)} title={ok ? e.name : T.locked}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs transition ${on ? "border-primary bg-primary/10" : "border-border bg-background/60"} ${ok ? "" : "opacity-40"}`}>
              <e.Logo size={16} /> {e.name} {!ok && <Lock className="size-3" />}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <button type="button" onClick={() => setSel((allowed || []).slice(0, maxN))} className="rounded-md border border-border px-2 py-0.5">{T.all}</button>
        <button type="button" onClick={() => setSel([])} className="rounded-md border border-border px-2 py-0.5">{T.none}</button>
        {cost?.maxEngines ? <span className="text-muted-foreground">{T.max}: {cost.maxEngines}</span> : null}
        <span className="ms-auto">
          {cost && (cost.metered
            ? <>{T.cost}: <b className="font-mono">{cost.total.toLocaleString()}</b> · {T.bal}: <b className="font-mono">{cost.balance.toLocaleString()}</b></>
            : <span className="text-muted-foreground">{T.free}</span>)}
        </span>
      </div>
      {cost && !cost.enough && <div className="text-xs text-destructive">{T.low}</div>}
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-muted-foreground">{T.mode}</label>
        <select value={mode} onChange={(e) => setMode(e.target.value as any)} className="rounded-md border border-border bg-background px-2 py-1 text-xs">
          <option value="instant">{T.instant}</option>
          {cost?.notifyAllowed !== false && <option value="notify">{T.notify}</option>}
        </select>
        <button type="button" onClick={run} disabled={busy || !sel.length || (cost ? !cost.enough : false)}
          className="ms-auto inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-primary to-accent px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50">
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Radar className="size-3.5" />} {T.run} ({sel.length})
        </button>
      </div>
      {err && <div className="text-xs text-destructive">{err}</div>}
      {cards.length > 0 && <EngineResponseFlow answers={cards} title={T.res} compact />}
    </div>
  );
}
