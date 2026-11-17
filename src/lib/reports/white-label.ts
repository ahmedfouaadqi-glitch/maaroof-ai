import type { UnifiedReportData } from "./report-contract-v2";
export type WhiteLabelConfig={workspaceId:string;companyName:string;logoUrl?:string;brandColor?:string;advisorName?:string;advisorTitle?:string};
const INTERNAL_KEYS=/^(tokenCount|tokenCost|provider|providerName|rawModel|modelId|trackingKey|traceId|internalId)$/i;
const INTERNAL_TEXT=/(?:openai\/|anthropic\/|google\/|openrouter\/|deepinfra\/|lovable gateway)/i;
function clean(value:unknown):unknown {
 if(Array.isArray(value)) return value.map(clean);
 if(value&&typeof value==="object") return Object.fromEntries(Object.entries(value).filter(([k])=>!INTERNAL_KEYS.test(k)).map(([k,v])=>[k,clean(v)]));
 if(typeof value==="string"&&INTERNAL_TEXT.test(value)) return "[internal provider detail omitted]";
 return value;
}
export function sanitizeClientReport(data:UnifiedReportData,config:WhiteLabelConfig):UnifiedReportData {
 if(config.workspaceId!==data.workspaceId) throw new Error("white_label_workspace_mismatch");
 const safe=clean(data) as UnifiedReportData;
 return {...safe,brand:{...safe.brand,name:config.companyName.trim()||safe.brand.name}};
}
