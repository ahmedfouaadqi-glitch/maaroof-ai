// Analyzes an uploaded image/PDF/text file. Owner-only; charges only after success.
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { attachmentKind, ownsPath, ATTACHMENT_MAX_BYTES } from "@/lib/attachments";
import { LOVABLE_AI_CHAT_COMPLETIONS_URL, lovableAiHeaders, FACTUAL_SAFETY_PROMPT } from "@/lib/lovable-ai";

const TOOL = "attachment.analyze";

async function auth(request: Request) {
  const h = request.headers.get("authorization") || "";
  if (!h.startsWith("Bearer ")) return null;
  const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data } = await admin.auth.getUser(h.slice(7));
  return data.user?.id ? { db: admin as any, userId: data.user.id } : null;
}

function b64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf); let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export const Route = createFileRoute("/api/attachment-analyze")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const a = await auth(request);
        if (!a) return Response.json({ error: "auth_required" }, { status: 401 });
        const { resolveToolCost } = await import("@/lib/tokens.server");
        const [cost, prof] = await Promise.all([
          resolveToolCost(a.userId, TOOL).catch(() => ({ tokens: 0 })),
          a.db.from("profiles").select("tokens_balance").eq("id", a.userId).maybeSingle(),
        ]);
        return Response.json({ cost: Number((cost as any).tokens) || 0, balance: Number(prof.data?.tokens_balance) || 0 });
      },
      POST: async ({ request }) => {
        const a = await auth(request);
        if (!a) return Response.json({ error: "auth_required" }, { status: 401 });
        const body = await request.json().catch(() => ({} as any));
        const path = String(body.path || ""); const name = String(body.name || "file").slice(0, 120);
        const mime = String(body.mime || ""); const question = String(body.question || "").slice(0, 1000);
        const context = body.context === "interview" ? "interview" : "task";
        const lang = body.lang === "en" ? "English" : body.lang === "ku" ? "Kurdish (Sorani)" : "Arabic";
        const kind = attachmentKind(mime);
        if (!ownsPath(a.userId, path) || !kind) return Response.json({ error: "bad_file" }, { status: 400 });

        const { resolveToolCost, chargeTokens } = await import("@/lib/tokens.server");
        const cost = await resolveToolCost(a.userId, TOOL);
        if ((cost.source as any) === "disabled_by_admin") return Response.json({ error: "tool_disabled" }, { status: 403 });
        const { data: prof } = await a.db.from("profiles").select("tokens_balance").eq("id", a.userId).maybeSingle();
        if (Number(cost.tokens) > 0 && Number(prof?.tokens_balance || 0) < Number(cost.tokens)) return Response.json({ error: "balance" }, { status: 402 });

        const { data: file, error: dlErr } = await a.db.storage.from("task-files").download(path);
        if (dlErr || !file) return Response.json({ error: "not_found" }, { status: 404 });
        const buf = await file.arrayBuffer();
        if (buf.byteLength > ATTACHMENT_MAX_BYTES) return Response.json({ error: "too_large" }, { status: 400 });

        const { data: row } = await a.db.from("task_attachments").insert({ user_id: a.userId, context, path, name, mime, size: buf.byteLength, question, status: "analyzing" }).select("id").single();
        const prompt = `${FACTUAL_SAFETY_PROMPT}\nYou analyze a file the user uploaded for a GEO/SEO/AEO task. Describe only what is visible in the file, then answer the user's question. Mark anything not directly visible as a hypothesis. Answer in ${lang}.\nUser question: ${question || "Summarize and extract the useful facts for brand visibility in AI answers."}`;
        const content: any[] = [{ type: "text", text: prompt }];
        if (kind === "text") content.push({ type: "text", text: new TextDecoder().decode(buf).slice(0, 60000) });
        else content.push({ type: "image_url", image_url: { url: `data:${mime};base64,${b64(buf)}` } });

        try {
          const apiKey = process.env.LOVABLE_API_KEY;
          if (!apiKey) throw new Error("not_configured");
          const r = await fetch(LOVABLE_AI_CHAT_COMPLETIONS_URL, {
            method: "POST", headers: lovableAiHeaders(apiKey),
            body: JSON.stringify({ model: "google/gemini-2.5-flash", messages: [{ role: "user", content }] }),
          });
          if (!r.ok) throw new Error(`ai_${r.status}`);
          const j: any = await r.json();
          const analysis = String(j?.choices?.[0]?.message?.content || "").trim();
          if (!analysis) throw new Error("empty");
          const charge: any = await chargeTokens({ userId: a.userId, toolKey: TOOL, meta: { name, mime } });
          const charged = charge?.ok ? Number(charge.tokens) || 0 : 0;
          await a.db.from("task_attachments").update({ analysis, status: "done", tokens_charged: charged }).eq("id", row?.id);
          try {
            const { taskFact } = await import("@/lib/knowledge-facts");
            const f = taskFact(`${name}`, analysis);
            if (f) await a.db.from("knowledge_facts").insert({ user_id: a.userId, source: context === "interview" ? "interview" : "task", source_ref: row?.id, ...f });
          } catch {}
          return Response.json({ id: row?.id, analysis, charged });
        } catch (e: any) {
          await a.db.from("task_attachments").update({ status: "failed" }).eq("id", row?.id);
          return Response.json({ error: "analysis_failed", detail: String(e?.message || e).slice(0, 100) }, { status: 502 });
        }
      },
    },
  },
});
