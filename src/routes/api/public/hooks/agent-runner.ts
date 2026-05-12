import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { FACTUAL_SAFETY_PROMPT, LOVABLE_AI_CHAT_COMPLETIONS_URL, lovableAiHeaders } from "@/lib/lovable-ai";

const SYSTEM_ANALYZE = `You are a GEO (Generative Engine Optimization) auditor for the Iraqi market.
Given a URL or topic, give a CONCISE summary (2-3 sentences in Arabic) of how to improve its visibility in AI search engines.
Then assign a GEO score 0-100 based on citation-worthiness. Be honest and specific. Never invent facts.`;

const SYSTEM_SUGGEST = `You are a GEO copywriter for the Iraqi market.
Given a topic or URL, write ONE short engaging social post (60-100 words) in Arabic optimized for citation by AI search engines.
Add 2-3 relevant hashtags. Never invent statistics, dates, or historical events.`;

async function callAI(apiKey: string, system: string, prompt: string) {
  const resp = await fetch(LOVABLE_AI_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: lovableAiHeaders(apiKey),
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      messages: [
        { role: "system", content: `${FACTUAL_SAFETY_PROMPT}\n\n${system}` },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!resp.ok) throw new Error(`ai ${resp.status}`);
  const data = await resp.json();
  return data?.choices?.[0]?.message?.content || "";
}

export const Route = createFileRoute("/api/public/hooks/agent-runner")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const apiKey = process.env.LOVABLE_API_KEY;
          const SUPABASE_URL = process.env.SUPABASE_URL;
          const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
          const HOOK_SECRET = process.env.RUNNER_HOOK_SECRET;
          if (!apiKey || !SUPABASE_URL || !SERVICE) {
            return Response.json({ error: "not_configured" }, { status: 500 });
          }
          // Closed by default: require shared secret header so anonymous
          // callers cannot drain AI credits or corrupt usage counters.
          if (!HOOK_SECRET) {
            console.error("[agent-runner] RUNNER_HOOK_SECRET is not set — endpoint is disabled");
            return Response.json({ error: "disabled" }, { status: 503 });
          }
          const provided = request.headers.get("x-hook-secret");
          if (!provided || provided !== HOOK_SECRET) {
            return Response.json({ error: "unauthorized" }, { status: 401 });
          }
          const admin = createClient(SUPABASE_URL, SERVICE);
          const today = new Date().toISOString().slice(0, 10);

          // Active agent subscriptions (not expired)
          const { data: subs } = await admin
            .from("user_agent_subscriptions")
            .select("*, agent_addons(*)")
            .eq("status", "active");

          let processed = 0;
          let skipped = 0;

          for (const sub of subs || []) {
            const addon = (sub as any).agent_addons;
            if (!addon) { skipped++; continue; }

            // expired?
            if (sub.expires_at && new Date(sub.expires_at) < new Date()) {
              await admin.from("user_agent_subscriptions").update({ status: "expired" }).eq("id", sub.id);
              skipped++; continue;
            }

            // monthly cap reached
            if (sub.tasks_used >= addon.monthly_tasks) { skipped++; continue; }

            // reset daily counter
            const dailyUsed = sub.last_run_date === today ? sub.tasks_used_today : 0;
            if (dailyUsed >= addon.daily_task_cap) { skipped++; continue; }

            // get user targets
            const { data: targets } = await admin
              .from("agent_targets")
              .select("*")
              .eq("user_id", sub.user_id)
              .eq("active", true)
              .limit(addon.max_targets);

            if (!targets || targets.length === 0) { skipped++; continue; }

            const remaining = Math.min(
              addon.monthly_tasks - sub.tasks_used,
              addon.daily_task_cap - dailyUsed,
            );

            let didThisRun = 0;
            for (const tg of targets) {
              if (didThisRun >= remaining) break;
              const subject = tg.url || tg.topic || "";
              if (!subject) continue;

              // Alternate: analyze, then suggest
              for (const taskType of ["analyze_url", "suggest_post"] as const) {
                if (didThisRun >= remaining) break;
                try {
                  const content = await callAI(
                    apiKey,
                    taskType === "analyze_url" ? SYSTEM_ANALYZE : SYSTEM_SUGGEST,
                    subject,
                  );
                  // attempt to extract a score from analyze
                  let score: number | null = null;
                  if (taskType === "analyze_url") {
                    const m = content.match(/(\d{1,3})\s*\/?\s*100/);
                    if (m) score = Math.min(100, parseInt(m[1], 10));
                  }
                  await admin.from("agent_tasks").insert({
                    user_id: sub.user_id,
                    target_id: tg.id,
                    task_type: taskType,
                    input: subject,
                    status: "done",
                    result: { summary: content, score },
                  });
                  didThisRun++;
                } catch (e: any) {
                  await admin.from("agent_tasks").insert({
                    user_id: sub.user_id, target_id: tg.id, task_type: taskType,
                    input: subject, status: "failed", error: e?.message || "error",
                  });
                }
              }
            }

            if (didThisRun > 0) {
              await admin.from("user_agent_subscriptions").update({
                tasks_used: sub.tasks_used + didThisRun,
                tasks_used_today: dailyUsed + didThisRun,
                last_run_date: today,
              }).eq("id", sub.id);
              processed += didThisRun;
            }
          }

          return Response.json({ ok: true, processed, skipped });
        } catch (e) {
          console.error("agent-runner", e);
          return Response.json({ error: "internal_error" }, { status: 500 });
        }
      },
    },
  },
});
