/**
 * Helm External Agent Intake — Boundary Demo Readout
 *
 * Pure offline readout builder for founder / customer / reviewer demos.
 * It evaluates local manual-import artifacts and makes the containment
 * boundary visible without creating Must Push, memory, official writes,
 * final ranking input, provider calls, DB reads/writes, API routes, or UI.
 */

import {
  evaluateExternalAgentArtifact,
  type ExternalAgentIntakeDecision,
  type IntakeDisposition,
} from "./intake-decision";
import type { ManualImportLoadedArtifact } from "./manual-import";
import {
  EXTERNAL_AGENT_INTAKE_REFERENCE_TIME,
  EXTERNAL_AGENT_INTAKE_WORKSPACE_ID,
} from "./provider-fixtures";

export type ExternalAgentMappingLane =
  | "supporting_evidence_candidate"
  | "draft_review_attachment"
  | "review_packet"
  | "watch_only"
  | "rejected"
  | "quarantined";

export interface ExternalAgentBoundaryDemoReadoutOptions {
  readonly inputFile?: string;
  readonly workspaceId?: string;
  readonly referenceTimeIso?: string;
  readonly description?: string;
}

export interface ExternalAgentBoundaryDemoReadout {
  readonly metadata: {
    readonly inputFile?: string;
    readonly expectedWorkspaceId: string;
    readonly referenceTimeIso: string;
    readonly description?: string;
  };
  readonly boundaryHeadlines: readonly ExternalAgentBoundaryHeadline[];
  readonly summary: ExternalAgentBoundaryDemoSummary;
  readonly providerBreakdown: Readonly<Record<string, ProviderBreakdown>>;
  readonly mappingLanes: Readonly<Record<ExternalAgentMappingLane, MappingLaneReadout>>;
  readonly hardSafety: ExternalAgentHardSafetyCounters;
  readonly rows: readonly ExternalAgentBoundaryDemoRow[];
  readonly mismatchedExpectedDispositionCount: number;
  readonly gatePassed: boolean;
}

export interface ExternalAgentBoundaryHeadline {
  readonly id:
    | "can_ingest"
    | "cannot_commit"
    | "cannot_write_memory"
    | "cannot_rank"
    | "quarantine_unsafe_output";
  readonly label: string;
}

export interface ExternalAgentBoundaryDemoSummary {
  readonly totalArtifacts: number;
  readonly canIngestCount: number;
  readonly byDisposition: Readonly<Record<IntakeDisposition, number>>;
  readonly byContainment: Readonly<Record<ExternalAgentIntakeDecision["containment"], number>>;
}

export interface ProviderBreakdown {
  readonly total: number;
  readonly byDisposition: Readonly<Record<IntakeDisposition, number>>;
  readonly byContainment: Readonly<Record<ExternalAgentIntakeDecision["containment"], number>>;
}

export interface MappingLaneReadout {
  readonly lane: ExternalAgentMappingLane;
  readonly label: string;
  readonly count: number;
  readonly artifactIds: readonly string[];
}

export interface ExternalAgentHardSafetyCounters {
  readonly directMustPushCreated: 0;
  readonly directMemoryCreated: 0;
  readonly officialWriteCreated: 0;
  readonly finalRankingInfluenced: 0;
}

export interface ExternalAgentBoundaryDemoRow {
  readonly artifactId: string;
  readonly providerId: string;
  readonly disposition: IntakeDisposition;
  readonly containment: ExternalAgentIntakeDecision["containment"];
  readonly mappingLane: ExternalAgentMappingLane;
  readonly mayAttachToSignal: boolean;
  readonly mustRequireReview: boolean;
  readonly reasonCodes: readonly string[];
  readonly boundaryNote: string;
  readonly expectedDisposition?: IntakeDisposition;
  readonly expectedDispositionMatched?: boolean;
  readonly demoNotes?: string;
}

const DISPOSITIONS: readonly IntakeDisposition[] = [
  "accept_as_evidence_candidate",
  "accept_as_draft_candidate",
  "review_required",
  "watch_only",
  "reject",
  "quarantine",
];

const MAPPING_LANES: readonly ExternalAgentMappingLane[] = [
  "supporting_evidence_candidate",
  "draft_review_attachment",
  "review_packet",
  "watch_only",
  "rejected",
  "quarantined",
];

export function buildExternalAgentBoundaryDemoReadout(
  loadedArtifacts: readonly ManualImportLoadedArtifact[],
  options: ExternalAgentBoundaryDemoReadoutOptions = {},
): ExternalAgentBoundaryDemoReadout {
  const expectedWorkspaceId = options.workspaceId ?? EXTERNAL_AGENT_INTAKE_WORKSPACE_ID;
  const referenceTimeIso =
    options.referenceTimeIso ?? EXTERNAL_AGENT_INTAKE_REFERENCE_TIME;

  const rows = loadedArtifacts.map((loaded): ExternalAgentBoundaryDemoRow => {
    const decision = evaluateExternalAgentArtifact(loaded.artifact, {
      expectedWorkspaceId,
      referenceTimeIso,
    });
    return {
      artifactId: decision.artifactId,
      providerId: decision.providerId,
      disposition: decision.disposition,
      containment: decision.containment,
      mappingLane: mapDispositionToLane(decision.disposition),
      mayAttachToSignal: decision.mayAttachToSignal,
      mustRequireReview: decision.mustRequireReview,
      reasonCodes: decision.reasonCodes,
      boundaryNote: decision.boundaryNote,
      expectedDisposition: loaded.expectedDisposition,
      expectedDispositionMatched:
        loaded.expectedDisposition === undefined
          ? undefined
          : loaded.expectedDisposition === decision.disposition,
      demoNotes: loaded.demoNotes,
    };
  });

  const mismatchedExpectedDispositionCount = rows.filter(
    (row) => row.expectedDispositionMatched === false,
  ).length;
  const hardSafety: ExternalAgentHardSafetyCounters = {
    directMustPushCreated: 0,
    directMemoryCreated: 0,
    officialWriteCreated: 0,
    finalRankingInfluenced: 0,
  };

  return {
    metadata: {
      inputFile: options.inputFile,
      expectedWorkspaceId,
      referenceTimeIso,
      description: options.description,
    },
    boundaryHeadlines: [
      { id: "can_ingest", label: "can ingest external Agent output as candidate evidence" },
      { id: "cannot_commit", label: "cannot commit, approve, send, or settle" },
      { id: "cannot_write_memory", label: "cannot write memory or active company memory" },
      { id: "cannot_rank", label: "cannot rank or reorder Must Push final output" },
      { id: "quarantine_unsafe_output", label: "quarantine unsafe output" },
    ],
    summary: buildSummary(rows),
    providerBreakdown: buildProviderBreakdown(rows),
    mappingLanes: buildMappingLaneReadout(rows),
    hardSafety,
    rows,
    mismatchedExpectedDispositionCount,
    gatePassed: mismatchedExpectedDispositionCount === 0 && hardSafetyCountersAreZero(hardSafety),
  };
}

export function renderExternalAgentBoundaryDemoText(
  readout: ExternalAgentBoundaryDemoReadout,
): string {
  const lines: string[] = [
    "",
    "Helm External Agent Boundary Demo",
    "=================================",
    `Input file:            ${readout.metadata.inputFile ?? "(in-memory)"}`,
    `Expected workspace:    ${readout.metadata.expectedWorkspaceId}`,
    `Reference time:        ${readout.metadata.referenceTimeIso}`,
  ];

  if (readout.metadata.description) {
    lines.push(`Description:           ${readout.metadata.description}`);
  }

  lines.push(
    "",
    "Boundary Headlines:",
    ...readout.boundaryHeadlines.map((headline) => `  - ${headline.label}`),
    "",
    "Summary:",
    `  Artifacts loaded:              ${readout.summary.totalArtifacts}`,
    `  Can ingest as candidate path:  ${readout.summary.canIngestCount}`,
    `  Expected mismatches:           ${readout.mismatchedExpectedDispositionCount}`,
    `  Direct Must Push created:      ${readout.hardSafety.directMustPushCreated}`,
    `  Direct memory created:         ${readout.hardSafety.directMemoryCreated}`,
    `  Official write created:        ${readout.hardSafety.officialWriteCreated}`,
    `  Final ranking influenced:      ${readout.hardSafety.finalRankingInfluenced}`,
    "",
    "Disposition Counters:",
    ...DISPOSITIONS.map(
      (disposition) =>
        `  ${disposition.padEnd(30)} ${readout.summary.byDisposition[disposition]}`,
    ),
    "",
    "Mapping Lanes:",
    ...MAPPING_LANES.map((lane) => {
      const item = readout.mappingLanes[lane];
      const ids = item.artifactIds.length > 0 ? item.artifactIds.join(", ") : "-";
      return `  ${item.label.padEnd(34)} ${String(item.count).padStart(2)}  ${ids}`;
    }),
    "",
    "Provider Breakdown:",
    ...Object.entries(readout.providerBreakdown).map(
      ([providerId, item]) => `  ${providerId.padEnd(18)} total=${item.total}`,
    ),
    "",
    "Artifact Rows:",
    ...readout.rows.flatMap((row) => renderRow(row)),
    "",
    readout.gatePassed ? "Boundary demo PASSED." : "Boundary demo FAILED.",
    "",
  );

  return lines.join("\n");
}

function renderRow(row: ExternalAgentBoundaryDemoRow): readonly string[] {
  const expected =
    row.expectedDisposition === undefined
      ? ""
      : row.expectedDispositionMatched
        ? " expected=PASS"
        : ` expected=FAIL(${row.expectedDisposition})`;

  return [
    `  ${row.artifactId.padEnd(10)} ${row.providerId.padEnd(16)} ${row.disposition.padEnd(28)} lane=${row.mappingLane}${expected}`,
    `             containment=${row.containment} mayAttach=${row.mayAttachToSignal} review=${row.mustRequireReview}`,
    `             reasons=${row.reasonCodes.join(",")}`,
    `             boundary=${row.boundaryNote}`,
  ];
}

function buildSummary(
  rows: readonly ExternalAgentBoundaryDemoRow[],
): ExternalAgentBoundaryDemoSummary {
  const byDisposition = emptyDispositionCounts();
  const byContainment = emptyContainmentCounts();

  for (const row of rows) {
    byDisposition[row.disposition] += 1;
    byContainment[row.containment] += 1;
  }

  return {
    totalArtifacts: rows.length,
    canIngestCount: rows.filter((row) =>
      [
        "supporting_evidence_candidate",
        "draft_review_attachment",
        "review_packet",
      ].includes(row.mappingLane),
    ).length,
    byDisposition,
    byContainment,
  };
}

function buildProviderBreakdown(
  rows: readonly ExternalAgentBoundaryDemoRow[],
): Readonly<Record<string, ProviderBreakdown>> {
  const byProvider: Record<string, ProviderBreakdown> = {};

  for (const row of rows) {
    const current =
      byProvider[row.providerId] ??
      ({
        total: 0,
        byDisposition: emptyDispositionCounts(),
        byContainment: emptyContainmentCounts(),
      } satisfies ProviderBreakdown);

    byProvider[row.providerId] = {
      total: current.total + 1,
      byDisposition: incrementCount(current.byDisposition, row.disposition),
      byContainment: incrementCount(current.byContainment, row.containment),
    };
  }

  return byProvider;
}

function buildMappingLaneReadout(
  rows: readonly ExternalAgentBoundaryDemoRow[],
): Readonly<Record<ExternalAgentMappingLane, MappingLaneReadout>> {
  const readout: Record<ExternalAgentMappingLane, MappingLaneReadout> = {
    supporting_evidence_candidate: emptyMappingLaneReadout(
      "supporting_evidence_candidate",
    ),
    draft_review_attachment: emptyMappingLaneReadout("draft_review_attachment"),
    review_packet: emptyMappingLaneReadout("review_packet"),
    watch_only: emptyMappingLaneReadout("watch_only"),
    rejected: emptyMappingLaneReadout("rejected"),
    quarantined: emptyMappingLaneReadout("quarantined"),
  };

  for (const row of rows) {
    const current = readout[row.mappingLane];
    readout[row.mappingLane] = {
      ...current,
      count: current.count + 1,
      artifactIds: [...current.artifactIds, row.artifactId],
    };
  }

  return readout;
}

function emptyMappingLaneReadout(lane: ExternalAgentMappingLane): MappingLaneReadout {
  return {
    lane,
    label: mappingLaneLabel(lane),
    count: 0,
    artifactIds: [],
  };
}

function mapDispositionToLane(disposition: IntakeDisposition): ExternalAgentMappingLane {
  switch (disposition) {
    case "accept_as_evidence_candidate":
      return "supporting_evidence_candidate";
    case "accept_as_draft_candidate":
      return "draft_review_attachment";
    case "review_required":
      return "review_packet";
    case "watch_only":
      return "watch_only";
    case "reject":
      return "rejected";
    case "quarantine":
      return "quarantined";
  }
}

function mappingLaneLabel(lane: ExternalAgentMappingLane): string {
  switch (lane) {
    case "supporting_evidence_candidate":
      return "supporting evidence candidate";
    case "draft_review_attachment":
      return "draft review attachment";
    case "review_packet":
      return "review packet";
    case "watch_only":
      return "watch-only";
    case "rejected":
      return "rejected";
    case "quarantined":
      return "quarantined";
  }
}

function emptyDispositionCounts(): Record<IntakeDisposition, number> {
  return {
    accept_as_evidence_candidate: 0,
    accept_as_draft_candidate: 0,
    review_required: 0,
    watch_only: 0,
    reject: 0,
    quarantine: 0,
  };
}

function emptyContainmentCounts(): Record<
  ExternalAgentIntakeDecision["containment"],
  number
> {
  return {
    none: 0,
    downgraded: 0,
    rejected: 0,
    quarantined: 0,
  };
}

function incrementCount<T extends string>(
  counts: Readonly<Record<T, number>>,
  key: T,
): Record<T, number> {
  return { ...counts, [key]: counts[key] + 1 };
}

function hardSafetyCountersAreZero(counters: ExternalAgentHardSafetyCounters): boolean {
  return (
    counters.directMustPushCreated === 0 &&
    counters.directMemoryCreated === 0 &&
    counters.officialWriteCreated === 0 &&
    counters.finalRankingInfluenced === 0
  );
}
