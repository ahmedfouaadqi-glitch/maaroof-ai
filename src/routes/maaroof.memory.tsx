import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { AuthProvider, useAuth } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { supabase } from "@/integrations/supabase/client";
import { Brain, Trash2, Plus, Loader2, ArrowLeft, Star } from "lucide-react";

export const Route = createFileRoute("/maaroof/memory")({
  head: () => ({
    meta: [
      { title: t("auto.maaroof_memory_maaroof_ai") },
      { name: "description", content: "Manage Maaroof's long-term memory: review, edit and prioritize the facts and preferences the AI agent uses to personalize your GEO workflows." },
      { property: "og:title", content: "Maaroof Memory · MAAROOF Ai" },
      { property: "og:description", content: "Review and curate the long-term memory of the Maaroof AI agent." },
      { property: "og:url", content: "https://geoiraq.com/maaroof/memory" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://geoiraq.com/maaroof/memory" }],
  }),
  component: () => <I18nProvider><AuthProvider><MemoryPage /></AuthProvider></I18nProvider>,
});

type Mem = { id: string; kind: string; content: string; importance: number; created_at: string; last_accessed_at: string };

function MemoryPage() {
  const { t } = useI18n();
  const { user, loading } = useAuth();
  const [items, setItems] = useState<Mem[]>([]);
  const [busy, setBusy] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [newKind, setNewKind] = useState<"fact" | "preference">("preference");

  async function load() {
    setBusy(true);
    const { data } = await supabase.from("maaroof_memory")
      .select("id, kind, content, importance, created_at, last_accessed_at")
      .order("importance", { ascending: false })
      .order("last_accessed_at", { ascending: false }).limit(200);
    setItems((data as any) || []); setBusy(false);
  }
  useEffect(() => { if (user) load(); }, [user]);

  async function del(id: string) {
    if (!confirm(t("auto.delete_this_memory"))) return;
    await supabase.from("maaroof_memory").delete().eq("id", id);
    setItems((p) => p.filter((x) => x.id !== id));
  }
  async function bump(id: string, importance: number) {
    await supabase.from("maaroof_memory").update({ importance }).eq("id", id);
    setItems((p) => p.map((x) => x.id === id ? { ...x, importance } : x));
  }
  async function add() {
    if (!newContent.trim() || !user) return;
    const { data } = await supabase.from("maaroof_memory").insert({
      user_id: user.id, kind: newKind, content: newContent.trim(), importance: 3,
    }).select("id, kind, content, importance, created_at, last_accessed_at").single();
    if (data) setItems((p) => [data as any, ...p]);
    setNewContent("");
  }
  async function clearAll() {
    if (!confirm(t("auto.delete_all_memory_cannot_be_undone"))) return;
    if (!user) return;
    await supabase.from("maaroof_memory").delete().eq("user_id", user.id);
    setItems([]);
  }

  if (loading) return <div className="min-h-screen grid place-items-center"><Loader2 className="animate-spin" /></div>;
  if (!user) return (
    <div className="min-h-screen"><SiteHeader />
      <div className="max-w-xl mx-auto p-8 text-center">
        <p className="mb-4">{t("auto.please_login")}</p>
        <Link to="/auth" className="px-4 py-2 bg-primary text-primary-foreground rounded-md">{t("auto.login")}</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="max-w-4xl mx-auto p-4 space-y-4">
        <div className="flex items-center gap-3">
          <Link to="/maaroof" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> رجوع</Link>
          <h1 className="text-xl font-bold flex items-center gap-2"><Brain className="w-5 h-5 text-primary" /> ذاكرة معروف</h1>
          <button onClick={clearAll} className="ms-auto text-xs text-destructive hover:underline">{t("auto.delete_all")}</button>
        </div>

        <div className="rounded-lg border bg-card p-3 flex gap-2 flex-wrap">
          <select value={newKind} onChange={(e) => setNewKind(e.target.value as any)} className="border rounded px-2 py-1 bg-background text-sm">
            <option value="preference">{t("auto.preference")}</option>
            <option value="fact">{t("auto.fact")}</option>
          </select>
          <input value={newContent} onChange={(e) => setNewContent(e.target.value)} placeholder={t("auto.example_my_brand_is_store_x")}
            className="flex-1 border rounded px-2 py-1 bg-background text-sm min-w-[200px]" />
          <button onClick={add} disabled={!newContent.trim()} className="rounded bg-primary text-primary-foreground px-3 py-1 text-sm flex items-center gap-1 disabled:opacity-50"><Plus className="w-4 h-4" /> {t("auto.add")}</button>
        </div>

        <div className="rounded-lg border bg-card divide-y">
          {busy && <div className="p-4 text-center text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin inline" /></div>}
          {!busy && items.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">{t("auto.no_memories_yet_they_will_be")}</div>}
          {items.map((m) => (
            <div key={m.id} className="p-3 flex gap-3 items-start">
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted shrink-0">{m.kind}</span>
              <div className="flex-1 text-sm">{m.content}</div>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} onClick={() => bump(m.id, n)} title={`الأهمية ${n}`} className={n <= m.importance ? "text-amber-500" : "text-muted-foreground/40"}>
                    <Star className="w-3 h-3" fill={n <= m.importance ? "currentColor" : "none"} />
                  </button>
                ))}
                <button onClick={() => del(m.id)} className="text-destructive ms-2"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
