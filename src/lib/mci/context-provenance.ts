// Context provenance recorder — in-memory, summarised for telemetry.
import type { CognitiveStage, ContextItem, ContextProvenance } from "./types";

export class ProvenanceLog {
  readonly entries: ContextProvenance[] = [];
  record(item: ContextItem, stage: CognitiveStage, included: boolean, reason: string, origin = item.source) {
    this.entries.push({ itemId: item.id, source: item.source, origin, stage, included, reason });
  }
  summary() {
    const inc = this.entries.filter((e) => e.included);
    const bySource: Record<string, number> = {};
    for (const e of inc) bySource[e.source] = (bySource[e.source] || 0) + 1;
    return { total: this.entries.length, included: inc.length, excluded: this.entries.length - inc.length, bySource };
  }
}
