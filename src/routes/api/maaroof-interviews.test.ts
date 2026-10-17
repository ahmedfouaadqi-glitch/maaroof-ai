import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockCreateClient, mockGetUser } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockGetUser: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: mockCreateClient,
}));

import { Route } from "@/routes/api/maaroof-interviews";

type HandlerArgs = { request: Request };
type Method = "GET" | "POST" | "PATCH";
type Handler = (args: HandlerArgs) => Promise<Response>;

const handlers = (Route.options as unknown as { server: { handlers: Record<Method, Handler> } })
  .server.handlers;
const USER_ID = "f2d2a2f6-1ea0-4be8-976a-77e68b11ea20";

function makeRequest(
  method: Method,
  authorization?: string,
  body: unknown = {},
  url = "http://localhost/api/maaroof-interviews",
): Request {
  const headers = new Headers();
  if (authorization) headers.set("authorization", authorization);
  if (method !== "GET") headers.set("content-type", "application/json");

  return new Request(url, {
    method,
    headers,
    ...(method === "GET" ? {} : { body: JSON.stringify(body) }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
  mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
  mockCreateClient.mockReturnValue({ auth: { getUser: mockGetUser } });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Maaroof interviews API authentication", () => {
  it.each(["GET", "POST", "PATCH"] as const)(
    "%s rejects requests without a bearer token",
    async (method) => {
      const response = await handlers[method]({ request: makeRequest(method) });

      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({ error: "auth_required" });
      expect(mockCreateClient).not.toHaveBeenCalled();
    },
  );

  it.each(["Basic dXNlcjpwYXNz", "Bearer", "Token invalid"] as const)(
    "rejects malformed authorization header %s",
    async (authorization) => {
      const response = await handlers.GET({ request: makeRequest("GET", authorization) });

      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({ error: "auth_required" });
      expect(mockCreateClient).not.toHaveBeenCalled();
    },
  );
});

describe("Maaroof interviews API request validation", () => {
  it("rejects an invalid target type before accessing the database", async () => {
    const response = await handlers.POST({
      request: makeRequest("POST", "Bearer valid-token", {
        target_type: "unknown",
        target_name: "Test target",
      }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid_target_type" });
    expect(mockGetUser).toHaveBeenCalledWith("valid-token");
  });

  it.each(["", "   ", "x".repeat(201)])(
    "rejects an empty or overlong target name",
    async (target_name) => {
      const response = await handlers.POST({
        request: makeRequest("POST", "Bearer valid-token", {
          target_type: "company",
          target_name,
        }),
      });

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error: "invalid_target_name" });
    },
  );

  it("rejects unknown interview depth values", async () => {
    const response = await handlers.POST({
      request: makeRequest("POST", "Bearer valid-token", {
        target_type: "company",
        target_name: "Test company",
        interview_depth: "adaptive-unknown",
      }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid_interview_depth" });
  });

  it("rejects malformed interview identifiers before querying storage", async () => {
    const response = await handlers.GET({
      request: makeRequest("GET", "Bearer valid-token", {}, "http://localhost/api/maaroof-interviews?id=not-a-uuid"),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid_interview_id" });
    expect(mockCreateClient).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid optimistic versions before querying storage", async () => {
    const response = await handlers.PATCH({
      request: makeRequest("PATCH", "Bearer valid-token", {
        id: "f2d2a2f6-1ea0-4be8-976a-77e68b11ea20",
        expected_version: 0,
        action: "answer",
      }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid_expected_version" });
  });

  it("rejects invalid workspace identifiers before querying storage", async () => {
    const response = await handlers.POST({
      request: makeRequest("POST", "Bearer valid-token", {
        target_type: "company",
        target_name: "Test company",
        workspace_id: "not-a-uuid",
      }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid_workspace_id" });
  });
});
