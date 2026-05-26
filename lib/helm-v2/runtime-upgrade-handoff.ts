import type {
  HelmV21HandoffPacket,
  HelmV2AgentId,
  HelmV2ApprovalTier,
} from "@/lib/helm-v2/contracts";

export function buildMetricDate(value = new Date()) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

export function buildRuntimeHandoffPacketContract(input: {
  handoffId: string;
  packetKey: string;
  fromAgent: HelmV2AgentId;
  toAgent: HelmV2AgentId;
  goal: string;
  objectRefs: {
    workspaceId: string;
    meetingId?: string | null;
    opportunityId?: string | null;
    customerId?: string | null;
  };
  constraints: string[];
  trustedRefs: string[];
  untrustedRefs: string[];
  requiredOutputs: string[];
  evidenceRefs: string[];
  notebookRef?: string | null;
  checkpointRef?: string | null;
  approvalTier: HelmV2ApprovalTier;
}): HelmV21HandoffPacket {
  return {
    handoffId: input.handoffId,
    fromAgent: input.fromAgent,
    toAgent: input.toAgent,
    goal: input.goal,
    objectRefs: {
      workspaceId: input.objectRefs.workspaceId,
      meetingId: input.objectRefs.meetingId ?? null,
      opportunityId: input.objectRefs.opportunityId ?? null,
      customerId: input.objectRefs.customerId ?? null,
      handoffId: input.handoffId,
    },
    constraints: input.constraints,
    trustBoundary: {
      trusted: input.trustedRefs,
      untrusted: input.untrustedRefs,
    },
    requiredOutputs: input.requiredOutputs,
    evidenceRefs: input.evidenceRefs,
    notebookRef: input.notebookRef ?? null,
    checkpointRef: input.checkpointRef ?? null,
    approvalTier: input.approvalTier,
  };
}

export function normalizeRuntimeAgentId(value: string): HelmV2AgentId {
  switch (value) {
    case "lead-orchestrator":
    case "meeting-analyst":
    case "opportunity-judge":
    case "proposal-composer":
    case "comms-scheduler":
    case "risk-promise-guard":
    case "handoff-manager":
    case "verification-agent":
    case "swarm-search-worker":
    case "swarm-grep-worker":
    case "swarm-evidence-miner":
      return value;
    default:
      return "lead-orchestrator";
  }
}

export function normalizeRuntimeApprovalTier(value: string): HelmV2ApprovalTier {
  return value === "A0" || value === "A1" || value === "A2" || value === "A3" || value === "A4" ? value : "A1";
}

export function mapRuntimeHandoffPacketState<
  T extends { fromAgent: string; toAgent: string; approvalTier: string },
>(
  input: T,
): Omit<T, "fromAgent" | "toAgent" | "approvalTier"> & {
  fromAgent: HelmV2AgentId;
  toAgent: HelmV2AgentId;
  approvalTier: HelmV2ApprovalTier;
} {
  return {
    ...input,
    fromAgent: normalizeRuntimeAgentId(input.fromAgent),
    toAgent: normalizeRuntimeAgentId(input.toAgent),
    approvalTier: normalizeRuntimeApprovalTier(input.approvalTier),
  };
}

export function mapRunThreadLifecycleHandoffPacket<
  T extends {
    id: string;
    packetKey: string;
    fromAgent: string;
    toAgent: string;
    goal: string;
    approvalTier: string;
    checkpointRef?: string | null;
    createdAt: Date;
  },
>(input: T) {
  return {
    id: input.id,
    packetKey: input.packetKey,
    fromAgent: normalizeRuntimeAgentId(input.fromAgent),
    toAgent: normalizeRuntimeAgentId(input.toAgent),
    goal: input.goal,
    approvalTier: normalizeRuntimeApprovalTier(input.approvalTier),
    checkpointRef: input.checkpointRef ?? null,
    createdAt: input.createdAt,
  };
}

export function mapRunThreadLifecycleRemediationEntry<
  T extends {
    id: string;
    action: string;
    executionStatus: string;
    summary: string;
    rollbackAnchorSummary: string | null;
    triggeredBy: string | null;
    createdAt: Date;
  },
>(input: T) {
  return {
    id: input.id,
    action: input.action,
    executionStatus: input.executionStatus,
    summary: input.summary,
    rollbackAnchorSummary: input.rollbackAnchorSummary,
    triggeredBy: input.triggeredBy,
    createdAt: input.createdAt,
  };
}
