import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { resolveAuthenticatedUserId } from "@/lib/api-auth.server";
import { attachmentPath } from "@/lib/attachments";

const MAX_KEYWORD_UPLOAD_BYTES = 25 * 1024 * 1024;
const ACCEPTED = /\.(xlsx|xlsm|csv|tsv)$/i;

export const Route = createFileRoute("/api/keyword-upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
          auth: { persistSession: false },
        });
        const userId = await resolveAuthenticatedUserId(request, db);
        if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

        const form = await request.formData().catch(() => null);
        if (!form) return Response.json({ error: "invalid_form_data" }, { status: 400 });
        const file = form.get("file");
        if (!(file instanceof File)) return Response.json({ error: "file_required" }, { status: 400 });
        const name = file.name.replace(/[\\/\\\\]/g, "_").slice(0, 180);
        if (!ACCEPTED.test(name)) return Response.json({ error: "unsupported_spreadsheet", allowed: [".xlsx", ".xlsm", ".csv", ".tsv"] }, { status: 415 });
        if (!file.size) return Response.json({ error: "empty_file" }, { status: 400 });
        if (file.size > MAX_KEYWORD_UPLOAD_BYTES) return Response.json({ error: "file_too_large", max_bytes: MAX_KEYWORD_UPLOAD_BYTES }, { status: 413 });

        const rawWorkspaceId = String(form.get("workspace_id") || "").trim();
        let workspaceId: string | null = null;
        if (!rawWorkspaceId) {
          const { count, error: workspaceCountError } = await db.from("workspaces")
            .select("id", { count: "exact", head: true })
            .eq("owner_id", userId);
          if (workspaceCountError) return Response.json({ error: "workspace_context_unavailable" }, { status: 503 });
          if ((count || 0) > 0) return Response.json({ error: "workspace_required" }, { status: 400 });
        }
        if (rawWorkspaceId) {
          if (!/^[0-9a-f-]{36}$/i.test(rawWorkspaceId)) return Response.json({ error: "invalid_workspace" }, { status: 400 });
          const { data: workspace } = await db.from("workspaces").select("id").eq("id", rawWorkspaceId).eq("owner_id", userId).maybeSingle();
          if (!workspace) return Response.json({ error: "workspace_not_found" }, { status: 404 });
          workspaceId = workspace.id;
        }

        const path = attachmentPath(userId, name, Date.now(), workspaceId);
        const { error: uploadError } = await db.storage.from("task-files").upload(path, file, {
          contentType: file.type || (name.toLowerCase().endsWith(".csv") || name.toLowerCase().endsWith(".tsv") ? "text/csv" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
          upsert: false,
        });
        if (uploadError) return Response.json({ error: "upload_failed", detail: uploadError.message.slice(0, 160) }, { status: 502 });

        const { data: row, error: insertError } = await db.from("task_attachments").insert({
          user_id: userId,
          workspace_id: workspaceId,
          context: "task",
          path,
          name,
          mime: file.type || "application/octet-stream",
          size: file.size,
          question: "Keyword intelligence source workbook",
          status: "uploaded",
          tokens_charged: 0,
        }).select("id, name, size, workspace_id").single();

        if (insertError || !row) {
          await db.storage.from("task-files").remove([path]);
          return Response.json({ error: "attachment_record_failed" }, { status: 500 });
        }
        return Response.json({ attachment_id: row.id, name: row.name, size: row.size, workspace_id: row.workspace_id });
      },
    },
  },
});
