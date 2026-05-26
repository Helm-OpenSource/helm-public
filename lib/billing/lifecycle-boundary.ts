import { AccessState } from "@prisma/client";

export type HighCostProcessingOperationKey =
  | "MEETING_ACTION_GENERATION"
  | "MEETING_MEMORY_PROCESSING"
  | "RECOMMENDATION_GENERATION"
  | "BRIEFING_GENERATION"
  | "CRM_PREVIEW_RECOMPUTATION"
  | "CRM_IMPORT_RUN"
  | "CSV_IMPORT_RUN"
  | "IMPORT_WARMUP_RERUN"
  | "CONNECTOR_SYNC"
  | "CAPTURE_START"
  | "CAPTURE_STOP";

export type LifecycleBoundarySummary = {
  note: string;
  stillAvailable: string[];
  pausedHighCostProcessing: string[];
  scopeNote: string;
};

const OPERATION_LABELS: Record<HighCostProcessingOperationKey, { en: string; zh: string }> = {
  MEETING_ACTION_GENERATION: {
    en: "post-meeting action generation",
    zh: "会后动作生成",
  },
  MEETING_MEMORY_PROCESSING: {
    en: "meeting memory processing",
    zh: "会议记忆处理",
  },
  RECOMMENDATION_GENERATION: {
    en: "recommendation refresh",
    zh: "判断建议刷新",
  },
  BRIEFING_GENERATION: {
    en: "briefing refresh",
    zh: "简报刷新",
  },
  CRM_PREVIEW_RECOMPUTATION: {
    en: "CRM preview recomputation",
    zh: "CRM 预演计算",
  },
  CRM_IMPORT_RUN: {
    en: "CRM import execution",
    zh: "CRM 导入执行",
  },
  CSV_IMPORT_RUN: {
    en: "CSV import execution",
    zh: "CSV 导入执行",
  },
  IMPORT_WARMUP_RERUN: {
    en: "import warmup rerun",
    zh: "导入预热重跑",
  },
  CONNECTOR_SYNC: {
    en: "connector sync",
    zh: "连接器同步",
  },
  CAPTURE_START: {
    en: "capture start",
    zh: "现场记录开始",
  },
  CAPTURE_STOP: {
    en: "capture stop and processing",
    zh: "现场记录结束与处理",
  },
};

function getOperationLabel(operation: HighCostProcessingOperationKey | undefined, english: boolean) {
  if (!operation) {
    return english ? "new high-cost processing" : "新的高成本处理";
  }

  return OPERATION_LABELS[operation][english ? "en" : "zh"];
}

function getAllowedOperations(state: AccessState, english: boolean) {
  const common = english
    ? [
        "Sign in",
        "Switch organization",
        "View dashboard, approvals, memory, diagnostics, meetings and settings",
        "Export meeting or memory bundles",
        "Read connector and billing status",
        "Refresh settings and billing state",
      ]
    : [
        "登录",
        "切换组织",
        "查看首页、复核、记忆、诊断、会议和设置",
        "导出会议或记忆包",
        "读取连接器和计费状态",
        "刷新设置和计费状态",
      ];

  if (state === AccessState.TRIALING || state === AccessState.ACTIVE) {
    return english
      ? [
          ...common,
          "Run the full current core product, including new processing",
          "Use local CSV import preview without lifecycle restriction",
        ]
      : [
          ...common,
          "继续运行当前完整核心能力，包括新的处理动作",
          "本地 CSV 导入预演不受订阅状态限制",
        ];
  }

  return english
    ? [
        ...common,
        "Open renew / restore from settings",
        "Use local CSV import preview without starting external recomputation",
      ]
    : [
        ...common,
        "在设置中发起续费 / 恢复",
        "使用本地 CSV 导入预演，但不触发外部重算",
      ];
}

function getPausedOperations(english: boolean) {
  return english
    ? [
        "Post-meeting action generation",
        "Meeting memory processing",
        "Recommendation refresh",
        "Briefing refresh",
        "New CRM preview recomputation",
        "CRM import execution",
        "CSV import execution",
        "Import warmup rerun",
        "Connector sync",
        "Capture start / stop processing",
      ]
    : [
        "会后动作生成",
        "会议记忆处理",
        "判断建议刷新",
        "简报刷新",
        "新的 CRM 预演计算",
        "CRM 导入执行",
        "CSV 导入执行",
        "导入预热重跑",
        "连接器同步",
        "现场记录开始 / 结束处理",
      ];
}

export function getLifecycleBoundarySummary(
  accessState: AccessState,
  english: boolean,
): LifecycleBoundarySummary {
  if (accessState === AccessState.GRACE) {
    return {
      note: english
        ? "Grace keeps viewing, export and restore-oriented settings actions open. New high-cost processing pauses until paid access is restored."
        : "grace 期间会继续开放查看、导出和以恢复为目标的 settings 动作；新的高成本处理会暂停，直到付费访问被恢复。",
      stillAvailable: getAllowedOperations(accessState, english),
      pausedHighCostProcessing: getPausedOperations(english),
      scopeNote: english
        ? "CRM preview here means a new import preview recomputation. It does not mean ordinary surface browsing is blocked. Local CSV import preview remains allowed because it stays a local draft preview rather than a provider-side recomputation."
        : "这里的 CRM 预览特指新的导入预演重算，不代表普通页面浏览被阻止。本地 CSV 导入预演仍然允许，因为它只是本地草稿预演，不会触发支付渠道或外部服务侧重算。",
    };
  }

  if (accessState === AccessState.READ_ONLY) {
    return {
      note: english
        ? "Read-only keeps viewing, export and restore-oriented settings actions open. New high-cost processing stays blocked until access is restored."
        : "只读状态会继续开放查看、导出和以恢复为目标的设置动作；新的高成本处理会保持阻止，直到访问被恢复。",
      stillAvailable: getAllowedOperations(accessState, english),
      pausedHighCostProcessing: getPausedOperations(english),
      scopeNote: english
        ? "Read-only is still lifecycle-based, not plan-based feature hiding. CRM preview still means a new import preview recomputation, while local CSV import preview remains allowed."
        : "只读状态仍然是订阅边界，不是按套餐任意隐藏功能。这里的 CRM 预览仍特指新的导入预演重算，而本地 CSV 导入预览继续允许。",
    };
  }

  if (accessState === AccessState.CANCELED) {
    return {
      note: english
        ? "Canceled keeps sign-in, viewing, export and restore-oriented settings actions open while new high-cost processing stays blocked."
        : "已取消期间仍可登录、查看、导出和执行以恢复为目标的设置动作，但新的高成本处理会保持阻止。",
      stillAvailable: getAllowedOperations(accessState, english),
      pausedHighCostProcessing: getPausedOperations(english),
      scopeNote: english
        ? "Canceled does not erase existing workspace access immediately. It still preserves read, export and restore paths while provider or operator actions bring lifecycle back into an active path."
        : "已取消不会立刻清空既有访问。它仍会保留读取、导出和恢复路径，等待支付渠道或运营动作把订阅状态拉回可用路径。",
    };
  }

  return {
    note: english
      ? "Trialing and active keep the full current core product open. Lifecycle truth stays visible here so Helm does not drift into hidden feature gating."
      : "试用和可用状态会继续开放当前完整核心产品。这里把订阅状态说清楚，是为了避免 Helm 漂成隐藏式功能开关。",
    stillAvailable: getAllowedOperations(accessState, english),
    pausedHighCostProcessing: [],
    scopeNote: english
      ? "Current trialing / active states keep viewing, export, refresh and new processing open. Differences remain lifecycle-based, not arbitrary plan hiding."
      : "当前试用 / 可用状态会继续开放查看、导出、刷新和新的处理动作。差异仍然基于订阅状态，而不是任意的套餐隐藏。",
  };
}

export function getBlockedProcessingMessage(input: {
  state: AccessState;
  english: boolean;
  operation?: HighCostProcessingOperationKey;
}) {
  const operationLabel = getOperationLabel(input.operation, input.english);

  if (input.state === AccessState.GRACE) {
    return input.english
      ? `This organization is in grace mode. Viewing, export, local draft preview and billing refresh remain available, but ${operationLabel} is paused until paid access is restored.`
      : `当前组织处于宽限状态。查看、导出、本地草稿预演和计费状态刷新仍然可用，但${operationLabel}会暂停，直到付费访问被恢复。`;
  }

  if (input.state === AccessState.READ_ONLY) {
    return input.english
      ? `This organization is in read-only mode. Existing records, export, local draft preview and restore-oriented settings actions remain available, but ${operationLabel} is blocked until access is restored.`
      : `当前组织处于只读状态。既有内容、导出、本地草稿预演和以恢复为目标的设置动作仍然可用，但${operationLabel}会被阻止，直到访问被恢复。`;
  }

  if (input.state === AccessState.CANCELED) {
    return input.english
      ? `This organization has been canceled. Viewing, export and restore remain available, but ${operationLabel} is blocked until the organization is reactivated.`
      : `当前组织已取消。查看、导出和恢复路径仍然可用，但${operationLabel}会被阻止，直到组织被重新激活。`;
  }

  return input.english
    ? `This organization cannot start ${operationLabel} right now.`
    : `当前组织暂时不能启动${operationLabel}。`;
}
