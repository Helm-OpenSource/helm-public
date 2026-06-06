/**
 * Source Profiler — Contract barrel.
 *
 * Pure TypeScript + zod contracts shared across the CLI. No I/O, no server
 * imports, no credentials. This is the deterministic seam: the deterministic
 * profiler is the only trusted producer; the AI overlay may only ever produce
 * `candidate`-state mappings.
 */

/** Bumped when any contract shape changes in a breaking way. */
export const CONTRACT_VERSION = "1.0.0";

/** Tool version, surfaced in SourceProfileRun. */
export const TOOL_VERSION = "0.1.0";

export * from "./governance";
export * from "./scope-manifest";
export * from "./code-scan";
export * from "./schema-introspection";
export * from "./mapping";
export * from "./run";
export * from "./review-packet";
export * from "./overlay";
