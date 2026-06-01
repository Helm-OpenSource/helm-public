import type { PilotReadinessModel, ReadinessGate } from "@/lib/operating-system/types";

type DiagnosticsDataLike = {
  recommendationQuality: {
    goldenSummary: { passRate: number };
    acceptanceRate: number;
  };
  memoryQuality: {
    goldenSummary: { passRate: number };
    correctionRate: number;
  };
  llmOverview: {
    fallbackCount: number;
    totalCalls: number;
  };
  captureOverview: {
    failedSessions: number;
    totalSessions: number;
    averageConfidence: number;
  };
  crmSources: Array<unknown>;
  importJobs: Array<{ failedRecords: number; warningRecords: number }>;
  identityReviewCount: number;
  pendingApprovals: number;
  recentAuditCount: number;
};

function createGate(
  id: string,
  label: string,
  status: ReadinessGate["status"],
  summary: string,
): ReadinessGate {
  return { id, label, status, summary };
}

function scoreGate(status: ReadinessGate["status"]) {
  if (status === "ready") return 25;
  if (status === "watch") return 15;
  return 6;
}

export function buildPilotReadinessModel(
  data: DiagnosticsDataLike,
  english = false,
): PilotReadinessModel {
  const recommendationGate =
    data.recommendationQuality.goldenSummary.passRate >= 75 &&
    data.recommendationQuality.acceptanceRate >= 45
      ? createGate(
          "recommendation",
          english ? "Recommendation quality" : "Recommendation 质量",
          "ready",
          english
            ? "Recommendation quality is good enough to keep using as a front-line judgement layer."
            : "Recommendation 质量已经足够承担前线判断层。",
        )
      : data.recommendationQuality.goldenSummary.passRate >= 60
        ? createGate(
            "recommendation",
            english ? "Recommendation quality" : "Recommendation 质量",
            "watch",
            english
              ? "Recommendation quality is usable, but still needs tighter acceptance before scaling."
              : "Recommendation 质量可用，但在继续放量前还需要更稳的接受率。",
          )
        : createGate(
            "recommendation",
            english ? "Recommendation quality" : "Recommendation 质量",
            "blocked",
            english
              ? "Recommendation quality is still too unstable to be treated as a scaling-ready control layer."
              : "Recommendation 质量还不够稳，暂时不能当成可放量的控制层。",
          );

  const memoryGate =
    data.memoryQuality.goldenSummary.passRate >= 75 &&
    data.memoryQuality.correctionRate <= 25
      ? createGate(
          "memory",
          english ? "Memory stability" : "记忆稳定度",
          "ready",
          english
            ? "Memory extraction and correction rates are in a healthy zone."
            : "记忆抽取和修正率都处在健康区间。",
        )
      : data.memoryQuality.goldenSummary.passRate >= 60
        ? createGate(
            "memory",
            english ? "Memory stability" : "记忆稳定度",
            "watch",
            english
              ? "Memory is useful, but still being corrected often enough that downstream actions need caution."
              : "记忆已经有用，但修正仍然偏频繁，下游动作还要保留谨慎边界。",
          )
        : createGate(
            "memory",
            english ? "Memory stability" : "记忆稳定度",
            "blocked",
            english
              ? "Memory is not stable enough yet to become a dependable operating substrate."
              : "记忆还不够稳定，暂时不能成为可依赖的经营底座。",
          );

  const ingressGate =
    data.crmSources.length > 0 && data.identityReviewCount <= 5
      ? createGate(
          "ingress",
          english ? "Data ingress" : "数据入口",
          "ready",
          english
            ? "CRM and imported operating data are already connected with a manageable review load."
            : "CRM 和导入信号已经接入，且复核负载可控。",
        )
      : data.crmSources.length > 0
        ? createGate(
            "ingress",
            english ? "Data ingress" : "数据入口",
            "watch",
            english
              ? "Data is arriving, but identity review still creates drag on the pilot."
              : "数据已经进来，但身份绑定复核仍在拖慢试点推进。",
          )
        : createGate(
            "ingress",
            english ? "Data ingress" : "数据入口",
            "blocked",
            english
              ? "Without CRM / import ingress, the pilot is still running on a thin data base."
              : "没有 CRM / 导入入口时，试点仍在薄数据底座上运行。",
          );

  const governanceGate =
    data.pendingApprovals <= 6 && data.recentAuditCount > 0
      ? createGate(
          "governance",
          english ? "Governance loop" : "治理回路",
          "ready",
          english
            ? "Approval and audit loops are active enough to trust controlled action handling."
            : "审批和审计回路已经足够活跃，可以支撑受控动作处理。",
        )
      : data.recentAuditCount > 0
        ? createGate(
            "governance",
            english ? "Governance loop" : "治理回路",
            "watch",
            english
              ? "Governance exists, but the approval queue is starting to accumulate."
              : "治理能力已经存在，但审批队列开始积压。",
          )
        : createGate(
            "governance",
            english ? "Governance loop" : "治理回路",
            "blocked",
            english
              ? "Without meaningful audit activity, the pilot is still weak on trust."
              : "如果没有足够的审计活动，试点在信任层仍然偏弱。",
          );

  const gates = [
    recommendationGate,
    memoryGate,
    ingressGate,
    governanceGate,
  ];
  const score = Math.min(
    100,
    gates.reduce((sum, gate) => sum + scoreGate(gate.status), 0),
  );
  const stage: PilotReadinessModel["stage"] =
    score >= 82
      ? "scalable"
      : score >= 58
        ? "usable"
        : "unstable";

  return {
    score,
    stage,
    headline:
      stage === "scalable"
        ? english
          ? "The pilot is close to a scale-ready operating system."
          : "这套试点已经接近可放量的经营操作系统。"
        : stage === "usable"
          ? english
            ? "The pilot is usable, but still needs a few gates tightened before expansion."
            : "这套试点已经可用，但继续扩大前还要再收紧几道门。"
          : english
            ? "The pilot is still unstable and should stay in controlled mode."
            : "这套试点还不够稳，应继续保持受控状态。",
    summary:
      stage === "scalable"
        ? english
          ? "Recommendation, memory, data ingress and governance are starting to behave like one system instead of separate features."
          : "Recommendation、经营记忆、数据入口和治理已经开始像一个系统协同，而不再只是分散功能。"
        : stage === "usable"
          ? english
            ? "The core loop works, but memory, approvals or ingress still leave visible drag."
            : "核心环路已经跑通，但记忆、审批或入口层还有明显拖拽。"
          : english
            ? "The product still relies too much on thin data or unstable judgement, so it should not be over-claimed yet."
            : "当前产品仍比较依赖薄数据或不够稳的判断层，还不应该被过度承诺。",
    gates,
    recommendedSkillIds: [
      "pilot-readiness-diagnostics",
      "approval-review",
      "memory-correction",
    ],
  };
}
