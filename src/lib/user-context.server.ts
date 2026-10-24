// Server-only helper to fetch the user's profile context (specialty / brand)
// + cognitive intent profile so every tool can localize prompts to the user's
// industry AND their detected goals/audience/gap/opportunity.
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadIntentProfile, buildIntentHint, type IntentProfile, EMPTY_PROFILE } from "@/lib/cognition.server";

export type UserContext = {
  specialty: string | null;
  brand_name: string | null;
  brand_keywords: string | null;
  intent: IntentProfile;
};

export async function getUserContext(admin: SupabaseClient, userId: string | null | undefined): Promise<UserContext> {
  if (!userId) return { specialty: null, brand_name: null, brand_keywords: null, intent: EMPTY_PROFILE };
  try {
    const [{ data }, intent] = await Promise.all([
      admin.from("profiles").select("specialty, brand_name, brand_keywords").eq("id", userId).maybeSingle(),
      loadIntentProfile(admin, userId),
    ]);
    return {
      specialty: (data as any)?.specialty || null,
      brand_name: (data as any)?.brand_name || null,
      brand_keywords: (data as any)?.brand_keywords || null,
      intent,
    };
  } catch {
    return { specialty: null, brand_name: null, brand_keywords: null, intent: EMPTY_PROFILE };
  }
}

// Build a short "specialty + intent" block to append to a system or user prompt.
export function specialtyHint(ctx: UserContext, lang: "ar" | "en" | "ku" = "en"): string {
  const hasSpec = ctx.specialty || ctx.brand_name || ctx.brand_keywords;
  const intentHint = buildIntentHint(ctx.intent, lang);
  if (!hasSpec && !intentHint) return "";
  const labels = {
    ar: { title: "سياق المستخدم — التزم بهذا التخصص في كل المخرجات:", spec: "التخصص", brand: "العلامة", kw: "كلمات مفتاحية" },
    ku: { title: "سیاقی بەکارهێنەر — لە هەموو دەرئەنجامەکاندا پابەند بە بە ئەم بوارە:", spec: "بوار", brand: "نیشان", kw: "وشە کلیلیەکان" },
    en: { title: "User context — keep ALL outputs anchored to this specialty:", spec: "Specialty", brand: "Brand", kw: "Keywords" },
  } as const;
  const L = labels[lang] || labels.en;
  const lines: string[] = [];
  if (hasSpec) {
    lines.push(L.title);
    if (ctx.specialty) lines.push(`- ${L.spec}: ${ctx.specialty}`);
    if (ctx.brand_name) lines.push(`- ${L.brand}: ${ctx.brand_name}`);
    if (ctx.brand_keywords) lines.push(`- ${L.kw}: ${ctx.brand_keywords}`);
  }
  return "\n\n" + lines.join("\n") + intentHint;
}
