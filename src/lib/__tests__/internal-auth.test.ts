import { afterEach, describe, expect, it, vi } from "vitest";
import { createInternalAuthHeader, verifyInternalAuth } from "@/lib/internal-auth.server";

const userId = "00000000-0000-4000-8000-000000000000";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("signed internal request authentication", () => {
  it("accepts a recent proof only for the exact method and route", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-only-service-role-secret");
    const proof = await createInternalAuthHeader(userId, "/api/brand-boost", "POST");
    expect(proof).toBeTruthy();

    const request = new Request("https://maaroof.internal/api/brand-boost", {
      method: "POST",
      headers: { "x-maaroof-internal-auth": proof! },
    });
    await expect(verifyInternalAuth(request)).resolves.toBe(userId);
  });

  it("rejects a proof replayed against another path or method", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-only-service-role-secret");
    const proof = await createInternalAuthHeader(userId, "/api/brand-boost", "POST");
    expect(proof).toBeTruthy();

    const wrongPath = new Request("https://maaroof.internal/api/compare", {
      method: "POST",
      headers: { "x-maaroof-internal-auth": proof! },
    });
    const wrongMethod = new Request("https://maaroof.internal/api/brand-boost", {
      method: "GET",
      headers: { "x-maaroof-internal-auth": proof! },
    });
    await expect(verifyInternalAuth(wrongPath)).resolves.toBeNull();
    await expect(verifyInternalAuth(wrongMethod)).resolves.toBeNull();
  });

  it("does not trust a signature created with a different secret", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "secret-a");
    const proof = await createInternalAuthHeader(userId, "/api/compare", "POST");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "secret-b");
    const request = new Request("https://maaroof.internal/api/compare", {
      method: "POST",
      headers: { "x-maaroof-internal-auth": proof! },
    });
    await expect(verifyInternalAuth(request)).resolves.toBeNull();
  });
});
