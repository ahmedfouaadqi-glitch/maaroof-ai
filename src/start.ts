import { createStart, createMiddleware, createCsrfMiddleware } from "@tanstack/react-start";

// Blocks cross-site calls to server functions only; server routes (/api/*, /lovable/*) are untouched.
const csrfMiddleware = createCsrfMiddleware({ filter: (ctx) => ctx.handlerType === "serverFn" });

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next, request }) => {
  // /lovable/* routes (email webhooks, previews) authenticate themselves.
  if (new URL(request.url).pathname.startsWith("/lovable/")) {
    return next();
  }
  try {

    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [csrfMiddleware, errorMiddleware],
}));
