import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RefreshCw, Check, X, ShieldCheck } from "lucide-react";
import { adminListSpecialtyRequests, adminReviewSpecialtyRequest } from "@/lib/specialty.functions";
import { useAdminL } from "./admin-i18n";

export function SpecialtyRequestsPanel() {
  const L = useAdminL({
    title: { ar: "طلبات تغيير التخصص / القطاع", en: "Specialty / sector change requests", ku: "داواکاریی گۆڕینی بوار" },
    desc: {
      ar: "لا يستطيع المستخدمون تغيير تخصصهم مباشرة — يتم اعتماد التغيير من الإدارة حصراً.",
      en: "Users cannot change their specialty directly — only administrators approve changes.",
      ku: "بەکارهێنەران ناتوانن بوارەکەیان بگۆڕن — تەنها بەڕێوەبەرایەتی پەسەندی دەکات.",
    },
    reload: { ar: "إعادة تحميل", en: "Reload", ku: "نوێکردنەوە" },
    empty: { ar: "لا توجد طلبات.", en: "No requests.", ku: "هیچ داواکاریەک نییە." },
    user: { ar: "المستخدم", en: "User", ku: "بەکارهێنەر" },
    from: { ar: "الحالي", en: "Current", ku: "ئێستا" },
    to: { ar: "المطلوب", en: "Requested", ku: "داواکراو" },
    reason: { ar: "السبب", en: "Reason", ku: "هۆکار" },
    status: { ar: "الحالة", en: "Status", ku: "دۆخ" },
    pending: { ar: "قيد المراجعة", en: "Pending", ku: "چاوەڕوانە" },
    approved: { ar: "معتمد", en: "Approved", ku: "پەسەندکرا" },
    rejected: { ar: "مرفوض", en: "Rejected", ku: "ڕەتکرایەوە" },
    approve: { ar: "اعتماد", en: "Approve", ku: "پەسەند" },
    reject: { ar: "رفض", en: "Reject", ku: "ڕەتکردنەوە" },
    notePh: { ar: "ملاحظة الإدارة (اختياري)", en: "Admin note (optional)", ku: "تێبینی (ئارەزوومەندانە)" },
    onlyPending: { ar: "قيد المراجعة فقط", en: "Pending only", ku: "تەنها چاوەڕوان" },
  });

  const callList = useServerFn(adminListSpecialtyRequests);
  const callReview = useServerFn(adminReviewSpecialtyRequest);

  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string>("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [onlyPending, setOnlyPending] = useState(true);

  const load = async () => {
    setLoading(true);
    try { const r = await callList(); setRows((r as any).rows || []); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const review = async (id: string, action: "approve" | "reject") => {
    setBusy(id);
    try { await callReview({ data: { id, action, note: notes[id] || undefined } }); await load(); }
    finally { setBusy(""); }
  };

  const statusLabel = (s: string) => (s === "approved" ? L.approved : s === "rejected" ? L.rejected : L.pending);
  const filtered = onlyPending ? rows.filter((r) => r.status === "pending") : rows;

  return (
    <section className="rounded-xl border border-border bg-card/60 p-4">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-primary" />
          <h3 className="font-semibold">{L.title}</h3>
        </div>
        <label className="inline-flex items-center gap-2 text-xs">
          <input type="checkbox" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} />
          <span>{L.onlyPending}</span>
        </label>
        <button onClick={load} className="ms-auto inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs">
          <RefreshCw className="size-3.5" /> {L.reload}
        </button>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">{L.desc}</p>

      {loading ? (
        <div className="grid h-32 place-items-center"><Loader2 className="size-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">{L.empty}</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => (
            <div key={r.id} className="rounded-lg border border-border/60 bg-background/40 p-3 text-xs">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="font-semibold">{L.user}: {r.email || r.user_id}</span>
                <span className="text-muted-foreground">{L.from}: {r.current_specialty || "—"}</span>
                <span className="text-primary font-semibold">{L.to}: {r.requested_specialty}</span>
                <span className="ms-auto rounded-full border border-border px-2 py-0.5">{L.status}: {statusLabel(r.status)}</span>
              </div>
              {r.reason && <div className="mt-1 text-muted-foreground">{L.reason}: {r.reason}</div>}
              {r.admin_note && <div className="mt-1 text-muted-foreground">— {r.admin_note}</div>}
              {r.status === "pending" && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    value={notes[r.id] || ""}
                    onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                    placeholder={L.notePh}
                    className="min-w-48 flex-1 rounded-lg border border-border bg-background/60 px-2 py-1.5 text-xs"
                  />
                  <button disabled={busy === r.id} onClick={() => review(r.id, "approve")}
                    className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-primary to-accent px-3 py-1.5 font-semibold text-primary-foreground disabled:opacity-50">
                    {busy === r.id ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} {L.approve}
                  </button>
                  <button disabled={busy === r.id} onClick={() => review(r.id, "reject")}
                    className="inline-flex items-center gap-1 rounded-lg border border-destructive/40 px-3 py-1.5 font-semibold text-destructive disabled:opacity-50">
                    <X className="size-3.5" /> {L.reject}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
