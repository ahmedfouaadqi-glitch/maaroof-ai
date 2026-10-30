import { useEffect, useMemo, useState } from "react";
import { ToolResultExport } from "@/components/ToolResultExport";
import { ExportButtons } from "@/components/ExportButtons";
import { ToolHistory } from "@/components/ToolHistory";
import { Megaphone, Loader2, Plus, Trash2, Sparkles, Radar, Copy, ExternalLink, Share2, History, Download, RefreshCw, Eye, Info, Rocket } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { VisibilityPanel } from "@/components/AIVisibility";
import { ProactiveNextStep } from "@/components/ProactiveNextStep";

import { ToolLangSelect } from "@/components/ToolLangSelect";
import { ToolHelpBanner } from "@/components/ToolHelpBanner";
import { GeoScopeSelector, getEffectiveScope } from "@/components/GeoScopeSelector";
import type { ExportPayload } from "@/lib/exports";
import { useI18n, type Lang } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { HandoffMenu } from "@/components/HandoffMenu";
import { apiFetch } from "@/lib/api-client";
import { toast } from "sonner";
import { ENGINES } from "@/components/engine-logos";
import EngineSelector from "@/components/EngineSelector";

import { ENGINE_KEYS } from "@/lib/ai-engines";
import { botCategory, type BotCategory } from "@/lib/crawler-bots";
const PLATFORMS: string[] = [...ENGINE_KEYS];
const MAX_PLATFORMS_PER_RUN = 10;

export function BrandBoostAgent({ workspaceId = null }: { workspaceId?: string | null }) {
  const { t, lang } = useI18n();
  const [outLang, setOutLang] = useState<Lang>(lang);
  const { user, profile } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [brand, setBrand] = useState((profile as any)?.brand_name || "");
  const [kw, setKw] = useState((profile as any)?.brand_keywords || "");
  // Fill once from the saved profile when it arrives; never overwrite what the user typed.
  useEffect(() => {
    const pb = (profile as any)?.brand_name;
    const pk = (profile as any)?.brand_keywords;
    if (pb) setBrand((cur: string) => cur || pb);
    if (pk) setKw((cur: string) => cur || pk);
  }, [(profile as any)?.brand_name, (profile as any)?.brand_keywords]);
  const [freq, setFreq] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [sel, setSel] = useState<string[]>(PLATFORMS.slice(0, MAX_PLATFORMS_PER_RUN));
  const [approved, setApproved] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [report, setReport] = useState<any>(null);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState<string>("enhance");

  const load = async () => {
    if (!user) return;
    let query = supabase.from("brand_boost_jobs").select("*").eq("user_id", user.id);
    query = workspaceId ? query.eq("workspace_id", workspaceId) : query.is("workspace_id", null);
    const { data } = await query.order("created_at", { ascending: false });
    setJobs(data || []);
  };
  useEffect(() => { load(); }, [user?.id, workspaceId]);

  const create = async () => {
    if (!user || !brand.trim() || !approved) return;
    const platforms = sel.slice(0, MAX_PLATFORMS_PER_RUN);
    await supabase.from("brand_boost_jobs").insert({
      user_id: user.id, workspace_id: workspaceId, brand_name: brand, brand_keywords: kw,
      platforms, frequency: freq, approved: true, active: false,
    });
    await load();
  };

  const remove = async (id: string) => {
    if (!confirm(t("boost_delete_confirm"))) return;
    let query = supabase.from("brand_boost_jobs").delete().eq("id", id).eq("user_id", user!.id);
    query = workspaceId ? query.eq("workspace_id", workspaceId) : query.is("workspace_id", null);
    await query;
    setReport(null);
    await load();
  };

  const buildExport = (j: any): ExportPayload => ({
    title: t("boost_export_title"),
    subtitle: j.brand_name,
    sections: [
      ...(report?.summary ? [{ heading: t("boost_summary"), kind: "text" as const, text: String(report.summary) }] : []),
      {
        heading: t("boost_title"),
        kind: "table" as const,
        table: {
          columns: [t("boost_platform"), t("boost_signal"), t("boost_actions")],
          data: (report?.plan || []).map((p: any) => [
            String(p.platform || ""),
            String(p.current_signal || ""),
            (p.recommended_actions || []).join(" • "),
          ]),
        },
      },
    ],
  });


  const runNow = async (j: any) => {
    setRunning(j.id); setErr(""); setReport(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
      const res = await apiFetch("/api/brand-boost", {
        method: "POST", headers,
        body: JSON.stringify({ brand_name: j.brand_name, brand_keywords: j.brand_keywords, platforms: (j.platforms || []).slice(0, MAX_PLATFORMS_PER_RUN), lang: outLang, scope: getEffectiveScope(profile, "brand"), workspace_id: workspaceId }),
      });
      const text = await res.text();
      let data: any = {};
      try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text.slice(0, 200) || `http_${res.status}` }; }
      if (!res.ok) throw new Error(data.error || `http_${res.status}`);
      setReport(data);
      toast.success(outLang === "ar" ? t("auto.tokens_deducted_check_balance_above")
        : outLang === "ku" ? "تۆکن کەمکرایەوە ✓ — باڵانس لە سەرەوە بپشکنە"
        : "Tokens charged ✓ — see updated balance above");
      await supabase.from("brand_boost_runs").insert({ job_id: j.id, user_id: user!.id, workspace_id: workspaceId, status: "done", report: data });
      let updateJob = supabase.from("brand_boost_jobs").update({ last_run_at: new Date().toISOString() }).eq("id", j.id).eq("user_id", user!.id);
      updateJob = workspaceId ? updateJob.eq("workspace_id", workspaceId) : updateJob.is("workspace_id", null);
      await updateJob;
      await load();
    } catch (e: any) { setErr(e?.message || "failed"); }
    finally { setRunning(null); }
  };

  return (
    <div className="max-w-full overflow-hidden rounded-2xl border border-accent/30 bg-card/70 p-3 backdrop-blur sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-display text-base font-semibold sm:text-lg">
            <Megaphone className="size-5 text-accent" /> {t("boost_title")}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">{t("boost_desc")}</p>
          <div className="mt-1 text-[11px] text-amber-600">{t("boost_addon_note")}</div>
          <ToolHelpBanner toolKey="brand" />
          <div className="mt-3"><GeoScopeSelector compact toolKey="brand" /></div>
        </div>
        <ToolLangSelect value={outLang} onChange={setOutLang} className="w-full flex-wrap sm:w-auto sm:justify-end" />
      </div>

      <Tabs value={tab} onValueChange={setTab} className="mt-4">
        <TabsList className="flex h-auto w-full flex-wrap gap-1">
          <TabsTrigger value="enhance" className="text-xs"><Eye className="me-1 inline size-3.5" />{lang === "ar" ? "تعزيز العلامة" : lang === "ku" ? "بەهێزکردنی براند" : "Brand Enhancement"}</TabsTrigger>
          <TabsTrigger value="broadcast" className="text-xs"><Rocket className="me-1 inline size-3.5" />{lang === "ar" ? "بث للذكاء" : lang === "ku" ? "بڵاوکردنەوە بۆ AI" : "AI Broadcast"}</TabsTrigger>
          <TabsTrigger value="tracking" className="text-xs"><Radar className="me-1 inline size-3.5" />{lang === "ar" ? "متتبع الانتشار" : lang === "ku" ? "شوێنپێی بڵاوبوونەوە" : "Reach Tracker"}</TabsTrigger>
          <TabsTrigger value="logs" className="text-xs"><History className="me-1 inline size-3.5" />{lang === "ar" ? "السجل" : lang === "ku" ? "تۆمار" : "Log"}</TabsTrigger>
        </TabsList>

        <TabsContent value="enhance" className="mt-4">
          <div className="rounded-lg border border-primary/30 bg-gradient-to-br from-primary/10 to-accent/5 p-4 mb-3">
            <h3 className="flex items-center gap-2 font-display text-sm font-bold text-gradient">
              <Eye className="size-4 text-primary" />
              {lang === "ar" ? "تحليل الظهور في محركات الذكاء" : lang === "ku" ? "شیکاری دەرکەوتن لە بزوێنەرە AIـەکان" : "AI Engines Visibility Analysis"}
            </h3>
            <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
              {lang === "ar"
                ? "افحص كيف تظهر علامتك التجارية أمام 10 محركات ذكاء اصطناعي (ChatGPT و Gemini و Claude و Perplexity و Copilot و Grok و Mistral و DeepSeek و Kimi و Qwen). يعرض لك: ما يقوله كل محرك الآن، نسبة الظهور لكل منصة، إشارات الثقة، التحيّز السلبي/الإيجابي، وتوصيات عملية مرتبطة مباشرة بخطة \"تعزيز العلامة\" بالأسفل. (يستهلك 1 تحليل — اسم العلامة مطلوب، الكلمات المفتاحية اختيارية)."
                : lang === "ku"
                ? "پشکنینی چۆنیەتی دەرکەوتنی براندەکەت لە ١٠ بزوێنەری AI. وەڵامی ئێستای هەر بزوێنەرێک، ڕێژەی دەرکەوتن، ئاماژەی متمانە و ڕاسپاردە کارایی پێشکەش دەکات کە ڕاستەوخۆ پەیوەستن بە پلانی بەهێزکردنی براند. (١ شیکاری — ناوی براند پێویستە)."
                : "Probe how your brand appears across 10 AI engines (ChatGPT, Gemini, Claude, Perplexity, Copilot, Grok, Mistral, DeepSeek, Kimi, Qwen). See what each engine says right now, per-platform visibility %, trust signals, sentiment, and actionable recommendations that feed directly into your Brand Boost plan below. (1 analysis — brand required, keywords optional)."}
            </p>
          </div>
          <VisibilityPanel brand={brand} keywords={kw} lang={outLang} embedded toolKey="brand" />
        

        
      <div className="grid gap-2 sm:grid-cols-2">
        <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder={t("boost_brand")}
          className="rounded-lg border border-border bg-background/60 px-3 py-2 text-sm" />
        <input value={kw} onChange={(e) => setKw(e.target.value)} placeholder={t("boost_keywords")}
          className="rounded-lg border border-border bg-background/60 px-3 py-2 text-sm" />
      </div>
      <EngineSelector className="mt-3" value={sel} onChange={setSel} maxOverride={MAX_PLATFORMS_PER_RUN} />

      <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 text-[11px] text-muted-foreground">
        {lang === "ar"
          ? "تفضيل التكرار يُحفظ في الإعدادات فقط. لا يوجد حالياً عامل خلفي يشغّل مهام تعزيز العلامة تلقائياً؛ استخدم «تشغيل الآن» للتنفيذ اليدوي."
          : lang === "ku"
          ? "هەڵبژاردەی دووبارەبوونەوە تەنها وەک ڕێکخستن پاشەکەوت دەکرێت. لە ئێستادا جێبەجێکەری پشتەوە بۆ کارکردنی خۆکاری نییە؛ «ئێستا جێبەجێ بکە» بەکاربهێنە."
          : "Frequency is saved as a preference only. No background worker currently runs Brand Boost jobs automatically; use Run Now for manual execution."}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <select value={freq} onChange={(e) => setFreq(e.target.value as any)}
          className="rounded-lg border border-border bg-background/60 px-3 py-1.5 text-sm">
          <option value="daily">{t("boost_freq_daily")}</option>
          <option value="weekly">{t("boost_freq_weekly")}</option>
          <option value="monthly">{t("boost_freq_monthly")}</option>
        </select>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={approved} onChange={(e) => setApproved(e.target.checked)} />
          {t("boost_approve")}
        </label>
        <span className="text-[11px] text-muted-foreground">{sel.length}/{MAX_PLATFORMS_PER_RUN} · 5 credits</span>
        <button disabled={!approved || !brand.trim() || sel.length === 0} onClick={create}
          className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-primary to-accent px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-40">
          <Plus className="size-3.5" /> {t("boost_create")}
        </button>
      </div>

      {jobs.length > 0 && (
        <div className="mt-4 space-y-2">
          {jobs.map((j) => (
            <div key={j.id} className="rounded-lg border border-border bg-background/40 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <strong className="max-w-full break-words">{j.brand_name}</strong>
                <span className="text-xs text-muted-foreground">· {j.frequency}</span>
                <span className="max-w-full break-words text-[10px] text-muted-foreground">{j.platforms?.slice(0, MAX_PLATFORMS_PER_RUN).join(", ")}</span>
                <span className="sm:ms-auto rounded-md border border-amber-500/30 bg-amber-500/5 px-2 py-1 text-[10px] text-amber-700 dark:text-amber-400">
                  {lang === "ar" ? "يدوي فقط" : lang === "ku" ? "تەنها بە دەستی" : "Manual only"}
                </span>
                <button disabled={running === j.id} onClick={() => runNow(j)}
                  className="rounded-md bg-primary/15 px-2 py-1 text-xs font-semibold text-primary disabled:opacity-50">
                  {running === j.id ? <Loader2 className="inline size-3 animate-spin" /> : t("boost_run_now")}
                </button>
                <button onClick={() => remove(j.id)} title={t("boost_delete")}
                  className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-xs font-semibold text-destructive hover:bg-destructive/20">
                  <Trash2 className="inline size-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {err && (
        <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
          {err === "credits_exhausted" || err === "subscription_required"
            ? (lang === "ar" ? "تم استنفاد رصيد التحليلات الشهري. ارفع باقتك أو انتظر تجديد الرصيد." : lang === "ku" ? "ڕەسیدی شیکاری مانگانە تەواو بوو." : "Monthly analyses quota exhausted. Upgrade your plan or wait for renewal.")
            : err === "rate_limited"
            ? (lang === "ar" ? "تم تجاوز الحد المسموح، حاول بعد دقائق." : "Rate limited — try again in a few minutes.")
            : err}
        </div>
      )}
      {report && <div className="mb-2 flex justify-end"><ToolResultExport toolKey="brand_boost" result={report} /></div>}
      <ToolHistory toolKey="brand_boost" />
      {report && (
        <div className="mt-4 space-y-2">
          {report.summary && <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">{report.summary}</div>}
          {(report.plan || []).map((p: any, i: number) => (
            <div key={i} className="rounded-lg border border-border bg-background/40 p-3 text-xs space-y-2">
              {(() => {
                const eng = ENGINES.find((e) => e.name.toLowerCase() === String(p.platform || "").toLowerCase());
                const Logo = eng?.Logo;
                return (
                  <div className={`flex flex-wrap items-center gap-2 rounded-md bg-gradient-to-br ${eng?.tint || "from-primary/10 to-accent/5"} p-2`}>
                    {Logo && <Logo size={20} />}
                    <strong className="text-foreground capitalize">{p.platform}</strong>
                    <span className="max-w-full break-all rounded-full border border-border bg-background/60 px-2 py-0.5 text-[10px] font-mono text-muted-foreground">{p.model_used}</span>
                    {p.is_proxy ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex cursor-help items-center gap-1 rounded-full border border-border bg-background/60 px-2 py-0.5 text-[10px] text-muted-foreground">
                              <Info className="size-2.5" /> {lang === "ar" ? "عبر Proxy" : lang === "ku" ? "لەڕێگەی Proxy" : "Proxy route"}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs text-[11px]">
                            {lang === "ar"
                              ? "Proxy قناة اتصال ضمن تكامل المحرك، ولا تعني أن الاستجابة محاكاة أو من نموذج بديل."
                              : lang === "ku"
                              ? "Proxy ڕێگای پەیوەندییە لە ناو یەکخستنی بزوێنەر؛ واتای هاوشێوەسازی یان بەکارهێنانی مۆدێلی جێگرەوە نییە."
                              : "Proxy is the configured connection route; it does not mean the engine response is simulated or replaced."}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <span className="rounded-full border border-border bg-background/60 px-2 py-0.5 text-[10px] text-muted-foreground">{lang === "ar" ? "اتصال مباشر" : lang === "ku" ? "پەیوەندی ڕاستەوخۆ" : "Direct connection"}</span>
                    )}
                    <span className="ms-auto rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] text-primary">{p.current_signal}</span>
                  </div>
                );
              })()}

              {p.current_answer ? (
                <div className="rounded-md border border-border bg-card/50 p-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{lang === "ar" ? "ما قاله المحرك الآن" : lang === "ku" ? "وەڵامی ئێستا" : "What the engine said just now"}</div>
                  <div className="mt-1 whitespace-pre-wrap break-words text-foreground/90">{p.current_answer}</div>
                </div>
              ) : (
                <div className="text-muted-foreground italic">{p.probe_error ? `(${p.probe_error})` : (lang === "ar" ? "(لا توجد إشارة)" : "(no signal)")}</div>
              )}
              {p.feeding_basis && (
                 <div className="break-words text-muted-foreground"><span className="font-semibold text-foreground/80">{lang === "ar" ? "كيف تمت تغذيته:" : lang === "ku" ? "چۆن خوێندراوەتەوە:" : "How it was fed:"}</span> {p.feeding_basis}</div>
              )}
              {p.feed_strategy && (
                 <div className="break-words"><span className="font-semibold text-foreground/80">{lang === "ar" ? "استراتيجية التغذية:" : lang === "ku" ? "ستراتیژی خواردن:" : "Feed strategy:"}</span> {p.feed_strategy}</div>
              )}
              {(p.recommended_actions || []).length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{lang === "ar" ? "إجراءات التحسين" : lang === "ku" ? "کردارەکانی باشترکردن" : "Improvement actions"}</div>
                  <ul className="mt-1 list-inside list-disc break-words">
                    {(p.recommended_actions || []).map((a: string, j: number) => <li key={j}>{a}</li>)}
                  </ul>
                </div>
              )}
              {(p.content_pieces || []).length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{lang === "ar" ? "محتوى مقترح" : lang === "ku" ? "ناوەڕۆکی پێشنیار" : "Content pieces"}</div>
                  <ul className="mt-1 list-inside list-disc break-words">
                    {(p.content_pieces || []).map((c: string, j: number) => <li key={j}>{c}</li>)}
                  </ul>
                </div>
              )}
              {p.injection_pack && (
                <div className="rounded-md border border-accent/30 bg-accent/5 p-2 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-accent">{lang === "ar" ? "حقنة جاهزة للنشر" : lang === "ku" ? "پاکێجی ئامادە بۆ بڵاوکردنەوە" : "Ready-to-publish injection"}</span>
                    {p.injection_pack.channel && <span className="rounded-full border border-border bg-background/60 px-2 py-0.5 text-[10px] text-muted-foreground">{p.injection_pack.channel}</span>}
                    <button onClick={() => {
                      const pack = p.injection_pack;
                      const qa = Array.isArray(pack?.qa_pairs) ? pack.qa_pairs.map((q: any) => `Q: ${q.q}\nA: ${q.a}`).join("\n\n") : "";
                      const combined = [pack?.title ? `# ${pack.title}` : "", pack?.article_markdown || "", qa ? `\n## Q&A\n${qa}` : "", pack?.json_ld ? `\n## JSON-LD\n\`\`\`json\n${pack.json_ld}\n\`\`\`` : ""].filter(Boolean).join("\n\n");
                      navigator.clipboard.writeText(combined);
                    }} className="ms-auto inline-flex items-center gap-1 rounded border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent hover:bg-accent/20">
                      <Copy className="size-3" /> {lang === "ar" ? "نسخ الكل" : lang === "ku" ? "هەموو کۆپی" : "Copy all"}
                    </button>
                  </div>
                  {p.injection_pack.title && <div className="font-semibold text-foreground">{p.injection_pack.title}</div>}

                  {p.injection_pack.article_markdown && (
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase text-muted-foreground">Article</span>
                        <button onClick={() => navigator.clipboard.writeText(String(p.injection_pack.article_markdown))} className="text-[10px] underline text-primary">copy</button>
                      </div>
                      <pre className="mt-1 max-h-48 max-w-full overflow-auto whitespace-pre-wrap break-words rounded bg-background/60 p-2 text-[11px] text-foreground/90">{p.injection_pack.article_markdown}</pre>
                    </div>
                  )}
                  {Array.isArray(p.injection_pack.qa_pairs) && p.injection_pack.qa_pairs.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-[10px] uppercase text-muted-foreground">Q&amp;A</div>
                      {p.injection_pack.qa_pairs.map((qa: any, k: number) => (
                        <div key={k} className="break-words rounded bg-background/60 p-2 text-[11px]"><strong>Q:</strong> {qa.q}<br/><strong>A:</strong> {qa.a}</div>
                      ))}
                    </div>
                  )}
                  {p.injection_pack.json_ld && (
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase text-muted-foreground">JSON-LD</span>
                        <button onClick={() => navigator.clipboard.writeText(String(p.injection_pack.json_ld))} className="text-[10px] underline text-primary">copy</button>
                      </div>
                      <pre className="mt-1 max-h-32 max-w-full overflow-auto whitespace-pre-wrap break-all rounded bg-background/60 p-2 text-[10px] font-mono text-foreground/80">{p.injection_pack.json_ld}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {Array.isArray(report.evidence) && report.evidence.length > 0 && (
            <div className="rounded-lg border border-border bg-background/40 p-3 text-xs">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{lang === "ar" ? "الأدلة العامة المُستخدَمة في التغذية" : lang === "ku" ? "بەڵگە گشتییەکانی خواردن" : "Public evidence used as feeding"}</div>
              <ol className="mt-1 list-inside list-decimal space-y-1">
                {report.evidence.map((e: any, j: number) => (
                  <li key={j}><a href={e.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">{e.title || e.url}</a></li>
                ))}
              </ol>
            </div>
          )}
          <div className="rounded-xl border-2 border-accent/50 bg-gradient-to-br from-accent/10 to-primary/10 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Rocket className="size-5 text-accent" />
              <strong className="text-sm">
                {lang === "ar" ? "جاهز للبثّ الحقيقي إلى محركات الذكاء؟"
                  : lang === "ku" ? "ئامادەی بۆ بڵاوکردنەوەی ڕاستەقینە بۆ AI؟"
                  : "Ready to broadcast to AI engines?"}
              </strong>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {lang === "ar"
                ? t("auto.open_the_broadcast_to_ai_tab")
                : lang === "ku"
                ? "تابی «بڵاوکردنەوە بۆ AI» بکەرەوە: لاپەڕەی گشتی + IndexNow ping + بەستەری هاوبەشی."
                : "Open the Broadcast tab to publish an indexable public page, ping IndexNow (Bing/Copilot/Perplexity/ChatGPT), and get share-ready links for every platform."}
            </p>
            <button onClick={() => setTab("authority")}
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-accent to-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)]">
              <Rocket className="size-4" />
              {lang === "ar" ? "ابدأ البثّ الآن" : lang === "ku" ? "ئێستا بڵاو بکەرەوە" : "Broadcast now"}
            </button>
          </div>
          <HandoffMenu source="boost" getText={() => `${brand}\n${report.summary || ""}\n\n${(report.plan || []).map((p: any) => `${p.platform}: ${(p.recommended_actions || []).join(", ")}`).join("\n")}`} />
          <ProactiveNextStep
            toolKey="brand_boost"
            inputSummary={`brand=${brand} kw=${kw} platforms=${sel.join(",")}`}
            outputSummary={`${report.summary || ""}\n${(report.plan || []).slice(0, 3).map((p: any) => `${p.platform}: ${(p.recommended_actions || []).slice(0, 2).join("; ")}`).join("\n")}`}
            handoffText={`${brand}\n${report.summary || ""}`}
          />
        </div>
      )}
        
        </TabsContent>

        <TabsContent value="broadcast" className="mt-4">
          <AuthorityPanel brand={brand} kw={kw} lang={outLang} workspaceId={workspaceId} />
        </TabsContent>

        <TabsContent value="tracking" className="mt-4">
          <PropagationPanel workspaceId={workspaceId} />
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          <LogsPanel workspaceId={workspaceId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AuthorityPanel({ brand, kw, lang, workspaceId }: { brand: string; kw: string; lang: Lang; workspaceId?: string | null }) {
  const { t } = useI18n();
  const [sourceUrl, setSourceUrl] = useState("");
  const [ping, setPing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [pack, setPack] = useState<any>(null);

  const generate = async () => {
    if (!brand.trim()) { setErr(t("boost_brand")); return; }
    setLoading(true); setErr(""); setPack(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
      const res = await apiFetch("/api/brand-authority", {
        method: "POST", headers,
        body: JSON.stringify({ brand_name: brand, brand_keywords: kw, source_url: sourceUrl, ping, lang, workspace_id: workspaceId || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `http_${res.status}`);
      setPack(data);
    } catch (e: any) { setErr(e?.message || "failed"); }
    finally { setLoading(false); }
  };

  const copy = (s: string) => { navigator.clipboard.writeText(s).catch(() => {}); };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border-2 border-accent/40 bg-gradient-to-br from-accent/10 to-primary/5 p-4 text-xs">
        <div className="flex items-center gap-2 font-semibold text-foreground">
          <Rocket className="size-4 text-accent" />
          {lang === "ar" ? "بث المعلومات العامة للعلامة — النطاق الحالي"
            : lang === "ku" ? "بڵاوکردنەوەی زانیاری براند — مەودای ئێستا"
            : "Brand information broadcast — current scope"}
        </div>
        <ol className="mt-2 ms-4 list-decimal space-y-1 text-muted-foreground">
          <li>{lang === "ar" ? "ينشئ معروف بطاقة HTML وMarkdown وJSON-LD وينشرها على رابط عام ضمن نطاق معروف." : lang === "ku" ? "Maaroof کارتی HTML وMarkdown وJSON-LD دروست دەکات و لەسەر بەستەرێکی گشتی لە مەودای Maaroof بڵاوی دەکاتەوە." : "Maaroof generates an HTML/Markdown/JSON-LD brand pack and publishes it at a public URL on the Maaroof domain."}</li>
          <li>{lang === "ar" ? "يمكن إرسال إشعار IndexNow لهذا الرابط على نطاق معروف؛ قبول الإشعار لا يثبت الزحف أو الفهرسة." : lang === "ku" ? "دەتوانرێت ئاگادارکردنەوەی IndexNow بۆ ئەم بەستەرە بنێردرێت؛ وەرگرتنی ئاگادارکردنەوە بەڵگەی کرۆڵ یان ئیندێکس نییە." : "An IndexNow notification can be sent for this Maaroof URL; acceptance does not prove crawling or indexing."}</li>
          <li>{lang === "ar" ? "هذا المسار لا يعدّل موقع العميل ولا ملف sitemap.xml الخاص به." : lang === "ku" ? "ئەم ڕێگایە ماڵپەڕی کڕیار یان sitemap.xml ـی ئەو ناگۆڕێت." : "This flow does not modify the customer's website or its sitemap.xml."}</li>
          <li>{lang === "ar" ? "يمكن مشاركة الرابط على قنوات العلامة؛ المشاركة لا تضمن أن أي محرك سيزحف إليه أو يستشهد به." : lang === "ku" ? "دەتوانرێت بەستەرەکە لە کەناڵەکانی براند بڵاو بکرێتەوە؛ ئەمە گەرەنتی کرۆڵ یان ئاماژەکردنی هیچ بزوێنەرێک ناکات." : "You can share the URL on brand channels; sharing does not guarantee that an engine will crawl or cite it."}</li>
          <li>{lang === "ar" ? "يعرض متتبع الانتشار الطلبات التي طابقت قواعد User-Agent؛ وهذا لا يثبت هوية الزاحف." : lang === "ku" ? "شوێنپێکەرەکە داواکارییە هاوتاکانی User-Agent پیشان دەدات؛ ئەمە ناسنامەی کرۆڵەر پشتڕاست ناکاتەوە." : "The reach tracker shows requests matching User-Agent rules; this does not authenticate the crawler."}</li>
        </ol>
        <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 text-[11px] text-foreground/80">
          {lang === "ar" ? "النشر المباشر على نطاق العميل يحتاج إلى ربط تقني وتحقق من ملكية النطاق وتفويض نشر؛ هذه الوظائف غير منفذة في هذا المسار حالياً."
            : lang === "ku" ? "بڵاوکردنەوەی ڕاستەوخۆ لە مەودای کڕیار پێویستی بە بەستەری تەکنیکی، پشتڕاستکردنەوەی خاوەندارێتی و ڕێگەپێدانی بڵاوکردنەوە هەیە؛ لەم ڕێگایەدا هێشتا جێبەجێ نەکراوە."
            : "Publishing directly to the customer's domain requires a site connector, domain verification, and publishing authorization; those are not implemented in this flow yet."}
        </p>
      </div>

      <div className="rounded-lg border border-accent/30 bg-accent/5 p-3 text-xs">
        <div className="font-semibold text-foreground">{t("authority_title")}</div>
        <p className="mt-1 text-muted-foreground">{t("authority_desc")}</p>
      </div>


      <input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)}
        placeholder={t("authority_source_url")}
        className="w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm" />

      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" checked={ping} onChange={(e) => setPing(e.target.checked)} />
        {lang === "ar"
          ? "إرسال إشعار IndexNow للرابط المنشور على نطاق معروف فقط (اختياري؛ لا يثبت الفهرسة ولا يخص موقع العميل)."
          : lang === "ku"
          ? "ئاگادارکردنەوەی IndexNow بۆ بەستەری Maaroof (ئارەزوومەندانە؛ بەڵگەی ئیندێکس نییە)."
          : "Optionally submit an IndexNow notification for the Maaroof-hosted URL only; this does not prove indexing or submit your own domain."}
      </label>

      <button disabled={loading || !brand.trim()} onClick={generate}
        className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-primary to-accent px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-40">
        {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
        {t("authority_generate")}
      </button>

      {err && <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">{err}</div>}

      {pack && (
        <div className="space-y-3 text-xs">
          {/* Step-by-step guide */}
          <StepGuide lang={lang as Lang} />

          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
            <div className="text-[10px] font-semibold uppercase text-muted-foreground">{t("authority_public_url")}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <a href={pack.public_url} target="_blank" rel="noreferrer" className="break-all font-mono text-primary hover:underline">{pack.public_url}</a>
              <button onClick={() => copy(pack.public_url)} className="rounded border border-border px-2 py-0.5 text-[10px]"><Copy className="inline size-3" /> {t("authority_copy")}</button>
              <a href={pack.public_url} target="_blank" rel="noreferrer" className="rounded border border-border px-2 py-0.5 text-[10px]"><ExternalLink className="inline size-3" /> {t("authority_open")}</a>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">{t("authority_public_hint")}</p>
            <p className="mt-2 rounded border border-primary/20 bg-background/50 p-2 text-[11px] text-foreground/85">{lang === "ar" ? "ضع هذا الرابط في خانة الرابط (Bio) في إنستغرام أو X أو لينكدإن أو تيك توك — لا تحتاج مبرمجاً ولا موقعاً." : lang === "ku" ? "ئەم لینکە لە بەشی Bio ی ئینستاگرام، X، لینکدئین یان تیکتۆک دابنێ — پێویستت بە پرۆگرامەر نییە." : "Paste this link in your bio on Instagram, X, LinkedIn or TikTok — no developer or website needed."}</p>

            {/* Share buttons */}
            <div className="mt-3">
              <div className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold text-foreground"><Share2 className="size-3.5" /> {lang === "ar" ? "شارك الرابط الآن" : lang === "ku" ? "ئێستا لینکەکە بڵاو بکەرەوە" : "Share now"}</div>
              <ShareButtons url={pack.public_url} text={`${brand}${kw ? " — " + kw : ""}`} lang={lang as Lang} />
            </div>

            {pack.ping && (
              <div className="mt-2 text-[11px]">IndexNow: <span className={pack.ping.ok ? "text-green-600" : "text-amber-600"}>{pack.ping.ok ? "ok" : `status ${pack.ping.status}`}</span></div>
            )}
          </div>

          {pack.summary && <div className="rounded-lg border border-border bg-background/40 p-3">{pack.summary}</div>}

          <details className="rounded-lg border border-border bg-background/30 p-2">
            <summary className="cursor-pointer text-[11px] font-semibold text-foreground">{lang === "ar" ? "لأصحاب المواقع: الأكواد التقنية (اختياري)" : lang === "ku" ? "بۆ خاوەن ماڵپەڕ: کۆدە تەکنیکییەکان (ئارەزوومەندانە)" : "For website owners: technical code (optional)"}</summary>
            <div className="mt-2 space-y-3">
          <div className="rounded-lg border border-border bg-background/40 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">{t("authority_jsonld")}</span>
              <button onClick={() => copy(JSON.stringify(pack.json_ld, null, 2))} className="text-[10px] underline text-primary">{t("authority_copy")}</button>
            </div>
            <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded bg-background/60 p-2 text-[10px] font-mono text-foreground/80">{JSON.stringify(pack.json_ld, null, 2)}</pre>
          </div>

          <div className="rounded-lg border border-border bg-background/40 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">{t("authority_markdown")}</span>
              <button onClick={() => copy(pack.markdown)} className="text-[10px] underline text-primary">{t("authority_copy")}</button>
            </div>
            <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded bg-background/60 p-2 text-[11px] text-foreground/90">{pack.markdown}</pre>
          </div>

            </div>
          </details>

          {/* Export buttons */}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => downloadFile(`${pack.slug || "brand"}-authority.json`, JSON.stringify({ summary: pack.summary, json_ld: pack.json_ld, markdown: pack.markdown, public_url: pack.public_url }, null, 2), "application/json")} className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary"><Download className="size-3" /> JSON</button>
            <button onClick={() => downloadFile(`${pack.slug || "brand"}-authority.md`, String(pack.markdown || ""), "text/markdown")} className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary"><Download className="size-3" /> Markdown</button>
          </div>

          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 text-[11px] text-amber-700 dark:text-amber-400">
            {t("authority_wikidata_hint")}
          </div>
        </div>
      )}
    </div>
  );
}

function StepGuide({ lang }: { lang: Lang }) {
  const { t } = useI18n();
  const steps = lang === "ar"
    ? [lang === "ar" ? "افتح رابط معروف العام" : t("auto.open_the_link_to_ensure_your"), t("auto.copy_it"), t("auto.share_it_on_your_platforms_and"), lang === "ar" ? "راجع الطلبات المصنفة حسب User-Agent في متتبع الانتشار" : t("auto.monitor_visits_in_the_spread_tracker")]
    : lang === "ku"
    ? ["بەستەری گشتیی Maaroof بکەرەوە", "کۆپی بکە", "لە کەناڵە پەسەندکراوەکانی براند بڵاوی بکەرەوە", "داواکارییە هاوتاکانی User-Agent لە شوێنپێکەر ببینە"]
    : ["Open the public Maaroof URL", "Copy it", "Share it on approved brand channels", "Review requests classified by User-Agent in the Reach Tracker"];
  return (
    <div className="rounded-lg border border-accent/30 bg-accent/5 p-3">
      <div className="mb-2 text-[11px] font-semibold text-accent">{lang === "ar" ? "ماذا تفعل بالرابط؟" : lang === "ku" ? "چی بکەی بەو لینکە؟" : "What to do with the link"}</div>
      <ol className="space-y-1 ps-4 text-[11px] text-foreground/85">
        {steps.map((s, i) => (
          <li key={i} className="list-decimal"><span>{s}</span></li>
        ))}
      </ol>
    </div>
  );
}

function ShareButtons({ url, text, lang }: { url: string; text: string; lang: Lang }) {
  const enc = encodeURIComponent;
  const msg = (lang === "ar"
    ? `تعرّف على علامتنا: ${text}\n`
    : lang === "ku"
    ? `براندەکەمان بناسە: ${text}\n`
    : `Learn about us: ${text}\n`);
  const targets: { label: string; href: string; color: string }[] = [
    { label: "WhatsApp", color: "bg-[#25D366] text-white", href: `https://wa.me/?text=${enc(msg + url)}` },
    { label: "X", color: "bg-black text-white", href: `https://twitter.com/intent/tweet?text=${enc(msg)}&url=${enc(url)}` },
    { label: "LinkedIn", color: "bg-[#0A66C2] text-white", href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}` },
    { label: "Facebook", color: "bg-[#1877F2] text-white", href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}` },
    { label: "Telegram", color: "bg-[#229ED9] text-white", href: `https://t.me/share/url?url=${enc(url)}&text=${enc(msg)}` },
  ];
  return (
    <div className="flex flex-wrap gap-1.5">
      {targets.map((t) => (
        <a key={t.label} href={t.href} target="_blank" rel="noreferrer noopener" className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold transition hover:opacity-90 ${t.color}`}>
          <Share2 className="size-3" /> {t.label}
        </a>
      ))}
    </div>
  );
}

function downloadFile(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function safeDecode(s: string): string {
  try { return decodeURIComponent(s); } catch { return s; }
}

function PropagationPanel({ workspaceId = null }: { workspaceId?: string | null }) {
  const { t, lang } = useI18n();
  const [data, setData] = useState<{ packs: any[]; hits: any[]; stats?: { total: number; known: number; first: string | null; last: string | null } } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const headers: Record<string, string> = {};
        if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
        const params = new URLSearchParams();
        if (workspaceId) params.set("workspace_id", workspaceId);
        const res = await apiFetch(`/api/brand-authority${params.size ? `?${params.toString()}` : ""}`, { headers });
        const j = await res.json().catch(() => ({ packs: [], hits: [] }));
        if (!cancelled) setData(j);
      } catch { if (!cancelled) setData({ packs: [], hits: [] }); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [refreshKey, workspaceId]);

  const hits = data?.hits || [];
  const byBot = useMemo(() => {
    const m = new Map<string, { count: number; last: string; paths: Set<string> }>();
    for (const h of hits) {
      const key = h.bot_name || "Unknown";
      const cur = m.get(key) || { count: 0, last: h.hit_at, paths: new Set() };
      cur.count++;
      if (h.hit_at > cur.last) cur.last = h.hit_at;
      if (h.path) cur.paths.add(h.path);
      m.set(key, cur);
    }
    return m;
  }, [hits]);
  const knownCount = Array.from(byBot.keys()).filter((k) => k !== "Unknown" && k !== "Browser").length;
  const catLabel = (b: string | null | undefined): string => {
    const c: BotCategory = botCategory(b);
    const L: Record<BotCategory, [string, string, string]> = {
      ai: ["زاحف ذكاء اصطناعي", "AI crawler", "کرۆلەری AI"],
      search: ["محرك بحث", "Search engine", "بزوێنەری گەڕان"],
      seo: ["أداة تحليل ويب", "Web-analysis tool", "ئامرازی شیکاری وێب"],
      preview: ["معاينة رابط (تطبيق مراسلة/تواصل)", "Link preview (messaging/social)", "پێشبینینی لینک"],
      browser: ["زيارة مباشرة (متصفح)", "Direct visit (browser)", "سەردانی ڕاستەوخۆ (وێبگەڕ)"],
      unclassified: ["غير مصنّف", "Unclassified", "پۆلێن نەکراو"],
    };
    const v = L[c];
    return lang === "ar" ? v[0] : lang === "ku" ? v[2] : v[1];
  };
  const [shown, setShown] = useState(100);
  const stats = data?.stats;
  const buildExport = (): ExportPayload => ({
    title: lang === "ar" ? "سجل زيارات الزواحف الكامل" : lang === "ku" ? "تۆماری تەواوی سەردانی کرۆلەرەکان" : "Full crawler visit log",
    subtitle: stats?.first ? `${new Date(stats.first).toLocaleDateString()} → ${new Date(stats.last || stats.first).toLocaleDateString()}` : undefined,
    sections: [
      { heading: lang === "ar" ? "الملخص" : "Summary", kind: "kv", rows: [
        [lang === "ar" ? "إجمالي الزيارات" : "Total visits", String(stats?.total ?? hits.length)],
        [lang === "ar" ? "زيارات زواحف معروفة" : "Known crawler visits", String(stats?.known ?? 0)],
        [lang === "ar" ? "أول زيارة" : "First visit", stats?.first ? new Date(stats.first).toLocaleString() : "-"],
        [lang === "ar" ? "آخر زيارة" : "Last visit", stats?.last ? new Date(stats.last).toLocaleString() : "-"],
      ] } as any,
      { heading: lang === "ar" ? "حسب الزاحف" : "By crawler", kind: "table", table: {
        columns: ["Bot", "Type", "Count", "Last"],
        data: Array.from(byBot.entries()).map(([b, i]) => [botName(b), catLabel(b), i.count, new Date(i.last).toLocaleString()]),
      } } as any,
      { heading: lang === "ar" ? "كل الزيارات" : "All visits", kind: "table", table: {
        columns: ["Date", "Bot", "Type", "Page", "Source", "User-Agent"],
        data: hits.map((h) => [new Date(h.hit_at).toLocaleString(), botName(h.bot_name || "Unknown"), catLabel(h.bot_name), safeDecode(h.path || ""), packLabel(h.brand_slug), h.user_agent || ""]),
      } } as any,
    ],
  });

  function packLabel(slug: string | null | undefined): string {
    if (slug) return safeDecode(slug);
    return lang === "ar" ? "الملف المعتمد الأساسي" : lang === "ku" ? "پرۆفایلی سەرەکی" : "Verified main profile";
  }

  const exportCsv = () => {
    const rows = [["bot_name", "type", "source", "user_agent", "path", "hit_at"]];
    for (const h of hits) rows.push([h.bot_name || "Unknown", catLabel(h.bot_name), packLabel(h.brand_slug), h.user_agent || "", h.path || "", h.hit_at || ""]);
    const csv = "\uFEFF" + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    downloadFile(`crawler-hits-${new Date().toISOString().slice(0, 10)}.csv`, csv, "text/csv");
  };

  const botName = (b: string): string => {
    const map: Record<string, string> = {
      GPTBot: "ChatGPT (OpenAI)", "ChatGPT-User": "ChatGPT browsing",
      "OAI-SearchBot": "OpenAI Search", PerplexityBot: "Perplexity",
      "Perplexity-User": "Perplexity user", ClaudeBot: "Claude (Anthropic)",
      "Google-Extended": "Google AI (Gemini)", Googlebot: "Google Search",
      Bingbot: "Bing / Copilot", "Applebot-Extended": "Apple AI",
      Applebot: "Apple Search", "Meta-ExternalAgent": "Meta AI",
      YouBot: "You.com", Bytespider: "ByteDance/Doubao",
      "MistralAI-User": "Mistral", DeepSeekBot: "DeepSeek", DuckAssistBot: "DuckDuckGo AI",
      SemrushBot: "Semrush", AhrefsBot: "Ahrefs", YandexBot: "Yandex",
    };
    if (b === "Browser") return lang === "ar" ? "متصفح" : "Browser";
    if (b === "Unknown") return lang === "ar" ? "غير مصنّف" : "Unclassified";
    return map[b] ? `${b} — ${map[b]}` : b;
  };

  if (loading) return <div className="text-xs text-muted-foreground"><Loader2 className="inline size-3 animate-spin" /></div>;

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-accent/30 bg-accent/5 p-3 text-xs">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="font-semibold text-foreground">{t("propagation_title")}</div>
            <p className="mt-1 text-muted-foreground">{t("propagation_desc")}</p>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setRefreshKey((k) => k + 1)} className="rounded-full border border-border bg-background/60 px-2 py-1 text-[11px]"><RefreshCw className="inline size-3" /> {lang === "ar" ? "تحديث" : lang === "ku" ? "نوێکردن" : "Refresh"}</button>
            {hits.length > 0 && (
              <>
                <button onClick={exportCsv} className="rounded-full border border-primary/40 bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary"><Download className="inline size-3" /> CSV</button>
                <ExportButtons size="xs" toolKey="brand_boost" build={buildExport} />
              </>
            )}
          </div>
        </div>
      </div>

      {byBot.size === 0 ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-xs">
          <div className="font-semibold text-amber-700 dark:text-amber-400">{lang === "ar" ? "لم تصل أي عناكب بعد" : lang === "ku" ? "هێشتا هیچ کرۆلەرێک نەهاتووە" : "No crawlers have arrived yet"}</div>
          <p className="mt-1 text-muted-foreground">{t("propagation_empty")}</p>
          <ol className="mt-2 list-decimal ps-5 text-foreground/80 space-y-1">
            <li>{lang === "ar" ? "اذهب إلى تبويب «محرك السلطة» وولّد الرابط العام." : lang === "ku" ? "بڕۆ بۆ تابی «بزوێنەری دەسەڵات» و لینکی گشتی دروست بکە." : "Go to the Authority Engine tab and generate the public URL."}</li>
            <li>{lang === "ar" ? "شارك الرابط على منصاتك (واتساب، إكس، لينكدإن…)." : lang === "ku" ? "لینکەکە لە پلاتفۆڕمەکانت بڵاو بکەرەوە." : "Share the URL on your platforms (WhatsApp, X, LinkedIn…)."}</li>
            <li>{lang === "ar" ? "انتظر من ساعات إلى أيام حتى تكتشفه العناكب وتظهر هنا." : lang === "ku" ? "چاوەڕێ بکە چەند کاتژمێر بۆ ڕۆژێک." : "Wait hours to days for crawlers to discover it."}</li>
          </ol>
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-2 text-xs text-green-700 dark:text-green-400">
            {t("propagation_visible_to").replace("{n}", String(knownCount))}
          </div>
          <p className="text-[11px] text-muted-foreground">{lang === "ar" ? "يشمل السجل: زواحف الذكاء الاصطناعي، محركات البحث، أدوات تحليل الويب، معاينات الروابط، والزيارات المباشرة عبر المتصفح. «الملف المعتمد الأساسي» يعني أن الزيارة قرأت رابطك المعتمد مباشرة قبل ربطها بحزمة تعزيز." : "Log includes AI crawlers, search engines, web-analysis tools, link previews and direct browser visits. “Verified main profile” means the visit read your official link directly, not a specific boost pack."}</p>
          <div className="overflow-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead className="bg-background/60 text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5 text-start">{t("propagation_bot")}</th>
                  <th className="px-2 py-1.5 text-start">{t("propagation_last")}</th>
                  <th className="px-2 py-1.5 text-start">{t("propagation_count")}</th>
                  <th className="px-2 py-1.5 text-start">{t("propagation_paths")}</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(byBot.entries()).sort((a, b) => b[1].count - a[1].count).map(([bot, info]) => (
                  <tr key={bot} className="border-t border-border">
                    <td className="px-2 py-1.5 font-semibold">{botName(bot)}</td>
                    <td className="px-2 py-1.5 text-muted-foreground">{new Date(info.last).toLocaleString()}</td>
                    <td className="px-2 py-1.5">{info.count}</td>
                    <td className="px-2 py-1.5 text-[10px] text-muted-foreground">{Array.from(info.paths).slice(0, 2).join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-xs font-semibold text-foreground">
            {lang === "ar" ? "كل الزيارات بالتفصيل" : lang === "ku" ? "هەموو سەردانەکان بە وردی" : "All visits in detail"} ({hits.length})
          </div>
          <div className="max-h-96 overflow-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-background text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5 text-start">{lang === "ar" ? "التاريخ والوقت" : lang === "ku" ? "بەروار و کات" : "Date & time"}</th>
                  <th className="px-2 py-1.5 text-start">{t("propagation_bot")}</th>
                  <th className="px-2 py-1.5 text-start">{lang === "ar" ? "الصفحة" : lang === "ku" ? "پەڕە" : "Page"}</th>
                  <th className="px-2 py-1.5 text-start">User-Agent</th>
                </tr>
              </thead>
              <tbody>
                {hits.slice(0, shown).map((h, i) => (
                  <tr key={i} className="border-t border-border align-top">
                    <td className="whitespace-nowrap px-2 py-1.5">{new Date(h.hit_at).toLocaleString()}</td>
                    <td className="px-2 py-1.5"><div className="font-semibold">{botName(h.bot_name || "Unknown")}</div><div className="text-[10px] text-muted-foreground">{catLabel(h.bot_name)} · {packLabel(h.brand_slug)}</div></td>
                    <td className="break-all px-2 py-1.5 text-[10px]">{safeDecode(h.path || "")}</td>
                    <td className="break-all px-2 py-1.5 text-[10px] text-muted-foreground">{h.user_agent || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hits.length > shown && (
            <button onClick={() => setShown((s) => s + 100)} className="rounded-full border border-border px-3 py-1 text-[11px]">
              {lang === "ar" ? "عرض المزيد" : lang === "ku" ? "زیاتر" : "Show more"}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function LogsPanel({ workspaceId = null }: { workspaceId?: string | null }) {
  const { lang } = useI18n();
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) { setLoading(false); return; }
      setLoading(true);
      let operationQuery = supabase
        .from("brand_operations")
        .select("id, created_at, operation_type, brand_name, status, duration_ms, charged_units, request_meta, result_meta")
        .eq("user_id", user.id);
      operationQuery = workspaceId
        ? operationQuery.eq("workspace_id", workspaceId)
        : operationQuery.is("workspace_id", null);
      const { data: operations, error: operationsError } = await operationQuery
        .order("created_at", { ascending: false }).limit(100);

      if (!operationsError && operations) {
        const ids = operations.map((operation) => operation.id);
        let eventCounts = new Map<string, number>();
        if (ids.length) {
          let eventQuery = supabase.from("brand_operation_events")
            .select("operation_id").eq("user_id", user.id).in("operation_id", ids);
          eventQuery = workspaceId
            ? eventQuery.eq("workspace_id", workspaceId)
            : eventQuery.is("workspace_id", null);
          const { data: events } = await eventQuery;
          eventCounts = (events || []).reduce((map, event) => {
            map.set(event.operation_id, (map.get(event.operation_id) || 0) + 1);
            return map;
          }, new Map<string, number>());
        }
        const unifiedRows = operations.map((operation) => ({
          created_at: operation.created_at,
          action: operation.operation_type,
          operation_id: operation.id,
          metadata: {
            brand: operation.brand_name,
            status: operation.status,
            duration_ms: operation.duration_ms,
            charged_units: operation.charged_units,
            event_count: eventCounts.get(operation.id) || 0,
            ...(operation.request_meta as any || {}),
            ...(operation.result_meta as any || {}),
          },
        }));
        if (!cancelled) { setRows(unifiedRows); setLoading(false); }
        return;
      }

      // Compatibility fallback for historical rows while the new ledger migration is rolling out.
      let legacyQuery = supabase
        .from("activity_log")
        .select("created_at, action, metadata")
        .eq("user_id", user.id)
        .in("action", ["brand_boost", "brand_authority"]);
      legacyQuery = workspaceId
        ? legacyQuery.eq("metadata->>workspace_id", workspaceId)
        : legacyQuery.is("metadata->>workspace_id", null);
      const { data: legacyRows } = await legacyQuery.order("created_at", { ascending: false }).limit(100);
      if (!cancelled) { setRows(legacyRows || []); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [user?.id, refreshKey, workspaceId]);

  const exportCsv = () => {
    const head = [["created_at", "action", "brand", "details"]];
    for (const r of rows) {
      const m = r.metadata || {};
      head.push([r.created_at, r.action, String(m.brand || ""), JSON.stringify(m)]);
    }
    const csv = head.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    downloadFile(`activity-log-${new Date().toISOString().slice(0, 10)}.csv`, csv, "text/csv");
  };

  const actionLabel = (a: string) =>
    a === "brand_boost"
      ? (lang === "ar" ? "تشغيل تعزيز" : lang === "ku" ? "بەهێزکردن" : "Run boost")
      : a === "brand_authority"
      ? (lang === "ar" ? "توليد ونشر بطاقة العلامة" : lang === "ku" ? "دروستکردن و بڵاوکردنەوەی کارتی براند" : "Generate/publish brand card")
      : a === "visibility_probe"
      ? (lang === "ar" ? "اختبار المحركات" : lang === "ku" ? "تاقیکردنەوەی بزوێنەرەکان" : "Engine probe")
      : a === "visibility_analysis"
      ? (lang === "ar" ? "تحليل الظهور التقديري" : lang === "ku" ? "شیکاری دەرکەوتنی خەمڵێنراو" : "Estimated visibility analysis")
      : a;

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-accent/30 bg-accent/5 p-3 text-xs">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="font-semibold text-foreground">{lang === "ar" ? "سجل العمليات" : lang === "ku" ? "تۆماری کردارەکان" : "Activity log"}</div>
            <p className="mt-1 text-muted-foreground">{lang === "ar" ? "آخر 100 عملية على أداة تعزيز العلامة (تشغيل + توليد بطاقات سلطة)." : lang === "ku" ? "دوایین ١٠٠ کردار." : "Latest 100 actions on the Brand Boost tool."}</p>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setRefreshKey((k) => k + 1)} className="rounded-full border border-border bg-background/60 px-2 py-1 text-[11px]"><RefreshCw className="inline size-3" /> {lang === "ar" ? "تحديث" : lang === "ku" ? "نوێکردن" : "Refresh"}</button>
            {rows.length > 0 && (
              <button onClick={exportCsv} className="rounded-full border border-primary/40 bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary"><Download className="inline size-3" /> CSV</button>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-xs text-muted-foreground"><Loader2 className="inline size-3 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-background/40 p-4 text-center text-xs text-muted-foreground">{lang === "ar" ? "لا توجد عمليات بعد." : lang === "ku" ? "هیچ کردارێک نییە." : "No activity yet."}</div>
      ) : (
        <div className="overflow-auto rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead className="bg-background/60 text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5 text-start">{lang === "ar" ? "التاريخ" : lang === "ku" ? "بەروار" : "Date"}</th>
                <th className="px-2 py-1.5 text-start">{lang === "ar" ? "النوع" : lang === "ku" ? "جۆر" : "Type"}</th>
                <th className="px-2 py-1.5 text-start">{lang === "ar" ? "العلامة" : lang === "ku" ? "براند" : "Brand"}</th>
                <th className="px-2 py-1.5 text-start">{lang === "ar" ? "تفاصيل" : lang === "ku" ? "وردەکاری" : "Details"}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const m = r.metadata || {};
                return (
                  <tr key={i} className="border-t border-border">
                    <td className="px-2 py-1.5 text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="px-2 py-1.5 font-semibold">{actionLabel(r.action)}</td>
                    <td className="px-2 py-1.5">{String(m.brand || "—")}</td>
                    <td className="px-2 py-1.5 text-[10px] text-muted-foreground">
                      {m.slug ? `slug: ${m.slug}` : ""}
                      {m.status ? ` · ${m.status}` : ""}
                      {m.charged_units != null ? ` · ${m.charged_units} units` : m.cost ? ` · ${m.cost} credits` : ""}
                      {m.duration_ms != null ? ` · ${m.duration_ms} ms` : ""}
                      {m.visibility_percent != null ? ` · visibility ${m.visibility_percent}%` : ""}
                      {m.event_count ? ` · ${m.event_count} events` : ""}
                      {m.operation_id ? <span className="block font-mono">{String(m.operation_id).slice(0, 12)}…</span> : ""}
                      {m.pinged ? " · pinged" : ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


