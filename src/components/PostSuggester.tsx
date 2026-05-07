import { useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Loader2, Upload, Image as ImageIcon, Type, Copy, Check, Lock, Linkedin, Facebook, Instagram } from "lucide-react";

type Mode = "text" | "image";
type Platform = "linkedin" | "facebook" | "tiktok" | "instagram";
type Length = "short" | "medium" | "long";
type ContentType = "post" | "article";

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
  const [loading, setLoading] = useState(false);
  const [post, setPost] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGate, setShowGate] = useState(false);
  const [showLimit, setShowLimit] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setImageData(reader.result as string);
      setImageMime(f.type);
    };
    reader.readAsDataURL(f);
  };

  const submit = async () => {
    setError(null); setPost(null); setShowGate(false); setShowLimit(false);
    if (!user) { setShowGate(true); return; }
    setLoading(true);
    try {
      const body: any = { lang };
      if (initialSourceText) body.sourceText = initialSourceText;
      else if (mode === "text") body.description = desc;
      else if (imageData) {
        body.imageBase64 = imageData;
        body.imageMime = imageMime;
      }
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const session = (await supabase.auth.getSession()).data.session;
      if (session) headers.Authorization = `Bearer ${session.access_token}`;
      const r = await fetch("/api/suggest", { method: "POST", headers, body: JSON.stringify(body) });
      const data = await r.json();
      if (r.status === 401) { setShowGate(true); return; }
      if (r.status === 402 && data.error === "limit") { setShowLimit(true); return; }
      if (!r.ok) throw new Error(data?.error || "Failed");
      setPost(data.post);
      if (auth) auth.refreshProfile();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const canSubmit =
    !!initialSourceText || (mode === "text" ? desc.trim().length > 0 : !!imageData);

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

      {!initialSourceText && (
        <div className="mb-4 inline-flex rounded-full border border-border bg-background/60 p-1">
          <button
            onClick={() => setMode("text")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
              mode === "text" ? "bg-primary/20 text-primary" : "text-muted-foreground"
            }`}
          >
            <Type className="size-3.5" /> {t("suggest_tab_text")}
          </button>
          <button
            onClick={() => setMode("image")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
              mode === "image" ? "bg-primary/20 text-primary" : "text-muted-foreground"
            }`}
          >
            <ImageIcon className="size-3.5" /> {t("suggest_tab_image")}
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

      {post && (
        <div className="mt-5 rounded-xl border border-border bg-background/60 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              {t("suggest_result")}
            </span>
            <button
              onClick={copy}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition hover:text-foreground"
            >
              {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
              {copied ? t("suggest_copied") : t("suggest_copy")}
            </button>
          </div>
          <pre className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{post}</pre>
        </div>
      )}
    </div>
  );
}
