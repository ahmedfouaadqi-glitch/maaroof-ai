import { useEffect, useState } from "react";
import { FilesManager } from "./FilesManager";
import { ExportButtons } from "@/components/ExportButtons";
import { Radio, LoaderCircle, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

type L = "ar" | "en" | "ku";
const tr = (l: L, ar: string, en: string, ku: string) => (l === "en" ? en : l === "ku" ? ku : ar);

/** "Intelligence broadcast": machine-readable public files and requests classified from their User-Agent. */
export function BroadcastPanel({ lang, workspaceId = null }: { lang: L; workspaceId?: string | null }) {
  const { user } = useAuth();
  const [packs, setPacks] = useState<any[] | null>(null);
  const [filesOpen, setFilesOpen] = useState(false);
  const [bots, setBots] = useState<Array<{ bot: string; count: number; last: string }>>([]);
  const [workspaceProfile, setWorkspaceProfile] = useState<any>(null);

  useEffect(() => {
    if (!user) {
      setPacks([]);
      setBots([]);
      setWorkspaceProfile(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const since = new Date(Date.now() - 30 * 86400000).toISOString();
      const scopeRows = async () => {
        let packsQuery = supabase.from("brand_authority_packs")
          .select("brand_slug, brand_name, updated_at")
          .eq("user_id", user.id);
        let hitsQuery = supabase.from("crawler_hits")
          .select("bot_name, hit_at")
          .eq("user_id", user.id)
          .gte("hit_at", since);
        packsQuery = workspaceId ? packsQuery.eq("workspace_id", workspaceId) : packsQuery.is("workspace_id", null);
        hitsQuery = workspaceId ? hitsQuery.eq("workspace_id", workspaceId) : hitsQuery.is("workspace_id", null);
        const [{ data: p, error: packError }, { data: h, error: hitError }] = await Promise.all([
          packsQuery.order("updated_at", { ascending: false }).limit(20),
          hitsQuery.order("hit_at", { ascending: false }).limit(1000),
        ]);
        if (packError) throw packError;
        if (hitError) throw hitError;
        if (cancelled) return;
        setPacks(p || []);
        const map = new Map<string, { count: number; last: string }>();
        for (const row of (h || []) as any[]) {
          const key = row.bot_name || "Unknown";
          const current = map.get(key);
          if (current) current.count++;
          else map.set(key, { count: 1, last: row.hit_at });
        }
        setBots([...map.entries()].map(([bot, value]) => ({ bot, ...value })).sort((a, b) => b.count - a.count));
      };

      if (workspaceId) {
        const { data, error } = await (supabase as any).from("workspaces")
          .select("id,name,brand_url,brand_summary,keywords,profile,goals,success_metrics,language,country,city")
          .eq("id", workspaceId).eq("owner_id", user.id).maybeSingle();
        if (error) throw error;
        if (cancelled) return;
        setWorkspaceProfile(data || null);
      } else {
        setWorkspaceProfile(null);
      }
      await scopeRows();
    })().catch((error) => {
      console.error("[BroadcastPanel] scoped load failed", error);
      if (!cancelled) { setPacks([]); setBots([]); }
    });
    return () => { cancelled = true; };
  }, [user?.id, workspaceId]);

  return (
    <section className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-sm md:p-5">
      <h2 className="mb-1 flex items-center gap-2 font-semibold"><Radio className="size-5 text-primary" />{tr(lang, "بث الذكاء وتتبع الانتشار", "Intelligence broadcast & reach", "بڵاوکردنەوەی زیرەکی")}</h2>
      <p className="mb-3 text-xs text-muted-foreground">{tr(lang, "ملفات قراءة الآلة المنشورة على رابط معروف، وطلبات الوصول المصنفة من User-Agent خلال آخر 30 يوماً. تصنيف User-Agent لا يثبت هوية الزاحف. لا يُنشر ملف على موقع العميل من هذه الشاشة.", "Machine-readable files hosted on a Maaroof URL and requests classified from User-Agent in the last 30 days. User-Agent matching does not authenticate a crawler. This screen does not publish to the customer's website.", "فایلە بڵاوکراوەکان و سەردانی خشۆکەکان.")}</p>
      {workspaceId ? <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">{!workspaceProfile ? <LoaderCircle className="size-5 animate-spin text-muted-foreground" /> : <><h3 className="font-semibold">{workspaceProfile.profile?.brand_name || workspaceProfile.name}</h3><p className="mt-1 text-xs text-muted-foreground">{tr(lang, "هوية مستقلة لهذه المساحة. التصدير يتضمن حزم قراءة الآلة المتاحة.", "Independent identity for this workspace. Export includes available machine-readable packs.", "ناسنامەی جیاواز بۆ ئەم شوێنە.")}</p><div className="mt-3"><ExportButtons size="xs" build={() => ({ title: workspaceProfile.profile?.brand_name || workspaceProfile.name, lang, entity: { brand: workspaceProfile.profile?.brand_name || workspaceProfile.name, site: workspaceProfile.brand_url || undefined, summary: workspaceProfile.brand_summary || undefined, facts: Array.isArray(workspaceProfile.keywords) ? workspaceProfile.keywords : [], links: workspaceProfile.brand_url ? [workspaceProfile.brand_url] : [], faqs: Array.isArray(workspaceProfile.profile?.faqs) ? workspaceProfile.profile.faqs : [] }, sections: [{ heading: tr(lang, "هوية مساحة العمل", "Workspace identity", "ناسنامەی شوێن"), kind: "kv", rows: [[tr(lang, "الاسم", "Name", "ناو"), workspaceProfile.profile?.brand_name || workspaceProfile.name], ["Website", workspaceProfile.brand_url || "—"], [tr(lang, "الوصف", "Description", "وەسف"), workspaceProfile.brand_summary || "—"]] }] })} /></div></>}</div> : packs === null ? <LoaderCircle className="size-5 animate-spin text-muted-foreground" /> : (
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
            <button type="button" onClick={() => setFilesOpen(true)} className="mt-3 inline-block text-xs text-primary hover:underline">{tr(lang, "إدارة الملفات", "Manage files", "بەڕێوەبردن")}</button>
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
      {filesOpen && <FilesManager lang={lang} workspaceId={workspaceId} onClose={() => setFilesOpen(false)} />}
    </section>
  );
}
