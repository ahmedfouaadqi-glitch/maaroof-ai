// Parts 14-15 admin panels — Publishing Ecosystem + Executive Trust Architecture.
// Rendered inside the existing Intelligence Center shell (no new dashboard page).
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useServerFn } from "@tanstack/react-start";
import { Send, ShieldCheck, RefreshCw, Loader2, Check, X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  getPublishingCenter,
  createCampaign,
  buildPublicationStrategy,
  draftPublications,
  decidePublication,
  getTrustCenter,
} from "@/lib/maaroof-publishing.functions";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

const money = (n: any) => `$${Number(n || 0).toFixed(4)}`;

/** Part 14 — Publishing Ecosystem: platforms, campaigns, strategy, approvals. */
export function PublishingCenterSection() {
  const { t } = useI18n();
  const load = useServerFn(getPublishingCenter);
  const mkCampaign = useServerFn(createCampaign);
  const mkStrategy = useServerFn(buildPublicationStrategy);
  const mkDrafts = useServerFn(draftPublications);
  const decide = useServerFn(decidePublication);

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [goal, setGoal] = useState("");
  const [name, setName] = useState("");
  const [strategy, setStrategy] = useState<any>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const refresh = async () => {
    try { setData(await load()); }
    catch (e: any) { toast.error(String(e?.message || e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, []);

  const connected = useMemo(() => {
    const kinds = new Set(((data?.channels as any[]) || []).filter((c) => c.active).map((c) => c.kind));
    return kinds;
  }, [data]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">{t("auto.loading")}</div>;

  const platforms: any[] = data?.platforms || [];
  const campaigns: any[] = data?.campaigns || [];
  const publications: any[] = data?.publications || [];
  const settings = data?.settings || {};

  const toggle = (k: string) =>
    setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));

  const doStrategy = async () => {
    if (!goal.trim()) return toast.error(t("auto.write_the_publishing_goal_first"));
    if (!picked.length) return toast.error(t("auto.choose_at_least_one_platform"));
    setBusy("strategy");
    try {
      const r: any = await mkStrategy({ data: { goal, platforms: picked } });
      setStrategy(r.strategy);
      const seeded: Record<string, string> = {};
      for (const p of r.strategy.per_platform) seeded[p.platform] = "";
      setDrafts(seeded);
      toast.success(t("auto.ready_strategy_for_each_platform_separately"));
    } catch (e: any) { toast.error(String(e?.message || e)); }
    finally { setBusy(null); }
  };

  const doCampaign = async () => {
    if (!name.trim() || !picked.length) return toast.error(t("auto.campaign_name_and_platforms_are_required"));
    setBusy("campaign");
    try {
      await mkCampaign({ data: { name, goal: goal || null, platforms: picked } });
      setName("");
      toast.success(t("auto.campaign_created"));
      await refresh();
    } catch (e: any) { toast.error(String(e?.message || e)); }
    finally { setBusy(null); }
  };

  const doDrafts = async () => {
    const items = Object.entries(drafts)
      .filter(([, v]) => v.trim().length > 2)
      .map(([platform_key, content]) => ({ platform_key, content }));
    if (!items.length) return toast.error(t("auto.write_at_least_one_post_content"));
    setBusy("drafts");
    try {
      await mkDrafts({ data: { items } });
      toast.success(t("auto.drafts_saved_nothing_will_be_published"));
      setDrafts({});
      await refresh();
    } catch (e: any) {
      const m = String(e?.message || e);
      toast.error(m.includes("publishing_disabled") ? t("auto.publishing_system_is_off_from_settings") : m);
    }
    finally { setBusy(null); }
  };

  const act = async (id: string, decision: "approve" | "reject" | "publish") => {
    setBusy(id + decision);
    try {
      const r: any = await decide({ data: { publication_id: id, decision } });
      if (r?.ok === false) toast.error(r?.error || t("auto.publish_failed"));
      else toast.success(decision === "publish" ? t("auto.published") : decision === "approve" ? t("auto.approved_2") : t("auto.rejected_2"));
      await refresh();
    } catch (e: any) { toast.error(String(e?.message || e)); }
    finally { setBusy(null); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-semibold"><Send className="size-4" /> منظومة النشر التنفيذي</h3>
        <button onClick={() => void refresh()} className="rounded-lg border px-2 py-1 text-xs flex items-center gap-1">
          <RefreshCw className="size-3" /> {t("auto.update")}
        </button>
      </div>
      {!settings.enabled && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
          المنظومة مُطفأة حالياً — يمكنك التخطيط، لكن حفظ المسودات معطّل حتى تُفعّلها من إعدادات معروف.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Stat label={t("auto.available_platforms")} value={platforms.length} />
        <Stat label={t("auto.connected_channels")} value={connected.size} />
        <Stat label={t("auto.campaigns")} value={campaigns.length} />
        <Stat label={t("auto.saved_posts")} value={publications.length} />
      </div>

      <div className="rounded-xl border border-border/60 bg-card/60 p-3 space-y-3">
        <div className="text-sm font-medium">{t("auto.1_goal_and_platforms")}</div>
        <textarea
          value={goal} onChange={(e) => setGoal(e.target.value)}
          placeholder={t("auto.example_introducing_a_new_service_to")}
          className="w-full rounded border bg-background p-2 text-sm" rows={2}
        />
        <div className="flex flex-wrap gap-1.5">
          {platforms.map((p) => {
            const on = picked.includes(p.platform_key);
            const linked = connected.has(p.platform_key);
            return (
              <button
                key={p.platform_key}
                onClick={() => toggle(p.platform_key)}
                className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                  on ? "bg-primary/15 border-primary/40 text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
                title={linked ? t("auto.connected_channel") : t("auto.not_connected_can_only_plan")}
              >
                {p.label}{linked ? " ✓" : ""}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => void doStrategy()} disabled={busy === "strategy"}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs text-primary-foreground flex items-center gap-1">
            {busy === "strategy" ? <Loader2 className="size-3 animate-spin" /> : null} بناء الاستراتيجية
          </button>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("auto.campaign_name_optional")}
            className="rounded border bg-background px-2 py-1 text-xs" />
          <button onClick={() => void doCampaign()} disabled={busy === "campaign"}
            className="rounded-lg border px-3 py-1.5 text-xs">{t("auto.create_campaign")}</button>
        </div>
      </div>

      {strategy && (
        <div className="rounded-xl border border-border/60 bg-card/60 p-3 space-y-3">
          <div className="text-sm font-medium">{t("auto.2_strategy_per_platform_write_the")}</div>
          {strategy.per_platform.map((p: any) => (
            <div key={p.platform} className="rounded-lg border p-2 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-semibold">{p.label}</span>
                {p.audience && <span className="text-muted-foreground">الجمهور: {p.audience}</span>}
                {p.best_time && <span className="text-muted-foreground">التوقيت: {p.best_time}</span>}
                {p.text_limit && <span className="text-muted-foreground">حد النص: {p.text_limit}</span>}
              </div>
              {p.notes && <div className="text-[11px] text-muted-foreground">{p.notes}</div>}
              <textarea
                rows={3} className="w-full rounded border bg-background p-2 text-xs"
                placeholder={`نص المنشور الخاص بـ${p.label}`}
                value={drafts[p.platform] ?? ""}
                onChange={(e) => setDrafts((d) => ({ ...d, [p.platform]: e.target.value }))}
              />
            </div>
          ))}
          <button onClick={() => void doDrafts()} disabled={busy === "drafts"}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs text-primary-foreground flex items-center gap-1">
            {busy === "drafts" ? <Loader2 className="size-3 animate-spin" /> : null} حفظ كمسودات
          </button>
        </div>
      )}

      <div className="rounded-xl border border-border/60 bg-card/60 p-3">
        <div className="text-sm font-medium mb-2">{t("auto.3_posts_and_approvals")}</div>
        {!publications.length && <div className="text-xs text-muted-foreground">{t("auto.no_posts_yet")}</div>}
        <div className="space-y-2">
          {publications.map((p) => (
            <div key={p.id} className="rounded-lg border p-2 text-xs space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{p.platform_key}</span>
                <span className="rounded bg-muted px-1.5 py-0.5">{p.status}</span>
                <span className="text-muted-foreground">{p.stage}</span>
                {p.trust_score != null && <span className="text-muted-foreground">ثقة {p.trust_score}</span>}
                <span className="text-muted-foreground">{money(p.cost_usd)}</span>
              </div>
              <div className="text-muted-foreground line-clamp-2 whitespace-pre-wrap">{p.content}</div>
              {p.error && <div className="text-destructive">{p.error}</div>}
              {p.status === "draft" && (
                <div className="flex gap-2 pt-1">
                  <button onClick={() => void act(p.id, "publish")} disabled={!!busy}
                    className="rounded border px-2 py-0.5 flex items-center gap-1"><Check className="size-3" /> اعتماد ونشر</button>
                  <button onClick={() => void act(p.id, "approve")} disabled={!!busy}
                    className="rounded border px-2 py-0.5">{t("auto.approved_only")}</button>
                  <button onClick={() => void act(p.id, "reject")} disabled={!!busy}
                    className="rounded border px-2 py-0.5 flex items-center gap-1"><X className="size-3" /> {t("auto.reject")}</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Part 15 — Trust Architecture: living trust profiles, weak links, movements. */
export function TrustCenterSection() {
  const { t } = useI18n();
  const load = useServerFn(getTrustCenter);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<string>("all");

  const refresh = async () => {
    try { setData(await load()); }
    catch (e: any) { toast.error(String(e?.message || e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, []);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">{t("auto.loading")}</div>;

  const profiles: any[] = data?.profiles || [];
  const weak: any[] = data?.weak_links || [];
  const events: any[] = data?.events || [];
  const settings = data?.settings || {};
  const shown = type === "all" ? profiles : profiles.filter((p) => p.entity_type === type);
  const types = Array.from(new Set(profiles.map((p) => p.entity_type)));
  const avg = profiles.length
    ? Math.round(profiles.reduce((a, p) => a + Number(p.trust_score || 0), 0) / profiles.length)
    : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-semibold"><ShieldCheck className="size-4" /> هندسة الثقة التنفيذية</h3>
        <button onClick={() => void refresh()} className="rounded-lg border px-2 py-1 text-xs flex items-center gap-1">
          <RefreshCw className="size-3" /> {t("auto.update")}
        </button>
      </div>
      {!settings.enabled && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
          محرك الثقة مُطفأ — الأرقام أدناه لما سُجّل سابقاً فقط.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Stat label={t("auto.rated_entities")} value={profiles.length} />
        <Stat label={t("auto.trust_average")} value={`${avg}%`} />
        <Stat label={t("auto.weak_loops")} value={weak.length} />
        <Stat label={t("auto.minimum_confidence_threshold")} value={`${settings.min_trust ?? 55}%`} />
      </div>

      {weak.length > 0 && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 space-y-1">
          <div className="flex items-center gap-2 text-sm font-medium"><AlertTriangle className="size-4" /> الحلقات الأضعف</div>
          {weak.map((w, i) => (
            <div key={i} className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{w.entity_type}: {w.entity_key}</span> — {w.trust_score}% ({w.reason})
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {["all", ...types].map((t) => (
          <button key={t} onClick={() => setType(t)}
            className={`rounded-full border px-2.5 py-1 text-[11px] ${type === t ? "bg-primary/15 border-primary/40 text-primary" : "text-muted-foreground"}`}>
            {t === "all" ? t("auto.all") : t}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border/60 bg-card/60 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-muted-foreground">
            <tr className="border-b">
              {[t("auto.entity"), t("auto.type"), t("auto.trust_2"), t("auto.experiments"), t("auto.success_3"), t("auto.failure_2"), t("auto.prediction_accuracy"), t("auto.cost_average")].map((h) => (
                <th key={h} className="p-2 text-start font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!shown.length && <tr><td colSpan={8} className="p-3 text-muted-foreground">{t("auto.no_confidence_data_yet")}</td></tr>}
            {shown.map((p) => (
              <tr key={p.id} className="border-b last:border-0">
                <td className="p-2 font-medium">{p.entity_key}</td>
                <td className="p-2 text-muted-foreground">{p.entity_type}</td>
                <td className="p-2">{p.trust_score}%</td>
                <td className="p-2">{p.samples}</td>
                <td className="p-2">{p.successes}</td>
                <td className="p-2">{p.failures}</td>
                <td className="p-2">{p.prediction_accuracy ?? "—"}</td>
                <td className="p-2">{p.avg_cost_usd != null ? money(p.avg_cost_usd) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-border/60 bg-card/60 p-3">
        <div className="text-sm font-medium mb-2">{t("auto.last_confidence_movement")}</div>
        {!events.length && <div className="text-xs text-muted-foreground">{t("auto.no_events_yet_2")}</div>}
        <div className="space-y-1">
          {events.map((e) => (
            <div key={e.id} className="text-xs flex flex-wrap items-center gap-2">
              <span className={Number(e.delta) >= 0 ? "text-emerald-500" : "text-destructive"}>
                {Number(e.delta) >= 0 ? "+" : ""}{Number(e.delta).toFixed(1)}
              </span>
              <span className="font-medium">{e.entity_type}: {e.entity_key}</span>
              <span className="text-muted-foreground">→ {e.score_after}% — {e.reason}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
