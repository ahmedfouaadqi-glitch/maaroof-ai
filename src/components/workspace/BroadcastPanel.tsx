import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Radio, LoaderCircle, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

type L = "ar" | "en" | "ku";
const tr = (l: L, ar: string, en: string, ku: string) => (l === "en" ? en : l === "ku" ? ku : ar);

/** "Intelligence broadcast": the machine-readable files you publish, and real AI-crawler visits to them. */
export function BroadcastPanel({ lang }: { lang: L }) {
  const { user } = useAuth();
  const [packs, setPacks] = useState<any[] | null>(null);
  const [bots, setBots] = useState<Array<{ bot: string; count: number; last: string }>>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const since = new Date(Date.now() - 30 * 86400000).toISOString();
      const [{ data: p }, { data: h }] = await Promise.all([
        supabase.from("brand_authority_packs").select("brand_slug, brand_name, updated_at").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(10),
        supabase.from("crawler_hits").select("bot_name, hit_at").eq("user_id", user.id).gte("hit_at", since).order("hit_at", { ascending: false }).limit(1000),
      ]);
      setPacks(p || []);
      const m = new Map<string, { count: number; last: string }>();
      for (const r of (h || []) as any[]) { const k = r.bot_name || "?"; const e = m.get(k); if (e) e.count++; else m.set(k, { count: 1, last: r.hit_at }); }
      setBots([...m.entries()].map(([bot, v]) => ({ bot, ...v })).sort((a, b) => b.count - a.count));
    })().catch(() => setPacks([]));
  }, [user?.id]);

  return (
    <section className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-sm md:p-5">
      <h2 className="mb-1 flex items-center gap-2 font-semibold"><Radio className="size-5 text-primary" />{tr(lang, "بث الذكاء وتتبع الانتشار", "Intelligence broadcast & reach", "بڵاوکردنەوەی زیرەکی")}</h2>
      <p className="mb-3 text-xs text-muted-foreground">{tr(lang, "ملفات قراءة الآلة المنشورة لعلامتك، وزيارات زواحف الذكاء الاصطناعي الفعلية لها خلال آخر 30 يوماً. لا يُنشر أي ملف إلا بعد موافقتك من أداة تعزيز العلامة.", "Your published machine-readable files and real AI-crawler visits in the last 30 days. Nothing is published without your approval in Brand Boost.", "فایلە بڵاوکراوەکان و سەردانی خشۆکەکان.")}</p>
      {packs === null ? <LoaderCircle className="size-5 animate-spin text-muted-foreground" /> : (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-border bg-background p-3">
            <p className="mb-2 text-sm font-semibold">{tr(lang, "الملفات المنشورة", "Published files", "فایلەکان")}</p>
            {packs.length === 0 ? <p className="text-xs text-muted-foreground">{tr(lang, "لا يوجد بعد. أنشئ بطاقة السلطة من أداة تعزيز العلامة.", "None yet — create an authority card in Brand Boost.", "هێشتا نییە.")}</p> : (
              <ul className="space-y-1.5 text-xs">
                {packs.map((p) => (
                  <li key={p.brand_slug} className="flex items-center justify-between gap-2">
                    <span className="font-medium">{p.brand_name || p.brand_slug}</span>
                    <a href={`/api/public/brand/${p.brand_slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline" dir="ltr">/brand/{p.brand_slug}<ExternalLink className="size-3" /></a>
                  </li>
                ))}
              </ul>
            )}
            <Link to="/dashboard" className="mt-3 inline-block text-xs text-primary hover:underline">{tr(lang, "إدارة الملفات", "Manage files", "بەڕێوەبردن")}</Link>
          </div>
          <div className="rounded-xl border border-border bg-background p-3">
            <p className="mb-2 text-sm font-semibold">{tr(lang, "زيارات زواحف الذكاء الاصطناعي (30 يوماً)", "AI crawler visits (30 days)", "سەردانی خشۆکەکان")}</p>
            {bots.length === 0 ? <p className="text-xs text-muted-foreground">{tr(lang, "لم تُسجَّل زيارات بعد.", "No visits recorded yet.", "هیچ سەردانێک نییە.")}</p> : (
              <ul className="space-y-1.5 text-xs">
                {bots.map((b) => {
                  const max = bots[0].count;
                  return (
                    <li key={b.bot}>
                      <div className="flex justify-between"><span>{b.bot}</span><span className="tabular-nums">{b.count}</span></div>
                      <div className="mt-0.5 h-1 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${(b.count / max) * 100}%` }} /></div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
