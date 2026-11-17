import { z } from "zod";

export const REPORT_SCHEMA_VERSION = "2.0.0" as const;
const safeHttpUrl = z.string().url().refine((value) => /^https?:\/\//i.test(value), "http_url_required");
const score = z.object({ score: z.number().min(0).max(100).nullable(), status: z.string().min(1), reason: z.string().optional() });
export const SixAxesScoresSchema = z.object({
  seo: score,
  geo: score.extend({ engineMentions: z.number().int().min(0), totalEngines: z.number().int().min(0) }),
  aeo: score, sge: score, gseo: score, sgeo: score,
});
export type SixAxesScores = z.infer<typeof SixAxesScoresSchema>;
export const UnifiedReportDataSchema = z.object({
  version: z.literal(REPORT_SCHEMA_VERSION), reportId: z.string().min(1), workspaceId: z.string().min(1),
  brand: z.object({ name: z.string().min(1), slug: z.string().min(1), websiteUrl: safeHttpUrl, hqCountry: z.string().optional(), targetMarkets: z.array(z.string()) }),
  generatedAt: z.string().datetime(),
  executiveSummary: z.object({ marketHeadline: z.string(), opportunityStatement: z.string(), keyMetricHighlights: z.array(z.object({label:z.string(),value:z.string(),trend:z.string().optional()})) }),
  axes: SixAxesScoresSchema,
  engines: z.array(z.object({engineKey:z.string(),engineName:z.string(),quoted:z.boolean(),rank:z.number().int().positive().nullable(),rawCitationSnippet:z.string().optional(),verifiedLinks:z.array(safeHttpUrl),sentiment:z.enum(["positive","neutral","negative"]).optional()})),
  websiteExperience: z.object({first100WordsDensityRatio:z.number().min(0).max(1),llmsTxtStatus:z.enum(["present","missing","invalid"]),schemaOrgStatus:z.enum(["valid","partial","missing"]),entityConsistencyPassed:z.boolean(),speedAndMobilityScore:z.number().min(0).max(100).nullable().optional()}),
  competitorGaps: z.array(z.object({competitorName:z.string(),citedInEngines:z.array(z.string()),lostKeywords:z.array(z.string()),actionNeeded:z.string()})),
  keywordOpportunities: z.array(z.object({clusterName:z.string(),intent:z.enum(["transactional","informational","navigational","commercial"]),searchVolumeCategory:z.enum(["high","medium","niche"]),aiCoverageStatus:z.enum(["covered","competitor_won","gap"])})),
  actionPlan30Days: z.array(z.object({dayRange:z.enum(["1-10","11-20","21-30"]),priority:z.enum(["critical","high","medium"]),axis:z.enum(["seo","geo","aeo","sge","gseo","sgeo"]),title:z.string(),rationale:z.string(),expectedImpact:z.string()})),
  kpiTargets: z.array(z.object({metric:z.string(),baseline:z.string(),target30d:z.string()})),
  evidenceSources: z.array(z.object({engine:z.string(),query:z.string(),sourceUrl:safeHttpUrl.optional(),timestamp:z.string().datetime()})),
}).strict();
export type UnifiedReportData = z.infer<typeof UnifiedReportDataSchema>;
export function validateReportData(data: unknown): data is UnifiedReportData {
  return UnifiedReportDataSchema.safeParse(data).success;
}
export function compileReportDataFromSession(sessionPayload: unknown): UnifiedReportData {
  const parsed = UnifiedReportDataSchema.safeParse(sessionPayload);
  if (!parsed.success) throw new Error("invalid_unified_report_data:" + parsed.error.issues.map(i => i.path.join(".")).join(","));
  return parsed.data;
}
