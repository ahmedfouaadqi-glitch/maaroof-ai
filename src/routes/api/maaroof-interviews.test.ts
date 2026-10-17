import { describe, expect, it } from "vitest";
import { Route } from "@/routes/api/maaroof-interviews";

type HandlerArgs = { request: Request };
type Method = "GET" | "POST" | "PATCH";
type Handler = (args: HandlerArgs) => Promise<Response>;

const handlers = (Route.options as unknown as { server: { handlers: Record<Method, Handler> } })
  .server.handlers;

function makeRequest(method: Method, authorization?: string): Request {
  const headers = new Headers();
  if (authorization) headers.set("authorization", authorization);
  if (method !== "GET") headers.set("content-type", "application/json");

  return new Request("http://localhost/api/maaroof-interviews", {
    method,
    headers,
    ...(method === "GET" ? {} : { body: JSON.stringify({}) }),
  });
}

describe("Maaroof interviews API authentication", () => {
  it.each(["GET", "POST", "PATCH"] as const)(
    "%s rejects requests without a bearer token",
    async (method) => {
      const response = await handlers[method]({ request: makeRequest(method) });

      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({ error: "auth_required" });
    },
  );

  it.each(["Basic dXNlcjpwYXNz", "Bearer", "Token invalid"] as const)(
    "rejects malformed authorization header %s",
    async (authorization) => {
      const response = await handlers.GET({ request: makeRequest("GET", authorization) });

      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({ error: "auth_required" });
    },
  );
});
