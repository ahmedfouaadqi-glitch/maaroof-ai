/**
 * Evidence-backed knowledge records for the Maaroof domain ontology.
 *
 * This is a curated first tranche, not an exhaustive encyclopedia.
 * Classification separates scientific disciplines, technical methods,
 * industry practices, standards/specifications and product terminology.
 * URLs are canonical primary or foundational references; they must be rechecked
 * periodically before being treated as current operational guidance.
 */
import { DOMAIN_ONTOLOGY_BY_ACRONYM } from "./domain-ontology";

export type KnowledgeKind =
  | "discipline"
  | "research_field"
  | "technical_method"
  | "data_model"
  | "standard"
  | "specification"
  | "industry_practice"
  | "evaluation_framework"
  | "vocabulary"
  | "product_or_interface";

export type EvidenceMaturity =
  | "well_established"
  | "documented_practice"
  | "emerging_research"
  | "variable_industry_usage"
  | "historical";

export type KnowledgeSource = {
  title: string;
  organization: string;
  url: string;
  source_kind: "official_documentation" | "standard" | "peer_reviewed_or_preprint" | "foundational_paper";
};

export type DomainKnowledgeRecord = {
  acronym: string;
  knowledge_kind: KnowledgeKind;
  maturity: EvidenceMaturity;
  definition: string;
  foundations: string[];
  operational_dimensions: string[];
  measurement_methods: string[];
  limitations: string[];
  related_concepts: string[];
  sources: KnowledgeSource[];
  reviewed_on: "2026-11-15";
};

const g = (title: string, organization: string, url: string, source_kind: KnowledgeSource["source_kind"] = "official_documentation"): KnowledgeSource =>
  ({ title, organization, url, source_kind });

export const DOMAIN_KNOWLEDGE: readonly DomainKnowledgeRecord[] = [
  {
    acronym: "SEO",
    knowledge_kind: "industry_practice",
    maturity: "documented_practice",
    definition: "A set of technical and editorial practices that help search engines crawl, understand, index and present useful web content. It is a professional practice area drawing on information retrieval, web architecture, content strategy and measurement, not a standalone natural science.",
    foundations: ["web crawling and indexing", "information retrieval", "information architecture", "content quality", "measurement and experimentation"],
    operational_dimensions: ["crawlability", "indexability", "rendering", "canonicalization", "internal linking", "content usefulness", "structured data", "search performance"],
    measurement_methods: ["Search Console impressions, clicks, CTR and average position", "index coverage and crawl diagnostics", "query/page cohort analysis", "controlled technical or content experiments where feasible"],
    limitations: ["No checklist guarantees crawling, indexing or ranking.", "Search ranking systems are partly opaque and change over time.", "Traffic correlation alone does not establish that a specific SEO change caused the result."],
    related_concepts: ["information retrieval", "SERP", "structured data", "CRO", "SXO"],
    sources: [g("SEO Starter Guide", "Google Search Central", "https://developers.google.com/search/docs/fundamentals/seo-starter-guide"), g("Google Search Essentials", "Google Search Central", "https://developers.google.com/search/docs/essentials")],
    reviewed_on: "2026-11-15"
  },
  {
    acronym: "AEO",
    knowledge_kind: "industry_practice",
    maturity: "variable_industry_usage",
    definition: "An industry practice label for structuring content so answer-oriented interfaces can identify concise, relevant and attributable responses. There is no single universally governing AEO standard or canonical metric.",
    foundations: ["question answering", "information retrieval", "content structuring", "entity disambiguation", "source attribution"],
    operational_dimensions: ["question-intent coverage", "answer completeness", "factual support", "source attribution", "machine-readable context"],
    measurement_methods: ["task-specific answer accuracy", "citation/source inclusion rate across repeated controlled prompts", "coverage of target question sets", "human relevance and factuality review"],
    limitations: ["AEO is not a formally standardized ranking system.", "A featured answer or citation cannot be guaranteed by markup or formatting.", "Metrics must identify the answer system, query set, sampling period and denominator."],
    related_concepts: ["SEO", "GEO", "question answering", "RAG", "structured data"],
    sources: [g("Search Central: SEO Starter Guide", "Google Search Central", "https://developers.google.com/search/docs/fundamentals/seo-starter-guide"), g("General Structured Data Guidelines", "Google Search Central", "https://developers.google.com/search/docs/appearance/structured-data/sd-policies")],
    reviewed_on: "2026-11-15"
  },
  {
    acronym: "GEO",
    knowledge_kind: "research_field",
    maturity: "emerging_research",
    definition: "Generative Engine Optimization is an emerging research and practice area studying how content can be represented, retrieved, cited and used in responses produced by generative search systems. The foundational GEO paper proposes a benchmark and black-box optimization methods; it does not establish a universal ranking factor or guaranteed cross-platform effect.",
    foundations: ["information retrieval", "generative question answering", "source attribution", "experimental evaluation", "content representation"],
    operational_dimensions: ["retrievability", "citation inclusion", "citation prominence", "factual absorption", "answer fidelity", "repeatability across runs"],
    measurement_methods: ["predefined query benchmark", "repeated runs and paraphrases", "citation precision and recall", "source inclusion rate", "factual fidelity review", "control groups and longitudinal tracking"],
    limitations: ["Generative systems are stochastic and partially observable.", "Results vary by model, query, locale, time and retrieval pipeline.", "A citation-rate increase in a controlled benchmark does not prove increased organic discovery or business impact.", "There is no universal GEO score."],
    related_concepts: ["AEO", "SEO", "RAG", "information retrieval", "LLM evaluation"],
    sources: [g("GEO: Generative Engine Optimization", "arXiv / Princeton University and collaborators", "https://arxiv.org/abs/2311.09735", "peer_reviewed_or_preprint")],
    reviewed_on: "2026-11-15"
  },
  {
    acronym: "E-E-A-T",
    knowledge_kind: "evaluation_framework",
    maturity: "documented_practice",
    definition: "Experience, Expertise, Authoritativeness and Trustworthiness are concepts used in Google's Search Quality Rater Guidelines and people-first content guidance. E-E-A-T is not itself a specific ranking factor or a public numerical score.",
    foundations: ["content quality assessment", "source credibility", "first-hand experience", "expertise and trust"],
    operational_dimensions: ["demonstrable first-hand experience", "author and reviewer expertise", "reputation and corroboration", "transparent sourcing", "trust and accountability"],
    measurement_methods: ["evidence checklist tied to page purpose", "source and author verification", "expert review", "claim-level provenance audit"],
    limitations: ["Do not assign an invented Google E-E-A-T score.", "Rater guidelines are evaluation guidance, not a disclosed ranking formula.", "Signals appropriate to a YMYL page differ from those appropriate to a low-risk hobby page."],
    related_concepts: ["SEO", "content quality", "YMYL", "SXO"],
    sources: [g("Creating Helpful, Reliable, People-First Content", "Google Search Central", "https://developers.google.com/search/docs/fundamentals/creating-helpful-content")],
    reviewed_on: "2026-11-15"
  },
  {
    acronym: "RAG",
    knowledge_kind: "technical_method",
    maturity: "well_established",
    definition: "Retrieval-Augmented Generation combines a retrieval component that selects external or non-parametric evidence with a generative model that conditions its output on the retrieved material.",
    foundations: ["dense and/or sparse information retrieval", "embedding representations", "document chunking", "conditional text generation", "provenance"],
    operational_dimensions: ["ingestion and parsing", "chunking", "indexing", "query transformation", "retrieval", "reranking", "context assembly", "generation", "citation validation"],
    measurement_methods: ["Recall@k and Precision@k", "MRR or nDCG for retrieval ranking", "answer correctness and faithfulness", "citation precision", "latency and cost per query"],
    limitations: ["RAG does not guarantee factual answers.", "Retrieval failure, stale sources, poor chunking and context truncation propagate into generation.", "A vector database is one possible retrieval implementation, not a requirement for every RAG system."],
    related_concepts: ["BM25", "ANN", "vector search", "reranking", "GraphRAG", "LLM evaluation"],
    sources: [g("Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks", "NeurIPS 2020", "https://arxiv.org/abs/2005.11401", "foundational_paper")],
    reviewed_on: "2026-11-15"
  },
  {
    acronym: "BM25",
    knowledge_kind: "technical_method",
    maturity: "well_established",
    definition: "A probabilistic lexical ranking function that scores documents using query-term occurrence, inverse document frequency and document-length normalization. It is a retrieval/ranking method, not a language model.",
    foundations: ["term frequency", "inverse document frequency", "document length normalization", "probabilistic relevance framework"],
    operational_dimensions: ["tokenization", "index construction", "k1 and b parameters", "query terms", "document scoring"],
    measurement_methods: ["Recall@k", "Precision@k", "MRR", "nDCG", "benchmark comparison against baselines"],
    limitations: ["Lexical matching can miss semantic matches and paraphrases.", "Performance depends on corpus, tokenization, language and parameter choices.", "BM25 scores are not calibrated probabilities of relevance."],
    related_concepts: ["RAG", "inverted index", "hybrid retrieval", "RRF"],
    sources: [g("The Probabilistic Relevance Framework: BM25 and Beyond", "Foundations and Trends in Information Retrieval", "https://doi.org/10.1561/1500000019", "foundational_paper")],
    reviewed_on: "2026-11-15"
  },
  {
    acronym: "KG",
    knowledge_kind: "data_model",
    maturity: "well_established",
    definition: "A knowledge graph represents entities and typed relationships as a graph, often with attributes, identifiers, provenance and schema. The term describes a family of representations and systems rather than one single standard.",
    foundations: ["graph theory", "knowledge representation", "ontology and schema design", "entity identity and relation semantics"],
    operational_dimensions: ["entity identifiers", "types and properties", "typed edges", "provenance", "constraints", "entity resolution"],
    measurement_methods: ["entity-linking precision and recall", "relation extraction precision and recall", "schema constraint validation", "coverage and freshness audits"],
    limitations: ["A graph-shaped database is not automatically a high-quality knowledge graph.", "Incorrect entity matching can contaminate many downstream relationships.", "Schema design and provenance are necessary to interpret facts safely."],
    related_concepts: ["RDF", "RDFS", "OWL", "entity resolution", "GraphRAG"],
    sources: [g("RDF 1.1 Concepts and Abstract Syntax", "W3C", "https://www.w3.org/TR/rdf11-concepts", "standard"), g("RDF Schema 1.1", "W3C", "https://www.w3.org/TR/rdf-schema", "standard")],
    reviewed_on: "2026-11-15"
  },
  {
    acronym: "RDF",
    knowledge_kind: "standard",
    maturity: "well_established",
    definition: "The Resource Description Framework is a W3C data model for expressing statements as subject-predicate-object triples and combining them into graphs.",
    foundations: ["graph data model", "formal semantics", "URI-based identification", "linked data"],
    operational_dimensions: ["subjects", "predicates", "objects", "named graphs", "serialization formats"],
    measurement_methods: ["RDF parser validation", "SHACL or application-level constraint validation", "SPARQL query tests", "identifier and provenance audits"],
    limitations: ["RDF defines a data model, not the truth of asserted statements.", "A valid graph can still contain false, stale or unsupported claims."],
    related_concepts: ["KG", "RDFS", "OWL", "SPARQL", "JSON-LD"],
    sources: [g("RDF 1.1 Concepts and Abstract Syntax", "W3C", "https://www.w3.org/TR/rdf11-concepts", "standard")],
    reviewed_on: "2026-11-15"
  },
  {
    acronym: "JSON-LD",
    knowledge_kind: "specification",
    maturity: "well_established",
    definition: "JSON-LD is a JSON-based serialization format for expressing Linked Data. It can express RDF data and is commonly used to publish Schema.org structured data in web pages.",
    foundations: ["JSON", "RDF data model", "linked data contexts", "web serialization"],
    operational_dimensions: ["@context", "@type", "identifiers", "properties", "entity relationships"],
    measurement_methods: ["JSON syntax validation", "JSON-LD processor validation", "Google Rich Results Test where applicable", "visible-content parity and policy review"],
    limitations: ["Valid JSON-LD does not guarantee a rich result or ranking benefit.", "Markup must accurately describe visible page content.", "Search engines may support only subsets of vocabularies and properties."],
    related_concepts: ["RDF", "Schema.org", "structured data", "KG"],
    sources: [g("JSON-LD 1.1", "W3C", "https://www.w3.org/TR/json-ld11", "standard"), g("General Structured Data Guidelines", "Google Search Central", "https://developers.google.com/search/docs/appearance/structured-data/sd-policies")],
    reviewed_on: "2026-11-15"
  },
  {
    acronym: "Schema.org",
    knowledge_kind: "vocabulary",
    maturity: "well_established",
    definition: "A collaborative, shared vocabulary for describing entities and relationships in structured data on the web. It is a vocabulary, not a search engine ranking standard.",
    foundations: ["semantic web", "schema and vocabulary design", "structured data"],
    operational_dimensions: ["types", "properties", "expected values", "domain and range guidance", "entity relationships"],
    measurement_methods: ["vocabulary and syntax validation", "property applicability review", "consistency with visible content", "consumer-specific eligibility checks"],
    limitations: ["Using a Schema.org type does not imply that a search engine supports a rich result for it.", "Markup cannot make unsupported or untrue claims valid."],
    related_concepts: ["JSON-LD", "RDF", "KG", "structured data"],
    sources: [g("Schema.org Documentation", "Schema.org", "https://schema.org/docs/documents.html"), g("Google Search structured data policies", "Google Search Central", "https://developers.google.com/search/docs/appearance/structured-data/sd-policies")],
    reviewed_on: "2026-11-15"
  },
  {
    acronym: "ANN",
    knowledge_kind: "technical_method",
    maturity: "well_established",
    definition: "Approximate Nearest Neighbor methods retrieve points or vectors that are likely to be near a query under a chosen distance or similarity function, trading exactness for speed and resource efficiency.",
    foundations: ["metric spaces", "index structures", "similarity search", "high-dimensional data"],
    operational_dimensions: ["embedding model", "distance metric", "index family", "recall-latency trade-off", "filtering"],
    measurement_methods: ["Recall@k against exact nearest neighbors", "latency percentiles", "memory footprint", "index build time", "throughput"],
    limitations: ["Approximate results can omit true nearest neighbors.", "Similarity quality depends on the embedding model and distance metric.", "ANN search does not by itself solve semantic correctness."],
    related_concepts: ["vector search", "HNSW", "RAG", "embeddings"],
    sources: [g("Efficient and Robust Approximate Nearest Neighbor Search Using Hierarchical Navigable Small World Graphs", "IEEE TPAMI", "https://doi.org/10.1109/TPAMI.2018.2889473", "foundational_paper")],
    reviewed_on: "2026-11-15"
  },
  {
    acronym: "HNSW",
    knowledge_kind: "technical_method",
    maturity: "well_established",
    definition: "Hierarchical Navigable Small World is a graph-based approximate nearest-neighbor indexing method that uses layered navigable proximity graphs to support efficient similarity search.",
    foundations: ["small-world graph navigation", "hierarchical indexing", "approximate nearest neighbors"],
    operational_dimensions: ["M", "efConstruction", "efSearch", "distance metric", "index memory"],
    measurement_methods: ["Recall@k", "p50/p95/p99 query latency", "index size", "build duration", "recall-latency curves"],
    limitations: ["Higher recall can require more search work and memory.", "Parameter settings are workload- and dataset-dependent.", "The index is not a substitute for evaluating embedding quality."],
    related_concepts: ["ANN", "vector search", "RAG"],
    sources: [g("Efficient and Robust Approximate Nearest Neighbor Search Using Hierarchical Navigable Small World Graphs", "IEEE TPAMI", "https://doi.org/10.1109/TPAMI.2018.2889473", "foundational_paper")],
    reviewed_on: "2026-11-15"
  },
  {
    acronym: "SXO",
    knowledge_kind: "industry_practice",
    maturity: "variable_industry_usage",
    definition: "Search Experience Optimization is an industry practice label for improving the complete journey from search intent and result discovery through landing-page usability and task completion. Definitions and measurement boundaries vary across practitioners.",
    foundations: ["information architecture", "usability", "search intent", "conversion optimization", "user research"],
    operational_dimensions: ["intent-result alignment", "snippet clarity", "page speed and accessibility", "content usability", "task completion"],
    measurement_methods: ["task success rate", "conversion rate", "Core Web Vitals as field diagnostics", "qualitative usability testing", "search-to-conversion funnel analysis"],
    limitations: ["SXO has no single formal standard or universally accepted score.", "Engagement metrics can be misleading without task and audience context.", "Do not collapse accessibility, relevance and conversion into one unexplained score."],
    related_concepts: ["SEO", "CRO", "UX", "Core Web Vitals"],
    sources: [g("SEO Starter Guide", "Google Search Central", "https://developers.google.com/search/docs/fundamentals/seo-starter-guide"), g("Web Vitals", "Google web.dev", "https://web.dev/articles/vitals")],
    reviewed_on: "2026-11-15"
  },
  {
    acronym: "A/B Testing",
    knowledge_kind: "technical_method",
    maturity: "well_established",
    definition: "A controlled experiment that randomly assigns eligible units to variants and compares a prespecified outcome to estimate the effect of a change under stated assumptions.",
    foundations: ["experimental design", "randomization", "statistical inference", "causal estimation"],
    operational_dimensions: ["hypothesis", "unit of randomization", "primary metric", "sample size", "duration", "guardrail metrics", "analysis plan"],
    measurement_methods: ["difference in means or proportions", "confidence intervals", "predefined hypothesis tests", "sample-ratio mismatch checks", "heterogeneity analysis where prespecified"],
    limitations: ["Peeking, multiple testing and post-hoc metric selection inflate false-positive risk.", "Interference, novelty effects and sample-ratio mismatch can invalidate conclusions.", "Statistical significance is not the same as practical importance."],
    related_concepts: ["CRO", "causal inference", "statistics", "experimentation"],
    sources: [g("Trustworthy Online Controlled Experiments: A Practical Guide to A/B Testing", "Cambridge University Press", "https://www.cambridge.org/core/books/trustworthy-online-controlled-experiments/")],
    reviewed_on: "2026-11-15"
  },
  {
    acronym: "CRO",
    knowledge_kind: "industry_practice",
    maturity: "documented_practice",
    definition: "Conversion Rate Optimization is the disciplined practice of improving the proportion of eligible users who complete a defined business or product outcome through research, diagnosis and experimentation.",
    foundations: ["behavioral research", "funnel analysis", "usability", "experimental design", "measurement"],
    operational_dimensions: ["conversion definition", "funnel stages", "friction analysis", "segmentation", "hypothesis prioritization", "experimentation"],
    measurement_methods: ["conversion rate with denominator explicitly defined", "incremental lift from controlled experiments", "guardrail metrics", "segment-level diagnostics"],
    limitations: ["A higher conversion rate can reduce customer quality or long-term value.", "Before/after comparisons are vulnerable to seasonality and confounding.", "The denominator and attribution window must be explicit."],
    related_concepts: ["A/B Testing", "SXO", "CAC", "LTV"],
    sources: [g("Trustworthy Online Controlled Experiments: A Practical Guide to A/B Testing", "Cambridge University Press", "https://www.cambridge.org/core/books/trustworthy-online-controlled-experiments/")],
    reviewed_on: "2026-11-15"
  }
] as const;

export const DOMAIN_KNOWLEDGE_BY_ACRONYM: ReadonlyMap<string, DomainKnowledgeRecord> = new Map(
  DOMAIN_KNOWLEDGE.map((record) => [record.acronym.toLowerCase(), record]),
);

export function getDomainKnowledge(acronym: string): DomainKnowledgeRecord | undefined {
  return DOMAIN_KNOWLEDGE_BY_ACRONYM.get(String(acronym || "").toLowerCase());
}

export function validateDomainKnowledge(): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const record of DOMAIN_KNOWLEDGE) {
    const key = record.acronym.toLowerCase();
    if (seen.has(key)) errors.push(`duplicate knowledge record: ${record.acronym}`);
    seen.add(key);
    if (!DOMAIN_ONTOLOGY_BY_ACRONYM.has(key)) errors.push(`missing ontology term: ${record.acronym}`);
    if (!record.definition.trim()) errors.push(`missing definition: ${record.acronym}`);
    if (!record.sources.length) errors.push(`missing sources: ${record.acronym}`);
    for (const source of record.sources) {
      try {
        const url = new URL(source.url);
        if (url.protocol !== "https:") errors.push(`non-https source: ${record.acronym}`);
      } catch {
        errors.push(`invalid source URL: ${record.acronym}`);
      }
    }
  }
  return errors;
}
