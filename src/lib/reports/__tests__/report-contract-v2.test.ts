import { describe, expect, it } from "vitest";
import { REPORT_SCHEMA_VERSION, validateReportData, compileReportDataFromSession } from "../report-contract-v2";

const sample = {
 version: REPORT_SCHEMA_VERSION, reportId:"r1", workspaceId:"w1",
 brand:{name:"Example",slug:"example",websiteUrl:"https://example.com",targetMarkets:["Iraq"]},
 generatedAt:"2026-11-17T10:00:00.000Z",
 executiveSummary:{marketHeadline:"Measured visibility",opportunityStatement:"Improve coverage",keyMetricHighlights:[]},
 axes:{seo:{score:70,status:"measured"},geo:{score:null,status:"not_measured",engineMentions:0,totalEngines:10},aeo:{score:null,status:"not_measured"},sge:{score:null,status:"not_measured"},gseo:{score:null,status:"not_measured"},sgeo:{score:null,status:"not_measured"}},
 engines:[],websiteExperience:{first100WordsDensityRatio:0.2,llmsTxtStatus:"missing",schemaOrgStatus:"partial",entityConsistencyPassed:false},
 competitorGaps:[],keywordOpportunities:[],actionPlan30Days:[],kpiTargets:[],evidenceSources:[]
};
describe("report contract v2",()=>{
 it("validates the specified schema and preserves not-measured states",()=>{expect(validateReportData(sample)).toBe(true);expect(compileReportDataFromSession(sample).axes.geo.score).toBeNull();});
 it("rejects scores outside 0-100 and malformed URLs",()=>{expect(validateReportData({...sample,axes:{...sample.axes,seo:{score:120,status:"measured"}}})).toBe(false);expect(validateReportData({...sample,brand:{...sample.brand,websiteUrl:"not-url"}})).toBe(false);});
 it("rejects unknown fields instead of silently dropping report data",()=>{expect(validateReportData({...sample,internalTokenCost:99})).toBe(false);});
});
