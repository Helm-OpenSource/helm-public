import type {
  TenantResourceEffectMode,
  TenantResourceReadiness,
  TenantResourceReadinessReason,
  TenantResourceReadinessStatus,
  TenantResourceTrustLevel,
} from "@/lib/tenant-resources/readiness";

const statusPriority: Record<TenantResourceReadinessStatus, number> = {
  error: 0,
  paused: 1,
  revoked: 2,
  actionable: 3,
  write_intent_enabled: 4,
  governed: 5,
  mapped: 6,
  readable: 7,
  connected: 8,
  configured: 9,
  registered: 10,
};

const statusLabels: Record<TenantResourceReadinessStatus, { zh: string; en: string }> = {
  registered: { zh: "已登记", en: "Registered" },
  configured: { zh: "已配置", en: "Configured" },
  connected: { zh: "已连接", en: "Connected" },
  readable: { zh: "可读取", en: "Readable" },
  mapped: { zh: "已映射", en: "Mapped" },
  governed: { zh: "已纳入治理", en: "Governed" },
  actionable: { zh: "可用于推进", en: "Actionable" },
  write_intent_enabled: { zh: "写意图待审", en: "Write intent" },
  paused: { zh: "已暂停", en: "Paused" },
  error: { zh: "异常", en: "Error" },
  revoked: { zh: "已撤销", en: "Revoked" },
};

const trustLabels: Record<TenantResourceTrustLevel, { zh: string; en: string }> = {
  unknown: { zh: "未知", en: "Unknown" },
  low: { zh: "低", en: "Low" },
  medium: { zh: "中", en: "Medium" },
  declared: { zh: "声明可信", en: "Declared" },
  human_confirmed: { zh: "人工确认", en: "Human confirmed" },
  system_of_record: { zh: "主记录系统", en: "System of record" },
};

const effectModeLabels: Record<TenantResourceEffectMode, { zh: string; en: string }> = {
  read_only: { zh: "只读", en: "Read-only" },
  draft_only: { zh: "仅草稿", en: "Draft-only" },
  internal_write: { zh: "内部写", en: "Internal write" },
  manual_execution: { zh: "人工执行", en: "Manual execution" },
  guarded_write_intent: { zh: "受控写意图", en: "Guarded write intent" },
};

const gapLabels: Record<TenantResourceReadinessReason, { zh: string; en: string }> = {
  ready: { zh: "已就绪", en: "Ready" },
  not_connected: { zh: "未连接", en: "Not connected" },
  connector_error: { zh: "连接器异常", en: "Connector error" },
  import_failed: { zh: "导入失败", en: "Import failed" },
  mapping_incomplete: { zh: "映射不完整", en: "Mapping incomplete" },
  manifest_missing: { zh: "Manifest 缺失", en: "Manifest missing" },
  review_required: { zh: "需要复核", en: "Review required" },
  resource_paused: { zh: "资源暂停", en: "Resource paused" },
  freshness_unknown: { zh: "新鲜度不足", en: "Freshness unknown" },
};

const evidenceTokenLabels: Record<string, { zh: string; en: string }> = {
  manual_capture: { zh: "人工记录", en: "Manual capture" },
  human_input: { zh: "人工录入", en: "Human input" },
  proof: { zh: "证据", en: "Proof" },
  crm: { zh: "客户关系系统", en: "CRM" },
  collaboration: { zh: "协作来源", en: "Collaboration" },
  hubspot: { zh: "HubSpot", en: "HubSpot" },
  salesforce: { zh: "Salesforce", en: "Salesforce" },
  gmail: { zh: "Gmail", en: "Gmail" },
  google_calendar: { zh: "Google Calendar", en: "Google Calendar" },
  route_to_review: { zh: "转入复核", en: "Route to review" },
  resource_not_actionable: { zh: "资源暂不可执行", en: "Resource not actionable" },
  resource_freshness_unknown: { zh: "新鲜度不足", en: "Resource freshness unknown" },
  review_required: { zh: "需要复核", en: "Review required" },
  freshness_unknown: { zh: "新鲜度不足", en: "Freshness unknown" },
  connection_or_manifest_missing: {
    zh: "连接或声明缺失",
    en: "Connection or manifest missing",
  },
  not_connected: { zh: "未连接", en: "Not connected" },
  review_queue: { zh: "复核队列", en: "Review queue" },
  blocked: { zh: "已阻断", en: "Blocked" },
  under_review: { zh: "复核中", en: "Under review" },
  reviewer: { zh: "复核人", en: "Reviewer" },
  connector: { zh: "连接器", en: "Connector" },
  capturesession: { zh: "现场记录", en: "Capture session" },
  import_source: { zh: "导入来源", en: "Import source" },
  import_job: { zh: "导入任务", en: "Import job" },
  capture_session: { zh: "现场记录", en: "Capture session" },
  fresh: { zh: "新鲜", en: "Fresh" },
  stale: { zh: "已过期", en: "Stale" },
  session_scoped: { zh: "会话范围", en: "Session scoped" },
  connection: { zh: "连接", en: "Connection" },
  not_requestable: { zh: "暂不可发起", en: "Not requestable" },
  requestable: { zh: "可发起复核", en: "Requestable" },
  eligible: { zh: "符合条件", en: "Eligible" },
  policy_external_write_never_allowed: {
    zh: "当前策略不允许外部写入",
    en: "External write is not allowed by policy",
  },
  evidence_detail_needs_review: {
    zh: "证据明细仍需复核",
    en: "Evidence detail still needs review",
  },
  write_intent_not_declared: {
    zh: "写入意图尚未声明",
    en: "Write intent is not declared",
  },
  field_mapping_gap_blocks_write_evaluation: {
    zh: "字段映射缺口阻断写回评估",
    en: "Field mapping gap blocks write evaluation",
  },
  customer_status: { zh: "客户状态", en: "Customer status" },
  recent_interaction: { zh: "最近互动", en: "Recent interaction" },
  owner: { zh: "负责人", en: "Owner" },
  amount_or_stage: { zh: "金额或阶段", en: "Amount or stage" },
  next_step_time: { zh: "下一步时间", en: "Next-step time" },
  clear: { zh: "已清楚", en: "Clear" },
  has_explainable_gaps: { zh: "存在可解释缺口", en: "Has explainable gaps" },
  downgraded: { zh: "已降级复核", en: "Downgraded to review" },
};

export function formatTenantResourceStatus(
  status: TenantResourceReadinessStatus,
  english: boolean,
) {
  return english ? statusLabels[status].en : statusLabels[status].zh;
}

export function formatTenantResourceTrust(
  trustLevel: TenantResourceTrustLevel,
  english: boolean,
) {
  return english ? trustLabels[trustLevel].en : trustLabels[trustLevel].zh;
}

export function formatTenantResourceGap(
  gap: TenantResourceReadinessReason | null,
  english: boolean,
) {
  if (!gap) {
    return english ? "No current gap" : "暂无当前缺口";
  }

  return english ? gapLabels[gap].en : gapLabels[gap].zh;
}

export function formatTenantResourceEffectModes(
  modes: TenantResourceEffectMode[],
  english: boolean,
) {
  if (!modes.length) {
    return english ? "No effect mode" : "无作用模式";
  }

  return modes
    .map((mode) => (english ? effectModeLabels[mode].en : effectModeLabels[mode].zh))
    .join(" / ");
}

export function formatTenantResourceGovernancePosture(
  resource: TenantResourceReadiness,
  english: boolean,
) {
  const modes = formatTenantResourceEffectModes(
    resource.governance.allowedEffectModes,
    english,
  );
  const writePosture = resource.governance.writeBackAllowed
    ? english
      ? "write-back guarded"
      : "写回受控"
    : english
      ? "write-back blocked"
      : "写回关闭";
  const reviewPosture =
    resource.governance.reviewRequirement === "required"
      ? english
        ? "review required"
        : "必须复核"
      : resource.governance.reviewRequirement === "recommended"
        ? english
          ? "review recommended"
          : "建议复核"
        : english
          ? "review clear"
          : "无需额外复核";

  return `${modes} · ${writePosture} · ${reviewPosture}`;
}

export function formatTenantResourceEvidenceToken(
  value: string,
  english: boolean,
) {
  const normalized = value.trim().replace(/[\s-]+/g, "_").toLowerCase();
  const label = evidenceTokenLabels[normalized];

  if (label) {
    return english ? label.en : label.zh;
  }

  return value.replaceAll("_", " ");
}

export function formatTenantResourceDisplayName(value: string, english: boolean) {
  const formatted = value
    .replace(/_/g, " ")
    .replace(/\bGOOGLE CALENDAR\b/g, "Google Calendar")
    .replace(/\bHUBSPOT\b/g, "HubSpot")
    .replace(/\bSALESFORCE\b/g, "Salesforce")
    .replace(/\bGMAIL\b/g, "Gmail")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (english) return formatted;

  return formatted
    .replace(/\bconnector\b/gi, "连接器")
    .replace(/\bresource\b/gi, "资源")
    .replace(/\bevidence\b/gi, "依据")
    .trim();
}

export function formatTenantResourceGuardedWriteText(
  text: string,
  english: boolean,
) {
  if (english) return text.replaceAll("_", " ");

  return text
    .replace(/Review captured evidence before using it for downstream judgement\./gi, "使用前先复核采集依据。")
    .replace(/Refresh the resource before using it for current Helm judgement\./gi, "先刷新资源，再用于当前 Helm 判断。")
    .replace(/Repair or reconnect the resource before using it for Helm judgement\./gi, "先修复或重新连接资源，再用于 Helm 判断。")
    .replace(/read:available/gi, "读取可用")
    .replace(/read:unavailable/gi, "读取不可用")
    .replace(/draft:allowed/gi, "草稿可用")
    .replace(/draft:not_allowed/gi, "草稿不可用")
    .replace(/draft:not allowed/gi, "草稿不可用")
    .replace(/review:recommended/gi, "建议复核")
    .replace(/review:required/gi, "必须复核")
    .replace(/external_write:never_allowed/gi, "外部写入禁止")
    .replace(/external write:never allowed/gi, "外部写入禁止")
    .replace(
      /Routed to review_queue because resource_freshness_unknown/gi,
      "因资源新鲜度不足，已转入复核队列",
    )
    .replace(
      /Routed to review_queue because resource_not_actionable/gi,
      "因资源暂不可执行，已转入复核队列",
    )
    .replace(
      /Downgrade to review because/gi,
      "因字段缺口转入复核：",
    )
    .replace(
      /Resource requires freshness review before closing or learning from the action\./gi,
      "资源需要先完成新鲜度复核，再关闭或学习该动作。",
    )
    .replace(
      /Review the submitted proof before closing or learning from the action\./gi,
      "先复核已提交证据，再关闭或学习该动作。",
    )
    .replace(
      /Resource requires review before use:\s*review_required/gi,
      "使用前必须先复核资源。",
    )
    .replace(
      /Resource requires review before use:\s*freshness_unknown/gi,
      "使用前必须先完成新鲜度复核。",
    )
    .replace(
      /Resource requires review before use:\s*not_connected/gi,
      "使用前必须先完成连接。",
    )
    .replace(/capture session:/gi, "现场记录：")
    .replace(/import source:/gi, "导入来源：")
    .replace(/import job:/gi, "导入任务：")
    .replace(/session scoped/gi, "会话范围")
    .replace(/customer status/gi, "客户状态")
    .replace(/recent interaction/gi, "最近互动")
    .replace(/Amount\s*\/\s*stage/gi, "金额 / 阶段")
    .replace(/Case status/gi, "案件状态")
    .replace(/amount or stage/gi, "金额或阶段")
    .replace(/next-step time/gi, "下一步时间")
    .replace(/\bowner\b/gi, "负责人")
    .replace(/\bunder review\b/gi, "复核中")
    .replace(/\breviewer\b/gi, "复核人")
    .replace(/\bconnection\b/gi, "连接")
    .replace(/\bresource_freshness_unknown\b/g, "资源新鲜度不足")
    .replace(/\bresource_not_actionable\b/g, "资源暂不可执行")
    .replace(/\breview_required\b/g, "需要复核")
    .replace(/\bfreshness_unknown\b/g, "新鲜度不足")
    .replace(/\bconnection_or_manifest_missing\b/g, "连接或声明缺失")
    .replace(/\bnot_connected\b/g, "未连接")
    .replace(/\breview_queue\b/g, "复核队列")
    .replace(
      /Keep guarded write blocked/gi,
      "保持写回关闭",
    )
    .replace(
      /Pilot remains blocked until proof is accepted and evaluation is eligible/gi,
      "试点会保持阻断，直到证据通过且评估符合条件",
    )
    .replace(/\bblocked\b/gi, "已阻断")
    .replace(/\bnot requestable\b/gi, "暂不可发起")
    .replace(/\beligible\b/gi, "符合条件")
    .replace(/\bpolicy_external_write_never_allowed\b/g, "当前策略不允许外部写入")
    .replace(/\bevidence_detail_needs_review\b/g, "证据明细仍需复核")
    .replace(/\bwrite_intent_not_declared\b/g, "写入意图尚未声明")
    .replace(
      /\bfield_mapping_gap_blocks_write_evaluation\b/g,
      "字段映射缺口阻断写回评估",
    );
}

export function pickTenantResourceReadinessRows(
  resources: TenantResourceReadiness[],
  limit = 6,
) {
  return [...resources]
    .sort((left, right) => {
      const statusDelta = statusPriority[left.status] - statusPriority[right.status];
      if (statusDelta !== 0) return statusDelta;

      const updatedDelta =
        new Date(right.updatedAt ?? 0).getTime() - new Date(left.updatedAt ?? 0).getTime();
      if (updatedDelta !== 0) return updatedDelta;

      return left.resourceName.localeCompare(right.resourceName);
    })
    .slice(0, limit);
}
