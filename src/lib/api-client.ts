import { toast } from "sonner";

const PREVIEW_TOKEN_PARAM = "__lovable_token";

export function withPreviewAuth(path: string) {
  if (typeof window === "undefined" || !path.startsWith("/api/")) return path;

  const token = new URLSearchParams(window.location.search).get(PREVIEW_TOKEN_PARAM);
  if (!token) return path;

  const url = new URL(path, window.location.origin);
  if (!url.searchParams.has(PREVIEW_TOKEN_PARAM)) {
    url.searchParams.set(PREVIEW_TOKEN_PARAM, token);
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

function currentLang(): "ar" | "en" | "ku" {
  if (typeof document === "undefined") return "ar";
  const l = document.documentElement.lang as any;
  return l === "en" || l === "ku" ? l : "ar";
}

export async function apiFetch(path: string, init?: RequestInit) {
  const res = await fetch(withPreviewAuth(path), init);

  // Handle token-related 402 with a localized toast
  if (res.status === 402 && path.startsWith("/api/")) {
    try {
      const clone = res.clone();
      const body = await clone.json();
      const L = currentLang();
      const msg =
        (body && typeof body === "object" && (body[L] || body.message || body.error)) ||
        (L === "ar" ? "تعذّر تنفيذ العملية (رصيد التوكنز)" : L === "ku" ? "تۆکنی پێویست نییە" : "Token charge failed");
      toast.error(String(msg));
    } catch {
      // ignore parse errors
    }
  } else if (res.ok && path.startsWith("/api/") && (init?.method || "GET").toUpperCase() !== "GET") {
    // Signal token usage may have changed so TokensBar / balances refresh
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("tokens-changed"));
    }
  }

  return res;
}
