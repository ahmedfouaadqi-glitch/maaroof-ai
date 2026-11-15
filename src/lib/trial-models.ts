// Pure: pick three real models from three different providers for the free trial.
import { ENGINE_COUNCIL_MODELS } from "@/lib/maaroof/tool-council";

export const TRIAL_CANDIDATE_ORDER = ["chatgpt", "gemini", "claude", "grok", "mistral", "deepseek", "kimi", "qwen", "perplexity", "copilot"] as const;

const providerOf = (model: string) => (model.includes("/") ? model.split("/")[0] : "");

/**
 * Governed/catalog model first when it already belongs to the engine's own provider;
 * otherwise, only when OpenRouter is configured, the engine's real council model.
 * Returns null unless three distinct providers are available (no fake fill-ins).
 */
export function pickTrialModels(
  resolved: Record<string, { model?: string } | undefined>,
  hasOpenRouter: boolean,
): Array<{ key: string; model: string }> | null {
  const selected: Array<{ key: string; model: string }> = [];
  const providers = new Set<string>();
  for (const key of TRIAL_CANDIDATE_ORDER) {
    const council = ENGINE_COUNCIL_MODELS.find((m) => m.key === key)?.model || "";
    const own = providerOf(council);
    const governed = String(resolved[key]?.model || "");
    let model = "";
    if (governed && providerOf(governed) === own) model = governed;
    else if (hasOpenRouter && council) model = council;
    const p = providerOf(model);
    if (!model || !p || providers.has(p)) continue;
    providers.add(p);
    selected.push({ key, model });
    if (selected.length === 3) break;
  }
  return selected.length === 3 ? selected : null;
}
