// Architecture & Concept: Ahmed Maaroof
// SEO / AEO / GEO panel + progress line from data already stored for this user. Zero cost.
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { trinityScore, type Trinity } from "@/lib/maaroof/trinity-score";
import { compareProbes, type ProbeSnap } from "@/lib/maaroof/progress";

const AI_BOT = /(gptbot|chatgpt|oai-search|claude|anthropic|perplexity|google-extended|googleother|bytespider|ccbot|meta-external|mistral|deepseek|qwen|grok|xai|kimi|moonshot)/i;

export async function loadProbeSnaps(userId: string): Promise<ProbeSnap[]> {
  const { data } = await supabase.from("report_drafts").select("payload, created_at").eq("user_id", userId).eq("tool_key", "visibility").order("created_at", { ascending: false }).limit(10);
  const out: ProbeSnap[] = [];
  for (const r of (data as any[]) || []) {
    const ans = r?.payload?.probe?.answers;
    if (!Array.isArray(ans) || !ans.length) continue;
    out.push({ at: String(r.created_at), mentioned: ans.filter((a: any) => a?.mentioned).length, total: ans.length });
  }
  return out;
}

export function ProgressLine({ userId, lang }: { userId?: string | null; lang: "ar" | "en" | "ku" }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => { if (userId) loadProbeSnaps(userId).then((s) => setText(compareProbes(s, lang))).catch(() => {}); }, [userId, lang]);
  if (!text) return null;
  return <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs">{text}</div>;
}

export function TrinityPanel({ userId, profile, lang }: { userId: string; profile: any; lang: "ar" | "en" | "ku" }) {
  const [t, setT] = useState<Trinity | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: hits } = await supabase.from("crawler_hits").select("bot_name, user_agent").eq("user_id", userId).limit(1000);
      const h = (hits as any[]) || [];
      const crawlers = h.length ? {
        googlebot: h.filter((x) => /googlebot/i.test(x.bot_name || "")).length,
        bingbot: h.filter((x) => /bingbot/i.test(x.bot_name || "")).length,
        aiBots: h.filter((x) => AI_BOT.test(`${x.bot_name || ""} ${x.user_agent || ""}`)).length,
      } : null;
      const snaps = await loadProbeSnaps(userId).catch(() => []);
      if (!alive) return;
      setT(trinityScore({ crawlers, entity: profile ? { ...profile, entity_verified: !!profile.entity_locked } : null, probe: snaps[0] || null }));
      setProgress(compareProbes(snaps, lang));
    })().catch(() => {});
    return () => { alive = false; };
  }, [userId, profile, lang]);
  if (!t) return null;
  const L = lang === "en" ? { h: "Your SEO / AEO / GEO index", none: "Not measured yet", seo: "SEO — technical foundation", aeo: "AEO — clear identity for answers", geo: "GEO — mentions in the 10 models", go: "Measure now" }
    : lang === "ku" ? { h: "پێوەری SEO / AEO / GEO", none: "هێشتا نەپێوراوە", seo: "SEO — بنەمای تەکنیکی", aeo: "AEO — ناسنامەی ڕوون", geo: "GEO — ناوهاتن لە 10 مۆدێل", go: "ئێستا بپێوە" }
    : { h: "مؤشر SEO / AEO / GEO", none: "لم يُقَس بعد", seo: "SEO — الأساس التقني", aeo: "AEO — وضوح هويتك للإجابات", geo: "GEO — ذكرك في النماذج العشرة", go: "قِس الآن" };
  const rows: [string, Trinity["seo"], boolean][] = [[L.seo, t.seo, false], [L.aeo, t.aeo, false], [L.geo, t.geo, true]];
  return (
    <div className="mt-6 rounded-2xl border border-border bg-card/70 p-5 space-y-3">
      <h2 className="font-display text-lg font-semibold">{L.h}</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {rows.map(([label, layer, isGeo]) => (
          <div key={label} className="rounded-lg border border-border p-3 text-xs space-y-1">
            <div className="font-medium">{label}</div>
            <div className="text-2xl font-bold text-primary">{layer.score == null ? <span className="text-sm text-muted-foreground">{L.none}</span> : `${layer.score}%`}</div>
            <ul className="text-muted-foreground list-disc ps-4">{layer.reasons.slice(0, 4).map((r) => <li key={r}>{r}</li>)}</ul>
            {isGeo && layer.score == null && <Link to="/dashboard" className="text-primary underline">{L.go}</Link>}
          </div>
        ))}
      </div>
      {progress && <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs">{progress}</div>}
    </div>
  );
}
