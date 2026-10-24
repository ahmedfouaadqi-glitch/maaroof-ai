import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { listNotifications, markNotificationRead } from "@/lib/publish.functions";
import { Bell, CheckCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function NotifyInbox() {
  const { t } = useI18n();
  const fetchFn = useServerFn(listNotifications);
  const markFn = useServerFn(markNotificationRead);
  const [items, setItems] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const load = async () => {
    try {
      const r = (await fetchFn()) as any;
      setItems(r.items || []);
      setUnread(r.unread || 0);
    } catch { /* unauth */ }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const markAll = async () => {
    await markFn({ data: { all: true } });
    load();
  };
  const markOne = async (id: string) => {
    await markFn({ data: { id } });
    load();
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={t("notify_inbox") || t("auto.notifications")}
        className="relative grid size-9 place-items-center rounded-lg border border-border bg-background/60 hover:bg-background"
      >
        <Bell className="size-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid min-w-[18px] place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute end-0 z-50 mt-2 w-80 max-w-[90vw] rounded-xl border border-border bg-card shadow-xl">
          <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
            <span className="text-sm font-bold">{t("notify_inbox") || t("auto.notifications")}</span>
            {unread > 0 && (
              <button onClick={markAll} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                <CheckCheck className="size-3" /> {t("notify_mark_all") || t("auto.mark_all_as_read_2")}
              </button>
            )}
          </div>
          <div className="max-h-96 divide-y divide-border/40 overflow-y-auto">
            {items.length === 0 && (
              <p className="p-4 text-center text-xs text-muted-foreground">{t("notify_empty") || t("auto.no_notifications")}</p>
            )}
            {items.map((n) => (
              <div key={n.id} className={`p-3 ${n.read_at ? "opacity-60" : "bg-primary/5"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold">{n.title}</div>
                    {n.body && <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</div>}
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span>{new Date(n.created_at).toLocaleString()}</span>
                      {n.link && (
                        <Link to={n.link} onClick={() => { markOne(n.id); setOpen(false); }} className="text-primary hover:underline">
                          {t("notify_open") || t("auto.open")}
                        </Link>
                      )}
                    </div>
                  </div>
                  {!n.read_at && (
                    <button onClick={() => markOne(n.id)} className="text-xs text-muted-foreground hover:text-foreground" aria-label="mark read">
                      ✓
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
