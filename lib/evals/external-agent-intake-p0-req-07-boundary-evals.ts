/**
 * Helm External Agent Intake — P0-REQ-07 Strict Boundary Eval Runner
 *
 * Planning-only offline runner. It walks the strict-boundary fixture pack and
 * checks each case's expected disposition + expected reason codes against the
 * classifier output.
 *
 * NOT a runtime intake API, NOT a connector adapter. Fixture-only.
 */

import strictBoundaryFixturePack from "@/evals/external-agent-intake-p0-req-07/strict-boundary-cases.json";
import type { ExternalAgentArtifact } from "@/features/external-agent-intake/artifact-contract";
import {
  classifyP0Req07Boundary,
  type P0Req07ClassificationResult,
  type P0Req07Disposition,
  type P0Req07ReasonCode,
} from "@/features/external-agent-intake/p0-req-07-boundary";

export interface StrictBoundaryFixtureMetadata {
  readonly version: string;
  readonly status: string;
  readonly redactionPosture: string;
  readonly boundary: string;
  readonly expectedWorkspaceId: string;
  readonly referenceTimeIso: string;
  readonly staleThresholdMs?: number;
  readonly description: string;
}

export interface StrictBoundaryFixtureCase {
  readonly id: string;
  readonly expectedDisposition: P0Req07Disposition;
  readonly expectedReasonCodes: readonly P0Req07ReasonCode[];
  readonly artifact: Partial<ExternalAgentArtifact>;
}

export interface StrictBoundaryFixturePack {
  readonly metadata: StrictBoundaryFixtureMetadata;
  readonly cases: readonly StrictBoundaryFixtureCase[];
}

export interface StrictBoundaryCaseResult {
  readonly caseId: string;
  readonly expectedDisposition: P0Req07Disposition;
  readonly actualDisposition: P0Req07Disposition;
  readonly expectedReasonCodes: readonly P0Req07ReasonCode[];
  readonly actualReasonCodes: readonly P0Req07ReasonCode[];
  readonly missingExpectedReasonCodes: readonly P0Req07ReasonCode[];
  readonly unexpectedActualReasonCodes: readonly P0Req07ReasonCode[];
  readonly classification: P0Req07ClassificationResult;
  readonly violations: readonly string[];
}

export interface StrictBoundaryEvalSummary {
  readonly passed: boolean;
  readonly version: string;
  readonly totalCases: number;
  readonly quarantineCount: number;
  readonly passesStrictBoundaryCount: number;
  readonly caseResults: readonly StrictBoundaryCaseResult[];
  readonly failures: ReadonlyArray<{ caseId: string; reason: string }>;
}

export function runExternalAgentIntakeP0Req07BoundaryEval(
  fixturePack: StrictBoundaryFixturePack =
    strictBoundaryFixturePack as unknown as StrictBoundaryFixturePack,
): StrictBoundaryEvalSummary {
  const caseResults = fixturePack.cases.map((item) =>
    evaluateCase(item, fixturePack.metadata),
  );

  const failures: Array<{ caseId: string; reason: string }> = [];
  for (const result of caseResults) {
    for (const violation of result.violations) {
      failures.push({ caseId: result.caseId, reason: violation });
    }
  }

  return {
    passed: failures.length === 0,
    version: fixturePack.metadata.version,
    totalCases: caseResults.length,
    quarantineCount: caseResults.filter(
      (c) => c.actualDisposition === "quarantine",
    ).length,
    passesStrictBoundaryCount: caseResults.filter(
      (c) => c.actualDisposition === "passes_strict_boundary",
    ).length,
    caseResults,
    failures,
  };
}

function evaluateCase(
  item: StrictBoundaryFixtureCase,
  metadata: StrictBoundaryFixtureMetadata,
): StrictBoundaryCaseResult {
  const classification = classifyP0Req07Boundary(item.artifact, {
    expectedWorkspaceId: metadata.expectedWorkspaceId,
    referenceTimeIso: metadata.referenceTimeIso,
    staleThresholdMs: metadata.staleThresholdMs,
  });

  const expectedReasonSet = new Set<P0Req07ReasonCode>(item.expectedReasonCodes);
  const actualReasonSet = new Set<P0Req07ReasonCode>(classification.reasonCodes);

  const missingExpectedReasonCodes = [...expectedReasonSet].filter(
    (code) => !actualReasonSet.has(code),
  );
  const unexpectedActualReasonCodes = [...actualReasonSet].filter(
    (code) => !expectedReasonSet.has(code),
  );

  const violations: string[] = [];
  if (classification.disposition !== item.expectedDisposition) {
    violations.push(
      `disposition_mismatch:expected=${item.expectedDisposition}:actual=${classification.disposition}`,
    );
  }
  if (missingExpectedReasonCodes.length > 0) {
    violations.push(
      `missing_expected_reason_codes:${missingExpectedReasonCodes.join(",")}`,
    );
  }
  if (unexpectedActualReasonCodes.length > 0) {
    violations.push(
      `unexpected_actual_reason_codes:${unexpectedActualReasonCodes.join(",")}`,
    );
  }

  return {
    caseId: item.id,
    expectedDisposition: item.expectedDisposition,
    actualDisposition: classification.disposition,
    expectedReasonCodes: item.expectedReasonCodes,
    actualReasonCodes: classification.reasonCodes,
    missingExpectedReasonCodes,
    unexpectedActualReasonCodes,
    classification,
    violations,
  };
}
