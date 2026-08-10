import "server-only";

import type { Prisma } from "@prisma/client";

import { safeParseJson } from "@/lib/utils";

const OPAQUE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,190}$/u;
const SOURCE_KIND_PATTERN = /^[a-z][a-z0-9_]{0,63}$/u;
const TERMINAL_OBSERVATION_STATUSES = new Set([
  "SUCCEEDED",
  "PARTIAL",
  "FAILED",
]);
const EVIDENCE_FRESHNESS = new Map([
  ["FRESH", "fresh"],
  ["STALE", "stale"],
  ["UNKNOWN", "unknown"],
] as const);

type ObservationEvidenceRun = Prisma.ObservationSourceRunGetPayload<{
  include: { program: true; source: true };
}>;

export class CaioFdeScopeResolutionError extends Error {
  readonly reasons: readonly string[];

  constructor(reasons: readonly string[]) {
    super(`CAIO Pro FDE scope resolution denied: ${reasons.join(", ")}`);
    this.name = "CaioFdeScopeResolutionError";
    this.reasons = [...new Set(reasons)];
  }
}

function parseExactRef(ref: string, prefix: string, reason: string): string {
  const marker = `${prefix}:`;
  const normalized = ref.trim();
  const id = normalized.startsWith(marker)
    ? normalized.slice(marker.length)
    : "";
  if (!OPAQUE_ID_PATTERN.test(id)) {
    throw new CaioFdeScopeResolutionError([reason]);
  }
  return id;
}

function parseStoredRefs(raw: string | null, reason: string): string[] {
  const parsed = safeParseJson<unknown>(raw, null);
  if (
    !Array.isArray(parsed) ||
    parsed.length === 0 ||
    parsed.length > 256 ||
    !parsed.every(
      (value) =>
        typeof value === "string" &&
        value.trim().length > 0 &&
        value.length <= 256,
    )
  ) {
    throw new CaioFdeScopeResolutionError([reason]);
  }
  return [...new Set(parsed.map((value) => value.trim()))];
}

export async function resolveCaioFdePortfolioScope(input: {
  client: Prisma.TransactionClient;
  workspaceId: string;
  workspaceRef: string;
  portfolioRef: string;
}) {
  if (input.workspaceRef !== `workspace:${input.workspaceId}`) {
    throw new CaioFdeScopeResolutionError(["workspace_ref_mismatch"]);
  }
  const opportunityId = parseExactRef(
    input.portfolioRef,
    "opportunity",
    "portfolio_ref_invalid",
  );
  const opportunity = await input.client.opportunity.findFirst({
    where: { id: opportunityId, workspaceId: input.workspaceId },
    select: { id: true, workspaceId: true },
  });
  if (!opportunity) {
    throw new CaioFdeScopeResolutionError([
      "workspace_portfolio_not_found",
    ]);
  }
  return {
    workspaceRef: input.workspaceRef,
    portfolioRef: `opportunity:${opportunity.id}`,
    opportunityId: opportunity.id,
  } as const;
}

export async function resolveCaioFdeObservationEvidence(input: {
  client: Prisma.TransactionClient;
  workspaceId: string;
  evidenceRef: string;
  portfolioRef: string;
  requiredBindingRefs?: readonly string[];
  expectedBusinessResult?: "success" | "failure";
  now?: Date;
}) {
  const runId = parseExactRef(
    input.evidenceRef,
    "observation-run",
    "observation_evidence_ref_invalid",
  );
  const run = await input.client.observationSourceRun.findFirst({
    where: { id: runId, workspaceId: input.workspaceId },
    include: { program: true, source: true },
  });
  if (!run) {
    throw new CaioFdeScopeResolutionError([
      "observation_evidence_workspace_mismatch",
    ]);
  }
  return resolveObservationEvidenceRun({ ...input, run });
}

function resolveObservationEvidenceRun(input: {
  run: ObservationEvidenceRun;
  workspaceId: string;
  portfolioRef: string;
  requiredBindingRefs?: readonly string[];
  expectedBusinessResult?: "success" | "failure";
  now?: Date;
}) {
  const run = input.run;
  const now = input.now ?? new Date();
  const reasons: string[] = [];
  if (
    run.program.workspaceId !== input.workspaceId ||
    run.source.workspaceId !== input.workspaceId ||
    run.source.programId !== run.programId
  ) {
    reasons.push("observation_evidence_workspace_mismatch");
  }
  if (
    run.program.status !== "ACTIVE" ||
    run.program.revokedAt !== null ||
    now < run.program.startsAt ||
    now >= run.program.expiresAt
  ) {
    reasons.push("observation_evidence_authorization_inactive");
  }
  if (run.source.status !== "ACTIVE") {
    reasons.push("observation_evidence_source_inactive");
  }
  const sourceKind = run.source.sourceKind.trim();
  if (
    sourceKind !== run.source.sourceKind ||
    !SOURCE_KIND_PATTERN.test(sourceKind)
  ) {
    reasons.push("observation_evidence_source_kind_invalid");
  }
  const freshness = EVIDENCE_FRESHNESS.get(
    run.freshness as "FRESH" | "STALE" | "UNKNOWN",
  );
  if (!freshness) {
    reasons.push("observation_evidence_freshness_invalid");
  }
  if (
    run.authorizationVersion !== run.program.authorizationVersion ||
    !TERMINAL_OBSERVATION_STATUSES.has(run.status) ||
    !run.observedAt ||
    run.observedAt < run.windowStart ||
    run.observedAt > run.windowEnd ||
    run.observedAt > now
  ) {
    reasons.push("observation_evidence_terminal_state_invalid");
  }

  const scopeRefs = parseStoredRefs(
    run.program.scopeRefs,
    "observation_program_scope_invalid",
  );
  if (!scopeRefs.includes(input.portfolioRef)) {
    reasons.push("observation_evidence_portfolio_mismatch");
  }
  const evidenceRefs = parseStoredRefs(
    run.evidenceRefs,
    "observation_evidence_bindings_invalid",
  );
  const required = [
    input.portfolioRef,
    ...(input.requiredBindingRefs ?? []),
  ];
  if (required.some((ref) => !evidenceRefs.includes(ref))) {
    reasons.push("observation_evidence_binding_mismatch");
  }

  if (
    input.expectedBusinessResult === "success" &&
    run.outcome !== "SUCCESS"
  ) {
    reasons.push("observation_evidence_outcome_mismatch");
  }
  if (
    input.expectedBusinessResult === "failure" &&
    !["PARTIAL_SUCCESS", "FAILURE"].includes(run.outcome)
  ) {
    reasons.push("observation_evidence_outcome_mismatch");
  }
  if (reasons.length > 0) {
    throw new CaioFdeScopeResolutionError(reasons);
  }
  return {
    runId: run.id,
    evidenceRef: `observation-run:${run.id}`,
    sourceId: run.sourceId,
    sourceKind,
    freshness: freshness!,
    outcome: run.outcome,
    observedAt: run.observedAt!,
    evidenceRefs,
  } as const;
}

export async function resolveCaioFdeObservationEvidenceBatch(input: {
  client: Prisma.TransactionClient;
  workspaceId: string;
  evidenceRefs: readonly string[];
  portfolioRef: string;
  now?: Date;
}) {
  if (input.evidenceRefs.length === 0 || input.evidenceRefs.length > 256) {
    throw new CaioFdeScopeResolutionError([
      "observation_evidence_batch_invalid",
    ]);
  }
  const runIds = input.evidenceRefs.map((evidenceRef) =>
    parseExactRef(
      evidenceRef,
      "observation-run",
      "observation_evidence_ref_invalid",
    ),
  );
  if (new Set(runIds).size !== runIds.length) {
    throw new CaioFdeScopeResolutionError([
      "observation_evidence_ref_duplicate",
    ]);
  }
  const runs = await input.client.observationSourceRun.findMany({
    where: { id: { in: runIds }, workspaceId: input.workspaceId },
    include: { program: true, source: true },
  });
  const runsById = new Map(runs.map((run) => [run.id, run]));
  if (runsById.size !== runIds.length) {
    throw new CaioFdeScopeResolutionError([
      "observation_evidence_workspace_mismatch",
    ]);
  }
  return runIds.map((runId) =>
    resolveObservationEvidenceRun({
      run: runsById.get(runId)!,
      workspaceId: input.workspaceId,
      portfolioRef: input.portfolioRef,
      now: input.now,
    }),
  );
}
