// Pure ContextIntelligence foundation entry point.
// These modules are available as a library and are not yet wired into the runtime tool pipeline.
// Runtime MCI cache/reuse currently lives separately in resolver.server.ts.
export * from "./types";
export * from "./canonical-entity";
export * from "./context-budget";
export * from "./freshness-gate";
export * from "./evidence-gate";
export * from "./context-provenance";
export * from "./context-selector";
