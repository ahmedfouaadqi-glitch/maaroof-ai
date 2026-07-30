// Parts 16-17 admin panels — State Center + HERMES Executive Office.
// Rendered inside the existing Intelligence Center shell (no new dashboard page).
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Anchor, Crown, RefreshCw, Loader2, Check, X, Clock, Send, AlertTriangle, History, Paperclip, ListChecks } from "lucide-react";
import { toast } from "sonner";
import {
  getStateCenter, getRecoveryPoint,
  getHermesCenter, refreshHermesProposals, decideHermesProposal, askHermes, getHermesMessages,
} from "@/lib/maaroof-state-hermes.functions";
import { EXECUTIVE_COMMANDS, COMMAND_LABELS_AR } from "@/lib/hermes-commands";
import { HermesTaskCenter } from "@/components/admin/HermesTaskCenter";


function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
      {hint ? <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div> : null}
    </div>
  );
}

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{Math.round(value)}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
        <div className="h-full rounded-full bg-primary/70" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

const money = (n: any) => `$${Number(n || 0).toFixed(4)}`;

/* ------------------------------------------------------------------ */
/* Part 16 — State Center                                              */
/* ------------------------------------------------------------------ */

export function StateCenterSection() {
  const load = useServerFn(getStateCenter);
  const recover = useServerFn(getRecoveryPoint);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [point, setPoint] = useState<any>(null);

  const refresh = async () => {
    try { setData(await load()); }
    catch (e: any) { toast.error(String(e?.message || e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, []);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">جارٍ التحميل…</div>;

  const anchors: any[] = data?.anchors || [];
  const timeline: any[] = data?.timeline || [];
  const byLevel: Record<string, any> = data?.byLevel || {};
  const platform = anchors.find((a) => a.level === "platform");
  const enabled = data?.settings?.enabled;

  const doRecover = async (level: string, scopeId: string) => {
    setBusy(true);
    try { setPoint(await recover({ data: { level, scope_id: scopeId } })); }
    catch (e: any) { toast.error(String(e?.message || e)); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Anchor className="size-4 text-primary" />
          <h3 className="font-semibold">مرساة الحالة الحيّة</h3>
          <span className={`rounded-full px-2 py-0.5 text-[10px] ${enabled ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
            {enabled ? "مفعّلة" : "معطّلة"}
          </span>
        </div>
        <button onClick={() => void refresh()} className="flex items-center gap-1.5 rounded-lg border border-border/60 px-2.5 py-1.5 text-xs hover:bg-muted/40">
          <RefreshCw className="size-3.5" /> تحديث
        </button>
      </div>

      {platform ? (
        <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4 space-y-2">
          <div className="text-xs text-muted-foreground">هوية المنصة (لا تتغير)</div>
          <div className="font-semibold">{platform.dna?.identity || platform.label}</div>
          <p className="text-sm text-muted-foreground">{platform.mission}</p>
          <div className="grid gap-2 sm:grid-cols-2 text-xs">
            <div><span className="text-muted-foreground">الهدف الحالي: </span>{platform.current_goal || "—"}</div>
            <div><span className="text-muted-foreground">الهدف المستقبلي: </span>{platform.future_goal || "—"}</div>
          </div>
          {Array.isArray(platform.dna?.never_change) && platform.dna.never_change.length ? (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {platform.dna.never_change.map((c: string) => (
                <span key={c} className="rounded-full border border-border/60 px-2 py-0.5 text-[10px]">{c}</span>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs">مرساة المنصة غير موجودة.</div>
      )}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="عدد المراسي" value={anchors.length} />
        <Stat label="مراسٍ بانحراف" value={anchors.filter((a) => (a.drift || []).length > 0).length} />
        <Stat label="متوسط صحة الحالة" value={`${Math.round(anchors.reduce((s, a) => s + Number(a.health_score || 0), 0) / (anchors.length || 1))}%`} />
        <Stat label="أحداث الخط الزمني" value={timeline.length} />
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(byLevel).map(([level, v]: any) => (
          <div key={level} className="rounded-xl border border-border/60 bg-card/60 p-3">
            <div className="text-xs font-medium">{level}</div>
            <div className="text-[11px] text-muted-foreground">{v.count} مرساة · انحراف {v.drifted}</div>
            <div className="mt-2"><Bar label="الصحة" value={v.avgHealth} /></div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border/60 bg-card/40">
        <div className="border-b border-border/60 px-3 py-2 text-xs font-semibold flex items-center gap-1.5">
          <History className="size-3.5" /> الخط الزمني للحالة
        </div>
        <div className="max-h-[380px] overflow-auto divide-y divide-border/40">
          {timeline.length === 0 ? (
            <div className="p-4 text-xs text-muted-foreground">لا أحداث بعد.</div>
          ) : timeline.map((t) => (
            <div key={t.id} className="p-3 text-xs space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{t.change_kind} · {t.level}</span>
                <span className="text-[10px] text-muted-foreground">{new Date(t.created_at).toLocaleString("ar")}</span>
              </div>
              <div className="text-muted-foreground">{t.reason || "—"}</div>
              {Array.isArray(t.drift) && t.drift.length ? (
                <div className="space-y-1 pt-1">
                  {t.drift.map((d: any, i: number) => (
                    <div key={i} className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2">
                      <div className="flex items-center gap-1.5 font-medium">
                        <AlertTriangle className="size-3" /> انحراف {d.kind} · {d.severity}
                      </div>
                      <div className="text-muted-foreground">{d.explanation}</div>
                      <div className="text-[10px]">التصحيح: {d.correction}</div>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="flex items-center gap-2 pt-1">
                {t.rollback_point ? <span className="rounded-full bg-primary/15 text-primary px-2 py-0.5 text-[10px]">نقطة تراجع</span> : null}
                <button
                  disabled={busy}
                  onClick={() => void doRecover(t.level, t.scope_id)}
                  className="rounded-lg border border-border/60 px-2 py-0.5 text-[10px] hover:bg-muted/40"
                >
                  آخر حالة سليمة
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {point ? (
        <div className="rounded-xl border border-border/60 bg-card/60 p-3 text-xs">
          <div className="font-medium mb-1">نقطة الاستعادة</div>
          {point.ok ? (
            <pre className="max-h-40 overflow-auto text-[10px] text-muted-foreground">{JSON.stringify(point.state, null, 2)}</pre>
          ) : <div className="text-muted-foreground">لا توجد نقطة تراجع محفوظة لهذا النطاق.</div>}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Part 17 — HERMES Executive Office                                   */
/* ------------------------------------------------------------------ */

export function HermesOfficeSection() {
  const load = useServerFn(getHermesCenter);
  const sync = useServerFn(refreshHermesProposals);
  const decide = useServerFn(decideHermesProposal);
  const ask = useServerFn(askHermes);
  const loadMsgs = useServerFn(getHermesMessages);

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<"observatory" | "inbox" | "office">("observatory");
  const [note, setNote] = useState<Record<string, string>>({});
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const refresh = async () => {
    try { setData(await load()); }
    catch (e: any) { toast.error(String(e?.message || e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">جارٍ التحميل…</div>;

  const o = data?.observatory || {};
  const proposals: any[] = data?.proposals || [];
  const dna = data?.dna || {};
  const pending = proposals.filter((p) => p.status === "pending");

  const doSync = async () => {
    setBusy("sync");
    try {
      const r: any = await sync();
      toast.success(`اقتراحات جديدة: ${r.created} · مكرّرة متجاهَلة: ${r.skipped}`);
      await refresh();
    } catch (e: any) { toast.error(String(e?.message || e)); }
    finally { setBusy(null); }
  };

  const doDecide = async (id: string, decision: "approved" | "rejected" | "deferred") => {
    setBusy(id);
    try {
      await decide({ data: { proposal_id: id, decision, note: note[id] || null } });
      toast.success("سُجِّل قرارك، وتعلّم منه هرمس.");
      await refresh();
    } catch (e: any) { toast.error(String(e?.message || e)); }
    finally { setBusy(null); }
  };

  const send = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    setMessages((m) => [...m, { id: `tmp-${Date.now()}`, role: "user", content: text }]);
    setBusy("ask");
    try {
      const r: any = await ask({ data: { message: text, conversation_id: conversationId } });
      if (r.conversationId) setConversationId(r.conversationId);
      setMessages((m) => [...m, { id: `a-${Date.now()}`, role: "assistant", content: r.reply, usd: r.usd, tokens: r.tokens }]);
    } catch (e: any) { toast.error(String(e?.message || e)); }
    finally { setBusy(null); }
  };

  const openConversation = async (id: string) => {
    setConversationId(id);
    try { setMessages(await loadMsgs({ data: { conversation_id: id } }) as any); }
    catch (e: any) { toast.error(String(e?.message || e)); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Crown className="size-4 text-primary" />
          <h3 className="font-semibold">هرمس — الوكيل التنفيذي للمؤسس</h3>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
            يقترح ولا ينفّذ بلا موافقة
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {(["observatory", "inbox", "office"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`rounded-lg px-2.5 py-1.5 text-xs ${tab === t ? "bg-primary/15 text-primary border border-primary/30" : "text-muted-foreground hover:bg-muted/40"}`}>
              {t === "observatory" ? "المرصد التنفيذي" : t === "inbox" ? `صندوق المؤسس (${pending.length})` : "مكتب هرمس"}
            </button>
          ))}
        </div>
      </div>

      {tab === "observatory" && (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="تشغيلات (30 يوماً)" value={o.runs?.total ?? 0} hint={`نجاح ${Math.round((o.runs?.successRatio ?? 0) * 100)}%`} />
            <Stat label="الكلفة الحقيقية" value={money(o.economics?.realUsd)} hint={`${o.economics?.meteredCalls ?? 0} نداء مقاس`} />
            <Stat label="المحصّل من المستخدمين" value={money(o.economics?.chargedUsd)} />
            <Stat label="الهامش" value={o.economics?.marginPct == null ? "غير مقاس" : `${o.economics.marginPct}%`} hint={money(o.economics?.marginUsd)} />
            <Stat label="ميزانية التعلّم" value={money(o.economics?.learningUsd)} hint={`${o.economics?.cacheHits ?? 0} نتيجة مخزّنة`} />
            <Stat label="نداءات بلا قياس" value={o.economics?.unmeteredCalls ?? 0} />
            <Stat label="مستخدمون" value={o.users?.total ?? 0} hint={`${o.users?.paying ?? 0} مشترك`} />
            <Stat label="نماذج فعّالة" value={`${o.models?.active ?? 0}/${o.models?.total ?? 0}`} />
          </div>

          <div className="rounded-2xl border border-border/60 bg-card/40">
            <div className="border-b border-border/60 px-3 py-2 text-xs font-semibold">الأدوات الأعلى كلفة حقيقية</div>
            <div className="divide-y divide-border/40">
              {(o.topCostTools || []).length === 0 ? (
                <div className="p-4 text-xs text-muted-foreground">لا بيانات كلفة مقاسة بعد.</div>
              ) : (o.topCostTools || []).map((t: any) => (
                <div key={t.tool} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                  <span className="font-medium">{t.tool}</span>
                  <span className="text-muted-foreground">{t.calls} نداء · متوسط {money(t.avgRealUsd)}</span>
                  <span className="font-semibold">{money(t.realUsd)}</span>
                </div>
              ))}
            </div>
          </div>

          {(o.weakestLinks || []).length ? (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-1.5">
              <div className="text-xs font-semibold flex items-center gap-1.5"><AlertTriangle className="size-3.5" /> الحلقات الأضعف</div>
              {(o.weakestLinks || []).map((w: any) => (
                <div key={`${w.entity_type}:${w.entity_key}`} className="text-[11px] text-muted-foreground">
                  {w.entity_type} · {w.entity_key} — ثقة {Math.round(Number(w.trust_score || 0))}% عبر {w.samples} عيّنة
                </div>
              ))}
            </div>
          ) : null}

          <div className="rounded-2xl border border-border/60 bg-card/40 p-3 text-xs space-y-1">
            <div className="font-semibold">حمض المؤسس</div>
            <div className="text-muted-foreground">
              تحمّل المخاطر {Math.round(Number(dna.risk_tolerance || 0))}/100 · ثقة الاستنتاج {Math.round(Number(dna.confidence || 0))}% ·
              موافقات {dna.approved_count || 0} · رفض {dna.rejected_count || 0}
            </div>
            <div className="text-[10px] text-muted-foreground">يتطوّر من قراراتك الفعلية فقط، لا من الافتراضات.</div>
          </div>
        </div>
      )}

      {tab === "inbox" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={() => void doSync()} disabled={busy === "sync"}
              className="flex items-center gap-1.5 rounded-lg border border-border/60 px-2.5 py-1.5 text-xs hover:bg-muted/40">
              {busy === "sync" ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />} توليد اقتراحات من البيانات
            </button>
          </div>
          {proposals.length === 0 ? (
            <div className="rounded-xl border border-border/60 p-6 text-center text-xs text-muted-foreground">
              لا اقتراحات بعد. اضغط «توليد اقتراحات» ليقرأ هرمس مؤشرات المنصة.
            </div>
          ) : proposals.map((p) => (
            <div key={p.id} className="rounded-2xl border border-border/60 bg-card/50 p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-semibold text-sm">{p.title}</div>
                <div className="flex items-center gap-1.5 text-[10px]">
                  <span className="rounded-full border border-border/60 px-2 py-0.5">{p.kind}</span>
                  <span className="rounded-full border border-border/60 px-2 py-0.5">أولوية {p.priority}</span>
                  <span className={`rounded-full px-2 py-0.5 ${
                    p.status === "approved" ? "bg-emerald-500/15 text-emerald-500"
                    : p.status === "rejected" ? "bg-destructive/15 text-destructive"
                    : "bg-muted text-muted-foreground"}`}>{p.status}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{p.executive_summary}</p>

              <div className="grid gap-2 md:grid-cols-2 text-[11px]">
                <div className="rounded-lg border border-border/60 p-2">
                  <div className="font-medium mb-0.5">المشكلة والدليل</div>
                  <div className="text-muted-foreground">{p.problem}</div>
                  <pre className="mt-1 max-h-24 overflow-auto text-[10px] text-muted-foreground">{JSON.stringify(p.evidence, null, 2)}</pre>
                </div>
                <div className="rounded-lg border border-border/60 p-2">
                  <div className="font-medium mb-0.5">القيمة والكلفة</div>
                  <div className="text-muted-foreground">{p.business_value}</div>
                  <div className="mt-1">قيمة متوقعة {money(p.expected_value_usd)} · كلفة {money(p.expected_cost_usd)} · ثقة {Math.round(Number(p.confidence || 0) * 100)}%</div>
                </div>
                <div className="rounded-lg border border-border/60 p-2">
                  <div className="font-medium mb-0.5">المخاطر والبدائل</div>
                  {(p.risk_analysis || []).map((r: any, i: number) => (
                    <div key={i} className="text-muted-foreground">• {r.risk} ({r.severity}) — {r.mitigation}</div>
                  ))}
                  {(p.alternatives || []).map((a: any, i: number) => (
                    <div key={i} className="text-muted-foreground">↺ {a.option} — {a.why_not}</div>
                  ))}
                </div>
                <div className="rounded-lg border border-border/60 p-2">
                  <div className="font-medium mb-0.5">التنفيذ والتراجع</div>
                  <div className="text-muted-foreground">{p.technical_analysis}</div>
                  <div className="mt-1 text-muted-foreground">تراجع: {p.rollback_plan}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(p.affected_components || []).map((c: string) => (
                      <span key={c} className="rounded-full border border-border/60 px-1.5 py-0.5 text-[10px]">{c}</span>
                    ))}
                  </div>
                </div>
              </div>

              {p.status === "pending" ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={note[p.id] || ""}
                    onChange={(e) => setNote((n) => ({ ...n, [p.id]: e.target.value }))}
                    placeholder="ملاحظتك (يتعلم منها هرمس)"
                    className="flex-1 min-w-[180px] rounded-lg border border-border/60 bg-background px-2 py-1.5 text-xs"
                  />
                  <button disabled={busy === p.id} onClick={() => void doDecide(p.id, "approved")}
                    className="flex items-center gap-1 rounded-lg bg-emerald-500/15 text-emerald-500 px-2.5 py-1.5 text-xs">
                    <Check className="size-3.5" /> موافقة
                  </button>
                  <button disabled={busy === p.id} onClick={() => void doDecide(p.id, "deferred")}
                    className="flex items-center gap-1 rounded-lg border border-border/60 px-2.5 py-1.5 text-xs">
                    <Clock className="size-3.5" /> تأجيل
                  </button>
                  <button disabled={busy === p.id} onClick={() => void doDecide(p.id, "rejected")}
                    className="flex items-center gap-1 rounded-lg bg-destructive/15 text-destructive px-2.5 py-1.5 text-xs">
                    <X className="size-3.5" /> رفض
                  </button>
                </div>
              ) : p.founder_note ? (
                <div className="text-[11px] text-muted-foreground">ملاحظتك: {p.founder_note}</div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {tab === "office" && (
        <div className="grid gap-3 md:grid-cols-[200px_1fr]">
          <div className="rounded-2xl border border-border/60 bg-card/40 p-2 h-max">
            <button onClick={() => { setConversationId(null); setMessages([]); }}
              className="w-full rounded-lg border border-border/60 px-2 py-1.5 text-xs mb-2 hover:bg-muted/40">
              محادثة جديدة
            </button>
            <div className="flex flex-col gap-1">
              {(data?.conversations || []).map((c: any) => (
                <button key={c.id} onClick={() => void openConversation(c.id)}
                  className={`truncate rounded-lg px-2 py-1.5 text-[11px] text-start ${conversationId === c.id ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/40"}`}>
                  {c.title}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card/40 flex flex-col min-h-[420px]">
            <div className="flex-1 overflow-auto p-3 space-y-2">
              {messages.length === 0 ? (
                <div className="text-xs text-muted-foreground p-4">
                  اسأل هرمس عن حالة المنصة أو الكلفة أو ما الذي يستحق البناء التالي. كل رقم يذكره من بيانات المرصد.
                </div>
              ) : messages.map((m) => (
                <div key={m.id} className={`rounded-xl p-2.5 text-xs whitespace-pre-wrap ${m.role === "user" ? "bg-primary/10 ms-8" : "bg-muted/40 me-8"}`}>
                  {m.content}
                  {m.usd ? <div className="mt-1 text-[10px] text-muted-foreground">{m.tokens} توكن · {money(m.usd)} (ميزانية النظام)</div> : null}
                </div>
              ))}
              <div ref={endRef} />
            </div>
            <div className="border-t border-border/60 p-2 flex items-center gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
                placeholder="اكتب إلى هرمس…"
                className="flex-1 rounded-lg border border-border/60 bg-background px-2.5 py-2 text-xs"
              />
              <button onClick={() => void send()} disabled={busy === "ask"}
                className="rounded-lg bg-primary/15 text-primary px-3 py-2 text-xs flex items-center gap-1.5">
                {busy === "ask" ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />} إرسال
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
