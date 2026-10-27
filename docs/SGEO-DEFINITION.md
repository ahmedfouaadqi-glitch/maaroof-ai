# SGEO in MAAROOF Ai

## Product definition

**SGEO is a derived overlap index** that measures shared, evidence-backed practices across **SEO, AEO, GEO and SGE**. It is not a sixth independent axis and it is not a replacement name for GSEO.

- **SEO**: crawlability, page metadata, headings, content coverage and other on-page/search signals.
- **AEO**: question-led content and answer structures that help answer systems locate explicit responses.
- **GEO**: clarity of the entity, grounded facts, context, citations and machine-readable information that can support generative answers.
- **SGE**: concise leads and clearly segmented content that can be extracted into generative search experiences.
- **GSEO**: the existing fifth axis in the application. Its current routing, weights, score and UI label remain separate and are not renamed to SGEO.

## Calculation in this implementation

1. Take the findings for each actual audited URL separately.
2. A URL is eligible only when numeric findings are available for all four core axes: SEO, AEO, GEO and SGE.
3. For eligible URLs, check four shared patterns: entity clarity, answer structure, factual content, and machine extractability.
4. A pattern counts for a URL only when the existing finding evidence contains its mapped signals across all four core axes on that same URL.
5. The SGEO score is the mean coverage percentage across the four patterns. The output also records the number of eligible URLs, per-axis measurement coverage and the pattern-level matched counts.
6. If no URL has all four core axes measured, SGEO is `null` ("not measured"), not zero and not a guessed score.

The computed SGEO result is added to the deep-audit event and shown separately in the workspace UI/export. The existing weighted overall score is unchanged and continues to use its existing axes/weights, including GSEO. SGEO is deliberately excluded from that weighted total to avoid double counting overlapping evidence.

## Interpretation limits

This is a deterministic, evidence-rule index based on fetched public page content; it is not a universal industry standard, a direct Google SGE ranking metric, or proof that a model cited a brand in a live answer. Live answer visibility and citations remain a separate measurement path and must be clearly labelled as measured only when the actual approved probe returned evidence.

Historical audit events do not contain this index; the UI marks those runs as unavailable until a new scan records the new field.
