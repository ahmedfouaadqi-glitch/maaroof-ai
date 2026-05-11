// Server-only helper to fetch the user's profile context (specialty / brand)
// so every tool can localize prompts to the user's industry.
import type { SupabaseClient } from "@supabase/supabase-js";

export type UserContext = {
  specialty: string | null;
  brand_name: string | null;
  brand_keywords: string | null;
};

export async function getUserContext(admin: SupabaseClient, userId: string | null | undefined): Promise<UserContext> {
  if (!userId) return { specialty: null, brand_name: null, brand_keywords: null };
  try {
    const { data } = await admin
      .from("profiles")
      .select("specialty, brand_name, brand_keywords")
      .eq("id", userId)
      .maybeSingle();
    return {
      specialty: (data as any)?.specialty || null,
      brand_name: (data as any)?.brand_name || null,
      brand_keywords: (data as any)?.brand_keywords || null,
    };
  } catch {
    return { specialty: null, brand_name: null, brand_keywords: null };
  }
}

// Build a short "specialty hint" block to append to a system or user prompt.
export function specialtyHint(ctx: UserContext, lang: "ar" | "en" | "ku" = "en"): string {
  if (!ctx.specialty && !ctx.brand_name && !ctx.brand_keywords) return "";
  const labels = {
    ar: { title: "سياق المستخدم — التزم بهذا التخصص في كل المخرجات:", spec: "التخصص", brand: "العلامة", kw: "كلمات مفتاحية" },
    ku: { title: "سیاقی بەکارهێنەر — لە هەموو دەرئەنجامەکاندا پابەند بە بە ئەم بوارە:", spec: "بوار", brand: "نیشان", kw: "وشە کلیلیەکان" },
    en: { title: "User context — keep ALL outputs anchored to this specialty:", spec: "Specialty", brand: "Brand", kw: "Keywords" },
  } as const;
  const L = labels[lang] || labels.en;
  const lines: string[] = [L.title];
  if (ctx.specialty) lines.push(`- ${L.spec}: ${ctx.specialty}`);
  if (ctx.brand_name) lines.push(`- ${L.brand}: ${ctx.brand_name}`);
  if (ctx.brand_keywords) lines.push(`- ${L.kw}: ${ctx.brand_keywords}`);
  return "\n\n" + lines.join("\n");
}
