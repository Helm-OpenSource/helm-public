import type {
  HelmV21CoordinationOutcome,
  HelmV21EdgeBriefAudience,
  HelmV21ProblemSpaceDraft,
  HelmV21VerificationDecision,
} from "@/lib/helm-v2/contracts";
import { trimText } from "@/lib/utils";

export function buildProblemSpaceDrafts(input: {
  meetingId: string;
  meetingTitle: string;
  recommendedNextAction?: string | null;
  blockers: string[];
  verification: HelmV21VerificationDecision;
  ownerHint?: string | null;
  evidenceRefs: string[];
  allowOperationalProblemSpaces: boolean;
}): HelmV21ProblemSpaceDraft[] {
  const drafts: HelmV21ProblemSpaceDraft[] = [];
  const hasGroundedEvidence = input.evidenceRefs.length > 0;
  const canCreateOperationalProblemSpaces = input.allowOperationalProblemSpaces && hasGroundedEvidence;

  if (canCreateOperationalProblemSpaces && input.recommendedNextAction) {
    drafts.push({
      problemKey: `${input.meetingId}:next-step-alignment`,
      title: "Next-step alignment",
      summary: `The meeting "${input.meetingTitle}" produced a concrete next step that now needs an accountable owner and visible follow-through.`,
      nextStep: input.recommendedNextAction,
      ownerHint: input.ownerHint ?? null,
      evidenceRefs: input.evidenceRefs,
    });
  }

  if (canCreateOperationalProblemSpaces && input.blockers.length > 0) {
    drafts.push({
      problemKey: `${input.meetingId}:blocker-resolution`,
      title: "Blocker resolution",
      summary: `Confirmed blockers need coordination instead of staying trapped inside notes: ${trimText(input.blockers.join("；"), 180)}`,
      nextStep: input.blockers[0] ?? "Clarify the top blocker and assign a resolving owner.",
      ownerHint: input.ownerHint ?? null,
      evidenceRefs: input.evidenceRefs,
    });
  }

  if (!canCreateOperationalProblemSpaces || input.verification.status !== "passed") {
    const deferredReason = !canCreateOperationalProblemSpaces
      ? "Operational problem-space generation stays deferred until this meeting slice has confirmed or promoted signals with visible grounding."
      : null;
    drafts.push({
      problemKey: `${input.meetingId}:truth-boundary`,
      title: "Truth boundary review",
      summary:
        trimText([deferredReason, ...input.verification.blockedReasons].filter(Boolean).join(" "), 220) ||
        "Some meeting-derived signals still need boundary review before quiet trust upgrade.",
      nextStep: "Review the blocked reasons, confirm the source of truth, and decide what can be promoted versus deferred.",
      ownerHint: input.ownerHint ?? null,
      evidenceRefs: input.evidenceRefs,
    });
  }

  return drafts;
}

export function buildEdgeBriefMarkdown(input: {
  audience: HelmV21EdgeBriefAudience;
  title: string;
  summary: string;
  nextStep: string;
  ownerHint?: string | null;
  groundingSummary?: string | null;
  truthPosture?: string | null;
  driSummary?: string | null;
}) {
  const lens =
    input.audience === "IC"
      ? "Focus on the exact action that unblocks the chain next."
      : input.audience === "DRI"
        ? "Focus on ownership, timeline, and what still needs confirmation."
        : "Focus on coaching risk, cross-thread visibility, and escalation posture.";

  return [
    `# ${input.title}`,
    "",
    `## Summary`,
    input.summary,
    "",
    `## Grounding`,
    input.groundingSummary ?? "Grounding trace still needs explicit review before anyone treats this as settled truth.",
    "",
    `## Truth posture`,
    input.truthPosture ?? "This brief remains internal-only and review-first until the runtime truth posture is explicitly confirmed.",
    "",
    `## Next step`,
    input.nextStep,
    "",
    `## Owner hint`,
    input.ownerHint ?? "Still unassigned",
    "",
    `## DRI posture`,
    input.driSummary ?? "No explicit DRI rationale has been recorded yet.",
    "",
    `## Lens`,
    lens,
    "",
    `## Boundary`,
    "This brief is operating guidance only. It is not an external commitment and it does not authorize auto-send or high-risk auto-write.",
  ].join("\n");
}

export function deriveCoordinationOutcome(input: {
  verificationStatus?: HelmV21VerificationDecision["status"] | null;
  hasTruthConflict?: boolean;
  missingCapability?: boolean;
  blockedByAuthority?: boolean;
  keptDraft?: boolean;
}): HelmV21CoordinationOutcome {
  if (input.missingCapability) return "capability_gap";
  if (input.blockedByAuthority || input.verificationStatus === "blocked") return "waiting_on_authority";
  if (input.hasTruthConflict) return "waiting_on_signal";
  if (input.keptDraft || input.verificationStatus === "needs_review") return "review_needed";
  return "action_ready";
}

export function mapCoordinationOutcomeToProblemSpaceStatus(input: {
  title: string;
  outcome: HelmV21CoordinationOutcome;
}) {
  if (input.title === "Truth boundary review") {
    if (input.outcome === "waiting_on_authority") return "WAITING_ON_AUTHORITY" as const;
    if (input.outcome === "action_ready") return "SCOPED" as const;
    return "WAITING_ON_SIGNAL" as const;
  }

  switch (input.outcome) {
    case "capability_gap":
      return "BLOCKED" as const;
    case "waiting_on_authority":
      return "WAITING_ON_AUTHORITY" as const;
    case "waiting_on_signal":
      return "WAITING_ON_SIGNAL" as const;
    case "review_needed":
      return "WATCHING" as const;
    case "action_ready":
    default:
      return "SCOPED" as const;
  }
}

export function mapCoordinationOutcomeToInitiativeStatus(outcome: HelmV21CoordinationOutcome) {
  switch (outcome) {
    case "capability_gap":
      return "CAPABILITY_GAP" as const;
    case "waiting_on_authority":
      return "WAITING_ON_AUTHORITY" as const;
    case "waiting_on_signal":
      return "WAITING_ON_SIGNAL" as const;
    case "review_needed":
      return "DETECTED" as const;
    case "action_ready":
    default:
      return "ACTIVE" as const;
  }
}

export function mapProblemSpaceStatusToCoordinationOutcome(status: string): HelmV21CoordinationOutcome {
  switch (status) {
    case "BLOCKED":
      return "capability_gap";
    case "WAITING_ON_AUTHORITY":
      return "waiting_on_authority";
    case "WAITING_ON_SIGNAL":
      return "waiting_on_signal";
    case "WATCHING":
    case "DETECTED":
      return "review_needed";
    case "ASSIGNED":
    case "ACTIVE":
    case "SCOPED":
    default:
      return "action_ready";
  }
}

export function buildProblemSpaceTruthPosture(outcome: HelmV21CoordinationOutcome) {
  switch (outcome) {
    case "waiting_on_signal":
      return "Truth is still unresolved. This brief stays in defer posture until conflicting or weak signals are explicitly settled.";
    case "waiting_on_authority":
      return "Signals are reviewed, but authority or boundary review still blocks execution. Treat this as internal coordination only.";
    case "review_needed":
      return "This problem space remains in review posture. Use it to coordinate follow-through, not to imply settled truth.";
    case "capability_gap":
      return "This chain is blocked by a capability gap, so the brief is diagnostic rather than execution-authorizing.";
    case "action_ready":
    default:
      return "This problem space is grounded enough for bounded internal coordination. It still does not authorize auto-send or broad auto-write.";
  }
}

export function buildProblemSpaceConflictSummary(outcome: HelmV21CoordinationOutcome) {
  switch (outcome) {
    case "waiting_on_signal":
      return "Conflict or weak truth still remains unresolved, so this stays in signal review.";
    case "waiting_on_authority":
      return "Boundary or authority review still blocks the next move.";
    case "review_needed":
      return "This problem space stays deferred until review resolves the remaining uncertainty.";
    case "capability_gap":
      return "A capability gap blocks safe completion of this chain.";
    case "action_ready":
    default:
      return null;
  }
}

export function buildProblemSpaceGroundingSummary(input: {
  evidenceRefs: string[];
  coordinationOutcome: HelmV21CoordinationOutcome;
}) {
  const refs = input.evidenceRefs.length > 0 ? input.evidenceRefs.slice(0, 4).join(" / ") : "runtime-session-trace";
  const prefix =
    input.coordinationOutcome === "action_ready"
      ? "Grounded on confirmed or promoted runtime signals."
      : "Grounding remains operator-visible while the slice stays in deferred or review posture.";
  return `${prefix} Evidence trace: ${refs}.`;
}

export function buildProblemSpaceDriSummary(input: {
  assignedUserName?: string | null;
  assignedByName?: string | null;
  assignmentNote?: string | null;
  coordinationOutcome: HelmV21CoordinationOutcome;
}) {
  const assignee = input.assignedUserName ?? "Still unassigned";
  const defaultReason =
    input.coordinationOutcome === "action_ready"
      ? "Assigned so the confirmed next step has one accountable follow-through owner."
      : "Assigned so one owner carries the review, conflict resolution, or authority follow-through.";
  const assignmentReason = input.assignmentNote ?? defaultReason;
  return trimText(
    [`DRI: ${assignee}.`, assignmentReason, input.assignedByName ? `Assigned by ${input.assignedByName}.` : null]
      .filter(Boolean)
      .join(" "),
    220,
  );
}

export function buildProblemSpaceBriefContent(input: {
  audience: HelmV21EdgeBriefAudience;
  problemSpace: {
    title: string;
    summary: string;
    nextStep: string;
    ownerHint?: string | null;
  };
  evidenceRefs: string[];
  coordinationOutcome: HelmV21CoordinationOutcome;
  assignedUserName?: string | null;
  assignedByName?: string | null;
  assignmentNote?: string | null;
}) {
  const groundingSummary = buildProblemSpaceGroundingSummary({
    evidenceRefs: input.evidenceRefs,
    coordinationOutcome: input.coordinationOutcome,
  });
  const truthPosture = buildProblemSpaceTruthPosture(input.coordinationOutcome);
  const driSummary = buildProblemSpaceDriSummary({
    assignedUserName: input.assignedUserName ?? input.problemSpace.ownerHint,
    assignedByName: input.assignedByName,
    assignmentNote: input.assignmentNote,
    coordinationOutcome: input.coordinationOutcome,
  });

  return {
    summary: trimText([input.problemSpace.summary, groundingSummary].filter(Boolean).join(" "), 400),
    markdown: buildEdgeBriefMarkdown({
      audience: input.audience,
      title: input.problemSpace.title,
      summary: input.problemSpace.summary,
      nextStep: input.problemSpace.nextStep,
      ownerHint: input.assignedUserName ?? input.problemSpace.ownerHint,
      groundingSummary,
      truthPosture,
      driSummary,
    }),
  };
}

type CoordinationTraceProblemInput = {
  id: string;
  title: string;
  status: string;
  ownerHint?: string | null;
  evidenceRefs: string[];
  meetingId?: string | null;
  opportunityId?: string | null;
  companyId?: string | null;
  updatedAt: Date;
  driAssignments: Array<{
    assignedUserName: string | null;
    assignedByName: string | null;
    note: string | null;
  }>;
};

type CoordinationTraceHumanExecutionInput = {
  id: string;
  meetingId: string;
  opportunityId?: string | null;
  companyId?: string | null;
  status: string;
  executionIntent: string;
  executionOwnerName?: string | null;
  followThroughStatus?: string | null;
  executedAt?: Date | null;
  updatedAt: Date;
};

type CoordinationTraceOfficialFollowThroughInput = {
  id: string;
  meetingId: string;
  opportunityId?: string | null;
  companyId?: string | null;
  followThroughStatus: string;
  followThroughResolutionStatus: string;
  followThroughOwnerName?: string | null;
  followThroughNextAction?: string | null;
  followThroughSummary?: string | null;
  updatedAt: Date;
};

type CoordinationTraceBridgeItem = {
  id: string;
  title: string;
  posture: string;
  summary: string;
  linkageSummary: string;
  humanExecutionSummary: string | null;
  officialFollowThroughSummary: string | null;
  driSummary: string | null;
  updatedAt: Date;
};

export type CoordinationTraceBridge = {
  summary: string;
  boundaryNote: string;
  humanExecution: {
    total: number;
    ready: number;
    executed: number;
    blocked: number;
    deferred: number;
  };
  officialFollowThrough: {
    total: number;
    open: number;
    unresolved: number;
    resolved: number;
  };
  items: CoordinationTraceBridgeItem[];
};

const COORDINATION_TRACE_BOUNDARY_NOTE =
  "This bridge only makes downstream posture visible. It does not auto-execute, does not auto-send, does not broaden official write authority, and does not claim one-to-one causality beyond the visible meeting / opportunity trace.";

function matchesCoordinationTraceContext(
  problemSpace: CoordinationTraceProblemInput,
  candidate: {
    meetingId?: string | null;
    opportunityId?: string | null;
    companyId?: string | null;
  },
) {
  if (!problemSpace.meetingId || problemSpace.meetingId !== candidate.meetingId) return false;
  if (problemSpace.opportunityId && candidate.opportunityId && problemSpace.opportunityId !== candidate.opportunityId) return false;
  if (problemSpace.companyId && candidate.companyId && problemSpace.companyId !== candidate.companyId) return false;
  return true;
}

function buildHumanExecutionCounts(items: CoordinationTraceHumanExecutionInput[]) {
  return {
    total: items.length,
    ready: items.filter((item) => item.status === "READY").length,
    executed: items.filter((item) => item.status === "EXECUTED").length,
    blocked: items.filter((item) => item.status === "BLOCKED").length,
    deferred: items.filter((item) => item.status === "DEFERRED").length,
  };
}

function buildOfficialFollowThroughCounts(items: CoordinationTraceOfficialFollowThroughInput[]) {
  return {
    total: items.length,
    open: items.filter((item) =>
      ["OPEN", "INVESTIGATING", "AWAITING_MANUAL_ACTION", "AWAITING_EXTERNAL_RECEIPT", "RECONCILED"].includes(
        item.followThroughStatus,
      ),
    ).length,
    unresolved: items.filter(
      (item) => !["RESOLVED", "CLOSED_NO_CHANGE", "BLOCKED"].includes(item.followThroughResolutionStatus),
    ).length,
    resolved: items.filter((item) => ["RESOLVED", "CLOSED_NO_CHANGE"].includes(item.followThroughResolutionStatus)).length,
  };
}

function buildCoordinationTraceLinkageSummary(input: {
  hasOpportunityScopedTrace: boolean;
}) {
  return input.hasOpportunityScopedTrace
    ? "Aligned by meeting and opportunity context. This is a downstream trace bridge, not exact per-problem execution proof."
    : "Aligned by meeting context only. This keeps downstream posture visible, but it does not prove a one-to-one execution mapping for this problem space.";
}

function buildHumanExecutionSummary(input: ReturnType<typeof buildHumanExecutionCounts>) {
  if (input.total === 0) return null;
  return trimText(
    `Human execution: ${input.ready} ready, ${input.executed} executed, ${input.blocked} blocked, ${input.deferred} deferred.`,
    160,
  );
}

function buildOfficialFollowThroughSummary(input: ReturnType<typeof buildOfficialFollowThroughCounts>) {
  if (input.total === 0) return null;
  return trimText(
    `Official follow-through: ${input.open} open, ${input.unresolved} unresolved, ${input.resolved} resolved.`,
    160,
  );
}

function deriveCoordinationTracePosture(input: {
  coordinationOutcome: HelmV21CoordinationOutcome;
  humanExecution: ReturnType<typeof buildHumanExecutionCounts>;
  officialFollowThrough: ReturnType<typeof buildOfficialFollowThroughCounts>;
}) {
  if (input.officialFollowThrough.resolved > 0) return "FOLLOW_THROUGH_RESOLVED";
  if (input.officialFollowThrough.total > 0) return "FOLLOW_THROUGH_OPEN";
  if (input.humanExecution.blocked > 0 && input.humanExecution.executed === 0 && input.humanExecution.ready === 0) {
    return "HUMAN_BLOCKED";
  }
  if (input.humanExecution.executed > 0 || input.humanExecution.ready > 0) return "HUMAN_IN_PROGRESS";
  if (input.humanExecution.deferred > 0) return "HUMAN_DEFERRED";
  switch (input.coordinationOutcome) {
    case "waiting_on_signal":
      return "WAITING_ON_SIGNAL";
    case "waiting_on_authority":
      return "WAITING_ON_AUTHORITY";
    case "capability_gap":
      return "CAPABILITY_GAP";
    case "review_needed":
      return "REVIEW_NEEDED";
    case "action_ready":
    default:
      return "ACTION_READY";
  }
}

function buildCoordinationTracePostureSummary(input: {
  posture: string;
  humanExecution: ReturnType<typeof buildHumanExecutionCounts>;
  officialFollowThrough: ReturnType<typeof buildOfficialFollowThroughCounts>;
}) {
  switch (input.posture) {
    case "FOLLOW_THROUGH_RESOLVED":
      return "Official follow-through has reached a resolved posture on this same operating thread. That still does not, by itself, claim official write success.";
    case "FOLLOW_THROUGH_OPEN":
      return "Official follow-through is active on this same operating thread. Treat it as post-write handling, not automatic official success.";
    case "HUMAN_BLOCKED":
      return "Human execution exists on this same operating thread, but prerequisites or boundary posture still block completion.";
    case "HUMAN_IN_PROGRESS":
      return "Human execution is already moving on this same operating thread. Treat that as manual progress, not official write success.";
    case "HUMAN_DEFERRED":
      return "Human execution exists on this same operating thread, but it is still deferred and has not safely advanced.";
    case "WAITING_ON_SIGNAL":
      return "Truth is still weak or conflicted, so the chain remains blocked before downstream execution.";
    case "WAITING_ON_AUTHORITY":
      return "Signals are grounded enough to coordinate, but authority or boundary review still blocks downstream execution.";
    case "CAPABILITY_GAP":
      return "A capability gap still blocks safe follow-through for this chain.";
    case "REVIEW_NEEDED":
      return "This chain remains in review posture before any downstream execution trace should be treated as actionable.";
    case "ACTION_READY":
    default:
      return "Verified coordination is action-ready, but no downstream human execution or official follow-through trace is visible yet.";
  }
}

export function buildCoordinationTraceBridge(input: {
  problemSpaces: CoordinationTraceProblemInput[];
  humanExecutions: CoordinationTraceHumanExecutionInput[];
  officialFollowThrough: CoordinationTraceOfficialFollowThroughInput[];
}): CoordinationTraceBridge {
  const workspaceHumanExecution = buildHumanExecutionCounts(input.humanExecutions);
  const workspaceOfficialFollowThrough = buildOfficialFollowThroughCounts(input.officialFollowThrough);

  const items = input.problemSpaces
    .map<CoordinationTraceBridgeItem>((problemSpace) => {
      const relatedHumanExecutions = input.humanExecutions.filter((item) => matchesCoordinationTraceContext(problemSpace, item));
      const relatedOfficialFollowThrough = input.officialFollowThrough.filter((item) =>
        matchesCoordinationTraceContext(problemSpace, item),
      );
      const humanExecution = buildHumanExecutionCounts(relatedHumanExecutions);
      const officialFollowThrough = buildOfficialFollowThroughCounts(relatedOfficialFollowThrough);
      const hasOpportunityScopedTrace = Boolean(problemSpace.opportunityId) &&
        (relatedHumanExecutions.some((item) => item.opportunityId === problemSpace.opportunityId) ||
          relatedOfficialFollowThrough.some((item) => item.opportunityId === problemSpace.opportunityId));
      const coordinationOutcome = mapProblemSpaceStatusToCoordinationOutcome(problemSpace.status);
      const posture = deriveCoordinationTracePosture({
        coordinationOutcome,
        humanExecution,
        officialFollowThrough,
      });
      const latestAssignment = problemSpace.driAssignments[0] ?? null;

      return {
        id: problemSpace.id,
        title: problemSpace.title,
        posture,
        summary: buildCoordinationTracePostureSummary({
          posture,
          humanExecution,
          officialFollowThrough,
        }),
        linkageSummary: buildCoordinationTraceLinkageSummary({
          hasOpportunityScopedTrace,
        }),
        humanExecutionSummary: buildHumanExecutionSummary(humanExecution),
        officialFollowThroughSummary: buildOfficialFollowThroughSummary(officialFollowThrough),
        driSummary: latestAssignment
          ? buildProblemSpaceDriSummary({
              assignedUserName: latestAssignment.assignedUserName ?? problemSpace.ownerHint,
              assignedByName: latestAssignment.assignedByName,
              assignmentNote: latestAssignment.note,
              coordinationOutcome,
            })
          : null,
        updatedAt: [
          problemSpace.updatedAt,
          ...relatedHumanExecutions.map((item) => item.updatedAt),
          ...relatedOfficialFollowThrough.map((item) => item.updatedAt),
        ].sort((left, right) => right.getTime() - left.getTime())[0] ?? problemSpace.updatedAt,
      };
    })
    .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());

  const summary = items.length
    ? trimText(
        `${items.length} traced coordination item(s). ${workspaceHumanExecution.total} human execution item(s) and ${workspaceOfficialFollowThrough.total} official follow-through item(s) are visible on the same meeting / opportunity thread. This remains operator trace only.`,
        240,
      )
    : "No verified coordination trace is visible yet. A confirmed problem space must exist before Helm shows a cross-layer trace bridge.";

  return {
    summary,
    boundaryNote: COORDINATION_TRACE_BOUNDARY_NOTE,
    humanExecution: workspaceHumanExecution,
    officialFollowThrough: workspaceOfficialFollowThrough,
    items,
  };
}
