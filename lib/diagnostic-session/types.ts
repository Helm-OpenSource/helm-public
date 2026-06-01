// DiagnosticSession — V2.3 §7.5 Phase 4 起点。
//
// 角色：把 lead + brief + control line 收成"一次诊断"，输出第一条 first-loop
// 候选 + 风险与边界备注。
//
// 永久边界（V2.3 §6.5、§10.2）：
//   1. 诊断不是"保证成功方案"；只输出 review-first first loop candidate；
//   2. recommendation ≠ commitment；客户可见 summary 必须由人工审过；
//   3. 哪些承诺要降级为前置条件 / 依赖项 / 边界备注，必须显式列在 boundaryNotes；
//   4. 状态机沿 V2.3 §8.5：DRAFT → REVIEWED → FIRST_LOOP_SELECTED | BLOCKED | SUPERSEDED；
//   5. FIRST_LOOP_SELECTED 不代表试用 workspace 已被初始化，只代表诊断结论已被复核接收。

import type {
  DiagnosticSessionStatus,
  FirstLoopType,
} from "@prisma/client";

export type { DiagnosticSessionStatus, FirstLoopType };

export const FIRST_LOOP_TYPES = [
  "LEAD_FOLLOW_UP",
  "CUSTOMER_REVIEW",
  "DELIVERY_RISK",
  "OPPORTUNITY_JUDGEMENT",
  "RENEWAL_EXPANSION",
  "OTHER",
] as const satisfies readonly FirstLoopType[];

export const DIAGNOSTIC_SESSION_STATUSES = [
  "DRAFT",
  "REVIEWED",
  "FIRST_LOOP_SELECTED",
  "BLOCKED",
  "SUPERSEDED",
] as const satisfies readonly DiagnosticSessionStatus[];

// V2.3 §6.5 6 个诊断维度的结构化 readiness。每个维度独立 yes/no/note，
// 让 reviewer 一眼看到当前缺哪个维度。
export type DiagnosticSessionRoleReadiness = {
  businessGoalClear: boolean;
  resourcesConnectable: boolean;
  rolesEngaged: boolean;
  firstLoopAvailable: boolean;
  proofCollectionReady: boolean;
  riskCommitmentsBoundedAsPrerequisites: boolean;
  notes?: string[];
};

export function emptyRoleReadiness(): DiagnosticSessionRoleReadiness {
  return {
    businessGoalClear: false,
    resourcesConnectable: false,
    rolesEngaged: false,
    firstLoopAvailable: false,
    proofCollectionReady: false,
    riskCommitmentsBoundedAsPrerequisites: false,
  };
}

export type DiagnosticSessionSourceTraceEntry = {
  ts: string;
  origin:
    | "intake_sync"            // 从 brief / control line 同步初始诊断
    | "internal_review"        // reviewer 复核 / 决策
    | "customer_followup";     // 客户提了补充事实
  actor: string;
  note: string;
};

export type DiagnosticSessionRecord = {
  id: string;
  workspaceId: string;
  leadId: string;
  briefId: string | null;
  controlLineCandidateId: string | null;
  diagnosticKey: string;
  workspaceCandidate: string | null;
  businessGoal: string;
  availableResources: string[];
  roleReadiness: DiagnosticSessionRoleReadiness;
  firstLoopCandidateType: FirstLoopType | null;
  firstLoopCandidateNote: string | null;
  riskNotes: string[];
  boundaryNotes: string[];
  status: DiagnosticSessionStatus;
  reviewerActor: string | null;
  reviewerDecisionNote: string | null;
  sourceTrace: DiagnosticSessionSourceTraceEntry[];
  createdAt: string;
  updatedAt: string;
};

export type DiagnosticSessionCreateInput = {
  workspaceId: string;
  leadId: string;
  briefId?: string | null;
  controlLineCandidateId?: string | null;
  diagnosticKey: string;
  workspaceCandidate?: string | null;
  businessGoal: string;
  availableResources?: readonly string[];
  roleReadiness?: DiagnosticSessionRoleReadiness;
  firstLoopCandidateType?: FirstLoopType | null;
  firstLoopCandidateNote?: string | null;
  riskNotes?: readonly string[];
  boundaryNotes?: readonly string[];
  initialSourceTrace?: readonly DiagnosticSessionSourceTraceEntry[];
};

// V2.3 §8.5 状态机邻接表。
export const DIAGNOSTIC_SESSION_STATUS_TRANSITIONS: Record<
  DiagnosticSessionStatus,
  readonly DiagnosticSessionStatus[]
> = {
  DRAFT: ["REVIEWED", "BLOCKED", "SUPERSEDED"],
  REVIEWED: [
    "FIRST_LOOP_SELECTED",
    "DRAFT",                 // 退回销售补诊断材料
    "BLOCKED",
    "SUPERSEDED",
  ],
  FIRST_LOOP_SELECTED: [
    "REVIEWED",              // 客户改写关键前提时回退
    "BLOCKED",
    "SUPERSEDED",
  ],
  BLOCKED: ["DRAFT", "SUPERSEDED"],
  SUPERSEDED: [],
};

export function isValidDiagnosticSessionStatusTransition(
  from: DiagnosticSessionStatus,
  to: DiagnosticSessionStatus,
) {
  if (from === to) return true;
  return DIAGNOSTIC_SESSION_STATUS_TRANSITIONS[from].includes(to);
}

// V2.3 §6.5 硬约束：进入 FIRST_LOOP_SELECTED 必须满足 4 个维度（business goal /
// resources / first loop / proof collection）+ firstLoopCandidateType 已选。
// rolesEngaged / riskCommitmentsBoundedAsPrerequisites 是 reviewer 必读但允许
// 用 boundary note 显式承认仍在补齐。
export function canEnterFirstLoopSelected(
  readiness: DiagnosticSessionRoleReadiness,
  firstLoopType: FirstLoopType | null,
): { ok: true } | { ok: false; missing: string[] } {
  const missing: string[] = [];
  if (!readiness.businessGoalClear) missing.push("businessGoalClear");
  if (!readiness.resourcesConnectable) missing.push("resourcesConnectable");
  if (!readiness.firstLoopAvailable) missing.push("firstLoopAvailable");
  if (!readiness.proofCollectionReady) missing.push("proofCollectionReady");
  if (!firstLoopType) missing.push("firstLoopCandidateType");
  if (missing.length > 0) return { ok: false, missing };
  return { ok: true };
}
