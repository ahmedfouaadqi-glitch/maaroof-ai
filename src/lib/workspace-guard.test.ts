import { describe, it, expect } from "vitest";
import { workspaceGuard, pickWorkspaceId } from "./workspace-guard.server";
const admin = (row: any) => ({ from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row }) }) }) }) }) });
const ws = "11111111-1111-1111-1111-111111111111";
describe("workspace guard", () => {
  it("allows requests without a workspace", async () => { expect(await workspaceGuard(admin(null), "u", {})).toBeNull(); });
  it("rejects a workspace the user does not own", async () => { const r = await workspaceGuard(admin(null), "u", { workspace_id: ws }); expect(r?.status).toBe(404); });
  it("allows an owned workspace", async () => { expect(await workspaceGuard(admin({ id: ws }), "u", { workspaceId: ws })).toBeNull(); });
  it("reads either field name", () => { expect(pickWorkspaceId({ workspaceId: ws })).toBe(ws); });
});
