import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listPendingApprovals, approveAndPublish, rejectApproval, getChannelsState } from "@/lib/publish.functions";
import { useI18n } from "@/lib/i18n";
import { Check, X, Edit3, Loader2, Inbox } from "lucide-react";

export function ApprovalQueue() {
  const { t } = useI18n();
  const listFn = useServerFn(listPendingApprovals);
  const approveFn = useServerFn(approveAndPublish);
  const rejectFn = useServerFn(rejectApproval);
  const chansFn = useServerFn(getChannelsState);

  const [tasks, setTasks] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<Record<string, string>>({});

  const load = async () => {
    const [a, b] = await Promise.all([listFn(), chansFn()]);
    setTasks((a as any).tasks || []);
    setChannels(((b as any).channels || []).filter((c: any) => c.verified_at));
  };
  useEffect(() => { load(); }, []);

  if (!tasks.length) return null;

  const approve = async (t: any, channelId: string) => {
    setBusy(t.id);
    try {
      const r = (await approveFn({ data: { taskId: t.id, channelId, editedText: editing[t.id] } })) as any;
      if (!r?.ok) alert(`${t.error || ""}`);
    } finally { setBusy(null); await load(); }
  };
  const reject = async (id: string) => {
    setBusy(id);
    try { await rejectFn({ data: { taskId: id } }); }
    finally { setBusy(null); await load(); }
  };

  return (
    <div className="mt-8 rounded-2xl border border-warning/40 bg-warning/5 p-5">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold">
        <Inbox className="size-5 text-warning" />
        {t("appr_title") || "بانتظار موافقتك"} <span className="rounded-full bg-warning/20 px-2 py-0.5 text-xs">{tasks.length}</span>
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("appr_desc") || "راجع المنشور، عدّله إن أردت، ثم وافق أو ارفض."}</p>

      <div className="mt-3 space-y-3">
        {tasks.map((tk) => {
          const original = (tk.result?.summary || tk.input || "").toString();
          const current = editing[tk.id] ?? original;
          return (
            <div key={tk.id} className="rounded-xl border border-border bg-background/60 p-3">
              <textarea
                value={current}
                onChange={(e) => setEditing((s) => ({ ...s, [tk.id]: e.target.value }))}
                className="w-full resize-y rounded-md border border-border bg-background/80 p-2 text-sm"
                rows={4}
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {channels.length === 0 && (
                  <span className="text-xs text-muted-foreground">{t("appr_no_channels") || "اربط قناة أولاً لتتمكن من النشر."}</span>
                )}
                {channels.map((c: any) => (
                  <button
                    key={c.id}
                    onClick={() => approve(tk, c.id)}
                    disabled={busy === tk.id}
                    className="inline-flex items-center gap-1 rounded-md bg-success/20 px-3 py-1.5 text-xs font-semibold text-success hover:bg-success/30 disabled:opacity-50"
                  >
                    {busy === tk.id ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
                    {t("appr_publish_to") || "انشر على"} {c.label || c.kind}
                  </button>
                ))}
                <button
                  onClick={() => reject(tk.id)}
                  disabled={busy === tk.id}
                  className="inline-flex items-center gap-1 rounded-md border border-destructive/40 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"
                >
                  <X className="size-3" /> {t("appr_reject") || "رفض"}
                </button>
                {editing[tk.id] && editing[tk.id] !== original && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Edit3 className="size-3" /> {t("appr_edited") || "تم التعديل"}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
