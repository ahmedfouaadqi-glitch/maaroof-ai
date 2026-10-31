/**
 * Server-side writer for the unified Brand Boost operation ledger.
 * The service-role client is required; browser users receive read-only RLS access.
 */
type BrandOperationRecord = {
  id: string;
  userId: string;
  workspaceId?: string | null;
  operationType: "brand_boost" | "brand_authority" | "visibility_probe" | "visibility_analysis" | "social_analysis";
  brandName?: string | null;
  status?: "completed" | "failed" | "partial";
  requestMeta?: Record<string, unknown>;
  resultMeta?: Record<string, unknown>;
  errorMessage?: string | null;
  durationMs?: number | null;
  chargedUnits?: number | null;
};

export async function recordBrandOperation(admin: any, input: BrandOperationRecord): Promise<void> {
  const now = new Date().toISOString();
  const row = {
    id: input.id,
    user_id: input.userId,
    workspace_id: input.workspaceId || null,
    operation_type: input.operationType,
    brand_name: input.brandName || null,
    status: input.status || "completed",
    request_meta: input.requestMeta || {},
    result_meta: input.resultMeta || {},
    error_message: input.errorMessage || null,
    started_at: new Date(Date.now() - Math.max(0, input.durationMs || 0)).toISOString(),
    finished_at: now,
    duration_ms: input.durationMs ?? null,
    charged_units: input.chargedUnits ?? null,
    updated_at: now,
  };

  try {
    const { error } = await admin.from("brand_operations").upsert(row, { onConflict: "id" });
    if (error) throw error;
    const { error: eventError } = await admin.from("brand_operation_events").insert({
      operation_id: input.id,
      user_id: input.userId,
      workspace_id: input.workspaceId || null,
      event_type: input.status === "failed" ? "operation_failed" : input.status === "partial" ? "operation_partial" : "operation_completed",
      payload: {
        operation_type: input.operationType,
        brand_name: input.brandName || null,
        duration_ms: input.durationMs ?? null,
        charged_units: input.chargedUnits ?? null,
        error_message: input.errorMessage || null,
        result_meta: input.resultMeta || {},
      },
    });
    if (eventError) throw eventError;
  } catch (error) {
    // Keep business operation responses working during a migration rollout.
    console.error("[brand-operations] ledger write failed", error);
  }
}
