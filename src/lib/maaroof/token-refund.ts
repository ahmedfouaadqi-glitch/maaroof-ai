export type TokenRefundSettlement = {
  charged_tokens: number;
  refund_requested_tokens: number;
  refunded_tokens: number;
  refund_confirmed: boolean | null;
};

/**
 * Report a token refund only when the atomic ledger RPC explicitly succeeds.
 * A failed/ambiguous refund keeps the original amount in charged_tokens.
 */
export async function settleTokenRefund(
  chargedTokensInput: number,
  requestedRefundInput: number,
  applyRefund: (tokens: number) => Promise<{ data?: unknown; error?: unknown | null }>,
): Promise<TokenRefundSettlement> {
  const chargedTokens = Math.max(0, Math.round(Number(chargedTokensInput) || 0));
  const requestedRefund = Math.min(chargedTokens, Math.max(0, Math.round(Number(requestedRefundInput) || 0)));

  if (requestedRefund === 0) {
    return {
      charged_tokens: chargedTokens,
      refund_requested_tokens: 0,
      refunded_tokens: 0,
      refund_confirmed: null,
    };
  }

  try {
    const result = await applyRefund(requestedRefund);
    const payload = result?.data as any;
    const confirmed = !result?.error && payload != null && payload !== false &&
      payload?.ok !== false && payload?.success !== false;

    return {
      charged_tokens: confirmed ? chargedTokens - requestedRefund : chargedTokens,
      refund_requested_tokens: requestedRefund,
      refunded_tokens: confirmed ? requestedRefund : 0,
      refund_confirmed: confirmed,
    };
  } catch {
    return {
      charged_tokens: chargedTokens,
      refund_requested_tokens: requestedRefund,
      refunded_tokens: 0,
      refund_confirmed: false,
    };
  }
}
