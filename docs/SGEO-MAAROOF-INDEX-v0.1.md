# SGEO — Maaroof Search Generative Ecosystem Index

**Owner / origin:** MAAROOF AI  
**Concept version:** 0.1 (definition and measurement specification)  
**Status:** Proposed framework; not yet a validated production metric.

## 1. Definition

SGEO is Maaroof's proposed integrated index for examining how four search-visibility disciplines relate:

- **SEO:** organic discoverability, crawlability, indexability, technical and content signals.
- **AEO:** answer readiness, question coverage, direct-answer extraction and answer usefulness.
- **GEO:** visibility and source use in generative answers, including retrieval, citation and factual representation.
- **SGE:** generative-search result experiences. The acronym originated as Google's historical product name, so SGEO must not imply that SGE is a currently active, independent universal engine or a standalone ranking factor.

SGEO does not replace the four disciplines and must never conceal their individual results.

## 2. What the index examines

SGEO evaluates four distinct relationships, not four interchangeable labels:

1. **Intersection (overlap):** evidence, entities, content assets or technical signals that contribute to more than one axis.
2. **Similarity:** how closely the observed profiles, outcomes or evidence patterns of two axes resemble one another.
3. **Divergence (difference):** gaps, conflicting outcomes, unique requirements or signals that benefit one axis but do not transfer to another.
4. **Complementarity (integration):** whether strengths on one axis address weaknesses or dependencies on another, supported by traceable evidence.

The output is an integrated relationship profile alongside the separate SEO, AEO, GEO and generative-search observations.

## 3. Required output

Every SGEO assessment should report:

- The four source-axis results separately, with their measurement scope.
- An intersection matrix showing shared evidence and which axes it supports.
- A similarity matrix with the comparison method and data sample stated.
- A divergence register listing gaps, conflicts and axis-specific requirements.
- A complementarity map showing supported dependencies and opportunities.
- Evidence references, observation dates, sample sizes, engine/model coverage and confidence/limitations.
- Missing-data markers. An unobserved axis is **unknown**, not zero and not an inferred score.

## 4. Measurement discipline

The concept definition does not itself authorize a numeric score. A composite SGEO number must not be displayed until each component has:
- an operational definition and reproducible data schema;
- a normalization method that makes unlike measures comparable;
- a documented aggregation rule and justified weights (or a justified non-weighted profile);
- repeated-run and cross-engine reliability testing;
- validation against human-reviewed evidence and known limitations.

Do not assume equal weights. Do not infer ranking, citations, discoverability or model recognition from on-page readiness alone. Do not treat SGE as a fifth discipline or double-count an SGE observation already included in GEO.

## 5. Version 0.1 boundary

This release defines the concept and the reporting structure. It does **not** claim that a production SGEO score, calibrated weighting model, validated benchmark or longitudinal measurement pipeline has been implemented.

The name and definition are proposed as a Maaroof-origin concept based on the research search conducted for this release. A search that did not surface an exact prior use cannot prove worldwide novelty, exclusivity, legal ownership or trademark availability. Any public claim about originality must retain that qualification until a formal prior-art and trademark search is completed.

## 6. Research distinction

The established term GEO (Generative Engine Optimization) appears in academic work, including the 2023 arXiv preprint and the KDD 2024 publication. A 2026 paper uses **SAGEO** for **Search-Augmented Generative Engine Optimization**; this is a different acronym and expansion from Maaroof's SGEO. Keep the spellings and definitions distinct in documentation and product copy.
