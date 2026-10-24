import { createServerFn } from "@tanstack/react-start";
import { visibleSkillKeys, type PublicTruthCard } from "@/lib/landing-data";

const SHOWCASE_SLUG = "maaroof-ai";

/** Public, read-only data for the landing page: admin-visible skills + Maaroof's own public truth card. */
export const getLandingData = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let skills: string[] | null = null;
  let card: PublicTruthCard | null = null;
  try {
    const { data } = await supabaseAdmin.from("app_settings").select("value").eq("key", "user_interface_policy").maybeSingle();
    skills = visibleSkillKeys(data?.value);
  } catch { skills = null; }
  try {
    const { data: pack } = await supabaseAdmin.from("brand_authority_packs").select("user_id, brand_name, updated_at").eq("brand_slug", SHOWCASE_SLUG).maybeSingle();
    if (pack) {
      const { data: p } = await supabaseAdmin.from("profiles").select("entity_type, hq_country, entity_links, target_markets").eq("id", (pack as any).user_id).maybeSingle();
      const links: string[] = Array.isArray((p as any)?.entity_links) ? (p as any).entity_links.filter((x: unknown) => typeof x === "string") : [];
      const website = links.find((l) => !/linkedin|facebook|instagram|x\.com|twitter|tiktok|youtube/i.test(l)) || null;
      card = {
        name: "MAAROOF Ai",
        entity_type: (p as any)?.entity_type ?? null,
        hq_country: (p as any)?.hq_country ?? null,
        website: website ? website.replace(/^https?:\/\//, "").replace(/\/$/, "") : null,
        links_count: links.length,
        markets_count: Array.isArray((p as any)?.target_markets) ? (p as any).target_markets.length : 0,
        updated_at: (pack as any).updated_at ?? null,
      };
    }
  } catch { card = null; }
  return { skills, card };
});
