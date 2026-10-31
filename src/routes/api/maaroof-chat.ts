// Maaroof chat mode. GET → history; POST { message, lang } → grounded reply; DELETE → clear.
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { detectGeoFromRequest, effectiveGeo, normalizeGeoScope } from "@/lib/maaroof/geo.server";
import { buildFiveAxisAuditGoal, detectFiveAxisAuditRequest, fiveAxisAuditReply } from "@/lib/maaroof/chat-axis-audit";
import { MAX_DARDASHA_MESSAGE_CHARS } from "@/lib/maaroof/dardasha";

async function authed(request: Request) {
  const auth = request.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data } = await admin.auth.getUser(auth.slice(7));
  return data.user?.id ? { admin: admin as any, userId: data.user.id } : null;
}

async function resolveWorkspace(db: any, userId: string, raw: unknown): Promise<{ id: string | null; error?: string }> {
  if (raw == null || raw === "") return { id: null };
  if (typeof raw !== "string" || !/^[0-9a-f-]{36}$/i.test(raw)) return { id: null, error: "invalid_workspace" };
  const { data } = await db.from("workspaces").select("id").eq("id", raw).eq("owner_id", userId).maybeSingle();
  return data ? { id: data.id } : { id: null, error: "workspace_not_found" };
}
function scopeWorkspace(query: any, workspaceId: string | null) {
  return workspaceId ? query.eq("workspace_id", workspaceId) : query.is("workspace_id", null);
}

// "legacy" = messages saved before conversations existed.
function byThread<T extends { is: any; eq: any }>(q: T, threadId: string): T {
  return threadId === "legacy" ? q.is("thread_id", null) : q.eq("thread_id", threadId);
}

export const Route = createFileRoute("/api/maaroof-chat")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const a = await authed(request); if (!a) return Response.json({ error: "auth_required" }, { status: 401 });
        const workspace = await resolveWorkspace(a.admin, a.userId, new URL(request.url).searchParams.get("workspace_id"));
        if (workspace.error) return Response.json({ error: workspace.error }, { status: 400 });
        const threadId = new URL(request.url).searchParams.get("thread_id") || "";
        const { data: threads } = await scopeWorkspace(a.admin.from("chat_threads").select("id, title, updated_at").eq("user_id", a.userId), workspace.id).order("updated_at", { ascending: false }).limit(50);
        const { count: legacyCount } = await scopeWorkspace(a.admin.from("maaroof_chat_messages").select("id", { count: "exact", head: true }).eq("user_id", a.userId).is("thread_id", null), workspace.id);
        const { data } = threadId
          ? await byThread(scopeWorkspace(a.admin.from("maaroof_chat_messages").select("id, role, content, grounded, created_at").eq("user_id", a.userId), workspace.id), threadId).order("created_at", { ascending: true }).limit(200)
          : { data: [] as any[] };
        const { data: prof } = await a.admin.from("profiles").select("is_subscribed, tokens_balance, tokens_daily_limit, tokens_monthly_limit").eq("id", a.userId).maybeSingle();
        const p: any = prof || {};
        const today = new Date(); today.setUTCHours(0, 0, 0, 0);
        const { count } = await a.admin.from("maaroof_chat_messages").select("id", { count: "exact", head: true }).eq("user_id", a.userId).eq("role", "user").gte("created_at", today.toISOString());
        const { chatQuota } = await import("@/lib/maaroof/chat-policy");
        const { isUnlimitedAccount } = await import("@/lib/tokens.server");
        const unlimited = await isUnlimitedAccount(a.userId);
        const { data: jobs } = await scopeWorkspace(a.admin.from("maaroof_jobs").select("id, goal, status, created_at").eq("user_id", a.userId).eq("status", "completed"), workspace.id).order("created_at", { ascending: false }).limit(15);
        return Response.json({ items: data ?? [], threads: [...(threads ?? []), ...((legacyCount || 0) > 0 ? [{ id: "legacy", title: "محادثات سابقة", updated_at: null }] : [])], tasks: jobs ?? [], quota: chatQuota({ metered: Number(p.tokens_balance) > 0 || p.tokens_daily_limit != null || p.tokens_monthly_limit != null, subscribed: !!p.is_subscribed, todayUserMessages: count || 0, unlimited }) });
      },
      DELETE: async ({ request }) => {
        const a = await authed(request); if (!a) return Response.json({ error: "auth_required" }, { status: 401 });
        const workspace = await resolveWorkspace(a.admin, a.userId, new URL(request.url).searchParams.get("workspace_id"));
        if (workspace.error) return Response.json({ error: workspace.error }, { status: 400 });
        const threadId = new URL(request.url).searchParams.get("thread_id") || "";
        if (!threadId) return Response.json({ error: "thread_required" }, { status: 400 });
        await byThread(scopeWorkspace(a.admin.from("maaroof_chat_messages").delete().eq("user_id", a.userId), workspace.id), threadId);
        if (threadId !== "legacy") await a.admin.from("chat_threads").delete().eq("user_id", a.userId).eq("id", threadId);
        return Response.json({ ok: true });
      },
      POST: async ({ request }) => {
        const a = await authed(request); if (!a) return Response.json({ error: "auth_required" }, { status: 401 });
        const { admin, userId } = a;
        const body = await request.json().catch(() => ({} as any));
        const workspace = await resolveWorkspace(admin, userId, body?.workspace_id ?? new URL(request.url).searchParams.get("workspace_id"));
        if (workspace.error) return Response.json({ error: workspace.error }, { status: 400 });
        const workspaceId = workspace.id;
        const message = String(body?.message || "").trim();
        if (!message) return Response.json({ error: "message_required" }, { status: 400 });
        if (message.length > MAX_DARDASHA_MESSAGE_CHARS) {
          return Response.json({ error: "message_too_long", max_chars: MAX_DARDASHA_MESSAGE_CHARS }, { status: 413 });
        }
        let threadId = typeof body?.thread_id === "string" && (body.thread_id === "legacy" || /^[0-9a-f-]{36}$/i.test(body.thread_id)) ? body.thread_id : "";
        if (threadId && threadId !== "legacy") {
          const { data: th } = await admin.from("chat_threads").select("id").eq("id", threadId).eq("user_id", userId).maybeSingle();
          if (!th) threadId = "";
        }
        const lang = (["ar", "en", "ku"].includes(body?.lang) ? body.lang : "ar") as "ar" | "en" | "ku";
        const axisAuditRequest = detectFiveAxisAuditRequest(message);
        const geoScope = normalizeGeoScope(body?.geo_scope);
        const geo = effectiveGeo(detectGeoFromRequest(request), geoScope);
        const { chatAllowed, parseReply, groundedSystemPrompt } = await import("@/lib/maaroof/chat-policy");
        const { ownerIdentity, freshFacts, interviewFacts } = await import("@/lib/knowledge-facts");

        const { data: prof } = await admin.from("profiles").select("full_name, brand_name, account_kind, specialty, hq_country, target_markets, entity_links, entity_verified_at, is_subscribed, tokens_balance, tokens_daily_limit, tokens_monthly_limit").eq("id", userId).maybeSingle();
        const p: any = prof || {};
        const metered = Number(p.tokens_balance) > 0 || p.tokens_daily_limit != null || p.tokens_monthly_limit != null;
        const { isUnlimitedAccount } = await import("@/lib/tokens.server");
        const unlimited = await isUnlimitedAccount(userId);
        const today = new Date(); today.setUTCHours(0, 0, 0, 0);
        const { count } = await admin.from("maaroof_chat_messages").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("role", "user").gte("created_at", today.toISOString());
        if (!chatAllowed({ metered, subscribed: !!p.is_subscribed, todayUserMessages: count || 0, unlimited })) {
          return Response.json({ error: "chat_limit" }, { status: 402 });
        }
        const { chatQuota } = await import("@/lib/maaroof/chat-policy");
        const quota = chatQuota({ metered, subscribed: !!p.is_subscribed, todayUserMessages: (count || 0) + 1, unlimited });
        // Optional context from an earlier task in the SAME workspace only (full isolation).
        let taskCtx: string[] = [];
        const taskId = typeof body?.task_id === "string" ? body.task_id : "";
        if (taskId && /^[0-9a-f-]{36}$/i.test(taskId)) {
          const { data: job } = await scopeWorkspace(admin.from("maaroof_jobs")
            .select("goal, status")
            .eq("id", taskId).eq("user_id", userId), workspaceId).maybeSingle();
          if (job) {
            const { data: recorded } = await admin.from("maaroof_job_events")
              .select("event_type, payload, seq").eq("job_id", taskId).eq("user_id", userId)
              .in("event_type", ["final", "tool_result", "error", "phase"])
              .order("seq", { ascending: true }).limit(100);
            const relevant = ((recorded || []) as any[])
              .filter((e) => e.event_type !== "tool_result" || e.payload?.ok === true)
              .slice(-12)
              .map((e) => `${e.event_type}: ${JSON.stringify(e.payload || {}).slice(0, 450)}`)
              .join("\n").slice(0, 3600);
            taskCtx = [
              `[previous task] goal=${String((job as any).goal || "").slice(0, 500)}; status=${String((job as any).status || "unknown")}`,
              relevant ? `[recorded previous task events and evidence]\n${relevant}` : "[recorded previous task events] No useful tool results were saved; do not assume the task succeeded.",
            ];
          }
        }

        // Knowledge actually held for this user — the only ground Maaroof speaks from.
        const [{ data: kf }, { data: iv }, { data: ws }, { data: hist }] = await Promise.all([
          scopeWorkspace(admin.from("knowledge_facts").select("source, fact, confidence, created_at, expires_at").eq("user_id", userId), workspaceId).order("created_at", { ascending: false }).limit(120),
          workspaceId ? Promise.resolve({ data: [] as any[] }) : admin.from("knowledge_space_interviews").select("question, answer, answered_at, created_at").eq("user_id", userId).not("answer", "is", null).limit(60),
          workspaceId ? admin.from("workspaces").select("name, space_kind, profile, goals, entity_truth_card, onboarding, settings, brand_url, brand_summary, keywords, country, city").eq("owner_id", userId).eq("id", workspaceId).limit(1) : Promise.resolve({ data: [] as any[] }),
          threadId ? byThread(scopeWorkspace(admin.from("maaroof_chat_messages").select("role, content").eq("user_id", userId), workspaceId), threadId).order("created_at", { ascending: false }).limit(40) : Promise.resolve({ data: [] as any[] }),
        ]);
        const id = ownerIdentity(p);
        const conf = id.verified ? "evidence" : "unverified profile entry";
        const knowledge: string[] = [
          ...(!workspaceId ? id.known.map((k) => `[profile, ${conf}] ${k}: ${typeof p[k] === "object" ? JSON.stringify(p[k]) : p[k]}`) : []),
          ...(ws || []).map((w: any) => `[workspace identity — user-entered, not independently verified] ${w.space_kind}: ${w.name}; profile=${JSON.stringify(w.profile || {})}; truth_card=${JSON.stringify(w.entity_truth_card || {})}; onboarding=${JSON.stringify(w.onboarding || {})}; settings=${JSON.stringify(w.settings || {})}; goals=${JSON.stringify(w.goals || [])}; website=${w.brand_url || ""}; sector=${w.brand_summary || ""}; keywords=${JSON.stringify(w.keywords || [])}; country=${w.country || ""}; city=${w.city || ""}`),
          ...freshFacts((kf || []) as any[]).map((f: any) => `[${f.source}, ${f.confidence}] ${String(f.fact).slice(0, 300)}`),
          ...interviewFacts((iv || []) as any).map((f) => `[interview] ${f.fact.slice(0, 300)}`),
        ].slice(0, 120);
        knowledge.unshift(
          `[geographic scope] ${geo.label}; country=${geo.country || "not resolved"}; city=${geo.city || "not resolved"}. Respect this selected scope. If visitor location is unavailable, do not infer or invent a country.`,
          ...taskCtx,
        );

        // Attached spreadsheets / Google Sheets links: full structured data for the model (not saved into history).
        let fileCtx = ""; const sheetCards: any[] = [];
        try {
          const ids = (Array.isArray(body?.attachment_ids) ? body.attachment_ids : []).filter((x: any) => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x)).slice(0, 5);
          if (ids.length) {
            const { data: atts } = await scopeWorkspace(admin.from("task_attachments").select("id, name, analysis, structure, status").eq("user_id", userId).in("id", ids), workspaceId);
            for (const at of (atts || []) as any[]) {
              if (at.structure?.digest) { fileCtx += `\n\n[FILE "${at.name}" — full structured read]\n${String(at.structure.digest).slice(0, 90000 / ids.length)}`; sheetCards.push({ name: at.name, attachment_id: at.id, ...at.structure, digest: undefined }); }
              else if (at.analysis) fileCtx += `\n\n[FILE "${at.name}" — analysis]\n${String(at.analysis).slice(0, 12000)}`;
            }
          }
          const { googleSheetId, buildStructure, workbookDigest } = await import("@/lib/spreadsheet-reader");
          const gid = googleSheetId(message);
          if (gid) {
            const { fetchPublicGoogleSheet } = await import("@/lib/spreadsheet-reader.server");
            const g = await fetchPublicGoogleSheet(gid);
            if ("sheets" in g) { fileCtx += `\n\n[GOOGLE SHEET ${gid} — full structured read]\n${workbookDigest(g.sheets, 90000)}`; sheetCards.push({ name: "Google Sheet", ...buildStructure(g.sheets, "gsheet") }); }
            else fileCtx += `\n\n[GOOGLE SHEET ${gid}] Could not be read (${g.error}). Tell the user exactly this: the link must be shared as "Anyone with the link can view", or they can upload the file directly. Do not claim to know its contents.`;
          }
        } catch (e) { console.warn("[maaroof-chat] file context failed", String((e as any)?.message || e).slice(0, 160)); }
        if (fileCtx) fileCtx = `\n\n---\nThe user attached data. Read ALL of it. Start with an inventory: every sheet by exact name, its row count and columns. Then per sheet: what it contains, key figures (top items by volume/score when such columns exist), gaps and issues. Then concrete GEO/SEO/Ads recommendations and next steps. Quote numbers only from the data; label inferences as inferences.${fileCtx}`;

        let reply: { text: string; needsTask: boolean; task: { kind: "scan" | "plan" | "recommend" | "simulate"; goal: string } | null } = { text: "", needsTask: false, task: null };
        const { openRouterChat, detectCouncilRequest } = await import("@/lib/maaroof/openrouter.server");
        const { detectGeoScoreRequest } = await import("@/lib/maaroof/chat-direct");
        const geoScore = !axisAuditRequest && !fileCtx ? detectGeoScoreRequest(message) : null;
        let directDone = false;
        let council: any = null;
        if (geoScore) {
          // One tool => runs directly in the chat; the tool itself charges only on success.
          try {
            const { dispatchToolInProcess } = await import("@/lib/maaroof/direct-tool-dispatch.server");
            const req = new Request(new URL("/api/analyze", request.url), {
              method: "POST",
              headers: { "content-type": "application/json", authorization: request.headers.get("authorization") || "" },
              body: JSON.stringify({ text: geoScore.text, lang, scope: geo }),
            });
            const res = await dispatchToolInProcess("/api/analyze", req, userId);
            const j: any = res ? await res.json().catch(() => null) : null;
            if (res?.ok && j && typeof j === "object" && !j.error) {
              const r = j.result || j;
              const s = (k: string) => (typeof r?.[k] === "number" ? Math.round(r[k]) : "—");
              const head = lang === "en" ? "GEO score for your text" : lang === "ku" ? "نمرەی GEO بۆ دەقەکەت" : "درجة GEO لنصك";
              const lbl = lang === "en" ? ["Overall", "Authority", "Local relevance", "Citation"] : ["الإجمالي", "السلطة", "الملاءمة المحلية", "قابلية الاقتباس"];
              const lines = [`### ${head}`, `- **${lbl[0]}:** ${s("score") !== "—" ? s("score") : s("overall")}/100`, `- **${lbl[1]}:** ${s("authority")}/100`, `- **${lbl[2]}:** ${s("local")}/100`, `- **${lbl[3]}:** ${s("citation")}/100`];
              if (r?.ai_view) lines.push("", String(r.ai_view));
              const ex = r?.explain || {};
              for (const k of ["authority", "local", "citation"]) if (ex[k]) lines.push(`- ${ex[k]}`);
              reply = { text: lines.join("\n"), needsTask: false, task: null };
              directDone = true;
              try {
                const { runToolCouncil } = await import("@/lib/maaroof/tool-council.server");
                council = await runToolCouncil({ tool: "geo_score", input: geoScore.text, result: lines.join("\n"), lang });
              } catch { council = null; }
            }
          } catch (e) { console.warn("[maaroof-chat] direct analyze failed", String((e as any)?.message || e).slice(0, 160)); }
        }
        if (directDone) {
          // reply already set from a real tool run
        } else if (!axisAuditRequest && !fileCtx && detectCouncilRequest(message)) {
          // Ten-engine council runs as a real approved task (live probe, charged only for answering engines).
          const t = lang === "en"
            ? "I can ask all ten Maaroof engines now: each one gets the same unbiased question, then an evidence check. You'll see every engine's status, answer, real sources and the conflict resolution. Approve to start."
            : lang === "ku"
              ? "دەتوانم ئێستا پرسیار لە هەر دە بزوێنەری معروف بکەم و وەڵام و سەرچاوە ڕاستەقینەکان پیشان بدەم. بۆ دەستپێکردن پەسەندی بکە."
              : "يمكنني الآن سؤال محركات معروف العشرة: سؤال محايد واحد لكل محرك ثم تحقق بالأدلة، وستظهر حالة كل محرك وإجابته ومصادره الحقيقية وحسم التعارض. وافق للبدء.";
          reply = { text: t, needsTask: true, task: { kind: "scan", goal: `${message}\n\n[visibility: probe all ten engines]` } };
        } else if (axisAuditRequest) {
          // This is an explicit user request for a live audit. Return an exact, localized task draft;
          // no live tools are run here, and the existing workspace approval/cost review still applies.
          reply = { text: fiveAxisAuditReply(lang), needsTask: true, task: { kind: "scan", goal: buildFiveAxisAuditGoal(lang) } };
        } else {
          const apiKey = process.env.LOVABLE_API_KEY;
          const { LOVABLE_AI_CHAT_COMPLETIONS_URL, lovableAiHeaders } = await import("@/lib/lovable-ai");
          const { CHAT_MODEL_CHAIN, chatSamplingParams } = await import("@/lib/model-params");
          const history = ((hist || []) as any[]).reverse().map((m) => ({ role: m.role, content: m.content }));
          const msgs = [{ role: "system", content: groundedSystemPrompt(lang, knowledge) }, ...history, { role: "user", content: message + fileCtx }];
          // OpenRouter is primary; the existing gateway chain is the fallback.
          let raw = await openRouterChat(msgs); let lastErr = "ai_failed";
          if (!raw && !apiKey) return Response.json({ error: "server_not_configured" }, { status: 500 });
          for (const model of raw ? [] : CHAT_MODEL_CHAIN) {
            try {
              const res = await fetch(LOVABLE_AI_CHAT_COMPLETIONS_URL, {
                method: "POST", headers: lovableAiHeaders(apiKey!), signal: AbortSignal.timeout(90_000),
                body: JSON.stringify({ model, ...chatSamplingParams(model), messages: msgs }),
              });
              if (!res.ok) { lastErr = res.status === 429 ? "rate_limited" : res.status === 402 ? "credits" : "ai_failed"; continue; }
              const j: any = await res.json().catch(() => null);
              raw = String(j?.choices?.[0]?.message?.content || "").trim();
              if (raw) break;
            } catch { lastErr = "ai_failed"; }
          }
          if (!raw) return Response.json({ error: lastErr }, { status: 502 });
          reply = parseReply(raw);
          try { const { brandModelIds } = await import("@/lib/maaroof/model-council"); reply.text = brandModelIds(reply.text, lang); } catch {}
        }

        // Charge only after a successful reply, for metered non-approved accounts.
        if (metered && !unlimited) {
          const { chargeTokens, chargeFailureBody } = await import("@/lib/tokens.server");
          const charge = await chargeTokens({ userId, toolKey: "maaroof.chat", meta: { chars: message.length } });
          if (!charge.ok) return Response.json(chargeFailureBody(charge.reason, (charge as any).left), { status: 402 });
        }
        const grounded = { council, knowledge_items: knowledge.length, needs_task: reply.needsTask, task: reply.task, geo_scope: geo, axis_audit_request: axisAuditRequest };
        if (!threadId) {
          const { data: th, error: thErr } = await admin.from("chat_threads").insert({ user_id: userId, workspace_id: workspaceId, title: message.replace(/\s+/g, " ").slice(0, 60) }).select("id").single();
          if (thErr) console.error("[maaroof-chat] thread create failed", thErr.message);
          threadId = th?.id || "";
        } else if (threadId !== "legacy") {
          await admin.from("chat_threads").update({ updated_at: new Date().toISOString() }).eq("id", threadId).eq("user_id", userId);
        }
        const tid = threadId && threadId !== "legacy" ? threadId : null;
        const { error: insErr } = await admin.from("maaroof_chat_messages").insert([
          { user_id: userId, workspace_id: workspaceId, thread_id: tid, role: "user", content: message },
          { user_id: userId, workspace_id: workspaceId, thread_id: tid, role: "assistant", content: reply.text, grounded },
        ]);
        if (insErr) console.error("[maaroof-chat] save failed", insErr.message);
        return Response.json({ thread_id: threadId || null, council, text: reply.text, needs_task: reply.needsTask, task: reply.task, axis_audit_request: axisAuditRequest, knowledge_items: knowledge.length, quota, sheets: sheetCards });
      },
    },
  },
});
