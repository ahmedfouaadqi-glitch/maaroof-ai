import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { apiFetch } from "@/lib/api-client";
import { GeoScopeSelector, getEffectiveScope } from "./GeoScopeSelector";
import { ToolLangSelect } from "./ToolLangSelect";
import { HandoffMenu } from "./HandoffMenu";
import { consumeHandoff } from "@/lib/tool-handoff";
import { Layers, Globe2, Smartphone, Tag, Loader2, Sparkles, CheckCircle2, AlertCircle, Lock } from "lucide-react";
import type { Lang } from "@/lib/i18n";

type Pillar = { score: number; summary: string; strengths: string[]; gaps: string[]; actions: string[] };
type Platform = { name: string; score: number; verdict: "high" | "medium" | "low"; why: string; next_step: string };
type Result = {
  overall: number;
  confidence: "high" | "medium" | "low";
  pillars: { website: Pillar; mobile_app: Pillar; brand: Pillar };
  platforms: Platform[];
  priority_actions: string[];
  evidence_used: string[];
  sources: { title: string; url: string; snippet: string }[];
  app_sources: { title: string; url: string; snippet: string }[];
  scope: string;
};

const LBL = {
  ar: {
    title: "الترتيب التطبيقي",
    sub: "قياس واقعي لحضور علامتك في الموقع والتطبيق والعلامة التجارية، مع رؤية كل منصة ذكاء على حدة.",
    brand: "اسم العلامة التجارية",
    keywords: "كلمات مفتاحية (اختياري)",
    sector: "القطاع (اختياري)",
    website: "رابط الموقع (https://...)",
    appName: "اسم تطبيق الهاتف (اختياري)",
    appUrl: "رابط متجر التطبيق (Play / App Store)",
    notes: "ملاحظات إضافية (اختياري)",
    run: "تشغيل الترتيب التطبيقي",
    running: "نقرأ الموقع ونبحث عن إشاراتك...",
    overall: "النتيجة الإجمالية",
    pWebsite: "الموقع الإلكتروني",
    pApp: "تطبيق الهاتف",
    pBrand: "العلامة التجارية",
    strengths: "نقاط القوة",
    gaps: "النواقص",
    actions: "إجراءات",
    platformsTitle: "كيف ترى كل منصة ذكاء علامتك",
    nextStep: "الخطوة التالية",
    priority: "أولويات الإصلاح",
    sources: "المصادر التي اعتمدنا عليها",
    needLogin: "سجل الدخول لتشغيل هذه الأداة",
    needBrand: "أدخل اسم العلامة التجارية",
    confidence: "مستوى الثقة",
    scope: "النطاق الجغرافي",
    evidence: "الأدلة المستخدمة",
  },
  en: {
    title: "Applied Ranking",
    sub: "Evidence-based scoring across your Website, Mobile App, and Brand — with a per-AI-engine view.",
    brand: "Brand name",
    keywords: "Keywords (optional)",
    sector: "Sector (optional)",
    website: "Website URL (https://...)",
    appName: "Mobile app name (optional)",
    appUrl: "App store URL (Play / App Store)",
    notes: "Extra notes (optional)",
    run: "Run Applied Ranking",
    running: "Scraping site & gathering brand signals...",
    overall: "Overall score",
    pWebsite: "Website",
    pApp: "Mobile App",
    pBrand: "Brand",
    strengths: "Strengths",
    gaps: "Gaps",
    actions: "Actions",
    platformsTitle: "How each AI engine sees your brand",
    nextStep: "Next step",
    priority: "Priority actions",
    sources: "Sources used",
    needLogin: "Sign in to run this tool",
    needBrand: "Enter a brand name",
    confidence: "Confidence",
    scope: "Geographic scope",
    evidence: "Evidence used",
  },
  ku: {
    title: "ڕیزبەندی جێبەجێکراو",
    sub: "نمرەدانی بەڵگەمەند بۆ ماڵپەڕ، ئەپ، و براندەکەت — لەگەڵ ڕوانگەی هەر ئەنجامدەرێکی AI.",
    brand: "ناوی براند",
    keywords: "ووشە کلیلەکان (ئارەزوومەندانە)",
    sector: "بوار (ئارەزوومەندانە)",
    website: "بەستەری ماڵپەڕ (https://...)",
    appName: "ناوی ئەپی مۆبایل",
    appUrl: "بەستەری فرۆشگای ئەپ",
    notes: "تێبینی زیاتر",
    run: "جێبەجێکردنی ڕیزبەندی",
    running: "ماڵپەڕ دەخوێنرێتەوە و سیگناڵەکان کۆ دەکرێنەوە...",
    overall: "نمرەی گشتی",
    pWebsite: "ماڵپەڕ",
    pApp: "ئەپی مۆبایل",
    pBrand: "براند",
    strengths: "خاڵە بەهێزەکان",
    gaps: "کەموکوڕی",
    actions: "کردارەکان",
    platformsTitle: "چۆن هەر ئەنجامدەرێکی AI براندەکەت دەبینێت",
    nextStep: "هەنگاوی داهاتوو",
    priority: "ئاوڵاوی چاککردن",
    sources: "سەرچاوە بەکارهاتووەکان",
    needLogin: "بچۆ ژوورەوە بۆ ئەم ئامرازە",
    needBrand: "ناوی براند بنووسە",
    confidence: "ئاستی متمانە",
    scope: "گەڕی جوگرافی",
    evidence: "بەڵگە بەکارهاتووەکان",
  },
} as const;

function scoreColor(n: number) {
  if (n >= 75) return "text-success border-success/40 bg-success/10";
  if (n >= 50) return "text-accent border-accent/40 bg-accent/10";
  return "text-destructive border-destructive/40 bg-destructive/10";
}

type Labels = (typeof LBL)[keyof typeof LBL];
function PillarCard({ icon, title, p, t }: { icon: React.ReactNode; title: string; p: Pillar; t: Labels }) {
  return (
    <div className="rounded-xl border border-border bg-background/50 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">{icon}{title}</div>
        <div className={`rounded-full border px-2.5 py-0.5 font-mono text-xs ${scoreColor(p.score)}`}>{p.score}/100</div>
      </div>
      {p.summary && <p className="mb-3 text-xs text-muted-foreground">{p.summary}</p>}
      {p.strengths.length > 0 && (
        <div className="mb-2">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-success">{t.strengths}</div>
          <ul className="space-y-1">
            {p.strengths.map((s, i) => <li key={i} className="flex gap-1.5 text-xs"><CheckCircle2 className="mt-0.5 size-3 shrink-0 text-success" />{s}</li>)}
          </ul>
        </div>
      )}
      {p.gaps.length > 0 && (
        <div className="mb-2">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-destructive">{t.gaps}</div>
          <ul className="space-y-1">
            {p.gaps.map((s, i) => <li key={i} className="flex gap-1.5 text-xs"><AlertCircle className="mt-0.5 size-3 shrink-0 text-destructive" />{s}</li>)}
          </ul>
        </div>
      )}
      {p.actions.length > 0 && (
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-primary">{t.actions}</div>
          <ul className="space-y-1">
            {p.actions.map((s, i) => <li key={i} className="flex gap-1.5 text-xs"><Sparkles className="mt-0.5 size-3 shrink-0 text-primary" />{s}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

export function AppliedRanking() {
  const { lang } = useI18n();
  let auth: ReturnType<typeof useAuth> | null = null;
  try { auth = useAuth(); } catch {}
  const user = auth?.user;
  const L = (lang === "en" || lang === "ku" ? lang : "ar") as "ar" | "en" | "ku";
  const t = LBL[L];

  const [brand, setBrand] = useState("");
  const [keywords, setKeywords] = useState("");
  const [sector, setSector] = useState("");
  const [website, setWebsite] = useState("");
  const [appName, setAppName] = useState("");
  const [appUrl, setAppUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [outLang, setOutLang] = useState<Lang>(lang);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const run = async () => {
    setError(null);
    if (!user) { setError(t.needLogin); return; }
    if (brand.trim().length < 2) { setError(t.needBrand); return; }
    setRunning(true); setResult(null);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const session = (await supabase.auth.getSession()).data.session;
      if (session) headers.Authorization = `Bearer ${session.access_token}`;
      const r = await apiFetch("/api/applied-ranking", {
        method: "POST", headers,
        body: JSON.stringify({
          brand_name: brand, brand_keywords: keywords, sector, website, app_name: appName, app_url: appUrl, notes,
          lang: outLang, scope: getEffectiveScope(auth?.profile, "applied_ranking"),
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data?.error === "limit" ? "limit" : data?.error || "error");
      } else {
        setResult(data.result);
        if (auth) auth.refreshProfile();
      }
    } catch (e: any) {
      setError(e.message || "error");
    } finally { setRunning(false); }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card/70 p-5 shadow-[var(--shadow-elevated)] backdrop-blur-xl sm:p-6 md:p-8 glow-border">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent opacity-70" />

      <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
        <Layers className="size-4 text-primary" />
        <span className="font-mono uppercase tracking-widest text-xs">{t.title}</span>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">{t.sub}</p>

      <div className="mb-3"><GeoScopeSelector compact toolKey="applied_ranking" /></div>
      <div className="mb-3 flex justify-end"><ToolLangSelect value={outLang} onChange={setOutLang} /></div>

      <div className="grid gap-3 sm:grid-cols-2">
        <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder={t.brand} className="rounded-xl border border-border bg-background/60 p-3 text-sm outline-none focus:border-primary" />
        <input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder={t.keywords} className="rounded-xl border border-border bg-background/60 p-3 text-sm outline-none focus:border-primary" />
        <input value={sector} onChange={(e) => setSector(e.target.value)} placeholder={t.sector} className="rounded-xl border border-border bg-background/60 p-3 text-sm outline-none focus:border-primary" />
        <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder={t.website} className="rounded-xl border border-border bg-background/60 p-3 text-sm outline-none focus:border-primary" />
        <input value={appName} onChange={(e) => setAppName(e.target.value)} placeholder={t.appName} className="rounded-xl border border-border bg-background/60 p-3 text-sm outline-none focus:border-primary" />
        <input value={appUrl} onChange={(e) => setAppUrl(e.target.value)} placeholder={t.appUrl} className="rounded-xl border border-border bg-background/60 p-3 text-sm outline-none focus:border-primary" />
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t.notes} rows={2} className="rounded-xl border border-border bg-background/60 p-3 text-sm outline-none focus:border-primary sm:col-span-2" />
      </div>

      <div className="mt-4 flex justify-end">
        <button onClick={run} disabled={running} className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition hover:scale-[1.02] disabled:opacity-50">
          {running ? <><Loader2 className="size-4 animate-spin" />{t.running}</> : <><Sparkles className="size-4" />{t.run}</>}
        </button>
      </div>

      {error && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          {error === t.needLogin ? <Lock className="size-3.5" /> : <AlertCircle className="size-3.5" />}
          {error === "limit" ? "Monthly quota reached." : error}
        </div>
      )}

      {result && (
        <div className="mt-6 space-y-5">
          <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-accent/5 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">{t.overall}</div>
                <div className="mt-1 font-display text-4xl font-bold text-gradient">{result.overall}<span className="text-xl text-muted-foreground">/100</span></div>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <div>{t.confidence}: <span className="font-semibold text-foreground">{result.confidence}</span></div>
                <div className="mt-1">{t.scope}: <span className="font-semibold text-foreground">{result.scope}</span></div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <PillarCard icon={<Globe2 className="size-4 text-primary" />} title={t.pWebsite} p={result.pillars.website} t={t} />
            <PillarCard icon={<Smartphone className="size-4 text-primary" />} title={t.pApp} p={result.pillars.mobile_app} t={t} />
            <PillarCard icon={<Tag className="size-4 text-primary" />} title={t.pBrand} p={result.pillars.brand} t={t} />
          </div>

          <div>
            <div className="mb-2 text-sm font-semibold">{t.platformsTitle}</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {result.platforms.map((p) => (
                <div key={p.name} className="rounded-xl border border-border bg-background/50 p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <div className="text-sm font-semibold">{p.name}</div>
                    <div className={`rounded-full border px-2 py-0.5 font-mono text-[11px] ${scoreColor(p.score)}`}>{p.score}</div>
                  </div>
                  {p.why && <p className="text-xs text-muted-foreground">{p.why}</p>}
                  {p.next_step && (
                    <div className="mt-2 rounded-lg bg-primary/5 p-2 text-[11px]">
                      <span className="font-semibold text-primary">{t.nextStep}: </span>{p.next_step}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {result.priority_actions.length > 0 && (
            <div className="rounded-xl border border-accent/40 bg-accent/10 p-4">
              <div className="mb-2 text-sm font-semibold text-accent">{t.priority}</div>
              <ol className="list-decimal space-y-1 ps-5 text-xs text-foreground">
                {result.priority_actions.map((a, i) => <li key={i}>{a}</li>)}
              </ol>
            </div>
          )}

          {result.evidence_used.length > 0 && (
            <div className="rounded-xl border border-border bg-background/50 p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t.evidence}</div>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {result.evidence_used.map((e, i) => <li key={i}>• {e}</li>)}
              </ul>
            </div>
          )}

          {(result.sources.length > 0 || result.app_sources.length > 0) && (
            <div className="rounded-xl border border-border bg-background/50 p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t.sources}</div>
              <ul className="space-y-1 text-xs">
                {[...result.sources, ...result.app_sources].map((s, i) => (
                  <li key={i}><a href={s.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">{s.title || s.url}</a></li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
