import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useVisibility } from "@/lib/visibility";
import { HANDOFF_TARGETS, HANDOFF_LABELS, type HandoffTarget } from "@/lib/tool-handoff";
import { Loader2, Plus, Trash2, Link2 } from "lucide-react";

type Row = { id: string; source_tool: string; target_tool: string };

export function ToolLinksManager() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const L = (k: HandoffTarget) => HANDOFF_LABELS[k][(lang as "ar" | "en" | "ku") || "ar"];
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [src, setSrc] = useState<HandoffTarget>("research");
  const [dst, setDst] = useState<HandoffTarget>("feasibility");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from("tool_links").select("id, source_tool, target_tool").eq("user_id", user.id);
    setRows((data as Row[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [user?.id]);

  const add = async () => {
    if (!user || src === dst) return;
    setBusy(true);
    await supabase.from("tool_links").insert({ user_id: user.id, source_tool: src, target_tool: dst });
    await load(); setBusy(false);
  };
  const remove = async (id: string) => {
    await supabase.from("tool_links").delete().eq("id", id);
    setRows(r => r.filter(x => x.id !== id));
  };

  const isAr = lang === "ar";

  return (
    <div className="mt-6 rounded-2xl border border-border bg-card/70 p-5">
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
        <Link2 className="size-5 text-primary" />
        {isAr ? "ربط الأدوات تلقائيًا" : "Tool Auto-Links"}
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {isAr
          ? "حدد روابط ثابتة بين الأدوات: عند انتهاء أداة المصدر سيظهر زر سريع لتمرير النتيجة إلى الأداة الهدف."
          : "Set fixed links between tools — when the source finishes, a quick button passes its result to the target."}
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[140px]">
          <label className="mb-1 block text-xs font-semibold text-muted-foreground">{isAr ? "من" : "From"}</label>
          <select value={src} onChange={e => setSrc(e.target.value as HandoffTarget)} className="w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm">
            {HANDOFF_TARGETS.map(k => <option key={k} value={k}>{L(k)}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[140px]">
          <label className="mb-1 block text-xs font-semibold text-muted-foreground">{isAr ? "إلى" : "To"}</label>
          <select value={dst} onChange={e => setDst(e.target.value as HandoffTarget)} className="w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm">
            {HANDOFF_TARGETS.map(k => <option key={k} value={k}>{L(k)}</option>)}
          </select>
        </div>
        <button onClick={add} disabled={busy || src === dst} className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} {isAr ? "إضافة" : "Add"}
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {loading ? <Loader2 className="size-5 animate-spin text-muted-foreground" />
          : rows.length === 0 ? <p className="text-xs text-muted-foreground">{isAr ? "لا توجد روابط بعد." : "No links yet."}</p>
          : rows.map(r => (
            <div key={r.id} className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2 text-sm">
              <span>{L(r.source_tool as HandoffTarget)} <span className="mx-2 text-muted-foreground">→</span> {L(r.target_tool as HandoffTarget)}</span>
              <button onClick={() => remove(r.id)} className="text-destructive hover:opacity-70"><Trash2 className="size-4" /></button>
            </div>
          ))}
      </div>
    </div>
  );
}
