import { useEffect, useMemo, useState } from "react";
import { Megaphone, Loader2, Plus, Power, Trash2, Sparkles, Radar, Copy, ExternalLink, Share2, History, Download, RefreshCw, Eye, Info, Search, Mail, Rocket } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { VisibilityPanel } from "@/components/AIVisibility";
import { SmartResearch } from "@/components/SmartResearch";
import { CompanyOutreach } from "@/components/CompanyOutreach";
import { ExportButtons } from "@/components/ExportButtons";
import { ToolLangSelect } from "@/components/ToolLangSelect";
import { ToolHelpBanner } from "@/components/ToolHelpBanner";
import { GeoScopeSelector, getEffectiveScope } from "@/components/GeoScopeSelector";
import type { ExportPayload } from "@/lib/exports";
import { useI18n, type Lang } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { HandoffMenu } from "@/components/HandoffMenu";
import { apiFetch } from "@/lib/api-client";
import { ENGINES } from "@/components/engine-logos";

const PLATFORMS = ["chatgpt", "gemini", "claude", "perplexity", "copilot", "grok", "mistral", "deepseek", "kimi"];
const MAX_PLATFORMS_PER_RUN = 5;

export function BrandBoostAgent() {
  const { t, lang } = useI18n();
  const [outLang, setOutLang] = useState<Lang>(lang);
  const { user, profile } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [brand, setBrand] = useState((profile as any)?.brand_name || "");
  const [kw, setKw] = useState((profile as any)?.brand_keywords || "");
  const [freq, setFreq] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [sel, setSel] = useState<string[]>(PLATFORMS.slice(0, MAX_PLATFORMS_PER_RUN));
  const [approved, setApproved] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [report, setReport] = useState<any>(null);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState<string>("visibility");

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("brand_boost_jobs").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setJobs(data || []);
  };
  useEffect(() => { load(); }, [user]);

  const create = async () => {
    if (!user || !brand.trim() || !approved) return;
    const platforms = sel.slice(0, MAX_PLATFORMS_PER_RUN);
    await supabase.from("brand_boost_jobs").insert({
      user_id: user.id, brand_name: brand, brand_keywords: kw,
      platforms, frequency: freq, approved: true, active: true,
    });
    await load();
  };

  const toggle = async (id: string, active: boolean) => {
    await supabase.from("brand_boost_jobs").update({ active: !active }).eq("id", id);
    await load();
  };

  const remove = async (id: string) => {
    if (!confirm(t("boost_delete_confirm"))) return;
    await supabase.from("brand_boost_jobs").delete().eq("id", id);
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
        body: JSON.stringify({ brand_name: j.brand_name, brand_keywords: j.brand_keywords, platforms: (j.platforms || []).slice(0, MAX_PLATFORMS_PER_RUN), lang: outLang, scope: getEffectiveScope(profile, "brand") }),
      });
      const text = await res.text();
      let data: any = {};
      try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text.slice(0, 200) || `http_${res.status}` }; }
      if (!res.ok) throw new Error(data.error || `http_${res.status}`);
      setReport(data);
      await supabase.from("brand_boost_runs").insert({ job_id: j.id, user_id: user!.id, status: "done", report: data });
      await supabase.from("brand_boost_jobs").update({ last_run_at: new Date().toISOString() }).eq("id", j.id);
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
          <TabsTrigger value="visibility" className="text-xs"><Eye className="me-1 inline size-3.5" />{t("ag_vis_title")}</TabsTrigger>
          <TabsTrigger value="research" className="text-xs"><Search className="me-1 inline size-3.5" />{t("research_title")}</TabsTrigger>
          <TabsTrigger value="outreach" className="text-xs"><Mail className="me-1 inline size-3.5" />{t("outreach_title")}</TabsTrigger>
          <TabsTrigger value="run" className="text-xs"><Megaphone className="me-1 inline size-3.5" />{t("boost_tab_run")}</TabsTrigger>
          <TabsTrigger value="authority" className="text-xs"><Rocket className="me-1 inline size-3.5" />{lang === "ar" ? "بثّ للذكاء" : lang === "ku" ? "بڵاوکردنەوە بۆ AI" : "Broadcast"}</TabsTrigger>
          <TabsTrigger value="propagation" className="text-xs"><Radar className="me-1 inline size-3.5" />{t("boost_tab_propagation")}</TabsTrigger>
          <TabsTrigger value="logs" className="text-xs"><History className="me-1 inline size-3.5" />{lang === "ar" ? "السجل" : lang === "ku" ? "تۆمار" : "Log"}</TabsTrigger>
        </TabsList>

        <TabsContent value="visibility" className="mt-4">
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground mb-3">
            {lang === "ar"
              ? "فحص ظهور علامتك في 9 محركات ذكاء (يستهلك 1 تحليل). اسم العلامة مطلوب — الكلمات المفتاحية اختيارية."
              : lang === "ku"
              ? "پشکنینی دەرکەوتنی براندەکەت لە 8 بزوێنەری AI (1 شیکاری). ناوی براند پێویستە، وشە کلیلیەکان ئارەزوومەندانە."
              : "Probe your brand visibility across 8 AI engines (1 analysis). Brand required, keywords optional."}
          </div>
          <VisibilityPanel brand={brand} keywords={kw} lang={outLang} embedded toolKey="brand" />
        </TabsContent>

        <TabsContent value="research" className="mt-4">
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground mb-3">
            {lang === "ar"
              ? "ابحث عن شركات/علامات/أسواق وحوّل النتائج إلى تغذية للظهور والتعزيز."
              : lang === "ku"
              ? "گەڕانی کۆمپانیا/براند/بازاڕ و گۆڕینیان بۆ خواردنی AI."
              : "Research companies/brands/markets and feed insights back into your boost plan."}
          </div>
          <SmartResearch />
        </TabsContent>

        <TabsContent value="outreach" className="mt-4">
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground mb-3">
            {lang === "ar"
              ? "ولّد رسائل تواصل وبروفايلات شركات لاستهداف الشركاء والعملاء بصوت علامتك."
              : lang === "ku"
              ? "نامەی پەیوەندی و پرۆفایلی کۆمپانیا دروست بکە."
              : "Generate outreach emails and company briefs in your brand voice."}
          </div>
          <CompanyOutreach />
        </TabsContent>




        <TabsContent value="run" className="mt-4">
      <div className="grid gap-2 sm:grid-cols-2">
        <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder={t("boost_brand")}
          className="rounded-lg border border-border bg-background/60 px-3 py-2 text-sm" />
        <input value={kw} onChange={(e) => setKw(e.target.value)} placeholder={t("boost_keywords")}
          className="rounded-lg border border-border bg-background/60 px-3 py-2 text-sm" />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {PLATFORMS.map((p) => (
          <button key={p} onClick={() => setSel(sel.includes(p) ? sel.filter(x => x !== p) : [...sel, p].slice(0, MAX_PLATFORMS_PER_RUN))}
            className={`rounded-full border px-2.5 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-40 ${sel.includes(p) ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground"}`}
            disabled={!sel.includes(p) && sel.length >= MAX_PLATFORMS_PER_RUN}>
            {p}
          </button>
        ))}
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
                <button onClick={() => toggle(j.id, j.active)} className="sm:ms-auto inline-flex items-center gap-1 text-xs">
                  <Power className="size-3" /> {j.active ? t("boost_pause") : t("boost_resume")}
                </button>
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
      {report && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-end">
            <ExportButtons build={() => buildExport(jobs[0] || { brand_name: brand })} />
          </div>
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
                            <span className="inline-flex cursor-help items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-600">
                              <Info className="size-2.5" /> proxy
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs text-[11px]">
                            {lang === "ar"
                              ? "لا يوجد API عام مباشر لهذه المنصة، فاستخدمنا نموذجاً مكافئاً من نفس العائلة لمحاكاة جوابها."
                              : lang === "ku"
                              ? "API ڕاستەوخۆی گشتی بۆ ئەم پلاتفۆڕمە نییە، مۆدێلی هاوشێوەمان بەکارهێنا."
                              : "No direct public API for this platform — we used an equivalent model from the same family to simulate its answer."}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <span className="rounded-full border border-green-500/40 bg-green-500/10 px-2 py-0.5 text-[10px] text-green-600">{lang === "ar" ? "مباشر" : "direct"}</span>
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
                ? "افتح تبويب «بثّ للذكاء» لإنشاء صفحة عامة مفهرسة + ping IndexNow (Bing/Copilot/Perplexity/ChatGPT) + روابط مشاركة جاهزة لكل المنصات."
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
        </div>
      )}
        </TabsContent>

        <TabsContent value="authority" className="mt-4">
          <AuthorityPanel brand={brand} kw={kw} lang={outLang} />
        </TabsContent>

        <TabsContent value="propagation" className="mt-4">
          <PropagationPanel />
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          <LogsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AuthorityPanel({ brand, kw, lang }: { brand: string; kw: string; lang: Lang }) {
  const { t } = useI18n();
  const [sourceUrl, setSourceUrl] = useState("");
  const [ping, setPing] = useState(true);
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
        body: JSON.stringify({ brand_name: brand, brand_keywords: kw, source_url: sourceUrl, ping, lang }),
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
          {lang === "ar" ? "بثّ حقيقي لمحركات الذكاء — كيف يعمل؟"
            : lang === "ku" ? "بڵاوکردنەوەی ڕاستەقینە بۆ AI — چۆن کاردەکات؟"
            : "Real broadcast to AI engines — how it works"}
        </div>
        <ol className="mt-2 ms-4 list-decimal space-y-1 text-muted-foreground">
          <li>{lang === "ar" ? "ننشر بطاقة علامتك على رابط عام مفهرَس (HTML + JSON-LD)." : lang === "ku" ? "بەستەرێکی گشتی + JSON-LD دروست دەکەین." : "We publish your brand card to an indexable public URL (HTML + JSON-LD)."}</li>
          <li>{lang === "ar" ? "نُبلّغ IndexNow → Bing/Yandex فوراً، وهذا هو نفس فهرس Copilot و ChatGPT Search و Perplexity." : lang === "ku" ? "IndexNow → Bing فۆراً، هەمان فهرس بۆ Copilot/ChatGPT/Perplexity." : "We ping IndexNow → Bing/Yandex — the same index Copilot, ChatGPT Search, and Perplexity read."}</li>
          <li>{lang === "ar" ? "نضيف الرابط لـ sitemap.xml لـ Google/Gemini." : lang === "ku" ? "بەستەرەکە لە sitemap بۆ Google/Gemini." : "We add the URL to sitemap.xml for Google/Gemini."}</li>
          <li>{lang === "ar" ? "تنسخ وتشارك على X/LinkedIn/Reddit ليصل لـ Grok و Claude و باقي الزواحف." : lang === "ku" ? "بەستەرەکە لە X/LinkedIn هاوبەش بکە بۆ Grok و Claude." : "Share the link on X/LinkedIn/Reddit so Grok, Claude, and other crawlers pick it up."}</li>
          <li>{lang === "ar" ? "راقب من زارها فعلاً في تبويب «متتبع الانتشار»." : lang === "ku" ? "زیارەتکارەکان لە تابی «شوێنپێ» ببینە." : "Watch which AI crawlers actually visited in the Propagation tab."}</li>
        </ol>
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
        {t("authority_ping")}
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
  const steps = lang === "ar"
    ? ["افتح الرابط للتأكد من ظهور بطاقتك", "انسخه", "شاركه على منصاتك ومواقع موثوقة", "راقب الزيارات في تبويب «متتبع الانتشار»"]
    : lang === "ku"
    ? ["لینکەکە بکەرەوە بۆ پشتڕاستکردنەوە", "کۆپی بکە", "بڵاوی بکەرەوە لە پلاتفۆڕمەکانت", "سەردانەکان ببینە لە تابی «شوێنپێ»"]
    : ["Open the URL to verify your card renders", "Copy it", "Share it on your sites and trusted platforms", "Watch hits in the Propagation Tracker tab"];
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

function PropagationPanel() {
  const { t, lang } = useI18n();
  const [data, setData] = useState<{ packs: any[]; hits: any[] } | null>(null);
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
        const res = await apiFetch("/api/brand-authority", { headers });
        const j = await res.json().catch(() => ({ packs: [], hits: [] }));
        if (!cancelled) setData(j);
      } catch { if (!cancelled) setData({ packs: [], hits: [] }); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [refreshKey]);

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
  const knownCount = Array.from(byBot.keys()).filter((k) => k !== "Unknown").length;

  const exportCsv = () => {
    const rows = [["bot_name", "user_agent", "path", "hit_at"]];
    for (const h of hits) rows.push([h.bot_name || "Unknown", h.user_agent || "", h.path || "", h.hit_at || ""]);
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
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
    };
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
              <button onClick={exportCsv} className="rounded-full border border-primary/40 bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary"><Download className="inline size-3" /> CSV</button>
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
        </>
      )}
    </div>
  );
}

function LogsPanel() {
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
      const { data } = await supabase
        .from("activity_log")
        .select("created_at, action, metadata")
        .eq("user_id", user.id)
        .in("action", ["brand_boost", "brand_authority"])
        .order("created_at", { ascending: false })
        .limit(100);
      if (!cancelled) { setRows(data || []); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [user, refreshKey]);

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
      ? (lang === "ar" ? "محرك السلطة" : lang === "ku" ? "بزوێنەری دەسەڵات" : "Authority")
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
                    <td className="px-2 py-1.5 text-[10px] text-muted-foreground">{m.slug ? `slug: ${m.slug}` : ""}{m.cost ? ` · ${m.cost} credits` : ""}{m.pinged ? " · pinged" : ""}</td>
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


