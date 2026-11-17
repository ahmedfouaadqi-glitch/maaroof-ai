import { rejectDestructiveOperation, type ProtectedDestructiveOperation } from "./non-destructive-guard";

/** Backwards-compatible name retained for existing server-function callers. */
export type DestructiveOperation = ProtectedDestructiveOperation;
export const blockDestructiveOperation = rejectDestructiveOperation;
