import { useEffect, useRef, useState } from "react";
import { useI18n, type Lang } from "@/lib/i18n";
import { ToolLangSelect } from "./ToolLangSelect";
import { useAuth } from "@/lib/auth";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Loader2, Upload, Image as ImageIcon, Type, Copy, Check, Lock, Linkedin, Facebook, Instagram, AlertTriangle, TrendingUp, Lightbulb, Gauge, Video as VideoIcon } from "lucide-react";
import { ExportButtons } from "./ExportButtons";
import { ToolHelpBanner } from "./ToolHelpBanner";
import { GeoScopeSelector, getEffectiveScope } from "./GeoScopeSelector";
import type { ExportPayload } from "@/lib/exports";

type Mode = "text" | "image" | "video";
type Platform = "linkedin" | "facebook" | "tiktok" | "instagram";
type Length = "short" | "medium" | "long";
type ContentType = "post" | "article";
type Goal = "promotional" | "educational" | "news" | "brand_story" | "personal" | "engagement";
type Result = {
  variants: { platform: string; content: string; geo_score: number; word_count?: number }[];
  overall_geo_score: number;
  expected_reach: "low" | "medium" | "high";
  expected_reach_reason: string;
  factual_warnings: string[];
  improvement_tips: string[];
  detected_goal?: string;
};

const PLATFORMS: { id: Platform; icon: React.ReactNode; key: string }[] = [
  { id: "linkedin", icon: <Linkedin className="size-3.5" />, key: "platform_linkedin" },
  { id: "facebook", icon: <Facebook className="size-3.5" />, key: "platform_facebook" },
  { id: "tiktok", icon: <span className="text-[10px] font-bold">TT</span>, key: "platform_tiktok" },
  { id: "instagram", icon: <Instagram className="size-3.5" />, key: "platform_instagram" },
];

export function PostSuggester({
  initialSourceText,
  compact,
}: {
  initialSourceText?: string;
  compact?: boolean;
}) {
  const { t, lang } = useI18n();
  let auth: ReturnType<typeof useAuth> | null = null;
  try { auth = useAuth(); } catch {}
  const user = auth?.user;
  const [mode, setMode] = useState<Mode>("text");
  const [desc, setDesc] = useState("");
  const [imageData, setImageData] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [videoBusy, setVideoBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [post, setPost] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGate, setShowGate] = useState(false);
  const [showLimit, setShowLimit] = useState(false);
  const [platforms, setPlatforms] = useState<Platform[]>(["linkedin"]);
  const [length, setLength] = useState<Length>("medium");
  const [contentType, setContentType] = useState<ContentType>("post");
  const [goal, setGoal] = useState<Goal>("promotional");
  const [count, setCount] = useState<number>(1);
  const [outLang, setOutLang] = useState<Lang>(lang);
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onReuse = (e: Event) => {
      const detail = (e as CustomEvent).detail as { text?: string } | undefined;
      if (detail?.text) {
        setMode("text");
        setDesc(detail.text);
        setPost(null);
        setResult(null);
        setError(null);
      }
    };
    window.addEventListener("geo:reuse-suggest", onReuse);
    return () => window.removeEventListener("geo:reuse-suggest", onReuse);
  }, []);


  const togglePlatform = (p: Platform) =>
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  const handleFile = (f: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setImageData(reader.result as string);
      setImageMime(f.type);
    };
    reader.readAsDataURL(f);
  };

  const handleVideoFile = async (f: File) => {
    setError(null);
    setVideoBusy(true);
    setImageData(null);
    setImageMime(null);
    setVideoUrl(null);
    setVideoDuration(null);
    try {
      const url = URL.createObjectURL(f);
      const v = document.createElement("video");
      v.preload = "metadata";
      v.muted = true;
      v.playsInline = true;
      v.src = url;
      await new Promise<void>((resolve, reject) => {
        v.onloadedmetadata = () => resolve();
        v.onerror = () => reject(new Error("video_load_failed"));
      });
      const duration = v.duration;
      if (!isFinite(duration) || duration > 60.5) {
        URL.revokeObjectURL(url);
        setError(t("suggest_video_too_long"));
        return;
      }
      // seek to middle and capture frame
      await new Promise<void>((resolve, reject) => {
        v.onseeked = () => resolve();
        v.onerror = () => reject(new Error("seek_failed"));
        try { v.currentTime = Math.min(duration / 2, Math.max(0, duration - 0.1)); } catch { resolve(); }
      });
      const w = v.videoWidth || 640;
      const h = v.videoHeight || 360;
      const scale = Math.min(1, 1024 / Math.max(w, h));
      const cw = Math.max(1, Math.round(w * scale));
      const ch = Math.max(1, Math.round(h * scale));
      const canvas = document.createElement("canvas");
      canvas.width = cw; canvas.height = ch;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.drawImage(v, 0, 0, cw, ch);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      setImageData(dataUrl);
      setImageMime("image/jpeg");
      setVideoUrl(url);
      setVideoDuration(duration);
    } catch (e: any) {
      setError(e?.message || "video_failed");
    } finally {
      setVideoBusy(false);
    }
  };

  const submit = async () => {
    setError(null); setPost(null); setResult(null); setShowGate(false); setShowLimit(false);
    if (!user) { setShowGate(true); return; }
    setLoading(true);
    try {
      const body: any = { lang: outLang, platforms, length, contentType, goal, count };
      if (initialSourceText) body.sourceText = initialSourceText;
      else if (mode === "text") body.description = desc;
      else if (mode === "video" && imageData) {
        body.imageBase64 = imageData;
        body.imageMime = imageMime;
        const dur = videoDuration ? Math.round(videoDuration) : null;
        const userNote = desc.trim();
        const base = dur
          ? `محتوى مأخوذ من فيديو مدّته ${dur} ثانية. اعتمد على الإطار المرفق وصف ما يظهر فيه بصرياً ثم استخدم ذلك لصياغة المنشور. لا تخترع أحداثاً أو حواراً غير ظاهر.`
          : "محتوى من فيديو قصير - اعتمد على الإطار المرفق فقط.";
        body.description = userNote ? `${base}\n\nملاحظات المستخدم: ${userNote}` : base;
      }
      else if (imageData) {
        body.imageBase64 = imageData;
        body.imageMime = imageMime;
        const userNote = desc.trim();
        if (userNote) body.description = userNote;
      }
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const session = (await supabase.auth.getSession()).data.session;
      if (session) headers.Authorization = `Bearer ${session.access_token}`;
      (body as any).scope = getEffectiveScope(auth?.profile, "suggest");
      const r = await fetch("/api/suggest", { method: "POST", headers, body: JSON.stringify(body) });
      const data = await r.json();
      if (r.status === 401) { setShowGate(true); return; }
      if (r.status === 402 && data.error === "limit") { setShowLimit(true); return; }
      if (!r.ok) throw new Error(data?.error || "Failed");
      setPost(data.post);
      if (data.variants) setResult(data);
      if (auth) auth.refreshProfile();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const canSubmit =
    !!initialSourceText ||
    (mode === "text" ? desc.trim().length > 0 : !!imageData && !videoBusy);

  const copy = async () => {
    if (!post) return;
    await navigator.clipboard.writeText(post);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-border bg-card/70 ${compact ? "p-5" : "p-6 md:p-8"} shadow-[var(--shadow-elevated)] backdrop-blur-xl glow-border`}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent to-transparent opacity-70" />
      <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
        <Sparkles className="size-4 text-accent" />
        <span className="font-mono uppercase tracking-widest text-xs">{t("suggest_title")}</span>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">{t("suggest_desc")}</p>
      <ToolHelpBanner toolKey="suggest" />
      <div className="mt-3"><GeoScopeSelector compact toolKey="suggest" /></div>

      <div className="mb-3 flex justify-end">
        <ToolLangSelect value={outLang} onChange={setOutLang} />
      </div>

      {!initialSourceText && (
        <div className="mb-4 flex w-full flex-wrap gap-1 rounded-2xl border border-border bg-background/60 p-1 sm:inline-flex sm:w-auto">
          <button
            onClick={() => setMode("text")}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition sm:flex-none ${
              mode === "text" ? "bg-primary/20 text-primary" : "text-muted-foreground"
            }`}
          >
            <Type className="size-3.5" /> {t("suggest_tab_text")}
          </button>
          <button
            onClick={() => setMode("image")}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition sm:flex-none ${
              mode === "image" ? "bg-primary/20 text-primary" : "text-muted-foreground"
            }`}
          >
            <ImageIcon className="size-3.5" /> {t("suggest_tab_image")}
          </button>
          <button
            onClick={() => setMode("video")}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition sm:flex-none ${
              mode === "video" ? "bg-primary/20 text-primary" : "text-muted-foreground"
            }`}
          >
            <VideoIcon className="size-3.5" /> {t("suggest_tab_video")}
          </button>
        </div>
      )}

      {!initialSourceText && mode === "text" && (
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder={t("suggest_placeholder")}
          rows={4}
          className="w-full resize-none rounded-xl border border-border bg-background/60 p-4 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
      )}

      {!initialSourceText && mode === "image" && (
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-background/40 p-8 text-sm text-muted-foreground transition hover:border-accent/50 hover:text-foreground"
          >
            {imageData ? (
              <img src={imageData} alt="upload" className="max-h-40 rounded-lg object-contain" />
            ) : (
              <>
                <Upload className="size-6" />
                <span>{t("suggest_upload")}</span>
              </>
            )}
          </button>
        </div>
      )}

      {!initialSourceText && mode === "video" && (
        <div>
          <input
            ref={videoRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleVideoFile(e.target.files[0])}
          />
          <button
            onClick={() => videoRef.current?.click()}
            disabled={videoBusy}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-background/40 p-6 text-sm text-muted-foreground transition hover:border-accent/50 hover:text-foreground disabled:opacity-60"
          >
            {videoUrl ? (
              <div className="flex w-full flex-col items-center gap-2">
                <video src={videoUrl} controls className="max-h-56 w-full max-w-md rounded-lg bg-black" />
                {videoDuration != null && (
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {Math.round(videoDuration)}s · {imageData ? "✓" : "…"}
                  </span>
                )}
              </div>
            ) : videoBusy ? (
              <>
                <Loader2 className="size-6 animate-spin" />
                <span>{t("suggest_video_processing")}</span>
              </>
            ) : (
              <>
                <VideoIcon className="size-6" />
                <span>{t("suggest_upload_video")}</span>
                <span className="text-[11px] text-muted-foreground/80">{t("suggest_video_hint")}</span>
              </>
            )}
          </button>
        </div>
      )}

      {!initialSourceText && (mode === "image" || mode === "video") && (
        <div className="mt-3">
          <label className="mb-1.5 block text-xs font-semibold text-foreground">{t("suggest_media_desc_label")}</label>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder={t("suggest_media_desc_placeholder")}
            rows={3}
            className="w-full resize-none rounded-xl border border-border bg-background/60 p-3 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
          />
        </div>
      )}

      <div className="mt-4 space-y-3 rounded-xl border border-border/60 bg-background/40 p-3">
        <div>
          <div className="mb-1.5 text-xs font-semibold text-foreground">{t("suggest_goal")}</div>
          <div className="flex flex-wrap gap-1.5">
            {(["promotional", "educational", "news", "brand_story", "personal", "engagement"] as Goal[]).map((g) => (
              <button key={g} onClick={() => setGoal(g)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${goal === g ? "border-primary bg-primary/15 text-primary" : "border-border bg-background/60 text-muted-foreground hover:text-foreground"}`}>
                {t(`goal_${g}` as any)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1.5 text-xs font-semibold text-foreground">{t("suggest_type")}</div>
          <div className="inline-flex rounded-full border border-border bg-background/60 p-1">
            {(["post", "article"] as ContentType[]).map((c) => (
              <button key={c} onClick={() => setContentType(c)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${contentType === c ? "bg-primary/20 text-primary" : "text-muted-foreground"}`}>
                {t(c === "post" ? "suggest_type_post" : "suggest_type_article")}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1.5 text-xs font-semibold text-foreground">{t("suggest_length")}</div>
          <div className="inline-flex rounded-full border border-border bg-background/60 p-1">
            {(["short", "medium", "long"] as Length[]).map((l) => (
              <button key={l} onClick={() => setLength(l)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${length === l ? "bg-primary/20 text-primary" : "text-muted-foreground"}`}>
                {t(`suggest_length_${l}` as any)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1.5 text-xs font-semibold text-foreground">{t("suggest_count")}</div>
          <div className="mb-2 text-[11px] text-muted-foreground">{t("suggest_count_hint")}</div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={1}
              max={10}
              value={count}
              onChange={(e) => setCount(parseInt(e.target.value, 10))}
              className="flex-1 accent-primary"
            />
            <span className="min-w-[2rem] rounded-md border border-border bg-background/60 px-2 py-1 text-center text-xs font-mono text-foreground">{count}</span>
          </div>
        </div>

        <div>
          <div className="mb-1.5 text-xs font-semibold text-foreground">{t("suggest_platforms")}</div>
          <div className="mb-2 text-[11px] text-muted-foreground">{t("suggest_platforms_hint")}</div>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((p) => {
              const on = platforms.includes(p.id);
              return (
                <button key={p.id} onClick={() => togglePlatform(p.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${on ? "border-primary bg-primary/15 text-primary" : "border-border bg-background/60 text-muted-foreground hover:text-foreground"}`}>
                  <span className={`grid size-4 place-items-center rounded-sm border ${on ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                    {on && <Check className="size-3" />}
                  </span>
                  {p.icon}
                  {t(p.key as any)}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-5 flex justify-end">
        <button
          onClick={submit}
          disabled={loading || !canSubmit}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-accent to-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {loading ? t("suggest_running") : t("suggest_cta")}
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {showGate && (
        <div className="mt-4 flex flex-col items-start gap-3 rounded-xl border border-primary/40 bg-primary/10 p-4">
          <div className="flex items-center gap-2"><Lock className="size-5 text-primary" /><div className="font-semibold">{t("suggest_login_required")}</div></div>
          <p className="text-sm text-muted-foreground">{t("suggest_login_desc")}</p>
          <Link to="/auth" search={{ mode: "signup", redirect: "/" }} className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent px-5 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)]">
            {t("trial_signup")}
          </Link>
        </div>
      )}

      {showLimit && (
        <div className="mt-4 flex flex-col items-start gap-3 rounded-xl border border-accent/40 bg-accent/10 p-4">
          <div className="font-semibold">{t("limit_reached_title")}</div>
          <p className="text-sm text-muted-foreground">{t("limit_reached_desc")}</p>
          <Link to="/pricing" className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-accent to-primary px-5 py-2 text-sm font-semibold text-primary-foreground">
            {t("limit_view_plans")}
          </Link>
        </div>
      )}

      {result && (
        <div className="mt-5 space-y-4">
          <div className="flex justify-end">
            <ExportButtons size="xs" build={(): ExportPayload => ({
              title: t("export_suggestions_set_title"),
              subtitle: `GEO ${result.overall_geo_score}/100 · ${t(`reach_${result.expected_reach}` as any)}`,
              sections: [
                { kind: "kv", heading: t("result_geo_score"), rows: [
                  [t("result_geo_score"), `${result.overall_geo_score}/100`],
                  [t("result_expected_reach"), t(`reach_${result.expected_reach}` as any)],
                  ["Reason", result.expected_reach_reason],
                ]},
                { kind: "table", heading: t("export_suggestions_set_title"), table: {
                  columns: [t("col_platform"), t("col_geo"), t("col_content")],
                  data: result.variants.map(v => [v.platform, `${v.geo_score}/100`, v.content]),
                }},
                ...(result.factual_warnings?.length ? [{ kind: "list" as const, heading: t("result_warnings"), list: result.factual_warnings }] : []),
                ...(result.improvement_tips?.length ? [{ kind: "list" as const, heading: t("result_tips"), list: result.improvement_tips }] : []),
              ],
            })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
              <div className="mb-1 flex items-center justify-between gap-2 text-[11px] uppercase tracking-widest text-primary">
                <span className="inline-flex items-center gap-1.5"><Gauge className="size-3.5" /> {t("result_geo_score")}</span>
                <details className="group relative">
                  <summary className="cursor-pointer list-none rounded-full border border-primary/40 px-2 py-0.5 text-[10px] font-mono text-primary/80 transition hover:bg-primary/10">?</summary>
                  <div className="absolute end-0 z-20 mt-1 w-72 rounded-lg border border-border bg-popover p-3 text-[11px] normal-case leading-relaxed tracking-normal text-foreground shadow-lg">
                    <div className="mb-1 font-semibold text-primary">{t("suggest_geo_what")}</div>
                    <p className="text-muted-foreground">{t("suggest_geo_explain")}</p>
                  </div>
                </details>
              </div>
              <div className="font-display text-3xl font-bold text-gradient">{result.overall_geo_score}<span className="text-sm text-muted-foreground">/100</span></div>
            </div>
            <div className="rounded-xl border border-accent/30 bg-accent/5 p-3 sm:col-span-2">
              <div className="mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-accent"><TrendingUp className="size-3.5" /> {t("result_expected_reach")}: {t(`reach_${result.expected_reach}` as any)}</div>
              <div className="text-xs text-foreground">{result.expected_reach_reason}</div>
            </div>
          </div>

          {result.factual_warnings?.length > 0 && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-destructive"><AlertTriangle className="size-3.5" /> {t("result_warnings")}</div>
              <ul className="ms-4 list-disc space-y-1 text-xs text-foreground">
                {result.factual_warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}

          {result.improvement_tips?.length > 0 && (
            <div className="rounded-xl border border-border bg-background/60 p-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground"><Lightbulb className="size-3.5 text-accent" /> {t("result_tips")}</div>
              <ul className="ms-4 list-disc space-y-1 text-xs text-muted-foreground">
                {result.improvement_tips.map((tip, i) => <li key={i}>{tip}</li>)}
              </ul>
            </div>
          )}

          {result.variants.map((v, i) => (
            <div key={i} className="rounded-xl border border-border bg-background/60 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-primary">
                  {v.platform} · GEO {v.geo_score}/100
                </span>
                <button
                  onClick={async () => { await navigator.clipboard.writeText(v.content); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition hover:text-foreground"
                >
                  {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
                  {copied ? t("suggest_copied") : t("suggest_copy")}
                </button>
              </div>
              <pre className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{v.content}</pre>
            </div>
          ))}
        </div>
      )}

      {!result && post && (
        <div className="mt-5 rounded-xl border border-border bg-background/60 p-4">
          <pre className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{post}</pre>
        </div>
      )}
    </div>
  );
}
