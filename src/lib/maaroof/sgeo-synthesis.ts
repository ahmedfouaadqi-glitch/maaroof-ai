import type { AxisFinding } from "@/lib/maaroof/deep-audit";

/**
 * SGEO is a derived overlap index, not an additional independent search axis.
 * It measures whether the same public source contains evidence that supports shared
 * principles across SEO, AEO, GEO and SGE. It is intentionally excluded from the
 * weighted axis score so the same evidence is not counted twice.
 */
export const SGEO_CORE_AXES = ["seo", "aeo", "geo", "sge"] as const;
export type SgeoCoreAxis = (typeof SGEO_CORE_AXES)[number];

export const SGEO_PILLARS = [
  "entity_clarity",
  "answer_structure",
  "factual_content",
  "machine_extractability",
] as const;
export type SgeoPillarKey = (typeof SGEO_PILLARS)[number];

export type SgeoPillarResult = {
  key: SgeoPillarKey;
  /** Number of complete targets where all four axes support this shared pillar. */
  matchedTargets: number;
  /** Percentage of complete targets with evidence overlap for this pillar; null if none were measurable. */
  coveragePercent: number | null;
};

export type SgeoSynthesis = {
  score: number | null;
  measuredTargets: number;
  totalTargets: number;
  axisCoverage: Record<SgeoCoreAxis, number>;
  pillars: SgeoPillarResult[];
  sharedPillars: SgeoPillarKey[];
  method: "same_target_shared_evidence_v1";
  /** Explains why the score is null when the available evidence cannot support synthesis. */
  reason: "measured_overlap" | "no_target_with_all_four_axes";
};

type PillarSupport = Record<SgeoCoreAxis, RegExp>;

const PILLAR_SUPPORT: Record<SgeoPillarKey, PillarSupport> = {
  entity_clarity: {
    seo: /^(title:|description:|h1$)/i,
    aeo: /^(questions:\d+|faq)$/i,
    geo: /^(brand_in_opening|brand_in_profile|brand_in_profile_title|brand_in_profile_description|brand_mentioned)$/i,
    sge: /^concise_lead$/i,
  },
  answer_structure: {
    seo: /^h1$/i,
    aeo: /^(questions:\d+|faq|lists)$/i,
    geo: /^(structured_data|facts_first_150:\d+)$/i,
    sge: /^(sections|concise_lead)$/i,
  },
  factual_content: {
    seo: /^words:\d+$/i,
    aeo: /^(questions:\d+|faq|lists)$/i,
    geo: /^facts_first_150:\d+$/i,
    sge: /^(concise_lead|sections)$/i,
  },
  machine_extractability: {
    seo: /^(title:|description:|h1$)/i,
    aeo: /^(faq|lists)$/i,
    geo: /^structured_data$/i,
    sge: /^sections$/i,
  },
};

function hasSupport(finding: AxisFinding | undefined, signal: RegExp): boolean {
  if (!finding || finding.score == null || !Number.isFinite(finding.score)) return false;
  return finding.evidence.some((item) => signal.test(String(item || "")));
}

function findingsByAxis(findings: AxisFinding[]): Partial<Record<SgeoCoreAxis, AxisFinding>> {
  const map: Partial<Record<SgeoCoreAxis, AxisFinding>> = {};
  for (const finding of findings) {
    if ((SGEO_CORE_AXES as readonly string[]).includes(finding.axis)) {
      map[finding.axis as SgeoCoreAxis] = finding;
    }
  }
  return map;
}

function isComplete(map: Partial<Record<SgeoCoreAxis, AxisFinding>>): map is Record<SgeoCoreAxis, AxisFinding> {
  return SGEO_CORE_AXES.every((axis) => {
    const finding = map[axis];
    return !!finding && typeof finding.score === "number" && Number.isFinite(finding.score);
  });
}

/**
 * Derive SGEO only from real axis findings for the same target.
 * A target without measured SEO + AEO + GEO + SGE is excluded instead of guessed.
 * Each pillar counts only when its evidence signal is present in all four axes.
 */
export function synthesizeSgeo(findingsByTarget: AxisFinding[][]): SgeoSynthesis {
  const axisCoverage: Record<SgeoCoreAxis, number> = { seo: 0, aeo: 0, geo: 0, sge: 0 };
  const completeTargets: Array<Record<SgeoCoreAxis, AxisFinding>> = [];

  for (const findings of findingsByTarget) {
    const byAxis = findingsByAxis(Array.isArray(findings) ? findings : []);
    for (const axis of SGEO_CORE_AXES) {
      const score = byAxis[axis]?.score;
      if (typeof score === "number" && Number.isFinite(score)) axisCoverage[axis] += 1;
    }
    if (isComplete(byAxis)) completeTargets.push(byAxis);
  }

  const pillars: SgeoPillarResult[] = SGEO_PILLARS.map((key) => {
    let matchedTargets = 0;
    for (const target of completeTargets) {
      const supportedByAllAxes = SGEO_CORE_AXES.every((axis) =>
        hasSupport(target[axis], PILLAR_SUPPORT[key][axis]),
      );
      if (supportedByAllAxes) matchedTargets += 1;
    }
    return {
      key,
      matchedTargets,
      coveragePercent: completeTargets.length
        ? Math.round((matchedTargets / completeTargets.length) * 100)
        : null,
    };
  });

  const score = completeTargets.length
    ? Math.round(
        pillars.reduce((sum, pillar) => sum + (pillar.coveragePercent ?? 0), 0) /
          pillars.length,
      )
    : null;

  return {
    score,
    measuredTargets: completeTargets.length,
    totalTargets: findingsByTarget.length,
    axisCoverage,
    pillars,
    sharedPillars: pillars.filter((pillar) => pillar.matchedTargets > 0).map((pillar) => pillar.key),
    method: "same_target_shared_evidence_v1",
    reason: completeTargets.length ? "measured_overlap" : "no_target_with_all_four_axes",
  };
}
