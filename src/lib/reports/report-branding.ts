import { z } from "zod";

export const ReportBrandingSchema = z.object({
  workspaceId: z.string().uuid(),
  mode: z.enum(["full_white_label", "co_branded", "maaroof_branded"]),
  displayName: z.string().trim().min(1).max(120),
  logoUrl: z.string().url().optional().refine((value) => !value || value.startsWith("https://"), "logoUrl_must_use_https"),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#4338CA"),
  secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#0F172A"),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#0EA5E9"),
  language: z.enum(["ar", "en", "ku"]).default("ar"),
  footerText: z.string().max(500).optional(),
});
export type ReportBranding = z.infer<typeof ReportBrandingSchema>;

export type ReportBrandPreview = {
  workspaceId: string;
  mode: ReportBranding["mode"];
  brandName: string;
  logoUrl: string | null;
  colors: { primary: string; secondary: string; accent: string };
  showMaaroofBrand: boolean;
  language: ReportBranding["language"];
  direction: "rtl" | "ltr";
  footerText: string;
};

export function buildReportBrandPreview(input: ReportBranding): ReportBrandPreview {
  return {
    workspaceId: input.workspaceId,
    mode: input.mode,
    brandName: input.mode === "maaroof_branded" ? "MAAROOF Ai" : input.displayName,
    logoUrl: input.logoUrl || null,
    colors: { primary: input.primaryColor, secondary: input.secondaryColor, accent: input.accentColor },
    showMaaroofBrand: input.mode !== "full_white_label",
    language: input.language,
    direction: input.language === "en" ? "ltr" : "rtl",
    footerText: input.footerText || "",
  };
}

export function validateReportBranding(input: unknown) {
  return ReportBrandingSchema.safeParse(input);
}
