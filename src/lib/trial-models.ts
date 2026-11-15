// Pure: pick three real models from three different providers for the free trial.
import { ENGINE_COUNCIL_MODELS } from "@/lib/maaroof/tool-council";

export const TRIAL_CANDIDATE_ORDER = ["chatgpt", "gemini", "claude", "grok", "mistral", "deepseek", "kimi", "qwen", "perplexity", "copilot"] as const;

const providerOf = (model: string) => (model.includes("/") ? model.split("/")[0] : "");

/**
 * With OpenRouter: the engine's real council model. Without it: the governed/catalog model
 * only when it belongs to the engine's own provider.
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
    // Council models are fast non-reasoning models; reasoning models (e.g. gpt-5) can spend the
    // whole token budget thinking and return empty content, so prefer the council model.
    if (hasOpenRouter && council) model = council;
    else if (governed && providerOf(governed) === own) model = governed;
    const p = providerOf(model);
    if (!model || !p || providers.has(p)) continue;
    providers.add(p);
    selected.push({ key, model });
    if (selected.length === 3) break;
  }
  return selected.length === 3 ? selected : null;
}
