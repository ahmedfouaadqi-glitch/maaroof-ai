import { describe, expect, it, vi } from "vitest";
import { recordBrandOperation } from "@/lib/brand-operations.server";

describe("Brand operation ledger writer", () => {
  it("upserts the operation with workspace scope and appends a completion event", async () => {
    const writes: Array<{ table: string; action: string; payload: any }> = [];
    const admin = {
      from(table: string) {
        return {
          upsert: async (payload: any, options: any) => {
            writes.push({ table, action: "upsert", payload: { ...payload, options } });
            return { error: null };
          },
          insert: async (payload: any) => {
            writes.push({ table, action: "insert", payload });
            return { error: null };
          },
        };
      },
    };

    await recordBrandOperation(admin, {
      id: "f84b2f72-a833-44a0-8db0-9da3527a1483",
      userId: "auth-user",
      workspaceId: "ad6ce4b7-030c-48f6-9b44-b04109f0b610",
      operationType: "brand_boost",
      brandName: "Example Brand",
      durationMs: 1200,
      chargedUnits: 5,
      requestMeta: { engines: ["chatgpt", "gemini"] },
      resultMeta: { evidence_count: 3 },
    });

    expect(writes).toHaveLength(2);
    expect(writes[0].table).toBe("brand_operations");
    expect(writes[0].action).toBe("upsert");
    expect(writes[0].payload).toMatchObject({
      id: "f84b2f72-a833-44a0-8db0-9da3527a1483",
      user_id: "auth-user",
      workspace_id: "ad6ce4b7-030c-48f6-9b44-b04109f0b610",
      operation_type: "brand_boost",
      status: "completed",
      charged_units: 5,
      duration_ms: 1200,
      request_meta: { engines: ["chatgpt", "gemini"] },
      result_meta: { evidence_count: 3 },
    });
    expect(writes[1].table).toBe("brand_operation_events");
    expect(writes[1].action).toBe("insert");
    expect(writes[1].payload).toMatchObject({
      operation_id: "f84b2f72-a833-44a0-8db0-9da3527a1483",
      user_id: "auth-user",
      workspace_id: "ad6ce4b7-030c-48f6-9b44-b04109f0b610",
      event_type: "operation_completed",
    });
  });

  it("does not throw when the ledger migration is not deployed yet", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const admin = {
      from() {
        return {
          upsert: async () => ({ error: { message: "relation does not exist" } }),
          insert: async () => ({ error: null }),
        };
      },
    };
    await expect(recordBrandOperation(admin, {
      id: "f84b2f72-a833-44a0-8db0-9da3527a1483",
      userId: "auth-user",
      operationType: "visibility_probe",
    })).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
