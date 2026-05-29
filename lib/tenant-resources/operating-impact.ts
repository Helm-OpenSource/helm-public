import { WORKSPACE_CAPABILITIES, type WorkspaceCapability } from "@/lib/auth/authorization";
import type { CapabilityDecisionOperatorReadout } from "@/lib/capability-decision-trace";
import {
  buildTenantResourceGovernedLoop,
  type TenantResourceGovernedLoop,
} from "@/lib/tenant-resources/governed-loop";
import {
  buildTenantResourceEvidenceDetail,
  type TenantResourceEvidenceDetail,
} from "@/lib/tenant-resources/evidence-detail";
import type { TenantExtensionResourceAdoptionReadout } from "@/lib/tenant-resources/extension-adoption";
import type { TenantResourceManualProofRecordInput } from "@/lib/tenant-resources/manual-proof-lifecycle";
import type {
  TenantResourceEffectMode,
  TenantResourceReadiness,
  TenantResourceReadinessReason,
  TenantResourceReadinessSummary,
  TenantResourceSourceKind,
} from "@/lib/tenant-resources/readiness";
import type { WorkspaceClass, WorkspaceRole } from "@prisma/client";

export type TenantResourceOperatingImpactSeverity = "critical" | "high" | "medium" | "low";

export type TenantResourceOperatingImpactItem = {
  resourceKey: string;
  resourceName: string;
  provider: string;
  sourceKind: TenantResourceSourceKind;
  severity: TenantResourceOperatingImpactSeverity;
  primaryGap: TenantResourceReadinessReason | null;
  status: TenantResourceReadiness["status"];
  trustLevel: TenantResourceReadiness["governance"]["trustLevel"];
  mappingCompleteness: number;
  decision: CapabilityDecisionOperatorReadout["decision"];
  primaryReasonCode: CapabilityDecisionOperatorReadout["primaryReasonCode"];
  fallbackType: CapabilityDecisionOperatorReadout["fallbackType"];
  nextActionMode: TenantResourceGovernedLoop["nextAction"]["mode"];
  nextActionTitle: string;
  followThroughStatus: TenantResourceGovernedLoop["followThrough"]["status"];
  proofRequired: boolean;
  summary: string;
  operatorNextMove: string;
  evidenceRefs: string[];
  evidenceDetail: TenantResourceEvidenceDetail;
  boundaryNotes: string[];
  href: string;
};

export type TenantResourceOperatingImpactReadout = {
  generatedAt: string;
  totalResources: number;
  actionableResourceCount: number;
  reviewQueueResourceCount: number;
  blockedResourceCount: number;
  manualProofResourceCount: number;
  primaryImpact: TenantResourceOperatingImpactItem | null;
  impactItems: TenantResourceOperatingImpactItem[];
  dashboardSummary: string;
  operatingSummary: string;
  boundaryNotes: string[];
};

export type BuildTenantResourceOperatingImpactReadoutInput = {
  english: boolean;
  readiness: TenantResourceReadinessSummary;
  extensionAdoptionReadouts?: TenantExtensionResourceAdoptionReadout[];
  manualProofRecords?: TenantResourceManualProofRecordInput[];
  actorUserId?: string | null;
  activeWorkspaceId: string | null;
  workspaceClass?: WorkspaceClass | null;
  membershipRole?: WorkspaceRole | null;
  now?: Date;
  maxItems?: number;
};

export function buildTenantResourceOperatingImpactReadout(
  input: BuildTenantResourceOperatingImpactReadoutInput,
): TenantResourceOperatingImpactReadout {
  const maxItems = input.maxItems ?? 4;
  const extensionAdoptionByResourceKey = new Map(
    (input.extensionAdoptionReadouts ?? []).map((readout) => [readout.resourceKey, readout]),
  );
  const loops = input.readiness.resources.map((resource) => ({
    resource,
    loop: buildTenantResourceGovernedLoop({
      now: input.now ?? new Date(input.readiness.generatedAt),
      actorUserId: input.actorUserId,
      activeWorkspaceId: input.activeWorkspaceId,
      workspaceClass: input.workspaceClass,
      membershipRole: input.membershipRole,
      requiredCapability: requiredCapabilityForTenantResource(resource),
      resource,
      requestedEffectMode: pickOperatingImpactEffectMode(resource),
      signal: {
        signalId: `tenant-resource-impact:${resource.resourceKey}`,
        title: input.english
          ? `${resource.resourceName} operating impact`
          : `${resource.resourceName} 经营影响`,
        objectType: "TenantResource",
        objectRef: resource.resourceKey,
        summary: buildResourceSignalSummary(resource, input.english),
        evidenceRefs: resource.evidenceRefs,
      },
    }),
  }));
  const impactItems = loops
    .map(({ loop, resource }) =>
      toOperatingImpactItem(
        loop,
        resource,
        input.english,
        input.manualProofRecords ?? [],
        extensionAdoptionByResourceKey.get(resource.resourceKey) ?? null,
      ),
    )
    .sort(compareImpactItems)
    .slice(0, maxItems);
  const reviewQueueResourceCount = loops.filter((loop) =>
    ["route_to_review", "stale_or_failed"].includes(loop.loop.followThrough.status),
  ).length;
  const blockedResourceCount = loops.filter(
    (loop) => loop.loop.followThrough.status === "blocked",
  ).length;
  const manualProofResourceCount = loops.filter(
    (loop) => loop.loop.nextAction.mode === "manual_execution_proof",
  ).length;
  const primaryImpact = impactItems[0] ?? null;

  return {
    generatedAt: input.readiness.generatedAt,
    totalResources: input.readiness.totalResources,
    actionableResourceCount: input.readiness.actionableResourceKeys.length,
    reviewQueueResourceCount,
    blockedResourceCount,
    manualProofResourceCount,
    primaryImpact,
    impactItems,
    dashboardSummary: buildDashboardSummary({
      english: input.english,
      totalResources: input.readiness.totalResources,
      reviewQueueResourceCount,
      blockedResourceCount,
      manualProofResourceCount,
      primaryImpact,
    }),
    operatingSummary: buildOperatingSummary({
      english: input.english,
      totalResources: input.readiness.totalResources,
      actionableResourceCount: input.readiness.actionableResourceKeys.length,
      reviewQueueResourceCount,
      blockedResourceCount,
      manualProofResourceCount,
      primaryImpact,
    }),
    boundaryNotes: [
      input.english
        ? "Resource impact readout is read-only and does not create external write authority."
        : "资源影响读数只读，不创建外部写回权限。",
      input.english
        ? "Next actions stay draft, manual proof or review queue until separate guarded-write evaluation exists."
        : "下一步动作仍停在草稿、人工凭证或复核队列，除非另行完成受控写回评估。",
      ...input.readiness.boundaryNotes,
    ],
  };
}

export function requiredCapabilityForTenantResource(
  resource: TenantResourceReadiness,
): WorkspaceCapability | null {
  if (resource.source.sourceKind === "connector") {
    return WORKSPACE_CAPABILITIES.MANAGE_CONNECTORS;
  }
  if (resource.source.sourceKind === "import_source") {
    return WORKSPACE_CAPABILITIES.MANAGE_IMPORTS;
  }
  if (resource.source.sourceKind === "capture_session") {
    return WORKSPACE_CAPABILITIES.MANAGE_CAPTURE_SESSIONS;
  }
  if (resource.source.sourceKind === "workspace_solution_extension") {
    return WORKSPACE_CAPABILITIES.REVIEW_GOVERNED_ACTIONS;
  }

  return null;
}

function pickOperatingImpactEffectMode(
  resource: TenantResourceReadiness,
): TenantResourceEffectMode {
  if (resource.governance.allowedEffectModes.includes("manual_execution")) {
    return "manual_execution";
  }

  return resource.governance.allowedEffectModes.at(-1) ?? "read_only";
}

function toOperatingImpactItem(
  loop: TenantResourceGovernedLoop,
  resource: TenantResourceReadiness,
  english: boolean,
  manualProofRecords: TenantResourceManualProofRecordInput[],
  extensionAdoptionReadout: TenantExtensionResourceAdoptionReadout | null,
): TenantResourceOperatingImpactItem {
  const evidenceDetail = buildTenantResourceEvidenceDetail({
    resource,
    loop,
    manualProofRecords,
    extensionAdoptionReadout,
  });

  return {
    resourceKey: loop.resourceIdentity,
    resourceName: resource.resourceName,
    provider: resource.provider,
    sourceKind: resource.source.sourceKind,
    severity: resolveImpactSeverity(loop),
    primaryGap: loop.sourcePosture.primaryGap,
    status: loop.sourcePosture.status,
    trustLevel: loop.sourcePosture.trustLevel,
    mappingCompleteness: resource.mapping.mappingCompleteness,
    decision: loop.capabilityReadout.decision,
    primaryReasonCode: loop.capabilityReadout.primaryReasonCode,
    fallbackType: loop.capabilityReadout.fallbackType,
    nextActionMode: loop.nextAction.mode,
    nextActionTitle: loop.nextAction.title,
    followThroughStatus: loop.followThrough.status,
    proofRequired: loop.followThrough.proofRequired,
    summary: localizeLoopSummary(loop, english),
    operatorNextMove: loop.summaries.handoff,
    evidenceRefs: loop.nextAction.evidenceRefs,
    evidenceDetail,
    boundaryNotes: loop.nextAction.boundaryNotes,
    href: evidenceDetail.ui.settingsHref,
  };
}

function resolveImpactSeverity(
  loop: TenantResourceGovernedLoop,
): TenantResourceOperatingImpactSeverity {
  if (loop.followThrough.status === "blocked") return "critical";
  if (loop.followThrough.status === "stale_or_failed") return "high";
  if (loop.followThrough.status === "route_to_review") return "high";
  if (loop.sourcePosture.primaryGap) return "medium";
  return "low";
}

function compareImpactItems(
  left: TenantResourceOperatingImpactItem,
  right: TenantResourceOperatingImpactItem,
) {
  const severityRank: Record<TenantResourceOperatingImpactSeverity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  return (
    severityRank[left.severity] - severityRank[right.severity] ||
    left.resourceKey.localeCompare(right.resourceKey)
  );
}

function buildResourceSignalSummary(
  resource: TenantResourceReadiness,
  english: boolean,
) {
  if (resource.readiness.primaryGap) {
    return english
      ? `${resource.resourceName} has ${resource.readiness.primaryGap}, so Helm should downgrade the operating move before using it for current judgement.`
      : `${resource.resourceName} 存在 ${resource.readiness.primaryGap}，用于当前判断前需要先降级处理。`;
  }

  return english
    ? `${resource.resourceName} is available for bounded operating judgement with evidence and no external write.`
    : `${resource.resourceName} 可用于带证据的受限经营判断，但不会外部写回。`;
}

function buildDashboardSummary(input: {
  english: boolean;
  totalResources: number;
  reviewQueueResourceCount: number;
  blockedResourceCount: number;
  manualProofResourceCount: number;
  primaryImpact: TenantResourceOperatingImpactItem | null;
}) {
  if (input.totalResources === 0) {
    return input.english
      ? "No tenant resources are ready to influence today’s operating judgement yet."
      : "当前还没有可影响今日经营判断的租户资源。";
  }
  if (input.blockedResourceCount > 0 && input.primaryImpact) {
    const resourceName = input.primaryImpact.resourceName.includes(":")
      ? input.primaryImpact.provider || "客户资源"
      : input.primaryImpact.resourceName;
    return input.english
      ? `${resourceName} is blocking resource-backed judgement until permission or ownership is corrected.`
      : `${resourceName} 正在阻断资源驱动判断，需要先修正权限或归属。`;
  }
  if (input.reviewQueueResourceCount > 0) {
    return input.english
      ? `${input.reviewQueueResourceCount} tenant resources need review before they can shape today’s top move.`
      : `${input.reviewQueueResourceCount} 个租户资源需要复核后才能影响今日第一动作。`;
  }
  if (input.manualProofResourceCount > 0) {
    return input.english
      ? `${input.manualProofResourceCount} tenant resources can support manual execution proof without external write authority.`
      : `${input.manualProofResourceCount} 个租户资源可支持人工凭证，但不获得外部写回权限。`;
  }

  return input.english
    ? "Tenant resources are visible, but none should change today’s move order yet."
    : "租户资源已可见，但暂时不应改变今日推进顺序。";
}

function buildOperatingSummary(input: {
  english: boolean;
  totalResources: number;
  actionableResourceCount: number;
  reviewQueueResourceCount: number;
  blockedResourceCount: number;
  manualProofResourceCount: number;
  primaryImpact: TenantResourceOperatingImpactItem | null;
}) {
  if (input.totalResources === 0) {
    return input.english
      ? "Connect or import a real tenant resource before treating this surface as resource-backed."
      : "先接入或导入真实租户资源，再把这页视为资源驱动的经营面。";
  }
  if (input.primaryImpact?.followThroughStatus === "stale_or_failed") {
    return input.english
      ? "Refresh stale resource evidence before using it to steer operating follow-through."
      : "先刷新过期资源证据，再用它指导经营推进。";
  }
  if (input.blockedResourceCount > 0) {
    return input.english
      ? "A resource permission block is outranking normal operating guidance."
      : "资源权限阻断当前比普通经营建议更优先。";
  }

  return input.english
    ? `${input.actionableResourceCount} of ${input.totalResources} resources are actionable; ${input.manualProofResourceCount} can support manual proof and ${input.reviewQueueResourceCount} stay in review.`
    : `${input.totalResources} 个资源中 ${input.actionableResourceCount} 个可用；${input.manualProofResourceCount} 个可支持人工凭证，${input.reviewQueueResourceCount} 个仍在复核。`;
}

function localizeLoopSummary(loop: TenantResourceGovernedLoop, english: boolean) {
  const statusLabel = formatFollowThroughStatus(loop.followThrough.status, english);
  const modeLabel = formatNextActionMode(loop.nextAction.mode, english);
  const reasonLabel = formatCapabilityReason(
    loop.capabilityReadout.primaryReasonCode,
    english,
  );

  if (english) {
    return `${statusLabel}: ${modeLabel}; ${reasonLabel}.`;
  }

  return `${statusLabel}：${modeLabel}；${reasonLabel}。`;
}

function formatFollowThroughStatus(
  status: TenantResourceGovernedLoop["followThrough"]["status"],
  english: boolean,
) {
  const labels: Record<
    TenantResourceGovernedLoop["followThrough"]["status"],
    { en: string; zh: string }
  > = {
    ready_for_manual_proof: { en: "Ready for manual proof", zh: "可进入人工凭证" },
    route_to_review: { en: "Needs resource review", zh: "需资源复核" },
    blocked: { en: "Blocked", zh: "已阻断" },
    stale_or_failed: { en: "Needs freshness review", zh: "需刷新证据" },
  };

  return english ? labels[status].en : labels[status].zh;
}

function formatNextActionMode(
  mode: TenantResourceGovernedLoop["nextAction"]["mode"],
  english: boolean,
) {
  const labels: Record<
    TenantResourceGovernedLoop["nextAction"]["mode"],
    { en: string; zh: string }
  > = {
    manual_execution_proof: { en: "manual proof required", zh: "需要人工凭证" },
    draft_only: { en: "draft only", zh: "只生成草稿" },
    review_queue: { en: "send to review queue", zh: "进入复核队列" },
    blocked: { en: "do not act", zh: "停止动作" },
  };

  return english ? labels[mode].en : labels[mode].zh;
}

function formatCapabilityReason(
  reason: CapabilityDecisionOperatorReadout["primaryReasonCode"],
  english: boolean,
) {
  const labels: Record<
    CapabilityDecisionOperatorReadout["primaryReasonCode"],
    { en: string; zh: string }
  > = {
    allowed: { en: "resource and permission checks passed", zh: "资源与权限检查通过" },
    workspace_missing: { en: "workspace context is missing", zh: "缺少工作区上下文" },
    membership_missing: { en: "membership is missing", zh: "缺少成员身份" },
    capability_not_granted: { en: "capability is not granted", zh: "权限尚未授予" },
    ownership_mismatch: { en: "workspace ownership does not match", zh: "工作区归属不匹配" },
    reserved_only: { en: "reserved workspace only", zh: "仅限保留工作区" },
    capability_not_declared: { en: "capability is not declared", zh: "能力尚未声明" },
    effect_mode_exceeded: { en: "requested effect exceeds policy", zh: "请求动作超出策略范围" },
    customer_facing_review_required: {
      en: "customer-facing action needs review",
      zh: "面向客户动作需要复核",
    },
    hard_boundary_blocked: { en: "hard boundary blocked it", zh: "硬边界已阻断" },
    manual_ack_required: { en: "manual acknowledgement is required", zh: "需要人工确认" },
    resource_not_actionable: { en: "resource is not actionable yet", zh: "资源尚不可直接使用" },
    resource_freshness_unknown: { en: "resource freshness is unknown", zh: "资源新鲜度未知" },
    resource_review_required: { en: "resource review is required", zh: "需要资源复核" },
    resource_effect_mode_exceeded: {
      en: "resource effect mode is too broad",
      zh: "资源动作范围过宽",
    },
    unsupported_runtime_posture: {
      en: "runtime posture is unsupported",
      zh: "当前运行姿态不支持",
    },
  };

  return english ? labels[reason].en : labels[reason].zh;
}
