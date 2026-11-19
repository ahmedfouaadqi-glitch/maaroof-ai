import { describe, expect, it } from "vitest";
import { blockDestructiveOperation } from "./non-destructive-mode";

describe("non-destructive operation guard", () => {
  it.each(["tool_result_delete", "tool_history_clear", "workspace_delete", "report_template_delete", "knowledge_asset_delete"] as const)(
    "blocks %s",
    (operation) => {
      expect(() => blockDestructiveOperation(operation)).toThrow(
        `${operation}_disabled_non_destructive_mode`,
      );
    },
  );
});
