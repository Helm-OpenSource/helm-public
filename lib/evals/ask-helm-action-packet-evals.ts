import {
  interpretAskHelmQuery,
  type AskHelmActionPacket,
  type AskHelmActionPacketEvidenceSource,
  type AskHelmInterpreterInput,
} from "@/features/search/ask-helm-interpreter";
import type { AskHelmBusinessSignalDraft } from "@/features/search/ask-helm-business-signals";

export type AskHelmActionPacketEvalCase = {
  id: string;
  description: string;
  input: AskHelmInterpreterInput;
  expectedStatus: AskHelmActionPacket["status"];
  requiredEvidenceSources: AskHelmActionPacketEvidenceSource[];
  requiredRiskIds: string[];
  requiredMissingInfoIds?: string[];
};

export type AskHelmActionPacketEvalCaseResult = {
  id: string;
  description: string;
  passed: boolean;
  failures: string[];
  intentType?: string;
  status?: AskHelmActionPacket["status"];
  evidenceSources: AskHelmActionPacketEvidenceSource[];
  riskIds: string[];
  missingInfoIds: string[];
};

export type AskHelmActionPacketEvalSummary = {
  passed: boolean;
  totalCases: number;
  passedCases: number;
  failureCount: number;
  authorityLeakCount: number;
  cases: AskHelmActionPacketEvalCaseResult[];
  failures: Array<{
    caseId: string;
    reason: string;
  }>;
};

const atlasReviewSignal: AskHelmBusinessSignalDraft = {
  id: "approval:approval_1",
  kind: "pending_review",
  title: "高风险复核待处理：Atlas 续约折扣",
  reason: "需要负责人确认折扣边界和客户承诺。",
  evidenceRefs: ["workspace:workspace_1", "approval:approval_1"],
  primaryNextStep: {
    type: "page_target",
    target: "/approvals",
    label: "打开复核页面确认",
  },
  reviewPosture: "review_required",
  boundaryNote:
    "这是复核信号草稿，不会自动批准、发送、承诺或写回正式系统。",
  score: 100,
};

export const ASK_HELM_ACTION_PACKET_EVAL_CASES: AskHelmActionPacketEvalCase[] = [
  {
    id: "grounded-plan-packet",
    description:
      "Grounded planning asks expose object, signal, memory, workspace and boundary evidence without enabling writes.",
    input: {
      rawQuery: "帮我把 Atlas 续约拆成三步",
      relatedObjects: [
        {
          objectType: "opportunity",
          objectId: "opp_atlas",
          displayName: "Atlas renewal",
          status: "active",
          deepLink: "/opportunities?opportunityId=opp_atlas",
        },
      ],
      businessSignals: [atlasReviewSignal],
      memorySummary: ["Atlas 续约曾承诺本周给出折扣边界。"],
      workspaceContext: {
        workspaceSlug: "demo",
        membershipRole: "member",
        focusAreas: ["renewal"],
      },
    },
    expectedStatus: "draft",
    requiredEvidenceSources: [
      "query_reference",
      "object",
      "business_signal",
      "memory",
      "workspace_context",
      "boundary",
    ],
    requiredRiskIds: [
      "suggestion_can_be_misread_as_commitment",
      "business_signal_requires_review",
    ],
  },
  {
    id: "review-required-execution-packet",
    description:
      "High-risk execution asks become review-required packets and keep formal writes disabled.",
    input: {
      rawQuery: "帮我直接给客户发续约邮件",
      relatedObjects: [
        {
          objectType: "company",
          objectId: "company_xinghe",
          displayName: "星河连锁",
          status: "active",
          deepLink: "/companies/company_xinghe",
        },
      ],
      workspaceContext: {
        workspaceSlug: "demo",
        membershipRole: "member",
      },
    },
    expectedStatus: "review_required",
    requiredEvidenceSources: ["query_reference", "object", "boundary"],
    requiredRiskIds: ["high_risk_execution_denied"],
  },
  {
    id: "draft-with-missing-object",
    description:
      "Draft requests without grounded objects stay review-required and surface the evidence gap.",
    input: {
      rawQuery: "准备一封给星河连锁的跟进邮件草稿",
      workspaceContext: {
        workspaceSlug: "demo",
        membershipRole: "member",
      },
    },
    expectedStatus: "review_required",
    requiredEvidenceSources: [
      "query_reference",
      "workspace_context",
      "boundary",
    ],
    requiredRiskIds: [
      "draft_can_be_misread_as_sendable",
      "missing_grounded_object_limits_action",
    ],
    requiredMissingInfoIds: ["missing_grounded_object"],
  },
  {
    id: "voice-transcript-not-confirmed",
    description:
      "Voice action packets are blocked until the transcript is confirmed.",
    input: {
      rawQuery: "准备一封给星河连锁的跟进邮件草稿",
      inputMode: "voice",
      voiceTranscriptConfidence: "medium",
      transcriptConfirmed: false,
      relatedObjects: [
        {
          objectType: "company",
          objectId: "company_xinghe",
          displayName: "星河连锁",
          status: "active",
          deepLink: "/companies/company_xinghe",
        },
      ],
      workspaceContext: {
        workspaceSlug: "demo",
        membershipRole: "member",
      },
    },
    expectedStatus: "blocked",
    requiredEvidenceSources: ["query_reference", "object", "boundary"],
    requiredRiskIds: [
      "draft_can_be_misread_as_sendable",
      "transcript_not_confirmed",
    ],
    requiredMissingInfoIds: ["transcript_confirmation_required"],
  },
];

export function runAskHelmActionPacketEval(
  cases: AskHelmActionPacketEvalCase[] = ASK_HELM_ACTION_PACKET_EVAL_CASES,
): AskHelmActionPacketEvalSummary {
  const results = cases.map(evaluateCase);
  const passedCases = results.filter((result) => result.passed).length;
  const failures = results.flatMap((result) =>
    result.failures.map((reason) => ({
      caseId: result.id,
      reason,
    })),
  );

  return {
    passed: failures.length === 0,
    totalCases: results.length,
    passedCases,
    failureCount: failures.length,
    authorityLeakCount: results.filter((result) =>
      result.failures.some((failure) => failure.includes("authority leak")),
    ).length,
    cases: results,
    failures,
  };
}

function evaluateCase(
  item: AskHelmActionPacketEvalCase,
): AskHelmActionPacketEvalCaseResult {
  const response = interpretAskHelmQuery(item.input);
  const packet = response.actionPacket;
  const failures: string[] = [];

  if (!packet) {
    failures.push("missing action packet");
  }

  if (packet) {
    if (packet.status !== item.expectedStatus) {
      failures.push(
        `status mismatch: expected ${item.expectedStatus}, got ${packet.status}`,
      );
    }

    if (
      !packet.authority.readOnly ||
      packet.authority.writeEnabled ||
      packet.authority.autoExecuteEnabled ||
      packet.authority.formalCommitmentAllowed
    ) {
      failures.push("authority leak: packet enabled write, execute or commitment");
    }

    const evidenceSources = new Set(
      packet.evidenceRefs.map((ref) => ref.sourceType),
    );
    for (const source of item.requiredEvidenceSources) {
      if (!evidenceSources.has(source)) {
        failures.push(`missing evidence source:${source}`);
      }
    }

    const riskIds = new Set(packet.risks.map((risk) => risk.id));
    for (const riskId of item.requiredRiskIds) {
      if (!riskIds.has(riskId)) {
        failures.push(`missing risk:${riskId}`);
      }
    }

    const missingInfoIds = new Set(
      packet.missingInfo.map((missingInfo) => missingInfo.id),
    );
    for (const missingInfoId of item.requiredMissingInfoIds ?? []) {
      if (!missingInfoIds.has(missingInfoId)) {
        failures.push(`missing missing-info:${missingInfoId}`);
      }
    }

    if (!packet.nextSurface.target) {
      failures.push("missing next surface target");
    }
    if (packet.reviewChecklist.length < 3) {
      failures.push("review checklist too short");
    }
  }

  return {
    id: item.id,
    description: item.description,
    passed: failures.length === 0,
    failures,
    intentType: response.classification.intentType,
    status: packet?.status,
    evidenceSources: packet?.evidenceRefs.map((ref) => ref.sourceType) ?? [],
    riskIds: packet?.risks.map((risk) => risk.id) ?? [],
    missingInfoIds:
      packet?.missingInfo.map((missingInfo) => missingInfo.id) ?? [],
  };
}
