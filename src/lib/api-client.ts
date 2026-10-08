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

const MCI_TOOLS = ["/api/analyze", "/api/visibility", "/api/research", "/api/compare"];
const MCI_TXT = {
  ar: { reused: "استخدمنا نتيجة سابقة لنفس الطلب دون خصم", refresh: "تحديث الآن", again: "اضغط زر التشغيل مرة أخرى لفحص جديد" },
  en: { reused: "Reused a previous result for the same request — no charge", refresh: "Refresh now", again: "Run the tool again for a fresh check" },
  ku: { reused: "ئەنجامێکی پێشووی هەمان داواکاری بەکارهات — بێ تێچوون", refresh: "نوێکردنەوە", again: "دووبارە کارپێبکە بۆ پشکنینی نوێ" },
};

/** MCI: if the user asked to refresh, add force:true to the next JSON body for that tool. */
function applyMciForce(path: string, init?: RequestInit): RequestInit | undefined {
  if (typeof window === "undefined" || !init || typeof init.body !== "string") return init;
  const key = `mci_force:${path}`;
  if (!sessionStorage.getItem(key)) return init;
  sessionStorage.removeItem(key);
  try { return { ...init, body: JSON.stringify({ ...JSON.parse(init.body), force: true }) }; } catch { return init; }
}

export async function apiFetch(path: string, init?: RequestInit) {
  const isMci = MCI_TOOLS.includes(path);
  if (isMci) init = applyMciForce(path, init);
  const res = await fetch(withPreviewAuth(path), init);

  if (isMci && res.ok && typeof window !== "undefined") {
    res.clone().json().then((b: any) => {
      if (!b?.mci?.reused) return;
      const T = MCI_TXT[currentLang()];
      const when = b.mci.at ? new Date(b.mci.at).toLocaleString() : "";
      toast.info(`${T.reused}${when ? ` (${when})` : ""}`, {
        duration: 10000,
        action: { label: T.refresh, onClick: () => { sessionStorage.setItem(`mci_force:${path}`, "1"); toast(T.again); } },
      });
    }).catch(() => {});
  }

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
