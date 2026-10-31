import { describe, expect, it, vi } from "vitest";
import { settleTokenRefund } from "./token-refund";

describe("settleTokenRefund", () => {
  it("subtracts the refund only after an explicit successful ledger response", async () => {
    const applyRefund = vi.fn().mockResolvedValue({ data: { ok: true }, error: null });
    await expect(settleTokenRefund(100, 40, applyRefund)).resolves.toEqual({
      charged_tokens: 60,
      refund_requested_tokens: 40,
      refunded_tokens: 40,
      refund_confirmed: true,
    });
    expect(applyRefund).toHaveBeenCalledWith(40);
  });

  it("keeps the original charge when the RPC returns an error", async () => {
    const result = await settleTokenRefund(100, 100, async () => ({ data: null, error: new Error("database unavailable") }));
    expect(result).toEqual({
      charged_tokens: 100,
      refund_requested_tokens: 100,
      refunded_tokens: 0,
      refund_confirmed: false,
    });
  });

  it("does not treat an explicit negative RPC response as a refund", async () => {
    const result = await settleTokenRefund(100, 25, async () => ({ data: { ok: false }, error: null }));
    expect(result.charged_tokens).toBe(100);
    expect(result.refunded_tokens).toBe(0);
    expect(result.refund_confirmed).toBe(false);
  });

  it("keeps the original charge when the refund call throws", async () => {
    const result = await settleTokenRefund(75, 75, async () => { throw new Error("network error"); });
    expect(result.charged_tokens).toBe(75);
    expect(result.refund_confirmed).toBe(false);
  });

  it("clamps a requested refund to the amount actually charged", async () => {
    const applyRefund = vi.fn().mockResolvedValue({ data: { ok: true }, error: null });
    const result = await settleTokenRefund(12, 99, applyRefund);
    expect(applyRefund).toHaveBeenCalledWith(12);
    expect(result.charged_tokens).toBe(0);
    expect(result.refunded_tokens).toBe(12);
  });

  it("does not call the ledger for a zero refund", async () => {
    const applyRefund = vi.fn();
    await expect(settleTokenRefund(10, 0, applyRefund)).resolves.toEqual({
      charged_tokens: 10,
      refund_requested_tokens: 0,
      refunded_tokens: 0,
      refund_confirmed: null,
    });
    expect(applyRefund).not.toHaveBeenCalled();
  });
});
