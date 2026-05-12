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

export function apiFetch(path: string, init?: RequestInit) {
  return fetch(withPreviewAuth(path), init);
}