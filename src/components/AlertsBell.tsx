import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export function AlertsBell() {
  const { t } = useI18n();
  let auth: ReturnType<typeof useAuth> | null = null;
  try { auth = useAuth(); } catch {}
  const user = auth?.user;
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<any[]>([]);

  async function load() {
    if (!user) return;
    const { data } = await supabase
      .from("competitor_alerts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    setItems(data || []);
    setCount((data || []).filter((a: any) => !a.read_at).length);
  }
  useEffect(() => { load(); const t = setInterval(load, 60_000); return () => clearInterval(t); /* eslint-disable-next-line */ }, [user?.id]);

  async function markAllRead() {
    if (!user) return;
    await supabase.from("competitor_alerts").update({ read_at: new Date().toISOString() }).is("read_at", null);
    load();
  }

  if (!user) return null;
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex size-8 items-center justify-center rounded-full border border-border bg-background/60 text-muted-foreground hover:text-foreground"
        aria-label="Alerts"
      >
        <Bell className="size-3.5" />
        {count > 0 && (
          <span className="absolute -top-1 -end-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">{count > 9 ? "9+" : count}</span>
        )}
      </button>
      {open && (
        <div className="absolute end-0 mt-2 w-80 rounded-xl border border-border bg-background/95 p-2 shadow-xl backdrop-blur z-50">
          <div className="flex items-center justify-between px-2 py-1">
            <b className="text-xs">{t("auto.alerts")}</b>
            <button onClick={markAllRead} className="text-[10px] text-primary hover:underline">{t("auto.mark_all_as_read")}</button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-2 py-4 text-center text-xs text-muted-foreground">{t("auto.no_alerts")}</p>
            ) : items.map((a) => (
              <div key={a.id} className={`rounded-md p-2 text-xs ${a.read_at ? "" : "bg-primary/5"}`}>
                <div className="flex items-center justify-between">
                  <b>{a.target || t("auto.alert")}</b>
                  <span className="text-[10px] text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
                </div>
                <p className="text-muted-foreground">{a.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
