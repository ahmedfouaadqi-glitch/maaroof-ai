import { createHash, timingSafeEqual } from "node:crypto";
function digest(reportId:string,workspaceId:string,salt:string):Buffer {
 if(!reportId.trim()||!workspaceId.trim()||salt.length<16) throw new Error("invalid_share_hash_input");
 return createHash("sha256").update([salt,workspaceId,reportId].join("\\0"),"utf8").digest();
}
export function generateReportShareHash(reportId:string,workspaceId:string,salt:string):string {
 return digest(reportId,workspaceId,salt).toString("hex");
}
export function verifyReportShareHash(token:string,reportId:string,workspaceId:string,salt:string):boolean {
 if(!/^[a-f0-9]{64}$/i.test(token)) return false;
 const expected=digest(reportId,workspaceId,salt), actual=Buffer.from(token,"hex");
 return actual.length===expected.length&&timingSafeEqual(actual,expected);
}
