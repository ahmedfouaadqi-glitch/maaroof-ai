// Prompt 22 — "Teach Once, Work Forever"™ dashboard (subscriber add-on inside the agent).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import {
  listKnowledgeSpaces, createKnowledgeSpace, updateKnowledgeSpace, deleteKnowledgeSpace,
  listSpaceAssets, registerSpaceAsset, learnSpaceAsset, deleteSpaceAsset,
  approveSpaceKnowledge, generateSpaceInterview, answerSpaceInterview, getSpaceDashboard,
} from "@/lib/teaching.functions";
import {
  Loader2, Plus, Upload, Link2, FileText, Brain, CheckCircle2, XCircle,
  Trash2, Sparkles, MessageSquareQuote, GraduationCap, AlertTriangle,
} from "lucide-react";

type Space = any;

const TABS = ["assets", "nodes", "prompts", "interview"] as const;
type Tab = (typeof TABS)[number];

export function KnowledgeSpaces({ userId }: { userId: string | null }) {
  const { t } = useI18n();
  const list = useServerFn(listKnowledgeSpaces);
  const create = useServerFn(createKnowledgeSpace);
  const patch = useServerFn(updateKnowledgeSpace);
  const remove = useServerFn(deleteKnowledgeSpace);
  const loadAssets = useServerFn(listSpaceAssets);
  const register = useServerFn(registerSpaceAsset);
  const learn = useServerFn(learnSpaceAsset);
  const dropAsset = useServerFn(deleteSpaceAsset);
  const approve = useServerFn(approveSpaceKnowledge);
  const genQuestions = useServerFn(generateSpaceInterview);
  const answer = useServerFn(answerSpaceInterview);
  const dashboard = useServerFn(getSpaceDashboard);

  const [spaces, setSpaces] = useState<Space[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("assets");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [data, setData] = useState<{ assets: any[]; nodes: any[]; prompts: any[]; interviews: any[] }>({
    assets: [], nodes: [], prompts: [], interviews: [],
  });
  const [metrics, setMetrics] = useState<any>({});
  const [proposals, setProposals] = useState<any[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const active = useMemo(() => spaces.find((s) => s.id === activeId) || null, [spaces, activeId]);

  const refreshSpaces = useCallback(async () => {
    try {
      const r: any = await list();
      setSpaces(r.spaces || []);
      setActiveId((cur) => cur || r.spaces?.[0]?.id || null);
    } catch (e: any) { setErr(String(e?.message || e)); }
  }, [list]);

  const refreshActive = useCallback(async (id: string) => {
    try {
      const [assets, dash]: any[] = await Promise.all([
        loadAssets({ data: { spaceId: id } }),
        dashboard({ data: { spaceId: id } }),
      ]);
      setData({
        assets: assets.assets || [], nodes: assets.nodes || [],
        prompts: assets.prompts || [], interviews: assets.interviews || [],
      });
      setMetrics(dash.metrics || {});
      setProposals(dash.proposals || []);
      setSpaces((prev) => prev.map((s) => (s.id === id ? dash.space : s)));
    } catch (e: any) { setErr(String(e?.message || e)); }
  }, [loadAssets, dashboard]);

  useEffect(() => { if (userId) void refreshSpaces(); }, [userId, refreshSpaces]);
  useEffect(() => { if (activeId) void refreshActive(activeId); }, [activeId, refreshActive]);

  if (!userId) return null;

  const run = async (key: string, fn: () => Promise<any>) => {
    setBusy(key); setErr(null);
    try { await fn(); } catch (e: any) { setErr(String(e?.message || e)); } finally { setBusy(null); }
  };

  const onCreate = () =>
    run("create", async () => {
      if (newName.trim().length < 2) return;
      const r: any = await create({ data: { name: newName.trim() } });
      setNewName("");
      await refreshSpaces();
      setActiveId(r.space?.id || null);
    });

  const onUpload = (files: FileList | null) =>
    run("upload", async () => {
      if (!files?.length || !activeId) return;
      for (const file of Array.from(files).slice(0, 10)) {
        const path = `${userId}/${activeId}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
        const up = await supabase.storage.from("knowledge-spaces").upload(path, file, { upsert: false });
        if (up.error) throw new Error(up.error.message);
        const reg: any = await register({
          data: {
            spaceId: activeId, title: file.name, sourceType: "file", filePath: path,
            mimeType: file.type || "application/octet-stream", sizeBytes: file.size,
          },
        });
        await learn({ data: { assetId: reg.asset.id } });
      }
      await refreshActive(activeId);
    });

  const onAddUrl = () =>
    run("url", async () => {
      if (!activeId || !/^https?:\/\//i.test(url)) return;
      const reg: any = await register({ data: { spaceId: activeId, title: url, sourceType: "url", sourceUrl: url } });
      setUrl("");
      await learn({ data: { assetId: reg.asset.id } });
      await refreshActive(activeId);
    });

  const onAddText = () =>
    run("text", async () => {
      if (!activeId || text.trim().length < 20) return;
      const reg: any = await register({
        data: { spaceId: activeId, title: text.trim().slice(0, 60), sourceType: "text", text: text.trim() },
      });
      setText("");
      await learn({ data: { assetId: reg.asset.id } });
      await refreshActive(activeId);
    });

  const metricCards = [
    { label: t("teach_assets"), value: metrics.documents_processed ?? 0 },
    { label: t("teach_learned"), value: metrics.documents_learned ?? 0 },
    { label: t("teach_nodes"), value: metrics.knowledge_nodes ?? 0 },
    { label: t("teach_prompts"), value: metrics.prompts ?? 0 },
    { label: "Confidence", value: `${metrics.confidence ?? 0}%` },
    { label: "Reality", value: `${metrics.reality ?? 0}%` },
  ];

  return (
    <section className="rounded-2xl border border-border/60 bg-card/60 p-4 sm:p-6 backdrop-blur">
      <header className="flex flex-wrap items-center gap-3">
        <GraduationCap className="h-5 w-5 text-primary" />
        <div className="min-w-0">
          <h2 className="text-lg font-semibold leading-tight">{t("teach_title")}</h2>
          <p className="text-xs text-muted-foreground">{t("teach_subtitle")}</p>
        </div>
      </header>

      {err && (
        <p className="mt-3 flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertTriangle className="h-3.5 w-3.5" /> {err}
        </p>
      )}

      {/* Spaces rail */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {spaces.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveId(s.id)}
            className={`rounded-full border px-3 py-1.5 text-xs transition ${
              s.id === activeId ? "border-primary bg-primary/15 text-primary" : "border-border/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            {s.name} · {s.nodes_count ?? 0}
          </button>
        ))}
        <div className="flex items-center gap-1">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t("teach_space_name")}
            className="w-40 rounded-full border border-border/60 bg-background/60 px-3 py-1.5 text-xs outline-none focus:border-primary"
          />
          <button
            onClick={onCreate}
            disabled={busy === "create"}
            className="inline-flex items-center gap-1 rounded-full border border-primary/50 px-3 py-1.5 text-xs text-primary disabled:opacity-50"
          >
            {busy === "create" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            {t("teach_new_space")}
          </button>
        </div>
      </div>

      {!active ? (
        <p className="mt-6 text-sm text-muted-foreground">{t("teach_no_space")}</p>
      ) : (
        <>
          {/* Metrics */}
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {metricCards.map((m) => (
              <div key={m.label} className="rounded-xl border border-border/50 bg-background/40 px-3 py-2">
                <div className="text-[11px] text-muted-foreground">{m.label}</div>
                <div className="text-sm font-semibold">{m.value}</div>
              </div>
            ))}
          </div>

          {/* Ingestion controls */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <input
              ref={fileRef} type="file" multiple hidden
              onChange={(e) => { void onUpload(e.target.files); e.target.value = ""; }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={busy === "upload"}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-2 text-xs hover:border-primary disabled:opacity-50"
            >
              {busy === "upload" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {t("teach_upload")}
            </button>
            <div className="flex items-center gap-1">
              <input
                value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…"
                className="w-56 rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-xs outline-none focus:border-primary"
              />
              <button onClick={onAddUrl} disabled={busy === "url"} className="inline-flex items-center gap-1 rounded-lg border border-border/60 px-3 py-2 text-xs hover:border-primary disabled:opacity-50">
                {busy === "url" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
                {t("teach_add_url")}
              </button>
            </div>
            <label className="ms-auto inline-flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={(active.inheritance || {}).enabled !== false}
                onChange={(e) =>
                  run("inherit", async () => {
                    await patch({ data: { spaceId: active.id, inheritance: { ...(active.inheritance || {}), enabled: e.target.checked } } });
                    await refreshSpaces();
                  })
                }
              />
              {t("teach_inherit")}
            </label>
            <button
              onClick={() => run("drop", async () => { await remove({ data: { spaceId: active.id } }); setActiveId(null); await refreshSpaces(); })}
              className="inline-flex items-center gap-1 rounded-lg border border-destructive/40 px-3 py-2 text-xs text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" /> {t("teach_delete")}
            </button>
          </div>

          <div className="mt-3">
            <textarea
              value={text} onChange={(e) => setText(e.target.value)} rows={2}
              placeholder={t("teach_add_text")}
              className="w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-xs outline-none focus:border-primary"
            />
            <button onClick={onAddText} disabled={busy === "text"} className="mt-1 inline-flex items-center gap-1 rounded-lg border border-border/60 px-3 py-1.5 text-xs hover:border-primary disabled:opacity-50">
              {busy === "text" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
              {t("teach_learn")}
            </button>
          </div>

          {/* Gap proposals from Hermes supervision */}
          {proposals.length > 0 && (
            <ul className="mt-4 space-y-1.5">
              {proposals.slice(0, 4).map((p, i) => (
                <li key={i} className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs">
                  <span className="font-medium">{p.issue}</span> — {p.suggestion}
                </li>
              ))}
            </ul>
          )}

          {/* Tabs */}
          <div className="mt-5 flex gap-1 border-b border-border/50">
            {TABS.map((x) => (
              <button
                key={x}
                onClick={() => setTab(x)}
                className={`px-3 py-2 text-xs transition ${tab === x ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}
              >
                {x === "assets" ? t("teach_assets") : x === "nodes" ? t("teach_nodes") : x === "prompts" ? t("teach_prompts") : t("teach_interview")}
              </button>
            ))}
          </div>

          <div className="mt-3 space-y-2">
            {tab === "assets" && data.assets.map((a) => (
              <div key={a.id} className="rounded-xl border border-border/50 bg-background/40 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm font-medium">{a.title}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] ${
                    a.status === "learned" ? "bg-emerald-500/15 text-emerald-500"
                      : a.status === "needs_approval" ? "bg-amber-500/15 text-amber-500"
                      : a.status === "failed" ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"
                  }`}>
                    {a.status === "learned" ? t("teach_learned") : a.status === "needs_approval" ? t("teach_pending") : a.stage}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {a.nodes_created ?? 0} · {a.confidence ?? 0}% · reality {a.reality_score ?? 0}%
                  </span>
                  <div className="ms-auto flex items-center gap-1">
                    {a.status === "needs_approval" && (
                      <>
                        <button onClick={() => run(a.id, async () => { await approve({ data: { assetId: a.id, approved: true } }); await refreshActive(active.id); })} className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 px-2 py-1 text-[11px] text-emerald-500">
                          <CheckCircle2 className="h-3 w-3" /> {t("teach_approve")}
                        </button>
                        <button onClick={() => run(a.id, async () => { await approve({ data: { assetId: a.id, approved: false } }); await refreshActive(active.id); })} className="inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-1 text-[11px] text-muted-foreground">
                          <XCircle className="h-3 w-3" /> {t("teach_reject")}
                        </button>
                      </>
                    )}
                    {(a.status === "failed" || a.status === "queued") && (
                      <button onClick={() => run(a.id, async () => { await learn({ data: { assetId: a.id } }); await refreshActive(active.id); })} className="inline-flex items-center gap-1 rounded-md border border-primary/40 px-2 py-1 text-[11px] text-primary">
                        {busy === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Brain className="h-3 w-3" />} {t("teach_learn")}
                      </button>
                    )}
                    <button onClick={() => run(a.id, async () => { await dropAsset({ data: { assetId: a.id } }); await refreshActive(active.id); })} className="rounded-md border border-border/60 p-1 text-muted-foreground">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                {a.classification?.summary && <p className="mt-1.5 text-xs text-muted-foreground">{a.classification.summary}</p>}
                {a.error && <p className="mt-1.5 text-xs text-destructive">{a.error}</p>}
              </div>
            ))}

            {tab === "nodes" && data.nodes.map((n) => (
              <div key={n.id} className="rounded-xl border border-border/50 bg-background/40 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Brain className="h-3.5 w-3.5 text-primary" />
                  <span className="text-sm font-medium">{n.title}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                    {(n.payload || {}).dimension || n.layer} · {(n.payload || {}).knowledge_class || "-"}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{n.confidence}% / q{n.quality}</span>
                  <button
                    onClick={() => run(n.id, async () => { await approve({ data: { nodeId: n.id, approved: !n.approved } }); await refreshActive(active.id); })}
                    className={`ms-auto rounded-md border px-2 py-1 text-[11px] ${n.approved ? "border-emerald-500/40 text-emerald-500" : "border-amber-500/40 text-amber-500"}`}
                  >
                    {n.approved ? t("teach_learned") : t("teach_approve")}
                  </button>
                </div>
                {n.summary && <p className="mt-1.5 text-xs text-muted-foreground">{n.summary}</p>}
              </div>
            ))}

            {tab === "prompts" && data.prompts.map((p) => (
              <div key={p.id} className="rounded-xl border border-border/50 bg-background/40 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <span className="text-sm font-medium">{p.title}</span>
                  <span className="text-[11px] text-muted-foreground">q{p.quality}</span>
                  <button
                    onClick={() => run(p.id, async () => { await approve({ data: { promptId: p.id, approved: !p.approved } }); await refreshActive(active.id); })}
                    className={`ms-auto rounded-md border px-2 py-1 text-[11px] ${p.approved ? "border-emerald-500/40 text-emerald-500" : "border-amber-500/40 text-amber-500"}`}
                  >
                    {p.approved ? t("teach_learned") : t("teach_approve")}
                  </button>
                </div>
                {p.intent && <p className="mt-1.5 text-xs text-muted-foreground">{p.intent}</p>}
              </div>
            ))}

            {tab === "interview" && (
              <>
                <button
                  onClick={() => run("gen", async () => { await genQuestions({ data: { spaceId: active.id } }); await refreshActive(active.id); })}
                  disabled={busy === "gen"}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-primary/50 px-3 py-2 text-xs text-primary disabled:opacity-50"
                >
                  {busy === "gen" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquareQuote className="h-3.5 w-3.5" />}
                  {t("teach_generate_questions")}
                </button>
                {data.interviews.map((q) => (
                  <div key={q.id} className="rounded-xl border border-border/50 bg-background/40 p-3">
                    <p className="text-sm">{q.question}</p>
                    {q.answer ? (
                      <p className="mt-1.5 text-xs text-emerald-500">{q.answer}</p>
                    ) : (
                      <div className="mt-2 flex items-center gap-1">
                        <input
                          value={answers[q.id] || ""}
                          onChange={(e) => setAnswers((s) => ({ ...s, [q.id]: e.target.value }))}
                          placeholder={t("teach_answer")}
                          className="flex-1 rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-xs outline-none focus:border-primary"
                        />
                        <button
                          onClick={() => run(q.id, async () => {
                            const a = (answers[q.id] || "").trim();
                            if (!a) return;
                            await answer({ data: { interviewId: q.id, answer: a } });
                            setAnswers((s) => ({ ...s, [q.id]: "" }));
                            await refreshActive(active.id);
                          })}
                          disabled={busy === q.id}
                          className="rounded-lg border border-primary/50 px-3 py-2 text-xs text-primary disabled:opacity-50"
                        >
                          {busy === q.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t("teach_send")}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
}
