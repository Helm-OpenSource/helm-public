import type { CapabilityDecisionOperatorReadout } from "@/lib/capability-decision-trace";
import type {
  TenantResourceOperatingImpactItem,
  TenantResourceOperatingImpactSeverity,
} from "@/lib/tenant-resources/operating-impact";
import type { TenantResourceGovernedLoop } from "@/lib/tenant-resources/governed-loop";
import type {
  TenantResourceEvidenceDetail,
  TenantResourceEvidenceFreshnessPosture,
} from "@/lib/tenant-resources/evidence-detail";
import type { TenantResourceManualProofLifecycle } from "@/lib/tenant-resources/manual-proof-lifecycle";
import type {
  TenantResourceReadiness,
  TenantResourceSourceKind,
} from "@/lib/tenant-resources/readiness";

export function formatTenantResourceImpactSummary(
  item: TenantResourceOperatingImpactItem,
  english: boolean,
) {
  if (item.followThroughStatus === "blocked") {
    return english
      ? `${item.resourceName} is blocked by capability or boundary controls; clear the blocker before using it for operating guidance.`
      : `${item.resourceName} 当前被权限或边界阻断，先处理阻断原因，再让它影响经营判断。`;
  }
  if (item.followThroughStatus === "stale_or_failed") {
    return english
      ? `${item.resourceName} needs a freshness check before it can steer today's operating move.`
      : `${item.resourceName} 的证据需要先刷新，复核通过后再用于今日判断。`;
  }
  if (item.followThroughStatus === "route_to_review") {
    return english
      ? `${item.resourceName} should enter resource review before the next operating action uses it.`
      : `${item.resourceName} 需要先进入资源复核，再进入下一步经营动作。`;
  }

  return english
    ? `${item.resourceName} can support the current judgement; follow-through still needs manual proof and does not write back externally.`
    : `${item.resourceName} 可用于当前判断；后续仍需补充人工凭证，不会外部写回。`;
}

export function formatTenantResourceImpactSeverity(
  severity: TenantResourceOperatingImpactSeverity,
  english: boolean,
) {
  if (english) {
    const labels: Record<TenantResourceOperatingImpactSeverity, string> = {
      critical: "Blocked",
      high: "High risk",
      medium: "Needs attention",
      low: "Usable",
    };
    return labels[severity];
  }

  const labels: Record<TenantResourceOperatingImpactSeverity, string> = {
    critical: "阻断",
    high: "高风险",
    medium: "需关注",
    low: "可用",
  };

  return labels[severity];
}

export function formatTenantResourceDecision(
  decision: CapabilityDecisionOperatorReadout["decision"],
  english: boolean,
) {
  const labels: Record<
    CapabilityDecisionOperatorReadout["decision"],
    { en: string; zh: string }
  > = {
    allow: { en: "Allowed for judgement", zh: "可用于判断" },
    allow_draft_only: { en: "Draft only", zh: "仅可生成草稿" },
    route_to_review: { en: "Needs resource review", zh: "需资源复核" },
    ask_human: { en: "Needs human confirmation", zh: "需人工确认" },
    deny: { en: "Blocked", zh: "已阻断" },
  };

  return english ? labels[decision].en : labels[decision].zh;
}

export function formatTenantResourceReason(
  reason: CapabilityDecisionOperatorReadout["primaryReasonCode"],
  english: boolean,
) {
  const labels: Record<
    CapabilityDecisionOperatorReadout["primaryReasonCode"],
    { en: string; zh: string }
  > = {
    allowed: { en: "Resource and permission checks passed", zh: "资源与权限检查通过" },
    workspace_missing: { en: "Workspace context is missing", zh: "缺少工作区上下文" },
    membership_missing: { en: "Membership is missing", zh: "缺少成员身份" },
    capability_not_granted: { en: "Capability is not granted", zh: "权限尚未授予" },
    ownership_mismatch: { en: "Workspace ownership does not match", zh: "工作区归属不匹配" },
    reserved_only: { en: "Reserved workspace only", zh: "仅限保留工作区" },
    capability_not_declared: { en: "Capability is not declared", zh: "能力尚未声明" },
    effect_mode_exceeded: { en: "Requested effect exceeds policy", zh: "请求动作超出策略范围" },
    customer_facing_review_required: {
      en: "Customer-facing action needs review",
      zh: "面向客户动作需要复核",
    },
    hard_boundary_blocked: { en: "Hard boundary blocked it", zh: "硬边界已阻断" },
    manual_ack_required: { en: "Manual acknowledgement is required", zh: "需要人工确认" },
    resource_not_actionable: { en: "Resource is not actionable yet", zh: "资源尚不可直接使用" },
    resource_freshness_unknown: { en: "Resource freshness is unknown", zh: "资源新鲜度未知" },
    resource_review_required: { en: "Resource review is required", zh: "需要资源复核" },
    resource_effect_mode_exceeded: {
      en: "Resource effect mode is too broad",
      zh: "资源动作范围过宽",
    },
    unsupported_runtime_posture: {
      en: "Runtime posture is unsupported",
      zh: "当前运行姿态不支持",
    },
  };

  return english ? labels[reason].en : labels[reason].zh;
}

export function formatTenantResourceNextActionMode(
  mode: TenantResourceGovernedLoop["nextAction"]["mode"],
  english: boolean,
) {
  const labels: Record<
    TenantResourceGovernedLoop["nextAction"]["mode"],
    { en: string; zh: string }
  > = {
    manual_execution_proof: { en: "Manual proof", zh: "人工凭证" },
    draft_only: { en: "Draft only", zh: "只生成草稿" },
    review_queue: { en: "Review queue", zh: "进入复核队列" },
    blocked: { en: "Blocked", zh: "已阻断" },
  };

  return english ? labels[mode].en : labels[mode].zh;
}

export function formatTenantResourceSourceKind(
  sourceKind: TenantResourceSourceKind | string,
  english: boolean,
) {
  const labels: Record<TenantResourceSourceKind, { en: string; zh: string }> = {
    connector: { en: "Connector", zh: "连接器" },
    import_source: { en: "Import source", zh: "导入来源" },
    workspace_solution_extension: { en: "Workspace extension", zh: "工作区扩展" },
    capture_session: { en: "Capture session", zh: "记录会话" },
    connector_ingestion: { en: "Connector ingestion", zh: "连接器采集" },
    official_write_intent: { en: "Official write intent", zh: "正式写回意图" },
  };
  const label = labels[sourceKind as TenantResourceSourceKind];
  if (label) return english ? label.en : label.zh;

  return sourceKind.replaceAll("_", " ");
}

export function formatTenantResourceEvidenceToken(value: string, english: boolean) {
  const labels: Record<string, { en: string; zh: string }> = {
    fresh: { en: "Fresh", zh: "新鲜" },
    stale: { en: "Stale", zh: "已过期" },
    session_scoped: { en: "Session scoped", zh: "会话范围" },
    manifest_declared: { en: "Manifest declared", zh: "清单声明" },
    unknown: { en: "Unknown", zh: "未知" },
    low: { en: "Low", zh: "低" },
    medium: { en: "Medium", zh: "中" },
    declared: { en: "Declared", zh: "已声明" },
    human_confirmed: { en: "Human confirmed", zh: "人工确认" },
    system_of_record: { en: "System of record", zh: "权威系统" },
    not_required: { en: "Not required", zh: "不需要" },
    awaiting_submission: { en: "Awaiting submission", zh: "待提交" },
    submitted: { en: "Submitted", zh: "已提交" },
    under_review: { en: "Under review", zh: "复核中" },
    accepted: { en: "Accepted", zh: "已接受" },
    rejected: { en: "Rejected", zh: "已拒绝" },
    withdrawn: { en: "Withdrawn", zh: "已撤回" },
    expired: { en: "Expired", zh: "已过期" },
    blocked: { en: "Blocked", zh: "已阻断" },
    clear: { en: "Clear", zh: "清晰" },
    has_explainable_gaps: { en: "Explainable gaps", zh: "有可解释缺口" },
    downgraded: { en: "Downgraded", zh: "已降级" },
    adopted_for_governed_loop: { en: "Adopted for governed loop", zh: "已纳入治理循环" },
    review_required: { en: "Review required", zh: "需要复核" },
    validation_pending: { en: "Validation pending", zh: "待验证" },
    validation_failed: { en: "Validation failed", zh: "验证失败" },
  };
  const label = labels[value];
  if (label) return english ? label.en : label.zh;

  return value.replaceAll("_", " ");
}

export function formatTenantResourceDecisionWhy(
  detail: TenantResourceEvidenceDetail,
  english: boolean,
) {
  if (english) {
    if (detail.status === "blocked") {
      return "Capability or boundary controls blocked this resource from steering the current action.";
    }
    if (detail.status === "needs_review") {
      return "The resource needs review before it can steer the current action.";
    }
    return "Resource posture and capability checks passed for read-only judgement.";
  }

  if (detail.status === "blocked") {
    return "权限或边界已阻断，当前不能用这个资源推动下一步动作。";
  }
  if (detail.timing.freshnessPosture === "stale") {
    return "资源证据已过期或新鲜度未知，需要先刷新或复核。";
  }
  if (detail.status === "needs_review") {
    return "资源姿态仍需复核，先进入复核队列，不直接影响当前动作。";
  }

  return "资源姿态和权限链通过，可用于只读判断或人工凭证。";
}

export function formatTenantResourceMappingDowngrade(
  detail: TenantResourceEvidenceDetail,
  english: boolean,
) {
  if (english) {
    return "Field mapping gaps downgraded this resource until the missing evidence is reviewed.";
  }

  return "字段映射仍有缺口，需要先补齐或复核证据，再提升判断权重。";
}

export function formatTenantResourceProofFollowThrough(
  lifecycle: TenantResourceManualProofLifecycle,
  english: boolean,
) {
  if (english) {
    const labels: Record<TenantResourceManualProofLifecycle["followThrough"]["result"], string> = {
      continue_without_proof: "Continue without manual proof while keeping evidence attached.",
      await_proof: "Submit manual proof before follow-through can close.",
      review_proof: "Review the submitted proof before closing this action.",
      learn_from_accepted_proof: "Use the accepted proof as closure evidence.",
      repair_or_retry: "Repair or retry proof before closing follow-through.",
      stop_blocked: "Stop until the blocking reason is cleared.",
    };
    return labels[lifecycle.followThrough.result];
  }

  const labels: Record<TenantResourceManualProofLifecycle["followThrough"]["result"], string> = {
    continue_without_proof: "无需人工凭证，继续保留证据即可。",
    await_proof: "需要先提交人工凭证，才能关闭后续动作。",
    review_proof: "已提交凭证，需复核后再关闭动作。",
    learn_from_accepted_proof: "可把已接受凭证作为闭环证据。",
    repair_or_retry: "凭证需要修复或重试后才能关闭。",
    stop_blocked: "阻断原因未清除前停止推进。",
  };
  return labels[lifecycle.followThrough.result];
}

export function formatTenantResourceObjectType(
  objectType: string,
  english: boolean,
) {
  const normalized = objectType.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
  return formatTenantResourceSourceKind(normalized, english);
}

export function formatTenantResourceReadinessStatus(
  status: TenantResourceReadiness["status"],
  english: boolean,
) {
  const labels: Record<TenantResourceReadiness["status"], { en: string; zh: string }> = {
    registered: { en: "Registered", zh: "已登记" },
    configured: { en: "Configured", zh: "已配置" },
    connected: { en: "Connected", zh: "已连接" },
    readable: { en: "Readable", zh: "可读取" },
    mapped: { en: "Mapped", zh: "已映射" },
    governed: { en: "Governed", zh: "已纳管" },
    actionable: { en: "Actionable", zh: "可用于判断" },
    write_intent_enabled: { en: "Write intent enabled", zh: "已开启写回意图" },
    paused: { en: "Paused", zh: "已暂停" },
    error: { en: "Error", zh: "异常" },
    revoked: { en: "Revoked", zh: "已撤销" },
  };

  return english ? labels[status].en : labels[status].zh;
}

export function formatTenantResourceFreshnessPosture(
  posture: TenantResourceEvidenceFreshnessPosture,
  english: boolean,
) {
  return formatTenantResourceEvidenceToken(posture, english);
}
