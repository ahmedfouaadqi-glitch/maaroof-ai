import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockCreateClient,
  mockGetUser,
  mockFrom,
  mockStoredInterview,
  mockWorkspace,
  mockWorkspaceMember,
  mockForceVersionConflictOnWrite,
} = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
  mockStoredInterview: { value: null as unknown },
  mockWorkspace: { value: null as unknown },
  mockWorkspaceMember: { value: null as unknown },
  mockForceVersionConflictOnWrite: { value: false },
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
const WORKSPACE_ID = "2d54c1b9-278f-4d8a-987a-2b2e6b5ff8c0";
const OTHER_USER_ID = "5bda9c50-a9a1-49e8-b680-081f19fb4cc2";

function makeStoredInterview(workspaceId: string | null = null) {
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
    workspace_id: workspaceId,
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
      workspace_id: workspaceId,
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
  mockWorkspace.value = null;
  mockWorkspaceMember.value = null;
  mockForceVersionConflictOnWrite.value = false;
  mockFrom.mockImplementation((table: string) => {
    type Query = {
      select: (...args: unknown[]) => Query;
      eq: (column: string, value: unknown) => Query;
      maybeSingle: () => Promise<{ data: unknown; error: null }>;
      update: (payload: Record<string, unknown>) => Query;
      in: (...args: unknown[]) => Query;
      is: (...args: unknown[]) => Query;
      order: (...args: unknown[]) => Query;
      limit: (...args: unknown[]) => Query;
    };
    const query = {} as Query;
    const eqFilters: Record<string, unknown> = {};
    let updatePayload: Record<string, unknown> | null = null;
    query.select = vi.fn(() => query);
    query.eq = vi.fn((column: string, value: unknown) => {
      eqFilters[column] = value;
      return query;
    });
    query.in = vi.fn(() => query);
    query.is = vi.fn(() => query);
    query.order = vi.fn(() => query);
    query.limit = vi.fn(() => query);
    query.update = vi.fn((payload: Record<string, unknown>) => {
      updatePayload = payload;
      return query;
    });
    query.maybeSingle = vi.fn(async () => {
      const stored =
        table === "maaroof_interviews"
          ? mockStoredInterview.value
          : table === "workspaces"
            ? mockWorkspace.value
            : table === "workspace_members"
              ? mockWorkspaceMember.value
              : null;
      if (stored && table === "maaroof_interviews") {
        const storedRow = stored as Record<string, unknown>;
        if (
          Object.entries(eqFilters).some(([column, expected]) => storedRow[column] !== expected)
        ) {
          return { data: null, error: null };
        }
        if (updatePayload) {
          // Simulate a concurrent write between the initial read and the conditional update.
          if (mockForceVersionConflictOnWrite.value) {
            mockForceVersionConflictOnWrite.value = false;
            return { data: null, error: null };
          }
          if (eqFilters.version !== storedRow.version) return { data: null, error: null };
          return { data: { ...storedRow, ...updatePayload }, error: null };
        }
      }
      return { data: stored, error: null };
    });
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

describe("Maaroof interviews workspace permissions", () => {
  it("allows a workspace viewer to read an interview", async () => {
    mockStoredInterview.value = makeStoredInterview(WORKSPACE_ID);
    mockWorkspace.value = { id: WORKSPACE_ID, owner_id: OTHER_USER_ID };
    mockWorkspaceMember.value = { role: "viewer" };

    const response = await handlers.GET({
      request: makeRequest(
        "GET",
        "Bearer valid-token",
        {},
        "http://localhost/api/maaroof-interviews?id=" + INTERVIEW_ID,
      ),
    });

    expect(response.status).toBe(200);
    expect(mockFrom).toHaveBeenCalledWith("workspaces");
    expect(mockFrom).toHaveBeenCalledWith("workspace_members");
  });

  it("does not allow a workspace viewer to pause or update an interview", async () => {
    mockStoredInterview.value = makeStoredInterview(WORKSPACE_ID);
    mockWorkspace.value = { id: WORKSPACE_ID, owner_id: OTHER_USER_ID };
    mockWorkspaceMember.value = { role: "viewer" };

    const response = await handlers.PATCH({
      request: makeRequest("PATCH", "Bearer valid-token", {
        id: INTERVIEW_ID,
        expected_version: 1,
        action: "status",
        status: "paused",
      }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "interview_not_found" });
  });

  it.each(["owner", "editor"] as const)(
    "allows workspace %s to update an interview status",
    async (role) => {
      mockStoredInterview.value = makeStoredInterview(WORKSPACE_ID);
      mockWorkspace.value = { id: WORKSPACE_ID, owner_id: OTHER_USER_ID };
      mockWorkspaceMember.value = { role };

      const response = await handlers.PATCH({
        request: makeRequest("PATCH", "Bearer valid-token", {
          id: INTERVIEW_ID,
          expected_version: 1,
          action: "status",
          status: "paused",
        }),
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.interview.status).toBe("paused");
      expect(body.interview.version).toBe(2);
    },
  );
});

describe("Maaroof interviews access isolation", () => {
  it("hides a personal interview from a different authenticated user", async () => {
    mockStoredInterview.value = makeStoredInterview();
    mockGetUser.mockResolvedValue({ data: { user: { id: OTHER_USER_ID } }, error: null });

    const response = await handlers.GET({
      request: makeRequest(
        "GET",
        "Bearer another-users-token",
        {},
        "http://localhost/api/maaroof-interviews?id=" + INTERVIEW_ID,
      ),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "interview_not_found" });
  });

  it("rejects a workspace non-member from reading an interview", async () => {
    mockStoredInterview.value = makeStoredInterview(WORKSPACE_ID);
    mockWorkspace.value = { id: WORKSPACE_ID, owner_id: OTHER_USER_ID };
    mockWorkspaceMember.value = null;

    const response = await handlers.GET({
      request: makeRequest(
        "GET",
        "Bearer valid-token",
        {},
        "http://localhost/api/maaroof-interviews?id=" + INTERVIEW_ID,
      ),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "interview_not_found" });
  });

  it("rejects a workspace non-member from modifying an interview", async () => {
    mockStoredInterview.value = makeStoredInterview(WORKSPACE_ID);
    mockWorkspace.value = { id: WORKSPACE_ID, owner_id: OTHER_USER_ID };
    mockWorkspaceMember.value = null;

    const response = await handlers.PATCH({
      request: makeRequest("PATCH", "Bearer valid-token", {
        id: INTERVIEW_ID,
        expected_version: 1,
        action: "status",
        status: "paused",
      }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "interview_not_found" });
  });

  it("allows a workspace owner to modify an interview without a membership row", async () => {
    mockStoredInterview.value = makeStoredInterview(WORKSPACE_ID);
    mockWorkspace.value = { id: WORKSPACE_ID, owner_id: USER_ID };
    mockWorkspaceMember.value = null;

    const response = await handlers.PATCH({
      request: makeRequest("PATCH", "Bearer valid-token", {
        id: INTERVIEW_ID,
        expected_version: 1,
        action: "status",
        status: "paused",
      }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.interview.status).toBe("paused");
  });
});

describe("Maaroof interviews optimistic concurrency", () => {
  it("rejects an update when the caller's expected version is stale", async () => {
    mockStoredInterview.value = { ...makeStoredInterview(), version: 2 };

    const response = await handlers.PATCH({
      request: makeRequest("PATCH", "Bearer valid-token", {
        id: INTERVIEW_ID,
        expected_version: 1,
        action: "status",
        status: "paused",
      }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "interview_version_conflict",
      current_version: 2,
    });
  });

  it("rejects a write if another update wins after the initial read", async () => {
    mockStoredInterview.value = makeStoredInterview();
    mockForceVersionConflictOnWrite.value = true;

    const response = await handlers.PATCH({
      request: makeRequest("PATCH", "Bearer valid-token", {
        id: INTERVIEW_ID,
        expected_version: 1,
        action: "status",
        status: "paused",
      }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "interview_version_conflict" });
  });
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
