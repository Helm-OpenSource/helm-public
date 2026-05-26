import type {
  HelmV21EnvironmentContractProviderRef,
  HelmV21EnvironmentContractReadModel,
  HelmV21EnvironmentExecutionAuthorityPosture,
  HelmV21EnvironmentExecutionAuthorityReadModel,
  HelmV21EnvironmentExecutionAuthoritySourceEntry,
  HelmV21EnvironmentExecutionSeamReadModel,
  HelmV21EnvironmentExecutionSeamSource,
  HelmV21EnvironmentContractRuntimePosture,
  HelmV21EnvironmentContractSeam,
  HelmV21ProjectSkillLibraryReadModel,
} from "@/lib/helm-v2/contracts";

type ConnectorInput = {
  id: string;
  provider: string;
  status: string;
  lastSyncedAt?: Date | null;
  lastSyncStatus?: string | null;
  lastSyncMessage?: string | null;
};

type OfficialActionCoverageInput = {
  actionType: string;
  defaultPath: string;
  limitedAutoStatus: string;
  executableLimitedAuto: boolean;
  boundaryReason: string;
};

type OfficialWriteIntentInput = {
  id: string;
  actionType: string;
  officialObjectRef: string;
  acknowledgementStatus: string;
  acknowledgedAt?: Date | null;
  updatedAt: Date;
};

type LimitedAutoIntentInput = {
  id: string;
  actionType: string;
  officialObjectRef: string;
  acknowledgementStatus: string;
  acknowledgedAt?: Date | null;
  updatedAt: Date;
};

type OfficialFollowThroughInput = {
  id: string;
  followThroughStatus: string;
  followThroughResolutionStatus: string;
  followThroughSummary?: string | null;
  followThroughNextAction?: string | null;
  updatedAt: Date;
};

type BuildEnvironmentContractReadModelInput = {
  projectSkillLibrary: HelmV21ProjectSkillLibraryReadModel;
  connectors?: ConnectorInput[];
  officialActionCoverage?: OfficialActionCoverageInput[];
  officialWriteIntents?: OfficialWriteIntentInput[];
  limitedAutoIntents?: LimitedAutoIntentInput[];
  officialFollowThrough?: OfficialFollowThroughInput[];
  humanExecutionCount?: number;
  officialFollowThroughCount?: number;
};

const ENVIRONMENT_CONTRACT_BOUNDARY_NOTE =
  "Environment contract stays review-first and boundary-first. It explains what connector, browser, control-plane, workspace-context, and official-action seams currently expose without granting broader execution authority.";
const ENVIRONMENT_EXECUTION_SEAM_BOUNDARY_NOTE =
  "Environment execution seam stays review-gated and audit-visible. It only reports guarded write / limited-auto / official follow-through posture already produced elsewhere, and does not grant broader execution authority.";
const ENVIRONMENT_EXECUTION_AUTHORITY_BOUNDARY_NOTE =
  "Environment execution authority stays explicit, narrow, and review-first. It tells the operator which execution paths are still boundary-only, manual-only, review-gated, or narrowly limited-auto without widening authority.";

function buildConnectorProviders(connectors: ConnectorInput[]): HelmV21EnvironmentContractProviderRef[] {
  return connectors
    .map((item) => ({
      id: item.id,
      label: item.provider,
      status: item.status.toLowerCase(),
      detail:
        item.lastSyncStatus?.trim() ||
        item.lastSyncMessage?.trim() ||
        (item.status === "CONNECTED" ? "connected" : "not connected"),
      updatedAt: item.lastSyncedAt ?? null,
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

function buildOfficialActionProviders(
  coverage: OfficialActionCoverageInput[],
): HelmV21EnvironmentContractProviderRef[] {
  return coverage.map((item) => ({
    id: item.actionType,
    label: item.actionType,
    status: item.limitedAutoStatus,
    detail: `${item.defaultPath} · ${item.boundaryReason}`,
    updatedAt: null,
  }));
}

function buildRuntimePostureForConnector(connectors: ConnectorInput[]): HelmV21EnvironmentContractRuntimePosture {
  if (connectors.length === 0) return "boundary_only";
  const connected = connectors.filter((item) => item.status === "CONNECTED").length;
  if (connected === 0) return "boundary_only";
  if (connected === connectors.length) return "connected";
  return "partially_connected";
}

function buildRuntimeSummaryForConnector(connectors: ConnectorInput[]) {
  if (connectors.length === 0) {
    return "No workspace connector is connected yet. Connector seam remains explicit but does not expand into connector platform authority.";
  }
  const connected = connectors.filter((item) => item.status === "CONNECTED").length;
  return `${connected}/${connectors.length} workspace connector(s) are connected. Connector reads stay narrow, workspace-scoped, and review-first.`;
}

function buildRuntimeSummaryForOfficialAction(
  coverage: OfficialActionCoverageInput[],
  humanExecutionCount: number,
  officialFollowThroughCount: number,
  executionSeam: HelmV21EnvironmentExecutionSeamReadModel,
) {
  if (coverage.length === 0) {
    return executionSeam.posture === "boundary_only"
      ? "No official-action coverage catalog is loaded here. Official action stays boundary-only."
      : executionSeam.summary;
  }
  const eligible = coverage.filter((item) => item.limitedAutoStatus === "eligible").length;
  const manualOnly = coverage.filter((item) => item.limitedAutoStatus === "eligible_but_manual_only").length;
  const blocked = coverage.filter((item) => item.limitedAutoStatus === "blocked").length;
  const deferred = coverage.filter((item) => item.limitedAutoStatus === "deferred").length;
  return `${eligible} limited-auto eligible, ${manualOnly} manual-only, ${blocked} blocked, ${deferred} deferred. ${humanExecutionCount} human execution trace item(s) and ${officialFollowThroughCount} official follow-through item(s) are currently visible. ${executionSeam.summary}`;
}

function buildExecutionSeam(
  input: Pick<
    BuildEnvironmentContractReadModelInput,
    "officialActionCoverage" | "officialWriteIntents" | "limitedAutoIntents" | "officialFollowThrough"
  >,
): HelmV21EnvironmentExecutionSeamReadModel {
  const officialActionCoverage = input.officialActionCoverage ?? [];
  const officialWriteIntents = input.officialWriteIntents ?? [];
  const limitedAutoIntents = input.limitedAutoIntents ?? [];
  const officialFollowThrough = input.officialFollowThrough ?? [];

  const counts = {
    officialWritesPending:
      officialWriteIntents.filter((item) => item.acknowledgementStatus === "PENDING").length +
      limitedAutoIntents.filter((item) => item.acknowledgementStatus === "PENDING").length,
    officialWritesAcknowledged:
      officialWriteIntents.filter((item) => item.acknowledgementStatus === "SUCCESS").length +
      limitedAutoIntents.filter((item) => item.acknowledgementStatus === "SUCCESS").length,
    officialWritesFailed:
      officialWriteIntents.filter((item) => item.acknowledgementStatus === "FAILURE").length +
      limitedAutoIntents.filter((item) => item.acknowledgementStatus === "FAILURE").length,
    officialWritesDeferred:
      officialWriteIntents.filter((item) => ["DEFERRED", "RECONCILIATION_NOTED"].includes(item.acknowledgementStatus))
        .length +
      limitedAutoIntents.filter((item) =>
        ["DEFERRED", "MANUAL_RECONCILIATION_REQUIRED"].includes(item.acknowledgementStatus),
      ).length,
    followThroughOpen: officialFollowThrough.filter(
      (item) => !["RESOLVED", "CLOSED_NO_CHANGE"].includes(item.followThroughResolutionStatus),
    ).length,
    followThroughResolved: officialFollowThrough.filter((item) =>
      ["RESOLVED", "CLOSED_NO_CHANGE"].includes(item.followThroughResolutionStatus),
    ).length,
  };

  const latestCandidates: Array<{
    source: HelmV21EnvironmentExecutionSeamSource;
    referenceId: string;
    posture: HelmV21EnvironmentExecutionSeamReadModel["posture"];
    summary: string;
    updatedAt: Date;
  }> = [
    ...officialWriteIntents.map((item) => ({
      source: "guarded_write" as const,
      referenceId: item.id,
      posture:
        item.acknowledgementStatus === "SUCCESS"
          ? ("acknowledged" as const)
          : item.acknowledgementStatus === "FAILURE"
            ? ("failed" as const)
            : item.acknowledgementStatus === "PENDING"
              ? ("awaiting_acknowledgement" as const)
              : ("deferred" as const),
      summary: `Guarded write ${item.actionType} for ${item.officialObjectRef} is ${item.acknowledgementStatus.toLowerCase().replaceAll("_", " ")}.`,
      updatedAt: item.acknowledgedAt ?? item.updatedAt,
    })),
    ...limitedAutoIntents.map((item) => ({
      source: "limited_auto" as const,
      referenceId: item.id,
      posture:
        item.acknowledgementStatus === "SUCCESS"
          ? ("acknowledged" as const)
          : item.acknowledgementStatus === "FAILURE"
            ? ("failed" as const)
            : item.acknowledgementStatus === "PENDING"
              ? ("awaiting_acknowledgement" as const)
              : ("deferred" as const),
      summary: `Limited auto ${item.actionType} for ${item.officialObjectRef} is ${item.acknowledgementStatus.toLowerCase().replaceAll("_", " ")}.`,
      updatedAt: item.acknowledgedAt ?? item.updatedAt,
    })),
    ...officialFollowThrough.map((item) => ({
      source: "follow_through" as const,
      referenceId: item.id,
      posture: ["RESOLVED", "CLOSED_NO_CHANGE"].includes(item.followThroughResolutionStatus)
        ? ("follow_through_resolved" as const)
        : ("follow_through_open" as const),
      summary:
        item.followThroughSummary?.trim() ||
        `Official follow-through is ${item.followThroughStatus.toLowerCase().replaceAll("_", " ")}${item.followThroughNextAction ? ` and next action is ${item.followThroughNextAction}.` : "."}`,
      updatedAt: item.updatedAt,
    })),
  ].sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());

  const latest = latestCandidates[0];
  if (!latest) {
    return {
      posture: officialActionCoverage.length > 0 ? "review_gated" : "boundary_only",
      summary:
        officialActionCoverage.length > 0
          ? "Official-action coverage is loaded, but no guarded write acknowledgement, limited-auto acknowledgement, or follow-through result is visible yet."
          : "No official-action execution seam is visible yet. The seam stays boundary-only.",
      boundaryNote: ENVIRONMENT_EXECUTION_SEAM_BOUNDARY_NOTE,
      latestSource: null,
      latestReferenceId: null,
      latestSummary: null,
      latestUpdatedAt: null,
      counts,
    };
  }

  return {
    posture: latest.posture,
    summary: `Latest execution seam: ${latest.summary} Counts: ${counts.officialWritesPending} pending, ${counts.officialWritesAcknowledged} acknowledged, ${counts.officialWritesFailed} failed, ${counts.officialWritesDeferred} deferred, ${counts.followThroughOpen} follow-through open, ${counts.followThroughResolved} follow-through resolved.`,
    boundaryNote: ENVIRONMENT_EXECUTION_SEAM_BOUNDARY_NOTE,
    latestSource: latest.source,
    latestReferenceId: latest.referenceId,
    latestSummary: latest.summary,
    latestUpdatedAt: latest.updatedAt,
    counts,
  };
}

function buildExecutionAuthority(input: Pick<
  BuildEnvironmentContractReadModelInput,
  "officialActionCoverage" | "officialWriteIntents" | "limitedAutoIntents" | "officialFollowThrough" | "humanExecutionCount"
>): HelmV21EnvironmentExecutionAuthorityReadModel {
  const officialActionCoverage = input.officialActionCoverage ?? [];
  const officialWriteIntents = input.officialWriteIntents ?? [];
  const limitedAutoIntents = input.limitedAutoIntents ?? [];
  const officialFollowThrough = input.officialFollowThrough ?? [];
  const humanExecutionCount = input.humanExecutionCount ?? 0;

  const guardedWriteReviewGated =
    officialWriteIntents.length +
    officialActionCoverage.filter((item) => item.defaultPath === "guarded").length;
  const limitedAutoEligible = officialActionCoverage.filter(
    (item) => item.limitedAutoStatus === "eligible" && item.executableLimitedAuto,
  ).length;
  const limitedAutoManualOnly = officialActionCoverage.filter(
    (item) =>
      item.limitedAutoStatus === "eligible_but_manual_only" ||
      (item.limitedAutoStatus === "eligible" && !item.executableLimitedAuto),
  ).length;
  const limitedAutoBlocked = officialActionCoverage.filter((item) => item.limitedAutoStatus === "blocked").length;
  const limitedAutoDeferred = officialActionCoverage.filter((item) => item.limitedAutoStatus === "deferred").length;
  const followThroughVisible = officialFollowThrough.length;

  const posture: HelmV21EnvironmentExecutionAuthorityPosture =
    limitedAutoEligible > 0
      ? "narrow_limited_auto"
      : guardedWriteReviewGated > 0 || limitedAutoBlocked > 0 || limitedAutoDeferred > 0 || followThroughVisible > 0
        ? "review_gated"
        : limitedAutoManualOnly > 0 || humanExecutionCount > 0
          ? "manual_only"
          : "boundary_only";

  const sourceEntries: HelmV21EnvironmentExecutionAuthoritySourceEntry[] = [
    {
      source: "human_execution",
      posture: "manual_only",
      summary:
        humanExecutionCount > 0
          ? `${humanExecutionCount} human execution trace item(s) remain explicit manual-only execution.`
          : "Human execution remains the manual-only fallback path when no broader environment authority should be inferred.",
      boundaryNote:
        "Human execution remains explicit manual work. It does not imply send authority, autonomous official writes, or broader runtime authority.",
      liveReferenceCount: humanExecutionCount,
    },
    {
      source: "guarded_write",
      posture: guardedWriteReviewGated > 0 ? "review_gated" : "boundary_only",
      summary:
        guardedWriteReviewGated > 0
          ? `${guardedWriteReviewGated} guarded write reference(s) are visible and stay review-gated before any official write attempt.`
          : "No guarded write path is currently visible here, so this source remains boundary-only.",
      boundaryNote:
        "Guarded write authority stays review-gated and acknowledgement-bound. It does not widen into broad official write authority.",
      liveReferenceCount: guardedWriteReviewGated,
    },
    {
      source: "limited_auto",
      posture:
        limitedAutoEligible > 0
          ? "narrow_limited_auto"
          : limitedAutoManualOnly > 0
            ? "manual_only"
            : limitedAutoBlocked > 0 || limitedAutoDeferred > 0 || limitedAutoIntents.length > 0
              ? "review_gated"
              : "boundary_only",
      summary:
        limitedAutoEligible > 0
          ? `${limitedAutoEligible} narrowly eligible limited-auto path(s) are visible; ${limitedAutoManualOnly} stay manual-only, ${limitedAutoBlocked} blocked, ${limitedAutoDeferred} deferred.`
          : limitedAutoManualOnly > 0
            ? `${limitedAutoManualOnly} limited-auto path(s) stay manual-only; ${limitedAutoBlocked} blocked and ${limitedAutoDeferred} deferred path(s) remain explicit.`
            : limitedAutoBlocked > 0 || limitedAutoDeferred > 0 || limitedAutoIntents.length > 0
              ? `Limited auto remains review-gated here: ${limitedAutoBlocked} blocked, ${limitedAutoDeferred} deferred, ${limitedAutoIntents.length} visible intent(s).`
              : "No limited-auto path is currently visible here, so this source remains boundary-only.",
      boundaryNote:
        "Limited auto stays extremely narrow, explicitly approved, and overrideable. It does not create broad auto-write or execution-plane authority.",
      liveReferenceCount: limitedAutoEligible + limitedAutoManualOnly + limitedAutoBlocked + limitedAutoDeferred,
    },
    {
      source: "follow_through",
      posture: followThroughVisible > 0 ? "review_gated" : "boundary_only",
      summary:
        followThroughVisible > 0
          ? `${followThroughVisible} official follow-through item(s) are visible for audited resolution, not expanded execution authority.`
          : "No official follow-through item is currently visible here, so this source remains boundary-only.",
      boundaryNote:
        "Official follow-through remains audit-visible and review-first. It does not, by itself, imply official write success or broader authority.",
      liveReferenceCount: followThroughVisible,
    },
  ];

  const summaryParts = [
    `Execution authority is currently ${posture.replaceAll("_", " ")}.`,
    `${guardedWriteReviewGated} guarded write reference(s) stay review-gated.`,
    `${limitedAutoEligible} narrow limited-auto eligible, ${limitedAutoManualOnly} manual-only, ${limitedAutoBlocked} blocked, ${limitedAutoDeferred} deferred.`,
    `${humanExecutionCount} human execution trace item(s) stay manual-only and ${followThroughVisible} follow-through item(s) stay audit-visible.`,
  ];

  return {
    posture,
    summary: summaryParts.join(" "),
    boundaryNote: ENVIRONMENT_EXECUTION_AUTHORITY_BOUNDARY_NOTE,
    sourceEntries,
    counts: {
      humanExecutionManualOnly: humanExecutionCount,
      guardedWriteReviewGated,
      limitedAutoEligible,
      limitedAutoManualOnly,
      limitedAutoBlocked,
      limitedAutoDeferred,
      followThroughVisible,
    },
  };
}

export function buildEnvironmentContractReadModel(
  input: BuildEnvironmentContractReadModelInput,
): HelmV21EnvironmentContractReadModel {
  const connectors = input.connectors ?? [];
  const officialActionCoverage = input.officialActionCoverage ?? [];
  const officialWriteIntents = input.officialWriteIntents ?? [];
  const limitedAutoIntents = input.limitedAutoIntents ?? [];
  const officialFollowThrough = input.officialFollowThrough ?? [];
  const humanExecutionCount = input.humanExecutionCount ?? 0;
  const officialFollowThroughCount = input.officialFollowThroughCount ?? 0;
  const executionSeam = buildExecutionSeam({
    officialActionCoverage,
    officialWriteIntents,
    limitedAutoIntents,
    officialFollowThrough,
  });
  const executionAuthority = buildExecutionAuthority({
    officialActionCoverage,
    officialWriteIntents,
    limitedAutoIntents,
    officialFollowThrough,
    humanExecutionCount,
  });

  const seams: HelmV21EnvironmentContractSeam[] = input.projectSkillLibrary.environmentSeams.map(
    (item) => {
      if (item.seamKind === "connector") {
        const providers = buildConnectorProviders(connectors);
        return {
          seamId: item.seamId,
          seamKind: item.seamKind,
          contractState: item.state,
          runtimePosture: buildRuntimePostureForConnector(connectors),
          summary: buildRuntimeSummaryForConnector(connectors),
          boundaryNote: item.boundaryNote,
          liveReferenceCount: connectors.length,
          providers,
        };
      }

      if (item.seamKind === "browser") {
        return {
          seamId: item.seamId,
          seamKind: item.seamKind,
          contractState: item.state,
          runtimePosture: item.state === "active" ? "available" : "boundary_only",
          summary:
            item.state === "active"
              ? `Bounded browser research is available through ${item.providers.join(", ")} and remains cited, replayable, and non-executing.`
              : "Browser seam is not bound in the current project skill contract.",
          boundaryNote: item.boundaryNote,
          liveReferenceCount: item.resourceIds.length,
          providers: item.providers.map((provider) => ({
            id: provider,
            label: provider,
            status: "available",
            detail: "bounded browser research",
            updatedAt: null,
          })),
        };
      }

      if (item.seamKind === "official_action") {
        return {
          seamId: item.seamId,
          seamKind: item.seamKind,
          contractState: item.state,
          runtimePosture: officialActionCoverage.length > 0 ? "review_gated" : "boundary_only",
          summary: buildRuntimeSummaryForOfficialAction(
            officialActionCoverage,
            humanExecutionCount,
            officialFollowThroughCount,
            executionSeam,
          ),
          boundaryNote: item.boundaryNote,
          liveReferenceCount: officialActionCoverage.length,
          providers: buildOfficialActionProviders(officialActionCoverage),
        };
      }

      return {
        seamId: item.seamId,
        seamKind: item.seamKind,
        contractState: item.state,
        runtimePosture: item.state === "active" ? "available" : "boundary_only",
        summary: item.summary,
        boundaryNote: item.boundaryNote,
        liveReferenceCount: item.resourceIds.length,
        providers: item.providers.map((provider) => ({
          id: provider,
          label: provider,
          status: item.state === "active" ? "available" : "boundary_only",
          detail: item.summary,
          updatedAt: null,
        })),
      };
    },
  );

  return {
    boundaryNote: ENVIRONMENT_CONTRACT_BOUNDARY_NOTE,
    summary: {
      seamCount: seams.length,
      activeConnectorCount: connectors.length,
      connectedConnectorCount: connectors.filter((item) => item.status === "CONNECTED").length,
      activeBrowserSeams: seams.filter(
        (item) => item.seamKind === "browser" && item.runtimePosture === "available",
      ).length,
      reviewGatedOfficialActions: officialActionCoverage.filter(
        (item) => item.limitedAutoStatus === "eligible" || item.limitedAutoStatus === "eligible_but_manual_only",
      ).length,
      liveOfficialFollowThrough: officialFollowThroughCount,
    },
    executionSeam,
    executionAuthority,
    seams,
  };
}
