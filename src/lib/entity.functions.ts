// Entity Truth Card: one-time verification + admin unlock.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const verifyEntityCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: p } = await supabaseAdmin.from("profiles").select("*").eq("id", userId).maybeSingle();
    const prof: any = p;
    if (!prof) return { ok: false, error: "profile_not_found" } as const;
    if (prof.entity_locked && !prof.entity_unlock_granted) return { ok: false, error: "locked" } as const;
    if (!prof.brand_name || !prof.hq_country) return { ok: false, error: "incomplete" } as const;

    const free = !!prof.entity_unlock_granted;
    const runId = crypto.randomUUID();
    let charged = 0;
    if (!free) {
      const { chargeTokens } = await import("@/lib/tokens.server");
      const chg: any = await chargeTokens({ userId, toolKey: "brand_authority.entity_verify", runId, meta: { endpoint: "entity.verify" } });
      if (!chg.ok) return { ok: false, error: chg.reason || "balance" } as const;
      charged = Number(chg.tokens || 0);
    }

    // Evidence: one scrape of the first website link (Firecrawl cache is reused when present).
    const links: string[] = (Array.isArray(prof.entity_links) ? prof.entity_links : []).map(String).filter((u: string) => /^https?:\/\//i.test(u));
    const site = links.find((u) => !/(instagram|facebook|tiktok|x\.com|twitter|linkedin|youtube|t\.me|snapchat)\./i.test(u));
    const facts: any = { checked_at: new Date().toISOString(), source: site || null, confirmed: [], unconfirmed: [] };
    if (site) {
      try {
        const { fcScrape } = await import("@/lib/firecrawl");
        const s: any = await fcScrape(site, { deep: false });
        const md = String(s?.data?.markdown || s?.markdown || "").slice(0, 8000);
        const { detectCountries } = await import("@/lib/entity-consistency");
        const low = md.toLowerCase();
        const seen = detectCountries(md);
        const check = (label: string, ok: boolean) => (ok ? facts.confirmed : facts.unconfirmed).push(label);
        check("brand_name", low.includes(String(prof.brand_name).toLowerCase()));
        check("hq_country", seen.includes(String(prof.hq_country).toUpperCase()));
        for (const m of prof.target_markets || []) check(`market:${m}`, seen.includes(String(m).toUpperCase()));
      } catch (e) {
        facts.unconfirmed.push("source_unreachable");
      }
    } else {
      facts.unconfirmed.push("no_website");
    }

    await supabaseAdmin.from("profiles").update({
      entity_facts: facts, entity_verified_at: new Date().toISOString(), entity_locked: true, entity_unlock_granted: false,
    } as any).eq("id", userId);
    return { ok: true, charged, facts } as const;
  });

export const grantEntityUnlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => ({ userId: String(d?.userId || "") }))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("profiles").update({ entity_locked: false, entity_unlock_granted: true } as any).eq("id", data.userId);
    return { ok: true };
  });
