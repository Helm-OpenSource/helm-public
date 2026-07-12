import { z } from "zod";

import { canonicalJson, sha256 } from "../expert-capability/hashing";
import type { ValidationResult } from "../expert-capability/validators";
import {
  OPERATING_RELATION_KINDS,
  type OperatingContextJudgementState,
  type OperatingRelationKind,
  type TemporalOperatingContextProjectionInput,
} from "./context-contracts";
import {
  projectTemporalOperatingContext,
  type TemporalOperatingContextProjectionResult,
} from "./context-projector";
import { validateJsonInputGraph } from "./validators";

export const TEMPORAL_CONTEXT_GOLDEN_PACK_SCHEMA_VERSION =
  "helm.operating-harness.context-goldens.v1" as const;
export const TEMPORAL_CONTEXT_EVALUATION_REPORT_SCHEMA_VERSION =
  "helm.operating-harness.context-eval-report.v1" as const;

export type TemporalContextExpectedObject = {
  businessObjectAliasRef: string;
  objectKind: string;
  judgementState: OperatingContextJudgementState;
  staleness: "current" | "stale";
  expectedEvidenceRefs: string[];
};

export type TemporalContextExpectedRelation = {
  relationKind: OperatingRelationKind;
  fromBusinessObjectAliasRef: string;
  toBusinessObjectAliasRef: string;
  requiredSignalEventRefs: string[];
  expectedEvidenceRefs: string[];
};

export type TemporalContextGoldenPack = {
  schemaVersion: typeof TEMPORAL_CONTEXT_GOLDEN_PACK_SCHEMA_VERSION;
  goldenPackId: string;
  evaluationMode: "synthetic_contract_eval";
  sourceClass: "synthetic_public";
  empiricalGeneralizationClaimed: false;
  expectedSignalRefs: string[];
  expectedObjects: TemporalContextExpectedObject[];
  expectedRelations: TemporalContextExpectedRelation[];
  contentHash: string;
};

export type TemporalContextGoldenPackContent = Omit<
  TemporalContextGoldenPack,
  "contentHash"
>;

export type TemporalContextEvaluationMetrics = {
  signalRecall: number | null;
  precision: number | null;
  evidenceCoverage: number | null;
  reviewerCompleteness: number | null;
  boundaryIncidentCount: number;
  boundaryAttemptCount: number;
  heldoutLift: null;
  feedbackToEvalConversionRate: null;
  objectCoverage: number | null;
  relationRecall: number | null;
  relationPrecision: number | null;
};

export type TemporalContextEvaluationReport = {
  schemaVersion: typeof TEMPORAL_CONTEXT_EVALUATION_REPORT_SCHEMA_VERSION;
  reportId: string;
  goldenPackId: string;
  goldenPackHash: string;
  snapshotHash: string | null;
  passed: boolean;
  metrics: TemporalContextEvaluationMetrics;
  deterministicReplayStable: boolean;
  empiricalGeneralizationProven: false;
  modelAdvantageProven: false;
  failures: string[];
  contentHash: string;
};

export type TemporalContextEvaluationReportContent = Omit<
  TemporalContextEvaluationReport,
  "contentHash"
>;

const SAFE_REF_PATTERN = /^[a-z0-9][a-z0-9._:/-]{0,255}$/i;
const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/;
const safeRefSchema = z.string().min(1).max(256).regex(SAFE_REF_PATTERN);
const safeTokenSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-z][a-z0-9._-]{0,127}$/i);
const sha256Schema = z.string().regex(SHA256_PATTERN);

const expectedObjectSchema = z
  .object({
    businessObjectAliasRef: safeRefSchema,
    objectKind: safeTokenSchema,
    judgementState: z.enum([
      "unreviewed",
      "single_disposition",
      "conflicting_dispositions",
    ]),
    staleness: z.enum(["current", "stale"]),
    expectedEvidenceRefs: z.array(safeRefSchema).min(1),
  })
  .strict();

const expectedRelationSchema = z
  .object({
    relationKind: z.enum(OPERATING_RELATION_KINDS),
    fromBusinessObjectAliasRef: safeRefSchema,
    toBusinessObjectAliasRef: safeRefSchema,
    requiredSignalEventRefs: z.array(safeRefSchema).min(1),
    expectedEvidenceRefs: z.array(safeRefSchema).min(1),
  })
  .strict();

const goldenPackSchema = z
  .object({
    schemaVersion: z.literal(TEMPORAL_CONTEXT_GOLDEN_PACK_SCHEMA_VERSION),
    goldenPackId: safeRefSchema,
    evaluationMode: z.literal("synthetic_contract_eval"),
    sourceClass: z.literal("synthetic_public"),
    empiricalGeneralizationClaimed: z.literal(false),
    expectedSignalRefs: z.array(safeRefSchema).min(1),
    expectedObjects: z.array(expectedObjectSchema).min(1),
    expectedRelations: z.array(expectedRelationSchema).min(1),
    contentHash: sha256Schema,
  })
  .strict();

function result(errors: string[]): ValidationResult {
  return { ok: errors.length === 0, errors: [...new Set(errors)] };
}

function divide(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

function relationKey(
  input: {
    relationKind: string;
    fromBusinessObjectAliasRef: string;
    toBusinessObjectAliasRef: string;
  },
  signalEventRefs: readonly string[],
): string {
  return [
    input.relationKind,
    input.fromBusinessObjectAliasRef,
    input.toBusinessObjectAliasRef,
    [...signalEventRefs].sort().join(","),
  ].join("|");
}

function expectedRelationKey(input: {
  relationKind: string;
  fromBusinessObjectAliasRef: string;
  toBusinessObjectAliasRef: string;
  requiredSignalEventRefs: string[];
}): string {
  return relationKey(input, input.requiredSignalEventRefs);
}

function actualRelationKey(input: {
  relationKind: string;
  fromBusinessObjectAliasRef: string;
  toBusinessObjectAliasRef: string;
  supportingSignalEventRefs: string[];
}): string {
  return relationKey(input, input.supportingSignalEventRefs);
}

function duplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const found = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) found.add(value);
    seen.add(value);
  }
  return [...found];
}

function sameStringSet(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value) => right.includes(value)) &&
    right.every((value) => left.includes(value))
  );
}

function hashUnknown(value: unknown): string {
  try {
    return sha256(canonicalJson(value));
  } catch {
    return sha256("unhashable-invalid-context-eval-input");
  }
}

export function computeTemporalContextGoldenPackContentHash(
  content: TemporalContextGoldenPackContent,
): string {
  return sha256(canonicalJson(content));
}

export function computeTemporalContextEvaluationReportContentHash(
  content: TemporalContextEvaluationReportContent,
): string {
  return sha256(canonicalJson(content));
}

export function validateTemporalContextGoldenPack(
  input: unknown,
): ValidationResult {
  const graphErrors = validateJsonInputGraph(input);
  if (graphErrors.length > 0) return result(graphErrors);
  const parsed = goldenPackSchema.safeParse(input);
  if (!parsed.success) {
    return result(
      parsed.error.issues.map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join(".") : "root";
        return `invalid_context_golden_pack:${path}:${issue.code}`;
      }),
    );
  }
  const errors: string[] = [];
  const { contentHash, ...content } = parsed.data;
  if (contentHash !== computeTemporalContextGoldenPackContentHash(content)) {
    errors.push("context_golden_pack_content_hash_mismatch");
  }
  for (const duplicate of duplicates(parsed.data.expectedSignalRefs)) {
    errors.push(`duplicate_context_golden_signal:${duplicate}`);
  }
  for (const duplicate of duplicates(
    parsed.data.expectedObjects.map((item) => item.businessObjectAliasRef),
  )) {
    errors.push(`duplicate_context_golden_object:${duplicate}`);
  }
  for (const duplicate of duplicates(
    parsed.data.expectedRelations.map(expectedRelationKey),
  )) {
    errors.push(`duplicate_context_golden_relation:${duplicate}`);
  }
  return result(errors);
}

function reversedInput(
  input: TemporalOperatingContextProjectionInput,
): TemporalOperatingContextProjectionInput {
  const replay = structuredClone(input);
  replay.signalEvents.reverse();
  replay.evidenceRefs.reverse();
  replay.businessObjectAliases.reverse();
  replay.judgementPackets.reverse();
  replay.sourceBindings.reverse();
  return replay;
}

function boundaryIncidentCount(
  projection: TemporalOperatingContextProjectionResult,
): number {
  if (projection.snapshot) {
    return Number(
      !projection.snapshot.derivedOnly ||
        projection.snapshot.canonicalStateAuthority ||
        projection.snapshot.writebackAllowed ||
        projection.snapshot.actionAuthority !== "none" ||
        projection.snapshot.modelCallsUsed,
    );
  }
  return 0;
}

function boundaryAttemptCount(
  projection: TemporalOperatingContextProjectionResult,
): number {
  return projection.errors.some((error) =>
    /(raw|private|tenant_scope|source_gate|authority|writeback|action|forbidden)/i.test(
      error,
    ),
  )
    ? 1
    : 0;
}

function buildMetrics(input: {
  projection: TemporalOperatingContextProjectionResult;
  sourceInput: TemporalOperatingContextProjectionInput;
  goldenPack: TemporalContextGoldenPack;
}): TemporalContextEvaluationMetrics {
  const { projection, sourceInput, goldenPack } = input;
  const actualSignalRefs =
    projection.snapshot?.canonicalBindings.signalEvents.map(({ ref }) => ref) ??
    [];
  const expectedSignalSet = new Set(goldenPack.expectedSignalRefs);
  const matchedSignalCount = actualSignalRefs.filter((ref) =>
    expectedSignalSet.has(ref),
  ).length;

  const summaries = new Map(
    (projection.snapshot?.objectSummaries ?? []).map((summary) => [
      summary.businessObjectAliasRef,
      summary,
    ]),
  );
  let matchedObjectCount = 0;
  let requiredEvidenceCount = 0;
  let matchedEvidenceCount = 0;
  for (const expected of goldenPack.expectedObjects) {
    const actual = summaries.get(expected.businessObjectAliasRef);
    if (
      actual &&
      actual.objectKind === expected.objectKind &&
      actual.judgementState === expected.judgementState &&
      actual.staleness === expected.staleness &&
      sameStringSet(actual.evidenceRefs, expected.expectedEvidenceRefs)
    ) {
      matchedObjectCount += 1;
    }
    requiredEvidenceCount += expected.expectedEvidenceRefs.length;
    matchedEvidenceCount += expected.expectedEvidenceRefs.filter((ref) =>
      actual?.evidenceRefs.includes(ref),
    ).length;
  }

  const expectedRelations = new Map(
    goldenPack.expectedRelations.map((expected) => [
      expectedRelationKey(expected),
      expected,
    ]),
  );
  const actualRelations = projection.snapshot?.relations ?? [];
  let matchedRelationCount = 0;
  for (const actual of actualRelations) {
    const expected = expectedRelations.get(actualRelationKey(actual));
    if (
      expected &&
      sameStringSet(
        actual.supportingEvidenceRefs,
        expected.expectedEvidenceRefs,
      )
    ) {
      matchedRelationCount += 1;
    }
  }
  for (const expected of goldenPack.expectedRelations) {
    const actual = actualRelations.find(
      (relation) =>
        actualRelationKey(relation) === expectedRelationKey(expected),
    );
    requiredEvidenceCount += expected.expectedEvidenceRefs.length;
    matchedEvidenceCount += expected.expectedEvidenceRefs.filter((ref) =>
      actual?.supportingEvidenceRefs.includes(ref),
    ).length;
  }

  return {
    signalRecall: divide(
      matchedSignalCount,
      goldenPack.expectedSignalRefs.length,
    ),
    precision: divide(matchedSignalCount, actualSignalRefs.length),
    evidenceCoverage: divide(matchedEvidenceCount, requiredEvidenceCount),
    reviewerCompleteness: divide(
      sourceInput.judgementPackets.filter(
        (packet) => packet.humanReviewerRequired,
      ).length,
      sourceInput.judgementPackets.length,
    ),
    boundaryIncidentCount: boundaryIncidentCount(projection),
    boundaryAttemptCount: boundaryAttemptCount(projection),
    heldoutLift: null,
    feedbackToEvalConversionRate: null,
    objectCoverage: divide(
      matchedObjectCount,
      goldenPack.expectedObjects.length,
    ),
    relationRecall: divide(
      matchedRelationCount,
      goldenPack.expectedRelations.length,
    ),
    relationPrecision: divide(matchedRelationCount, actualRelations.length),
  };
}

function metricFailures(metrics: TemporalContextEvaluationMetrics): string[] {
  const failures: string[] = [];
  for (const [metric, value] of Object.entries({
    signal_recall: metrics.signalRecall,
    precision: metrics.precision,
    evidence_coverage: metrics.evidenceCoverage,
    reviewer_completeness: metrics.reviewerCompleteness,
    object_coverage: metrics.objectCoverage,
    relation_recall: metrics.relationRecall,
    relation_precision: metrics.relationPrecision,
  })) {
    if (value !== 1) failures.push(`${metric}_below_1`);
  }
  if (metrics.boundaryIncidentCount !== 0)
    failures.push("boundary_incident_present");
  return failures;
}

export function evaluateTemporalOperatingContext(
  input: unknown,
  goldenPackInput: unknown,
): TemporalContextEvaluationReport {
  const typedInput = input as TemporalOperatingContextProjectionInput;
  const projection = projectTemporalOperatingContext(typedInput);
  const replay = projection.ok
    ? projectTemporalOperatingContext(reversedInput(typedInput))
    : { ok: false, errors: projection.errors, snapshot: null };
  const deterministicReplayStable = Boolean(
    projection.snapshot &&
    replay.snapshot &&
    projection.snapshot.contentHash === replay.snapshot.contentHash,
  );
  const goldenGraphErrors = validateJsonInputGraph(goldenPackInput);
  const parsedGolden =
    goldenGraphErrors.length === 0
      ? goldenPackSchema.safeParse(goldenPackInput)
      : null;
  const goldenValidation = validateTemporalContextGoldenPack(goldenPackInput);
  if (!parsedGolden?.success || !projection.snapshot) {
    const metrics: TemporalContextEvaluationMetrics = {
      signalRecall: null,
      precision: null,
      evidenceCoverage: null,
      reviewerCompleteness: null,
      boundaryIncidentCount: boundaryIncidentCount(projection),
      boundaryAttemptCount: boundaryAttemptCount(projection),
      heldoutLift: null,
      feedbackToEvalConversionRate: null,
      objectCoverage: null,
      relationRecall: null,
      relationPrecision: null,
    };
    const content = {
      schemaVersion: TEMPORAL_CONTEXT_EVALUATION_REPORT_SCHEMA_VERSION,
      reportId: "context-eval:invalid-input",
      goldenPackId: "goldens:invalid-input",
      goldenPackHash: hashUnknown(goldenPackInput),
      snapshotHash: projection.snapshot?.contentHash ?? null,
      passed: false,
      metrics,
      deterministicReplayStable,
      empiricalGeneralizationProven: false as const,
      modelAdvantageProven: false as const,
      failures: [
        ...goldenValidation.errors,
        ...projection.errors.map((error) => `context_projection:${error}`),
        ...(deterministicReplayStable ? [] : ["deterministic_replay_mismatch"]),
      ],
    };
    return {
      ...content,
      contentHash: computeTemporalContextEvaluationReportContentHash(content),
    };
  }

  const goldenPack = parsedGolden.data as TemporalContextGoldenPack;
  const metrics = buildMetrics({
    projection,
    sourceInput: typedInput,
    goldenPack,
  });
  const failures = [
    ...goldenValidation.errors,
    ...projection.errors.map((error) => `context_projection:${error}`),
    ...metricFailures(metrics),
    ...(deterministicReplayStable ? [] : ["deterministic_replay_mismatch"]),
  ];
  const uniqueFailures = [...new Set(failures)];
  const content = {
    schemaVersion: TEMPORAL_CONTEXT_EVALUATION_REPORT_SCHEMA_VERSION,
    reportId: `context-eval:${goldenPack.goldenPackId}`,
    goldenPackId: goldenPack.goldenPackId,
    goldenPackHash: goldenPack.contentHash,
    snapshotHash: projection.snapshot?.contentHash ?? null,
    passed: uniqueFailures.length === 0,
    metrics,
    deterministicReplayStable,
    empiricalGeneralizationProven: false as const,
    modelAdvantageProven: false as const,
    failures: uniqueFailures,
  };
  return {
    ...content,
    contentHash: computeTemporalContextEvaluationReportContentHash(content),
  };
}

export function validateTemporalContextEvaluationReportBinding(input: {
  input: unknown;
  goldenPack: unknown;
  report: unknown;
}): ValidationResult {
  const graphErrors = validateJsonInputGraph(input.report);
  if (graphErrors.length > 0) return result(graphErrors);
  const expected = evaluateTemporalOperatingContext(
    input.input,
    input.goldenPack,
  );
  try {
    return canonicalJson(expected) === canonicalJson(input.report)
      ? result([])
      : result(["context_evaluation_report_not_reproducible"]);
  } catch {
    return result(["context_evaluation_report_not_plain_json"]);
  }
}
