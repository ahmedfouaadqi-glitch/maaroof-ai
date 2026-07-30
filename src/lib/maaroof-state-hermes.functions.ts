// Parts 16-17 admin surface — State Anchor Center + HERMES Executive Office.
// Thin wrapper module: no runtime helpers at module scope (server-fn splitting).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Part 16 — anchors, timeline and per-level health for the admin. */
export const getStateCenter = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId, _role: "admin",
    });
    if (!isAdmin) throw new Error("forbidden");
    const { stateOverview } = await import("@/lib/maaroof/state.server");
    const { getMaaroofSettings } = await import("@/lib/maaroof/settings.server");
    const [overview, settings] = await Promise.all([stateOverview(), getMaaroofSettings()]);
    return { ...overview, settings: (settings as any).state_anchor };
  });

/** Part 16 — the last healthy rollback point for a scope. */
export const getRecoveryPoint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ level: z.string().min(1).max(30), scope_id: z.string().min(1).max(120) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId, _role: "admin",
    });
    if (!isAdmin) throw new Error("forbidden");
    const { recoverFromLastGoodState } = await import("@/lib/maaroof/state.server");
    return await recoverFromLastGoodState(data.level, data.scope_id);
  });

/** Part 17 — observatory, proposals and Founder DNA in one read. */
export const getHermesCenter = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId, _role: "admin",
    });
    if (!isAdmin) throw new Error("forbidden");
    const { observePlatform, listProposals, getFounderDna, listConversations } =
      await import("@/lib/maaroof/hermes.server");
    const { getMaaroofSettings } = await import("@/lib/maaroof/settings.server");
    const [observatory, proposals, dna, conversations, settings] = await Promise.all([
      observePlatform(), listProposals(), getFounderDna(),
      listConversations(context.userId), getMaaroofSettings(),
    ]);
    return { observatory, proposals, dna, conversations, settings: (settings as any).hermes };
  });

/** Part 17 — derive fresh proposals from measured signals (no model call). */
export const refreshHermesProposals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId, _role: "admin",
    });
    if (!isAdmin) throw new Error("forbidden");
    const { syncProposals } = await import("@/lib/maaroof/hermes.server");
    return await syncProposals();
  });

/** Part 17/18 — the Founder decides. HERMES never executes on its own.
 *  Part 18 widens the vocabulary with modify / postpone / archive. */
export const decideHermesProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      proposal_id: z.string().uuid(),
      decision: z.enum(["approved", "rejected", "deferred", "modified", "postponed", "archived"]),
      note: z.string().max(2000).optional().nullable(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId, _role: "admin",
    });
    if (!isAdmin) throw new Error("forbidden");
    const { decideProposal } = await import("@/lib/maaroof/hermes.server");
    return await decideProposal({
      proposalId: data.proposal_id,
      decision: data.decision,
      note: data.note ?? null,
      founderId: context.userId,
    });
  });

/** Part 17/18 — the Founder's private office. Cost is charged to the system budget.
 *  Part 18 adds executive commands, language selection and file/image input. */
export const askHermes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      message: z.string().min(2).max(4000),
      conversation_id: z.string().uuid().optional().nullable(),
      command: z.string().max(40).optional().nullable(),
      language: z.enum(["ar", "en", "ku"]).optional(),
      attachments: z.array(z.object({
        kind: z.enum(["image", "file"]),
        name: z.string().max(200).optional(),
        dataUrl: z.string().max(8_000_000),
      })).max(4).optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId, _role: "admin",
    });
    if (!isAdmin) throw new Error("forbidden");
    const { getMaaroofSettings } = await import("@/lib/maaroof/settings.server");
    const settings: any = await getMaaroofSettings();
    if (settings?.hermes?.enabled === false || settings?.hermes?.office_enabled === false) {
      return { conversationId: data.conversation_id ?? null, reply: "مكتب هرمس معطّل من إعدادات الإدارة.", tokens: 0, usd: 0, disabled: true };
    }
    const { hermesReply } = await import("@/lib/maaroof/hermes.server");
    const r = await hermesReply({
      userId: context.userId,
      conversationId: data.conversation_id ?? null,
      message: data.message,
      command: data.command ?? null,
      language: data.language ?? "ar",
      attachments: data.attachments,
    });
    return { conversationId: r.conversationId, reply: r.reply, tokens: r.tokens, usd: r.usd, disabled: false };
  });


/** Part 17 — read one office conversation. */
export const getHermesMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ conversation_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId, _role: "admin",
    });
    if (!isAdmin) throw new Error("forbidden");
    const { listMessages } = await import("@/lib/maaroof/hermes.server");
    return await listMessages(data.conversation_id, context.userId);
  });
