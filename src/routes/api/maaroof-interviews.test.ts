import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockCreateClient, mockGetUser, mockFrom, mockStoredInterview } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
  mockStoredInterview: { value: null as unknown },
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: mockCreateClient,
}));

import { Route } from "@/routes/api/maaroof-interviews";
import { createInterviewState } from "@/lib/maaroof/interview-engine";
import { buildInterviewQuestionSet } from "@/lib/maaroof/interview-question-bank";

type HandlerArgs = { request: Request };
type Method = "GET" | "POST" | "PATCH";
type Handler = (args: HandlerArgs) => Promise<Response>;

const handlers = (Route.options as unknown as { server: { handlers: Record<Method, Handler> } })
  .server.handlers;
const USER_ID = "f2d2a2f6-1ea0-4be8-976a-77e68b11ea20";

const INTERVIEW_ID = "f7d6a816-6a1f-43c2-85dc-2b74d8d4d112";

function makeStoredInterview() {
  const domains = ["general"] as const;
  const questions = buildInterviewQuestionSet("individual", [...domains]);
  const state = createInterviewState({
    targetType: "individual",
    domains: [...domains],
    locale: "ar",
  });
  return {
    id: INTERVIEW_ID,
    user_id: USER_ID,
    workspace_id: null,
    target_type: "individual",
    target_name: "Test individual",
    initial_goal: null,
    domains: [...domains],
    locale: "ar",
    question_set_version: "2026-10-v1",
    questions_snapshot: questions,
    state,
    context_snapshot: {
      target_type: "individual",
      target_name: "Test individual",
      workspace_id: null,
      domains: [...domains],
      locale: "ar",
      interview_depth: "focused",
    },
    status: "in_progress",
    current_question_id: "objective",
    version: 1,
    created_at: "2026-10-17T00:00:00.000Z",
    updated_at: "2026-10-17T00:00:00.000Z",
    completed_at: null,
  };
}

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
  mockStoredInterview.value = null;
  mockFrom.mockImplementation(() => {
    type Query = {
      select: (...args: unknown[]) => Query;
      eq: (...args: unknown[]) => Query;
      maybeSingle: () => Promise<{ data: unknown; error: null }>;
      update: (...args: unknown[]) => Query;
    };
    const query = {} as Query;
    query.select = vi.fn(() => query);
    query.eq = vi.fn(() => query);
    query.update = vi.fn(() => query);
    query.maybeSingle = vi.fn(async () => ({ data: mockStoredInterview.value, error: null }));
    return query;
  });
  mockCreateClient.mockReturnValue({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  });
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

describe("Maaroof interviews stored-data integrity", () => {
  it("returns the expected question when saved context and cursor agree", async () => {
    mockStoredInterview.value = makeStoredInterview();

    const response = await handlers.GET({
      request: makeRequest(
        "GET",
        "Bearer valid-token",
        {},
        "http://localhost/api/maaroof-interviews?id=" + INTERVIEW_ID,
      ),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.next_question.id).toBe("objective");
  });

  it("rejects a stale saved question cursor instead of returning a conflicting question", async () => {
    mockStoredInterview.value = { ...makeStoredInterview(), current_question_id: "audience" };

    const response = await handlers.GET({
      request: makeRequest(
        "GET",
        "Bearer valid-token",
        {},
        "http://localhost/api/maaroof-interviews?id=" + INTERVIEW_ID,
      ),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "stored_interview_cursor_mismatch" });
  });

  it("rejects a saved context snapshot that no longer matches the interview target", async () => {
    const interview = makeStoredInterview();
    interview.context_snapshot.target_name = "A different target";
    mockStoredInterview.value = interview;

    const response = await handlers.GET({
      request: makeRequest(
        "GET",
        "Bearer valid-token",
        {},
        "http://localhost/api/maaroof-interviews?id=" + INTERVIEW_ID,
      ),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "stored_interview_context_mismatch" });
  });

  it("rejects inconsistent stored context before a status update", async () => {
    const interview = makeStoredInterview();
    interview.state.context.targetType = "company";
    mockStoredInterview.value = interview;

    const response = await handlers.PATCH({
      request: makeRequest("PATCH", "Bearer valid-token", {
        id: INTERVIEW_ID,
        expected_version: 1,
        action: "status",
        status: "paused",
      }),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "stored_interview_context_mismatch" });
  });
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
      request: makeRequest(
        "GET",
        "Bearer valid-token",
        {},
        "http://localhost/api/maaroof-interviews?id=not-a-uuid",
      ),
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
