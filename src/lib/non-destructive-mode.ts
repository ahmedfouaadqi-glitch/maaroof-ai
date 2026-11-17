/** Central guard for destructive operations while non-destructive rollout is active. */
export type DestructiveOperation = "tool_result_delete" | "tool_history_clear" | "workspace_delete" | "report_template_delete";

export function blockDestructiveOperation(operation: DestructiveOperation): never {
  throw new Error(`${operation}_disabled_non_destructive_mode`);
}
