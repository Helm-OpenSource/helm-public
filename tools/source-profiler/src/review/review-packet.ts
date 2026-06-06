/**
 * Source Profiler — ReviewPacket builder.
 *
 * Assembles a user-private ReviewPacket from a deterministic profile result.
 * The full packet is CONFIDENTIAL (may carry real table/field names — a
 * user-owned local artifact). Required metadata follows the P0-REQ-07 shape.
 */

import os from "node:os";
import type { CodeScanSummary } from "../contract/code-scan";
import type { SignalMappingCandidate } from "../contract/mapping";
import type { SourceProfileRun } from "../contract/run";
import type { SchemaIntrospectionSummary } from "../contract/schema-introspection";
import type { ReviewPacket } from "../contract/review-packet";
import type { RequiredArtifactMetadata } from "../contract/governance";
import { reviewPacketSchema } from "../contract/review-packet";
import { stableHash } from "../util/hash";

export type BuildReviewPacketInput = {
  run: SourceProfileRun;
  codeScan: CodeScanSummary;
  candidates: SignalMappingCandidate[];
  schemaIntrospection?: SchemaIntrospectionSummary;
  /** Logical source label (e.g. repo path or system name). */
  source?: string;
  /** Workspace the operator is reviewing for. */
  workspace?: string;
  /** Operator identity (defaults to the OS user). */
  actor?: string;
};

export function buildReviewPacket(input: BuildReviewPacketInput): ReviewPacket {
  const { run, codeScan, candidates, schemaIntrospection } = input;
  const requiredMetadata: RequiredArtifactMetadata = {
    provider: "source-profiler",
    source: input.source ?? "local-repo",
    timestamp: run.createdAt,
    actor: input.actor ?? safeUser(),
    workspace: input.workspace ?? "local",
    rawOutputHash: stableHash({ codeScan, candidates }),
    redactionStatus: "unknown",
    traceId: run.runId,
  };

  return reviewPacketSchema.parse({
    schemaVersion: "helm.source-profiler.review-packet.v1",
    sensitivity: "CONFIDENTIAL",
    requiredMetadata,
    run,
    codeScan,
    schemaIntrospection,
    candidates,
    redactionStatus: "unknown",
    humanReviewState: "pending_review",
  });
}

function safeUser(): string {
  try {
    return os.userInfo().username || "local-operator";
  } catch {
    return "local-operator";
  }
}
