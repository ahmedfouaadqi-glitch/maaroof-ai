import { useEffect, useState } from "react";
import { MciReuseBadge } from "@/components/MciReuseBadge";
import { EngineResponseFlow } from "@/components/EngineResponseFlow";
import { fromResearch } from "@/lib/engine-card-adapters";
import { ToolResultExport } from "@/components/ToolResultExport";
import { ToolHistory } from "@/components/ToolHistory";
import { Search, Loader2, ExternalLink, Sparkles, Radio, Zap, TrendingUp, Building2, Globe, Database, ShieldCheck, AlertTriangle } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";

import { ToolHelpBanner } from "@/components/ToolHelpBanner";
import { GeoScopeSelector, getEffectiveScope } from "@/components/GeoScopeSelector";
import { HandoffMenu } from "@/components/HandoffMenu";
import { consumeHandoff } from "@/lib/tool-handoff";
import { apiFetch } from "@/lib/api-client";
import { ProactiveNextStep } from "@/components/ProactiveNextStep";
import { summarizeInput, summarizeOutput } from "@/lib/cognition-summary";
import { SourcesList } from "@/components/SourcesList";


const CHANNEL_OPTIONS = [
  "website", "linkedin", "twitter", "instagram", "facebook", "youtube", "telegram", "whatsapp", "email",
] as const;

type SearchMode = "web" | "company";

function initialOptionsFromSchema(schema: any): string {
  const properties = schema?.properties && typeof schema.properties === "object" ? schema.properties : {};
  const required = new Set(Array.isArray(schema?.required) ? schema.required.map(String) : []);
  const result: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(properties) as Array<[string, any]>) {
    if (!required.has(key) && field?.default === undefined && field?.examples === undefined) continue;
    if (field?.default !== undefined) result[key] = field.default;
    else if (Array.isArray(field?.examples) && field.examples.length) result[key] = field.examples[0];
    else if (Array.isArray(field?.enum) && field.enum.length) result[key] = field.enum[0];
    else if (field?.type === "integer" || field?.type === "number") result[key] = Number(field?.minimum ?? 1);
    else if (field?.type === "boolean") result[key] = false;
    else if (field?.type === "array") result[key] = [];
    else if (field?.type === "object") result[key] = {};
    else result[key] = "";
  }
  return JSON.stringify(result, null, 2);
}

function schemaSummary(schema: any, lang: string): string[] {
  const properties = schema?.properties && typeof schema.properties === "object" ? schema.properties : {};
  const required = new Set(Array.isArray(schema?.required) ? schema.required.map(String) : []);
  return Object.entries(properties).map(([key, field]: [string, any]) =>
    key + (required.has(key) ? " *" : "") + " — " + String(field?.type || "value") +
    (Array.isArray(field?.enum) ? " (" + field.enum.map(String).join(", ") + ")" : "") +
    (field?.description ? ": " + String(field.description).slice(0, 120) : "")
  );
}

export function SmartResearch() {
  const { t, lang } = useI18n();
  const { profile, session } = useAuth();
  const specialty = (profile as any)?.specialty || "";
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<SearchMode>("web");
  const [loading, setLoading] = useState(false);
  const [out, setOut] = useState<any>(null);
  const [err, setErr] = useState("");
  const [includeChannels, setIncludeChannels] = useState(false);
  const [channelTypes, setChannelTypes] = useState<string[]>(["website", "linkedin", "instagram", "email"]);
  const [requestSpecializedDiscovery, setRequestSpecializedDiscovery] = useState(false);
  const [selectedSpecializedId, setSelectedSpecializedId] = useState("");
  const [specializedOptionsJson, setSpecializedOptionsJson] = useState("{}");
  const [confirmSpecializedPaidRun, setConfirmSpecializedPaidRun] = useState(false);
  const [specializedBusy, setSpecializedBusy] = useState(false);
  const [specializedError, setSpecializedError] = useState("");
  const [specializedResult, setSpecializedResult] = useState<any>(null);
  const [specializedRequestId, setSpecializedRequestId] = useState("");
  const phrase = (ar: string, en: string, ku: string) => lang === "en" ? en : lang === "ku" ? ku : ar;

  const toggleChannel = (c: string) =>
    setChannelTypes((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));

  useEffect(() => {
    const onReuse = (e: Event) => {
      const txt = (e as CustomEvent).detail?.text;
      if (txt) { setQ(String(txt).slice(0, 500)); setOut(null); setErr(""); }
    };
    window.addEventListener("geo:reuse-research", onReuse);
    const pending = consumeHandoff("research");
    if (pending) { setQ(pending.slice(0, 500)); setOut(null); setErr(""); }
    return () => window.removeEventListener("geo:reuse-research", onReuse);
  }, []);

  const run = async () => {
    if (!q.trim()) return;
    setLoading(true); setErr(""); setOut(null);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
      const res = await apiFetch("/api/research", {
        method: "POST", headers,
        body: JSON.stringify({
          query: q, lang, scope: getEffectiveScope(profile, "research"),
          mode,
          include_channels: includeChannels || mode === "company",
          channel_types: (includeChannels || mode === "company") ? channelTypes : undefined,
          request_specialized_discovery: requestSpecializedDiscovery,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "failed");
      setOut(j);
    } catch (e: any) { setErr(e?.message || "failed"); }
    finally { setLoading(false); }
  };

  const runSpecializedSource = async () => {
    const candidate = (out?.specialized_source_options?.candidates || []).find((item: any) => item.candidate_id === selectedSpecializedId);
    if (!candidate || !candidate.executable) return;
    if (!confirmSpecializedPaidRun) {
      setSpecializedError(phrase("أكد موافقتك على تشغيل المصدر المدفوع أولًا.", "Confirm the paid source run first.", "سەرەتا ڕەزامەندی بە کارپێکردنی سەرچاوەی پارەدان پشتڕاست بکە."));
      return;
    }
    let options: any;
    try {
      options = JSON.parse(specializedOptionsJson);
      if (!options || typeof options !== "object" || Array.isArray(options)) throw new Error("options_object_required");
    } catch {
      setSpecializedError(phrase("مدخلات الخيارات ليست كائن JSON صالحًا.", "Options must be a valid JSON object.", "هەڵبژاردەکان دەبێت کۆمەڵەیەکی JSONی دروست بن."));
      return;
    }
    const requestId = specializedRequestId || (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : "");
    if (!requestId) {
      setSpecializedError(phrase("تعذّر إنشاء معرّف آمن للطلب. أعد تحميل الصفحة.", "Could not create a safe request ID. Reload the page.", "نەتوانرا ناسنامەی داواکاری دروست بکرێت؛ پەڕەکە نوێ بکەرەوە."));
      return;
    }
    setSpecializedRequestId(requestId);
    setSpecializedBusy(true);
    setSpecializedError("");
    setSpecializedResult(null);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.access_token) headers.Authorization = "Bearer " + session.access_token;
      const res = await apiFetch("/api/research", {
        method: "POST", headers,
        body: JSON.stringify({
          query: q, lang, scope: getEffectiveScope(profile, "research"), mode,
          specialized_execution: {
            candidate_id: candidate.candidate_id,
            options,
            confirm_paid_run: true,
            max_credits: candidate.estimated_credits,
            request_id: requestId,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        const message = json.message || json.error || "specialized_source_failed";
        if (json.retry_with_same_request_id) setSpecializedRequestId(requestId);
        throw new Error(String(message));
      }
      setSpecializedResult(json.specialized_execution);
      setSpecializedRequestId("");
      setConfirmSpecializedPaidRun(false);
    } catch (error: any) {
      setSpecializedError(String(error?.message || "specialized_source_failed"));
    } finally {
      setSpecializedBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card/70 p-5 backdrop-blur">
      <h2 className="font-display text-lg font-semibold flex items-center gap-2">
        <Search className="size-5 text-primary" /> {t("research_title")}
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">{t("research_desc")}</p>
      <ToolHelpBanner toolKey="research" />
      <div className="mt-3"><GeoScopeSelector compact toolKey="research" /></div>
      {specialty && (
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] text-primary">
          <Sparkles className="size-3" /> {t("specialty_active")}: <b>{specialty}</b>
        </div>
      )}

      {/* Mode toggle: web vs company */}
      <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl border border-border bg-background/40 p-1">
        <button onClick={() => { setMode("web"); setOut(null); }}
          className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition ${mode === "web" ? "bg-gradient-to-r from-primary to-accent text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}>
          <Globe className="size-3.5" /> {t("research_mode_web") || t("auto.general_web_search")}
        </button>
        <button onClick={() => { setMode("company"); setOut(null); setIncludeChannels(true); }}
          className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition ${mode === "company" ? "bg-gradient-to-r from-primary to-accent text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}>
          <Building2 className="size-3.5" /> {t("research_mode_company") || t("auto.search_for_a_company")}
        </button>
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder={mode === "company" ? (t("research_company_ph") || t("auto.company_or_brand_name")) : t("research_ph")}
          className="flex-1 rounded-lg border border-border bg-background/60 px-3 py-2 text-sm" />
        <button disabled={loading} onClick={run}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-primary to-accent px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          {t("research_run")}
        </button>
      </div>

      <div className="mt-3 rounded-lg border border-border/70 bg-background/40 p-3">
        <label className="flex items-center gap-2 text-xs font-semibold">
          <input type="checkbox" checked={requestSpecializedDiscovery} onChange={(e) => { setRequestSpecializedDiscovery(e.target.checked); setSpecializedError(""); setSpecializedResult(null); }} />
          <Database className="size-3.5 text-accent" />
          {phrase("اكتشف مصادر بيانات متخصصة (الاكتشاف فقط مجاني)", "Discover specialized data sources (discovery only is free)", "سەرچاوەی داتای تایبەت بدۆزەوە (دۆزینەوە بەخۆڕاییە)")}
        </label>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {phrase("لن يجري تشغيل أي مصدر متخصص أثناء البحث العادي. سيُعرض الخيار والتكلفة أولًا، ثم يلزم تأكيد منفصل.", "No specialized source runs during normal research. Options and estimated cost appear first; execution requires separate confirmation.", "هیچ سەرچاوەیەکی تایبەت لە گەڕانی ئاساییدا کار ناکات؛ سەرەتا هەڵبژاردە و تێچوو پیشان دەدرێت و پەسەندکردنی جیاواز دەوێت.")}
        </p>
        <div className="mt-3 border-t border-border/70 pt-3">
        <label className="flex items-center gap-2 text-xs font-semibold">
          <input type="checkbox" checked={includeChannels} onChange={(e) => setIncludeChannels(e.target.checked)} />
          <Radio className="size-3.5 text-accent" /> {t("research_include_channels")}
        </label>
        {includeChannels && (
          <>
            <div className="mt-2 text-[11px] text-muted-foreground">{t("research_channels_hint")}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {CHANNEL_OPTIONS.map((c) => {
                const active = channelTypes.includes(c);
                return (
                  <button key={c} type="button" onClick={() => toggleChannel(c)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${active ? "border-primary bg-primary/15 text-primary" : "border-border bg-background/50 text-muted-foreground hover:bg-background"}`}>
                    {t(`ch_${c}`)}
                  </button>
                );
              })}
            </div>
          </>
        )}
        </div>
      </div>

      {err && <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">{err}</div>}
      {out && <MciReuseBadge mci={out.mci} path="/api/research" onRefresh={run} />}
      {out && <div className="mb-2 flex justify-end"><ToolResultExport toolKey="research" result={out} /></div>}

      {out?.source_plan && (
        <div className="mt-3 rounded-xl border border-border bg-background/50 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold"><ShieldCheck className="size-4 text-primary" />{phrase("منهجية جمع المصادر", "Source collection method", "شێوازی کۆکردنەوەی سەرچاوە")}</div>
          <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
            <div className="rounded-lg bg-muted/40 p-2">{phrase("المصدر المختار", "Selected route", "ڕێڕەوی هەڵبژێردراو")}: <b>{out.source_plan.retrieved_source_profile || out.source_plan.route}</b></div>
            <div className="rounded-lg bg-muted/40 p-2">{phrase("النتائج المستلمة", "Results returned", "ئەنجامە وەرگیراوەکان")}: <b>{out.source_plan.sample_size}</b></div>
          </div>
          {out.source_plan.limitation && <p className="mt-2 text-[11px] leading-5 text-muted-foreground">{out.source_plan.limitation}</p>}
        </div>
      )}

      {requestSpecializedDiscovery && out?.specialized_source_options && (
        <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold"><Database className="size-4" />{phrase("مصادر متخصصة مقترحة", "Suggested specialized sources", "سەرچاوە تایبەتە پێشنیارکراوەکان")}</div>
          <p className="mt-1 text-[11px] text-muted-foreground">{phrase("عرض الاكتشاف لا ينفذ المصدر. لا يظهر التشغيل إلا عندما تتوفر تكلفة مؤكدة وعقد خيارات وشروط الجهة.", "Discovery does not execute the source. Execution is shown only when a quote, option contract, and organization terms are available.", "دۆزینەوە سەرچاوەکە کارپێناکات؛ تەنها کاتێک تێچوو و گرێبەستی هەڵبژاردە و مەرجەکان بەردەست بن کارپێکردن پیشان دەدرێت.")}</p>
          {out.specialized_source_options.limitation && <p className="mt-2 text-[11px] text-muted-foreground">{out.specialized_source_options.limitation}</p>}
          <div className="mt-3 space-y-2">
            {(out.specialized_source_options.candidates || []).map((candidate: any) => (
              <div key={candidate.candidate_id} className="rounded-lg border border-border bg-background p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold">{candidate.label}</div>
                    {candidate.description && <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{candidate.description}</p>}
                  </div>
                  <div className="shrink-0 rounded-md bg-muted px-2 py-1 text-[11px]">{candidate.estimated_credits == null ? phrase("التكلفة غير معروفة", "Cost unknown", "تێچوو نادیارە") : phrase("التكلفة المقدرة", "Estimated credits", "تێچووی خەمڵێنراو") + ": " + candidate.estimated_credits}</div>
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">{candidate.terms_configured ? phrase("شروط الجهة مؤكدة في إعدادات النظام", "Organization terms are configured", "مەرجەکانی دامەزراوە لە ڕێکخستنەکان پشتڕاست کراون") : phrase("يتطلب إعداد الشروط من مسؤول النظام", "Administrator must configure accepted terms", "بەڕێوەبەری سیستەم دەبێت مەرجە پەسەندکراوەکان ڕێکبخات")}</p>
                {candidate.executable && (
                  <div className="mt-2">
                    <button type="button" onClick={() => { setSelectedSpecializedId(candidate.candidate_id); setSpecializedOptionsJson(initialOptionsFromSchema(candidate.options_schema)); setConfirmSpecializedPaidRun(false); setSpecializedError(""); setSpecializedResult(null); setSpecializedRequestId(""); }}
                      className="rounded-lg border border-primary/40 px-3 py-1.5 text-[11px] font-semibold text-primary">
                      {selectedSpecializedId === candidate.candidate_id ? phrase("المصدر المحدد", "Selected source", "سەرچاوەی هەڵبژێردراو") : phrase("اختيار المصدر", "Select source", "سەرچاوە هەڵبژێرە")}
                    </button>
                  </div>
                )}
                {!candidate.executable && <p className="mt-2 text-[10px] text-muted-foreground">{phrase("غير قابل للتشغيل الآن: التكلفة أو مخطط الخيارات أو شروط الجهة غير متاحة.", "Not executable yet: cost, input schema, or organization terms are unavailable.", "ئێستا ناکرێت کارپێبکرێت: تێچوو، گرێبەستی هەڵبژاردە، یان مەرجەکانی دامەزراوە بەردەست نین.")}</p>}
                {selectedSpecializedId === candidate.candidate_id && candidate.executable && (
                  <div className="mt-3 border-t border-border pt-3">
                    <div className="text-[11px] font-medium">{phrase("خيارات المصدر (JSON)", "Source options (JSON)", "هەڵبژاردەکانی سەرچاوە (JSON)")}</div>
                    <div className="mt-1 space-y-1">
                      {schemaSummary(candidate.options_schema, lang).map((line: string) => <div key={line} className="text-[10px] leading-4 text-muted-foreground">{line}</div>)}
                    </div>
                    <textarea value={specializedOptionsJson} onChange={(e) => setSpecializedOptionsJson(e.target.value)} rows={5} spellCheck={false}
                      className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs" />
                    <label className="mt-2 flex items-start gap-2 text-[11px] leading-5">
                      <input type="checkbox" checked={confirmSpecializedPaidRun} onChange={(e) => setConfirmSpecializedPaidRun(e.target.checked)} className="mt-1" />
                      <span>{phrase("أوافق على تنفيذ هذا المصدر بتكلفة تقديرية ", "I approve running this source at an estimated cost of ", "ڕازیم بە کارپێکردنی ئەم سەرچاوەیە بە تێچووی خەمڵێنراوی ") + candidate.estimated_credits + phrase(" رصيد. قد تختلف التكلفة الفعلية المبلّغ عنها؛ سيظهر أي تجاوز بوضوح.", " credits. Reported final cost may differ; any overrun will be disclosed.", " خاڵ. تێچووی کۆتایی ڕەنگە جیاواز بێت؛ هەر زیادەڕۆییەک ڕوون دەکرێتەوە.")}</span>
                    </label>
                    <button type="button" disabled={!confirmSpecializedPaidRun || specializedBusy} onClick={runSpecializedSource}
                      className="mt-2 inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">
                      {specializedBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Database className="size-3.5" />}
                      {phrase("تنفيذ المصدر المحدد", "Run selected source", "سەرچاوەی هەڵبژێردراو کارپێبکە")}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {specializedError && <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{specializedError}</div>}
      {specializedResult && (
        <div className="mt-3 rounded-xl border border-primary/25 bg-primary/5 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-semibold">{specializedResult.label}</div>
            <div className="text-[11px] text-muted-foreground">{phrase("النتائج", "Results", "ئەنجامەکان")}: {specializedResult.result_count} · {phrase("التكلفة المقدرة", "Estimate", "خەمڵاندن")}: {specializedResult.estimated_credits} · {phrase("التكلفة المبلّغ عنها", "Reported", "ڕاپۆرتکراوە")}: {specializedResult.reported_credits ?? phrase("غير متاحة", "Unavailable", "بەردەست نییە")}</div>
          </div>
          {specializedResult.budget_overrun_detected && <p className="mt-2 rounded-md bg-amber-500/10 p-2 text-[11px] text-amber-800">{phrase("أبلغ المصدر عن تكلفة أعلى من التقدير؛ يلزم مراجعة الفاتورة قبل تشغيل جديد.", "The source reported a cost above the estimate; review the bill before another run.", "سەرچاوەکە تێچوویەکی زیاتر لە خەمڵاندن ڕاپۆرت کرد؛ پێش کارپێکردنی نوێ پێداچوونەوە بکە.")}</p>}
          <p className="mt-2 text-[11px] text-muted-foreground">{specializedResult.limitation}</p>
          <pre className="mt-2 max-h-80 overflow-auto rounded-lg bg-background p-3 text-[11px] whitespace-pre-wrap break-words">{JSON.stringify(specializedResult.result, null, 2)}</pre>
        </div>
      )}
      <ToolHistory toolKey="research" />
      {out && (
        <div className="mt-4 space-y-3" id="research-result">
          {out.sge_summary && (
            <div className="rounded-lg border border-accent/40 bg-gradient-to-br from-accent/10 to-primary/5 p-3">
              <div className="mb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-accent font-bold">
                <Zap className="size-3.5" /> {t("research_sge")}
                <span title={t("research_sge_tooltip")} className="cursor-help text-muted-foreground">ⓘ</span>
              </div>
              <div className="text-sm leading-relaxed whitespace-pre-wrap">{out.sge_summary}</div>
            </div>
          )}
          {out.answer && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm whitespace-pre-wrap leading-relaxed">
              <div className="mb-1 text-[10px] uppercase tracking-widest text-primary font-semibold">{t("research_answer")}</div>
              {out.answer}
            </div>
          )}
          {out.key_findings?.length > 0 && (
            <div className="rounded-lg border border-accent/30 bg-accent/5 p-3 text-sm">
              <div className="mb-1 text-xs font-semibold text-accent">{t("research_findings")}</div>
              <ul className="ms-5 list-disc space-y-1">
                {out.key_findings.map((k: string, i: number) => <li key={i}>{k}</li>)}
              </ul>
            </div>
          )}
          {out.visibility_opportunities?.length > 0 && (
            <div className="rounded-lg border border-success/40 bg-success/5 p-3 text-sm">
              <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-success">
                <TrendingUp className="size-3.5" /> {t("research_opportunities")}
                <span title={t("research_opportunities_tooltip")} className="cursor-help text-muted-foreground">ⓘ</span>
              </div>
              <ul className="ms-5 list-decimal space-y-1">
                {out.visibility_opportunities.map((k: string, i: number) => <li key={i}>{k}</li>)}
              </ul>
            </div>
          )}
          {/* Chain to other tools */}
          {(out.sge_summary || out.answer) && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  const txt = `${q}\n\n${out.sge_summary || out.answer}`;
                  window.dispatchEvent(new CustomEvent("geo:reuse-suggest", { detail: { text: txt } }));
                  document.getElementById("suggest")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary hover:bg-primary/20">
                <Sparkles className="size-3" /> {t("research_send_suggest")}
              </button>
              <button
                onClick={() => {
                  const txt = out.answer || out.sge_summary;
                  window.dispatchEvent(new CustomEvent("geo:reuse-analyze", { detail: { text: txt } }));
                  document.getElementById("analyze")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-[11px] font-semibold text-accent hover:bg-accent/20">
                <Zap className="size-3" /> {t("research_send_analyze")}
              </button>
            </div>
          )}
          {includeChannels && (
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <Radio className="size-3.5 text-accent" /> {t("research_channels")} ({out.channels?.length || 0})
              </div>
              {out.channels?.length ? (
                <ul className="grid gap-1.5 sm:grid-cols-2">
                  {out.channels.map((c: any, i: number) => (
                    <li key={i} className="rounded-lg border border-border bg-background/40 p-2 text-xs">
                      <div className="text-[10px] font-semibold uppercase text-accent">{t(`ch_${c.type}`) || c.type}</div>
                      <a href={c.url} target="_blank" rel="noreferrer" className="mt-0.5 inline-flex items-center gap-1 font-medium text-primary hover:underline break-all">
                        {c.label} <ExternalLink className="size-3 shrink-0" />
                      </a>
                      {c.source && <div className="mt-0.5 text-[10px] text-muted-foreground">{c.source}</div>}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="rounded-lg border border-border bg-background/40 p-2 text-xs text-muted-foreground">{t("research_no_channels")}</div>
              )}
            </div>
          )}
          {out.sources?.length > 0 && (
            <div>
              <div className="mb-2 text-xs font-semibold text-muted-foreground">{t("research_sources")} ({out.sources.length})</div>
              <ul className="space-y-1.5">
                {out.sources.map((s: any, i: number) => (
                  <li key={i} className="rounded-lg border border-border bg-background/40 p-2 text-xs">
                    <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
                      [{i + 1}] {s.title} <ExternalLink className="size-3" />
                    </a>
                    {s.domain && <div className="mt-0.5 text-[10px] text-muted-foreground">{s.domain}</div>}
                    {s.description && <div className="mt-1 text-foreground/80">{s.description.slice(0, 200)}</div>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {fromResearch(out).length > 0 && <EngineResponseFlow answers={fromResearch(out)} compact />}
          <SourcesList sources={out.sources} sourcesUsed={out.sources_used} rarityScore={out.rarity_score} uniquenessNotes={out.uniqueness_notes} evidenceMissing={out.evidence_missing} />
          <HandoffMenu source="research" getText={() => `${q}\n\n${out.sge_summary || out.answer || ""}`} />

          <ProactiveNextStep
            toolKey="research"
            inputSummary={summarizeInput({ query: q, mode })}
            outputSummary={summarizeOutput(out)}
            handoffText={`${q}\n\n${out.sge_summary || out.answer || ""}`}
          />
        </div>
      )}
    </div>
  );
}
