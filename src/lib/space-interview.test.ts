import { describe, expect, it } from "vitest";
import { ENGINE_LIST } from "@/lib/ai-engines";
import { buildSpaceInterviewRows, engineFailureReason, ENGINE_PERSPECTIVES } from "./space-interview";

describe("ten-engine knowledge-space interview", () => {
  it("creates one user-facing question row per configured engine", () => {
    const rows = buildSpaceInterviewRows(
      "space-1",
      "user-1",
      "ar",
      ENGINE_LIST.map((engine) => ({
        engineKey: engine.key,
        question: `ما المعلومة الناقصة التي يجب توضيحها؟`,
      })),
    );
    expect(rows).toHaveLength(10);
    expect(new Set(rows.map((row) => row.engine_key)).size).toBe(10);
    expect(rows.every((row) => row.generation_status === "ready" && row.failure_reason === null)).toBe(true);
    expect(rows.every((row) => !!row.engine_name && !!row.question)).toBe(true);
    expect(Object.keys(ENGINE_PERSPECTIVES)).toHaveLength(10);
  });

  it("keeps nine successful questions when one engine fails", () => {
    const outcomes = ENGINE_LIST.map((engine) => ({
      engineKey: engine.key,
      question: engine.key === "grok" ? "" : "What knowledge is missing?",
      ...(engine.key === "grok" ? { failureCode: "rate_limit" as const } : {}),
    }));
    const rows = buildSpaceInterviewRows("space-1", "user-1", "ar", outcomes);
    expect(rows.filter((row) => row.generation_status === "ready")).toHaveLength(9);
    const failed = rows.find((row) => row.engine_key === "grok");
    expect(failed?.generation_status).toBe("failed");
    expect(failed?.failure_reason).toBe("المحرك مشغول حالياً. حاول مرة أخرى لاحقاً.");
  });

  it("localizes generic failures without exposing gateway/provider details", () => {
    expect(engineFailureReason("en", "network")).toBe("The engine could not be reached. You can retry.");
    expect(engineFailureReason("ku", "unavailable")).toContain("بەردەست نییە");
  });
});
