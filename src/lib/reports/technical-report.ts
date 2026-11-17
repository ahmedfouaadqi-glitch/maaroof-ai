import type { AuditReportSnapshot } from "./report-contract";
import { projectTechnicalReport } from "./report-contract";
import { buildTechnicalExportPayload } from "./report-export";
export function buildTechnicalReport(snapshot:AuditReportSnapshot) {
 const complete=projectTechnicalReport(snapshot);
 return {data:complete,payload:buildTechnicalExportPayload(complete,complete.clientIdentity.language)};
}
