/**
 * Helm — Founder Operating Loop sourceId namespace.
 *
 * Pure forward-compat utility. No DB, no schema, no runtime adoption.
 *
 * Phase 3 implementation contract §3 specifies the sourceId regex:
 *   ^founder_loop:(helm_self|customer_vertical):[a-z][a-z0-9_]{2,63}:
 *     [a-zA-Z0-9_-]{1,128}:[a-zA-Z0-9_-]{1,128}(:reissue:[1-9][0-9]?)?$
 *
 * This module provides:
 *   - parseFounderLoopSourceId: regex-strict parser; returns null on bad input
 *   - buildFounderLoopSourceId: reverse of parse; throws if parts violate rules
 *
 * The parser never throws on untrusted input (returns null instead). The
 * builder asserts on its inputs and throws because callers control the parts.
 *
 * Public boundary anchor:
 *   docs/product/HELM_FOUNDER_OPERATING_LOOP_BOUNDARY_BRIEF.md
 */

import type { FounderRunScope } from "./contract";

export interface FounderLoopSourceId {
  readonly scope: FounderRunScope;
  readonly workspaceSlug: string;
  readonly runId: string;
  readonly signalId: string;
  readonly reissue: number | null;
}

// Anchored regex; reissue suffix is optional and clamped to 1–99.
const SOURCE_ID_REGEX =
  /^founder_loop:(helm_self|customer_vertical):([a-z][a-z0-9_]{2,63}):([a-zA-Z0-9_-]{1,128}):([a-zA-Z0-9_-]{1,128})(?::reissue:([1-9][0-9]?))?$/;

const WORKSPACE_SLUG_REGEX = /^[a-z][a-z0-9_]{2,63}$/;
const ID_SEGMENT_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

export function parseFounderLoopSourceId(
  raw: unknown,
): FounderLoopSourceId | null {
  if (typeof raw !== "string") return null;
  const match = SOURCE_ID_REGEX.exec(raw);
  if (!match) return null;
  const [, scope, workspaceSlug, runId, signalId, reissueRaw] = match;
  return {
    scope: scope as FounderRunScope,
    workspaceSlug,
    runId,
    signalId,
    reissue: reissueRaw ? Number.parseInt(reissueRaw, 10) : null,
  };
}

export interface BuildFounderLoopSourceIdInput {
  readonly scope: FounderRunScope;
  readonly workspaceSlug: string;
  readonly runId: string;
  readonly signalId: string;
  readonly reissue?: number | null;
}

export function buildFounderLoopSourceId(
  input: BuildFounderLoopSourceIdInput,
): string {
  if (input.scope !== "helm_self" && input.scope !== "customer_vertical") {
    throw new Error(`invalid scope: ${input.scope as string}`);
  }
  if (!WORKSPACE_SLUG_REGEX.test(input.workspaceSlug)) {
    throw new Error(
      `invalid workspaceSlug (need lowercase, 3–64 chars, [a-z0-9_], leading [a-z]): ${input.workspaceSlug}`,
    );
  }
  if (!ID_SEGMENT_REGEX.test(input.runId)) {
    throw new Error(
      `invalid runId (need 1–128 chars from [a-zA-Z0-9_-]): ${input.runId}`,
    );
  }
  if (!ID_SEGMENT_REGEX.test(input.signalId)) {
    throw new Error(
      `invalid signalId (need 1–128 chars from [a-zA-Z0-9_-]): ${input.signalId}`,
    );
  }
  let raw = `founder_loop:${input.scope}:${input.workspaceSlug}:${input.runId}:${input.signalId}`;
  if (input.reissue != null) {
    if (!Number.isInteger(input.reissue) || input.reissue < 1 || input.reissue > 99) {
      throw new Error(`invalid reissue (must be integer 1–99): ${input.reissue}`);
    }
    raw += `:reissue:${input.reissue}`;
  }
  return raw;
}

/**
 * Type guard for runtime values claimed to be Founder Loop sourceIds.
 * Useful at the seam between untyped JSON (e.g. fixture loader) and
 * code that expects a parsed `FounderLoopSourceId`.
 */
export function isFounderLoopSourceId(raw: unknown): raw is string {
  return parseFounderLoopSourceId(raw) !== null;
}
