import { RefreshCw, History } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const TX = {
  ar: { reused: "استخدمنا نتيجة سابقة لنفس الطلب — بلا خصم", refresh: "تحديث الآن" },
  en: { reused: "Reused a previous result for the same request — no charge", refresh: "Refresh now" },
  ku: { reused: "ئەنجامێکی پێشوو بەکارهات — بێ تێچوون", refresh: "ئێستا نوێبکەرەوە" },
};

/** Shows when a tool result came from MCI reuse; "Refresh now" forces a fresh run. */
export function MciReuseBadge({ mci, path, onRefresh }: { mci?: { reused?: boolean; at?: string } | null; path: string; onRefresh: () => void }) {
  const { lang } = useI18n();
  if (!mci?.reused) return null;
  const T = TX[(lang === "en" || lang === "ku" ? lang : "ar") as "ar"];
  const when = mci.at ? new Date(mci.at).toLocaleString() : "";
  return (
    <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs">
      <History className="size-3.5 text-primary" />
      <span>{T.reused}{when ? ` · ${when}` : ""}</span>
      <button
        type="button"
        onClick={() => { try { sessionStorage.setItem(`mci_force:${path}`, "1"); } catch {} onRefresh(); }}
        className="ms-auto inline-flex items-center gap-1 rounded-full border border-primary/40 px-3 py-1 font-semibold text-primary hover:bg-primary/15"
      >
        <RefreshCw className="size-3" /> {T.refresh}
      </button>
    </div>
  );
}
