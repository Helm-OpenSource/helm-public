import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import { formatDateLabel } from "@/lib/utils";
import type {
  OrganizationGovernanceAuditMarker,
  OrganizationIdentityMatchMarker,
  OrganizationWebhookCallbackMarker,
  SettingsConnectorState,
  SettingsConnectorSummary,
  SettingsConnectorValidationStatus,
  SettingsConnectorCallbackStatus,
  SettingsConnectorFailurePosture,
  SettingsConnectorIngestScope,
  SettingsConnectorIngestScopeStatus,
  SettingsConnectorIngestStatus,
} from "../types/settings-types";

export const organizationAuditActionLabels = {
  ORGANIZATION_CREATED: { zh: "组织创建", en: "Organization created" },
  ORGANIZATION_MEMBER_ADDED: { zh: "成员新增", en: "Member added" },
  ORGANIZATION_MEMBER_LIFECYCLE_UPDATED: { zh: "成员状态更新", en: "Member lifecycle updated" },
  ORGANIZATION_MEMBER_ROLE_UPDATED: { zh: "成员角色更新", en: "Member role updated" },
  ORGANIZATION_OWNERSHIP_TRANSFERRED: { zh: "负责人转移", en: "Ownership transferred" },
  AUTH_SESSION_CREATED: { zh: "会话创建", en: "Auth session created" },
  AUTH_SESSION_ROTATED: { zh: "会话轮换", en: "Auth session rotated" },
  AUTH_SESSION_REVOKED: { zh: "会话撤销", en: "Auth session revoked" },
  AUTH_SESSION_SCOPE_REVOKED: { zh: "会话批量撤销", en: "Auth session scope revoked" },
  AUTH_SESSION_WORKSPACE_REALIGNED: { zh: "会话工作区纠偏", en: "Session workspace realigned" },
  AUTH_SESSION_WORKSPACE_SWITCHED: { zh: "会话切换组织", en: "Session workspace switched" },
  MEMORY_SUMMARY_EXPORTED: { zh: "记忆导出", en: "Memory exported" },
  MEMORY_FACT_CREATED: { zh: "事实创建", en: "Memory fact created" },
  MEMORY_CORRECTED: { zh: "记忆修正", en: "Memory corrected" },
  MEMORY_DELETED: { zh: "记忆删除", en: "Memory deleted" },
  MEMORY_FACT_CONFIRMED: { zh: "事实确认", en: "Memory fact confirmed" },
  MEMORY_FACT_CORRECTED: { zh: "事实修正", en: "Memory fact corrected" },
  MEMORY_FACT_INVALIDATED: { zh: "事实失效", en: "Memory fact invalidated" },
  MEMORY_FACT_DELETED: { zh: "事实删除", en: "Memory fact deleted" },
  COMMITMENT_CREATED: { zh: "承诺创建", en: "Commitment created" },
  COMMITMENT_STATUS_UPDATED: { zh: "承诺状态更新", en: "Commitment status updated" },
  BLOCKER_CREATED: { zh: "阻塞创建", en: "Blocker created" },
  BLOCKER_RESOLVED: { zh: "阻塞解决", en: "Blocker resolved" },
  BLOCKER_STATUS_UPDATED: { zh: "阻塞状态更新", en: "Blocker status updated" },
  MEETING_MEMORY_PROCESSED: { zh: "会议记忆处理", en: "Meeting memory processed" },
  WORKSPACE_OPERATIONAL_CONTROLS_UPDATED: { zh: "运营控制更新", en: "Operational controls updated" },
  WORKSPACE_SETUP_COMPLETED: { zh: "工作区初始化完成", en: "Workspace setup completed" },
  POLICY_UPDATED: { zh: "策略更新", en: "Policy updated" },
  POLICY_RESTORED_DEFAULTS: { zh: "策略恢复默认", en: "Policy defaults restored" },
  CONTRIBUTOR_PORTAL_ACCESS_ISSUED: { zh: "门户访问发放", en: "Participant portal access issued" },
  CONTRIBUTOR_PORTAL_ACCESS_STATUS_UPDATED: { zh: "门户访问状态更新", en: "Participant portal access updated" },
  CONTRIBUTOR_PORTAL_ONBOARDED: { zh: "门户入驻完成", en: "Participant portal onboarded" },
  CONTRIBUTOR_PORTAL_PROFILE_UPDATED: { zh: "门户资料更新", en: "Participant portal profile updated" },
  PROGRAM_APPLICATION_SUBMITTED: { zh: "申请提交", en: "Program application submitted" },
  PROGRAM_APPLICATION_REVIEWED: { zh: "申请审核", en: "Program application reviewed" },
  PROGRAM_APPLICATION_INVITE_ISSUED: { zh: "申请邀请发放", en: "Program invite issued" },
  CONNECTOR_CONNECTED: { zh: "连接器接入", en: "Connector connected" },
  CONNECTOR_SYNC_COMPLETED: { zh: "连接器同步完成", en: "Connector sync completed" },
  CONNECTOR_DISCONNECTED: { zh: "连接器断开", en: "Connector disconnected" },
  DINGTALK_DIRECTORY_INVITE_SYNC_SUCCEEDED: {
    zh: "钉钉目录邀请同步完成",
    en: "DingTalk directory invite sync completed",
  },
  DINGTALK_DIRECTORY_INVITE_SYNC_PARTIAL: {
    zh: "钉钉目录邀请同步部分完成",
    en: "DingTalk directory invite sync partial",
  },
  FEISHU_OAUTH_CALLBACK_SUCCEEDED: {
    zh: "飞书 OAuth 回调成功",
    en: "Feishu OAuth callback succeeded",
  },
  FEISHU_OAUTH_CALLBACK_FAILED: {
    zh: "飞书 OAuth 回调失败",
    en: "Feishu OAuth callback failed",
  },
  FEISHU_OAUTH_CALLBACK_UNRESOLVED: {
    zh: "飞书 OAuth 回调未解析",
    en: "Feishu OAuth callback unresolved",
  },
  FEISHU_OAUTH_CALLBACK_MISMATCH: {
    zh: "飞书 OAuth 回调不匹配",
    en: "Feishu OAuth callback mismatch",
  },
  FEISHU_READONLY_INGEST_SUCCEEDED: {
    zh: "飞书多维表格只读采集完成",
    en: "Feishu Bitable read-only ingest completed",
  },
  FEISHU_READONLY_INGEST_PARTIAL: {
    zh: "飞书多维表格只读采集部分完成",
    en: "Feishu Bitable read-only ingest partial",
  },
  FEISHU_READONLY_INGEST_FAILED: {
    zh: "飞书多维表格只读采集失败",
    en: "Feishu Bitable read-only ingest failed",
  },
  FEISHU_READONLY_INGEST_UNRESOLVED: {
    zh: "飞书多维表格只读采集未解析",
    en: "Feishu Bitable read-only ingest unresolved",
  },
  WECOM_CALENDAR_REGISTRY_VALIDATED: { zh: "企业微信日历注册表已校验", en: "WeCom calendar registry validated" },
  WECOM_CALENDAR_REGISTRY_PARTIAL: { zh: "企业微信日历注册表部分完成", en: "WeCom calendar registry partial" },
  WECOM_CALENDAR_REGISTRY_FAILED: { zh: "企业微信日历注册表失败", en: "WeCom calendar registry failed" },
  WECOM_CALENDAR_REGISTRY_UNRESOLVED: { zh: "企业微信日历注册表未解析", en: "WeCom calendar registry unresolved" },
  CSV_IMPORT_COMPLETED: { zh: "CSV 导入完成", en: "CSV import completed" },
  CRM_IMPORT_COMPLETED: { zh: "客户关系系统导入完成", en: "CRM import completed" },
  IMPORT_WARMUP_COMPLETED: { zh: "导入预热完成", en: "Import warmup completed" },
  IMPORT_CONFLICT_RESOLVED: { zh: "导入冲突已处理", en: "Import conflict resolved" },
  IMPORT_SOURCE_CONNECTED: { zh: "导入源接入", en: "Import source connected" },
  IMPORT_SOURCE_DISCONNECTED: { zh: "导入源断开", en: "Import source disconnected" },
  WEEKLY_REPORT_GENERATED: { zh: "周报生成", en: "Weekly report generated" },
  RECOMMENDATION_FEEDBACK_SUBMITTED: { zh: "建议反馈提交", en: "Recommendation feedback submitted" },
  STRATEGY_SUGGESTION_ACCEPTED: { zh: "策略建议采纳", en: "Strategy suggestion accepted" },
  STRATEGY_SUGGESTION_DISMISSED: { zh: "策略建议忽略", en: "Strategy suggestion dismissed" },
  AI_GENERATED_ACTION: { zh: "AI 动作生成", en: "AI action generated" },
  ACTION_EXECUTED: { zh: "动作执行", en: "Action executed" },
  OPPORTUNITY_STAGE_CHANGED: { zh: "机会阶段变更", en: "Opportunity stage changed" },
  APPROVAL_APPROVED: { zh: "审批通过", en: "Approval approved" },
  APPROVAL_REJECTED: { zh: "审批拒绝", en: "Approval rejected" },
  APPROVAL_CONVERTED_TO_MANUAL: { zh: "转成人工处理", en: "Approval converted to manual" },
  POLICY_AUTO_EXECUTE_ENABLED: { zh: "自动执行策略启用", en: "Auto-execution policy enabled" },
  MEETING_ACTION_ITEMS_GENERATED: { zh: "会后动作生成", en: "Meeting action items generated" },
  MEETING_ACTION_ITEM_UPDATED: { zh: "会后动作更新", en: "Meeting action item updated" },
  FIRST_LOOP_SETUP_HANDOFF_ENTERED: { zh: "首轮交接进入", en: "First-loop handoff entered" },
  FIRST_LOOP_PRIMARY_ACTION_OPENED: { zh: "首轮主动作打开", en: "First-loop primary action opened" },
  FIRST_LOOP_RETURN_ANCHOR_SET: { zh: "首轮回访锚点保存", en: "First-loop return anchor saved" },
  FIRST_LOOP_ANCHOR_RESUMED: { zh: "首轮回访锚点继续", en: "First-loop anchor resumed" },
  HELM_V2_HUMAN_ACTION_EXECUTION_READY: { zh: "人工动作执行就绪", en: "Human action execution ready" },
  HELM_V2_HUMAN_ACTION_EXECUTION_ACKNOWLEDGED: { zh: "人工动作执行确认", en: "Human action execution acknowledged" },
  HELM_V2_OFFICIAL_WRITE_INTENT_CREATED: { zh: "官方写入意图创建", en: "Official write intent created" },
  HELM_V2_LIMITED_AUTO_INTENT_SYNCED: { zh: "受限自动意图同步", en: "Limited auto intent synced" },
  HELM_V2_OFFICIAL_FOLLOWTHROUGH_SYNCED: { zh: "官方跟进同步", en: "Official follow-through synced" },
  HELM_V2_OFFICIAL_FOLLOWTHROUGH_UPDATED: { zh: "官方跟进更新", en: "Official follow-through updated" },
  HELM_V2_LIMITED_AUTO_EXECUTED: { zh: "受限自动执行", en: "Limited auto executed" },
  HELM_V2_LIMITED_AUTO_REVIEWED: { zh: "受限自动复核", en: "Limited auto reviewed" },
  HELM_V2_OFFICIAL_WRITE_INTENT_REVIEWED: { zh: "官方写入意图复核", en: "Official write intent reviewed" },
  HELM_V2_OFFICIAL_WRITE_ATTEMPTED: { zh: "官方写入尝试", en: "Official write attempted" },
  HELM_V2_OFFICIAL_WRITE_ACKNOWLEDGED: { zh: "官方写入确认", en: "Official write acknowledged" },
  SETTLEMENT_BATCH_CREATED: { zh: "结算批次创建", en: "Settlement batch created" },
  SETTLEMENT_BATCH_APPROVED: { zh: "结算批次批准", en: "Settlement batch approved" },
  SETTLEMENT_BATCH_EXPORTED: { zh: "结算批次导出", en: "Settlement batch exported" },
  SETTLEMENT_LINE_MARKED_PAID: { zh: "结算条目标记已支付", en: "Settlement line marked paid" },
  SETTLEMENT_LINE_REVERSED: { zh: "结算条目冲回", en: "Settlement line reversed" },
  SETTLEMENT_BATCH_CLOSED: { zh: "结算批次关闭", en: "Settlement batch closed" },
  ORGANIZATION_SUPPORT_PACK_EXPORTED: { zh: "支持包导出", en: "Support pack exported" },
} as const;

function formatGovernanceDateLabel(value: Date | string | null | undefined, english: boolean) {
  if (!value) {
    return english ? "Not recorded" : "未设置";
  }

  const date = value instanceof Date ? value : new Date(value);

  if (english) {
    return format(date, "MMM d HH:mm", { locale: enUS });
  }

  return formatDateLabel(date);
}

export function formatGovernanceAuditMarker(
  marker: OrganizationGovernanceAuditMarker,
  english: boolean,
) {
  if (!marker) {
    return english ? "Not recorded" : "未记录";
  }

  const actionLabel =
    organizationAuditActionLabels[marker.actionType as keyof typeof organizationAuditActionLabels]?.[
      english ? "en" : "zh"
  ] ?? marker.actionType;
  const targetType = formatGovernanceAuditTargetType(marker.targetType, english);

  return `${actionLabel} · ${formatGovernanceDateLabel(marker.createdAt, english)} · ${english ? "actor" : "操作者"} ${marker.actor} · ${english ? "target" : "目标"} ${targetType}`;
}

export function formatGovernanceAuditSummary(
  summary: string | null | undefined,
  english: boolean,
) {
  const value = summary?.trim();
  if (!value) return english ? "No summary recorded" : "未记录摘要";
  if (english) return value;

  return value
    .replace(
      /Created auth session for ([^\s.]+(?:\.[^\s.]+)*)(?=\.?(?:\s|$))/gi,
      "已为 $1 创建认证会话",
    )
    .replace(
      /Rotated auth session for ([^\s.]+(?:\.[^\s.]+)*)(?=\.?(?:\s|$))/gi,
      "已为 $1 轮换认证会话",
    )
    .replace(
      /Revoked auth session for ([^\s.]+(?:\.[^\s.]+)*)(?=\.?(?:\s|$))/gi,
      "已为 $1 撤销认证会话",
    )
    .replace(/Revoked (\d+) stale active auth sessions/gi, "已撤销 $1 个过期活跃会话")
    .replace(/PROVIDER\/SOURCE/gi, "来源服务商 / 来源页")
    .replace(/\bINACTIVE\b/g, "已停用")
    .replace(/\bACTIVE\b/g, "已激活")
    .replace(/AuthSession/g, "认证会话")
    .replace(/ApprovalTask/g, "审批任务")
    .replace(/ActionItem/g, "动作项")
    .trim();
}

export function formatWebhookCallbackMarker(
  marker: OrganizationWebhookCallbackMarker,
  english: boolean,
) {
  if (!marker) {
    return english ? "Not recorded" : "未记录";
  }

  return [
    marker.provider,
    formatGovernanceDateLabel(marker.recordedAt, english),
    marker.summary,
    marker.workspaceScoped
      ? english
        ? "workspace-scoped"
        : "已进入工作区范围"
      : english
        ? "external-boundary"
        : "外部边界事件",
  ].join(" · ");
}

export function formatIdentityMatchMarker(
  marker: OrganizationIdentityMatchMarker,
  english: boolean,
) {
  if (!marker) {
    return english ? "Not recorded" : "未记录";
  }

  return [
    formatIdentityMatchExternalType(marker.externalType, english),
    formatGovernanceDateLabel(marker.recordedAt, english),
    marker.reason ?? (english ? "No reason recorded" : "未记录原因"),
    `${english ? "score" : "分值"} ${marker.matchScore}`,
    formatIdentityMatchStatus(marker.status, english),
  ].join(" · ");
}

export function formatGovernanceAuditTargetType(targetType: string, english: boolean) {
  const normalized = targetType.trim();

  if (normalized === "ApprovalTask") {
    return english ? "Approval task" : "审批任务";
  }

  if (normalized === "ActionItem") {
    return english ? "Action item" : "动作项";
  }

  if (normalized === "Membership") {
    return english ? "Member" : "成员";
  }

  if (normalized === "Workspace") {
    return english ? "Workspace" : "工作区";
  }

  if (normalized === "Opportunity") {
    return english ? "Opportunity" : "机会";
  }

  if (normalized === "Contact") {
    return english ? "Contact" : "联系人";
  }

  if (normalized === "Company") {
    return english ? "Company" : "公司";
  }

  if (normalized === "Meeting") {
    return english ? "Meeting" : "会议";
  }

  if (normalized === "PolicyRule") {
    return english ? "Policy rule" : "策略规则";
  }

  if (normalized === "AuthSession") {
    return english ? "Auth session" : "认证会话";
  }

  return targetType;
}

function formatIdentityMatchExternalType(externalType: string, english: boolean) {
  switch (externalType) {
    case "CONTACT":
      return english ? "Contact" : "联系人";
    case "COMPANY":
      return english ? "Company" : "公司";
    case "OPPORTUNITY":
      return english ? "Opportunity" : "机会";
    default:
      return externalType;
  }
}

function formatIdentityMatchStatus(
  status: NonNullable<OrganizationIdentityMatchMarker>["status"],
  english: boolean,
) {
  switch (status) {
    case "EXACT":
      return english ? "exact match" : "准确匹配";
    case "AUTO_LINKED":
      return english ? "auto linked" : "已自动关联";
    case "NEEDS_REVIEW":
      return english ? "needs review" : "需要复核";
    case "RESOLVED_LINKED":
      return english ? "resolved as linked" : "已确认关联";
    case "RESOLVED_CREATED":
      return english ? "resolved as new" : "已确认新建";
    case "IGNORED":
      return english ? "ignored" : "已忽略";
    default:
      return String(status);
  }
}

export function formatAuthSessionProvider(providerType: string | null, english: boolean) {
  switch (providerType) {
    case "EMAIL_ENTRY":
      return english ? "Email entry" : "邮箱入口";
    case "PASSWORD":
      return english ? "Password" : "密码";
    case "PHONE_CODE":
      return english ? "Phone code" : "短信验证码";
    case "VERIFIED_SIGNUP":
      return english ? "Verified signup" : "正式验证注册";
    case "PARTICIPANT_PORTAL":
      return english ? "Participant portal" : "贡献方门户";
    case "DINGTALK_OAUTH":
      return english ? "DingTalk OAuth" : "钉钉授权";
    case "WECOM_OAUTH":
      return english ? "WeCom OAuth" : "企业微信授权";
    case "FEISHU_OAUTH":
      return english ? "Feishu OAuth" : "飞书授权";
    default:
      return english ? "Legacy / not recorded" : "旧来源 / 未记录";
  }
}

export function formatDingTalkCallbackStatus(
  status: SettingsConnectorCallbackStatus | null | undefined,
  english: boolean,
) {
  switch (status) {
    case "SUCCESS":
      return english ? "Resolved" : "已解析";
    case "FAILURE":
      return english ? "Failed" : "失败";
    case "UNRESOLVED":
      return english ? "Unresolved" : "未解析";
    case "MISMATCH":
      return english ? "Mismatch" : "不匹配";
    default:
      return english ? "Not recorded" : "未记录";
  }
}

export function formatDingTalkFailurePosture(
  posture: SettingsConnectorFailurePosture | null | undefined,
  english: boolean,
) {
  switch (posture) {
    case "CLEAR":
      return english ? "Clear" : "清晰";
    case "RETRYABLE":
      return english ? "Retryable" : "可重试";
    case "REVIEW_REQUIRED":
      return english ? "Review required" : "需要人工复核";
    default:
      return english ? "Not recorded" : "未记录";
  }
}

export function formatDingTalkIngestStatus(
  status: SettingsConnectorIngestStatus | null | undefined,
  english: boolean,
) {
  switch (status) {
    case "SUCCESS":
      return english ? "Established" : "已成立";
    case "PARTIAL":
      return english ? "Partially established" : "部分成立";
    case "FAILURE":
      return english ? "Failed" : "失败";
    case "UNRESOLVED":
      return english ? "Unresolved" : "未解析";
    default:
      return english ? "Not recorded" : "未记录";
  }
}

export function formatDingTalkReadOnlyScope(
  scope: SettingsConnectorIngestScope,
  english: boolean,
) {
  switch (scope) {
    case "MEETINGS":
      return english ? "Meetings" : "会议";
    case "CALENDAR":
      return english ? "Calendar" : "日程";
    case "BITABLE":
      return english ? "Bitable" : "多维表格";
    case "TODO":
      return english ? "Todos" : "待办";
    case "PROJECTS":
      return english ? "Projects" : "项目";
    case "MANAGEMENT":
      return english ? "Management" : "管理";
    case "WORK":
      return english ? "Work reports" : "工作汇报";
    case "MESSAGE_NOTIFICATIONS":
      return english ? "Message notifications" : "消息通知";
    default:
      return scope;
  }
}

export function formatDingTalkIngestScopeStatus(
  status: SettingsConnectorIngestScopeStatus | null | undefined,
  english: boolean,
) {
  switch (status) {
    case "INGESTED":
      return english ? "Ingested" : "已采集";
    case "UNRESOLVED":
      return english ? "Unresolved" : "未解析";
    case "FAILED":
      return english ? "Failed" : "失败";
    default:
      return english ? "Not recorded" : "未记录";
  }
}

export function formatWeComCalendarRegistryStatus(
  status: SettingsConnectorValidationStatus | null | undefined,
  english: boolean,
) {
  switch (status) {
    case "SUCCESS":
      return english ? "Validated" : "已校验";
    case "PARTIAL":
      return english ? "Partial" : "部分完成";
    case "FAILURE":
      return english ? "Failed" : "失败";
    case "UNRESOLVED":
      return english ? "Unresolved" : "未解析";
    default:
      return english ? "Not validated" : "未校验";
  }
}

export function formatWeComCalendarRegistryReadiness(
  connector: SettingsConnectorSummary,
  english: boolean,
) {
  const boundCalendarCount = connector?.calendarRegistry?.boundCalendars.length ?? 0;
  const validationStatus = connector?.calendarRegistry?.lastValidationResult?.status ?? null;

  if (boundCalendarCount > 0 && validationStatus === "SUCCESS") {
    return english ? "Registry ready" : "注册表已就绪";
  }

  if (boundCalendarCount > 0 && validationStatus === "PARTIAL") {
    return english ? "Registry partial" : "注册表部分完成";
  }

  if (validationStatus === "FAILURE" || validationStatus === "UNRESOLVED") {
    return english ? "Registry needs review" : "注册表需复核";
  }

  return english ? "Registry pending" : "注册表待建立";
}

export function getWeComCalendarRegistryNextAction(
  connector: SettingsConnectorSummary,
  oauthReady: boolean,
  english: boolean,
) {
  if (!oauthReady) {
    return english ? "Complete WeCom OAuth config" : "先完成企业微信授权配置";
  }

  if (!connector || connector.lastCallbackResult?.status !== "SUCCESS") {
    return english ? "Complete WeCom callback first" : "先完成企业微信回调接入";
  }

  const boundCalendarCount = connector.calendarRegistry?.boundCalendars.length ?? 0;
  const validationStatus = connector.calendarRegistry?.lastValidationResult?.status ?? null;

  if (boundCalendarCount === 0) {
    return english ? "Register and validate workspace calendar ids" : "登记并校验工作区日历 ID";
  }

  if (
    validationStatus === "PARTIAL" ||
    validationStatus === "FAILURE" ||
    validationStatus === "UNRESOLVED"
  ) {
    return english ? "Fix failed calendar ids and revalidate" : "修正失败的日历 ID 后重新校验";
  }

  return english
    ? "Keep calendar runtime pending until the registry-backed ingest slice lands"
    : "在注册表支撑的采集切片落地前，继续保持日历运行时待成立";
}

export function formatConnectorBannerMessage(
  connectorState: SettingsConnectorState,
  english: boolean,
) {
  if (!connectorState.status) {
    return null;
  }

  if (connectorState.message?.trim()) {
    return connectorState.message.trim();
  }

  if (connectorState.connector === "dingtalk") {
    switch (connectorState.status) {
      case "connected":
        return english
          ? "DingTalk OAuth callback completed and the workspace-scoped auth session is active."
          : "钉钉授权回调已完成，当前工作区范围的认证会话已生效。";
      case "oauth-error":
        return english
          ? "DingTalk returned an OAuth error during callback."
          : "钉钉在回调阶段返回了授权错误。";
      case "failure":
        return english
          ? "DingTalk callback failed before the connector state could be stabilized."
          : "钉钉回调在连接状态稳定前失败。";
      case "unresolved":
        return english
          ? "DingTalk callback completed, but Helm could not resolve the DingTalk identity to the active workspace user."
          : "钉钉回调已完成，但 Helm 无法把钉钉身份解析到当前工作区用户。";
      case "mismatch":
        return english
          ? "DingTalk callback completed, but the DingTalk identity does not match the active workspace user."
          : "钉钉回调已完成，但钉钉身份与当前工作区用户不匹配。";
      case "missing-state":
        return english
          ? "DingTalk callback state is missing or expired."
          : "钉钉回调状态缺失或已过期。";
      case "invalid-state":
        return english
          ? "DingTalk callback state could not be trusted."
          : "钉钉回调状态无法被信任。";
      case "forbidden":
        return english
          ? "The current role cannot manage DingTalk connector callbacks for this workspace."
          : "当前角色不能管理这个工作区的钉钉连接器回调。";
      default:
        return english ? "DingTalk connector status updated." : "钉钉连接器状态已更新。";
    }
  }

  if (connectorState.connector === "wecom") {
    switch (connectorState.status) {
      case "connected":
        return english
          ? "WeCom OAuth callback completed and the workspace-scoped auth session is active."
          : "企业微信授权回调已完成，当前工作区范围的认证会话已生效。";
      case "oauth-error":
        return english
          ? "WeCom returned an OAuth error during callback."
          : "企业微信在回调阶段返回了授权错误。";
      case "failure":
        return english
          ? "WeCom callback failed before the connector state could be stabilized."
          : "企业微信回调在连接状态稳定前失败。";
      case "unresolved":
        return english
          ? "WeCom callback completed, but Helm could not resolve the WeCom identity to the active workspace user."
          : "企业微信回调已完成，但 Helm 无法把企业微信身份解析到当前工作区用户。";
      case "mismatch":
        return english
          ? "WeCom callback completed, but the WeCom identity does not match the active workspace user."
          : "企业微信回调已完成，但企业微信身份与当前工作区用户不匹配。";
      case "missing-state":
        return english
          ? "WeCom callback state is missing or expired."
          : "企业微信回调状态缺失或已过期。";
      case "invalid-state":
        return english
          ? "WeCom callback state could not be trusted."
          : "企业微信回调状态无法被信任。";
      case "forbidden":
        return english
          ? "The current role cannot manage WeCom connector callbacks for this workspace."
          : "当前角色不能管理这个工作区的企业微信连接器回调。";
      default:
        return english ? "WeCom connector status updated." : "企业微信连接器状态已更新。";
    }
  }

  if (connectorState.connector === "feishu") {
    switch (connectorState.status) {
      case "connected":
        return english
          ? "Feishu OAuth callback completed and the workspace-scoped auth session is active."
          : "飞书授权回调已完成，当前工作区范围的认证会话已生效。";
      case "oauth-error":
        return english
          ? "Feishu returned an OAuth error during callback."
          : "飞书在回调阶段返回了授权错误。";
      case "failure":
        return english
          ? "Feishu callback failed before the connector state could be stabilized."
          : "飞书回调在连接状态稳定前失败。";
      case "unresolved":
        return english
          ? "Feishu callback completed, but Helm could not resolve the Feishu identity to the active workspace user."
          : "飞书回调已完成，但 Helm 无法把飞书身份解析到当前工作区用户。";
      case "mismatch":
        return english
          ? "Feishu callback completed, but the Feishu identity does not match the active workspace user."
          : "飞书回调已完成，但飞书身份与当前工作区用户不匹配。";
      case "missing-state":
        return english
          ? "Feishu callback state is missing or expired."
          : "飞书回调状态缺失或已过期。";
      case "invalid-state":
        return english
          ? "Feishu callback state could not be trusted."
          : "飞书回调状态无法被信任。";
      case "forbidden":
        return english
          ? "The current role cannot manage Feishu connector callbacks for this workspace."
          : "当前角色不能管理这个工作区的飞书连接器回调。";
      default:
        return english ? "Feishu connector status updated." : "飞书连接器状态已更新。";
    }
  }

  if (connectorState.status === "connected") {
    return english
      ? "Aliyun Mail is connected and has completed the first sync. You can open Inbox now to inspect real threads."
      : "阿里邮箱已连接并完成首次同步。现在可以去收件箱查看真实线程来源。";
  }

  return english ? "Connector status updated." : "连接器状态已更新。";
}
