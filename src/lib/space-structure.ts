// Pure rules for workspace structure (company / product / client) and
// account-kind inference from onboarding answers. No I/O.
import type { AccountKind } from "@/lib/account-kinds";

export type SpaceKind = "company" | "subsidiary" | "product" | "client";
export const SPACE_KINDS: SpaceKind[] = ["company", "subsidiary", "product", "client"];

export type StructureAnswers = {
  sellsProduct: boolean;
  managesClients: boolean;
  multipleProducts: boolean;
  isPerson: boolean;
  isMedia: boolean;
};

/** Suggest an account kind from short answers; the user confirms it. */
export function inferAccountKind(a: StructureAnswers): AccountKind {
  if (a.managesClients) return "agency_with_clients";
  if (a.isMedia) return "news_agency";
  if (a.isPerson) return a.sellsProduct ? "content_creator" : "individual";
  if (a.sellsProduct) return "product_company";
  return "marketing_company";
}

/** Which child space kinds a parent may hold. */
export function allowedChildKinds(parent: SpaceKind, account: AccountKind | null): SpaceKind[] {
  // Tree: company -> (product | subsidiary | client) ; subsidiary/client -> product ; product is a leaf.
  if (parent === "subsidiary" || parent === "client") return ["product"];
  if (parent !== "company") return [];
  const kinds: SpaceKind[] = ["product", "subsidiary"];
  // Unknown account kind stays permissive so the owner can still add clients.
  if (account === null || account === "agency_with_clients" || account === "marketing_company") kinds.push("client");
  return kinds;
}

/** Ids of a space and all its descendants (cycle-safe). */
export function descendantIds(rootId: string, items: { id: string; parent_id: string | null }[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const walk = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id); out.push(id);
    for (const w of items) if (w.parent_id === id) walk(w.id);
  };
  walk(rootId);
  return out;
}

/** Max spaces per plan tier; unknown tiers fall back to free. */
export const SPACE_LIMITS: Record<string, number> = { free: 1, pro: 5, premium: 10, business: 25, enterprise: 100 };
export function spaceLimit(tier: string | null | undefined): number {
  return SPACE_LIMITS[String(tier || "free").toLowerCase()] ?? SPACE_LIMITS.free;
}
export function canCreateSpace(existing: number, tier: string | null | undefined): boolean {
  return existing < spaceLimit(tier);
}
