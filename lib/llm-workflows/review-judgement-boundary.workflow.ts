import {
  buildJudgementBoundaryReviewPrompt,
  judgementBoundaryReviewSchema,
  llmPromptVersions,
} from "@/lib/llm/prompt-registry";
import { safeParseJson } from "@/lib/utils";
import { executeLLMTask } from "@/lib/llm/provider-registry";
import {
  buildFailClosedLLMCriticResult,
  judgementCandidateSchema,
  llmContextPacketSchema,
  llmCriticResultSchema,
  prepareLLMContextPacketForRemoteProvider,
  redactLLMEgressValue,
  type JudgementCandidate,
  type LLMCriticResult,
  type LLMContextPacket,
} from "@/lib/llm/intelligence-contracts";

export interface JudgementBoundaryEgressPolicy {
  providerMode?: "local" | "remote";
  consentGranted?: boolean;
  promptPreviewAccepted?: boolean;
  auditRef?: string;
}

export interface JudgementBoundaryReviewInput {
  workspaceId: string;
  userId?: string | null;
  contextPacket: LLMContextPacket;
  candidate: JudgementCandidate;
  egressPolicy?: JudgementBoundaryEgressPolicy;
  traceId?: string;
}

function buildFallback(input: JudgementBoundaryReviewInput, reason: string): LLMCriticResult {
  return buildFailClosedLLMCriticResult({
    resultId: `${input.candidate.candidateId}:fail_closed`,
    candidateId: input.candidate.candidateId,
    packetId: input.contextPacket.packetId,
    fallbackReason: reason,
    missingEvidenceIds: input.candidate.missingEvidenceIds,
  });
}

export async function reviewJudgementBoundaryWithLLM(
  input: JudgementBoundaryReviewInput,
): Promise<LLMCriticResult> {
  const contextPacket = llmContextPacketSchema.parse(input.contextPacket);
  const candidate = judgementCandidateSchema.parse(input.candidate);
  const fallback = buildFallback(input, "provider_or_parse_failure");
  const providerMode =
    input.egressPolicy?.providerMode ??
    (contextPacket.privacyClass === "public_safe_synthetic" ? "local" : "remote");
  const egress = prepareLLMContextPacketForRemoteProvider(contextPacket, {
    providerMode,
    consentGranted: input.egressPolicy?.consentGranted,
    promptPreviewAccepted: input.egressPolicy?.promptPreviewAccepted,
    auditRef: input.egressPolicy?.auditRef ?? input.traceId,
  });
  if (!egress.ok || !egress.safePacket) {
    return buildFailClosedLLMCriticResult({
      resultId: `${candidate.candidateId}:egress_blocked`,
      candidateId: candidate.candidateId,
      packetId: contextPacket.packetId,
      fallbackReason: egress.audit.blockedReason ?? "llm_context_packet_egress_blocked",
      issueNotes: [
        "Context packet egress was blocked before provider dispatch; human review is required.",
      ],
      missingEvidenceIds: candidate.missingEvidenceIds,
    });
  }
  const safeContextPacket = egress.safePacket;
  const redactedCandidate = redactLLMEgressValue(candidate);
  const safeCandidate = judgementCandidateSchema.parse(redactedCandidate.value);
  const prompt = buildJudgementBoundaryReviewPrompt({
    contextPacket: safeContextPacket,
    candidate: safeCandidate,
  });

  const result = await executeLLMTask<LLMCriticResult>({
    taskType: "JUDGEMENT_BOUNDARY_REVIEW",
    workspaceId: input.workspaceId,
    userId: input.userId ?? undefined,
    promptKey: prompt.promptKey,
    promptVersion: llmPromptVersions.judgementBoundaryReview,
    systemPrompt: prompt.systemPrompt,
    userPrompt: prompt.userPrompt,
    inputSummary: `${candidate.candidateId} 的经营判断边界复核`,
    outputMode: "json",
    jsonSchema: judgementBoundaryReviewSchema,
    maxOutputTokens: safeContextPacket.tokenBudget.maxOutputTokens,
    fallbackOutput: fallback,
    parseOutput(rawText) {
      const parsed = safeParseJson(rawText, fallback);
      const candidateResult = llmCriticResultSchema.safeParse(parsed);
      if (!candidateResult.success) {
        return buildFallback(input, "schema_validation_failure");
      }

      if (
        candidateResult.data.reviewState === "candidate" ||
        candidateResult.data.reviewState === "rejected_by_guard"
      ) {
        return {
          ...candidateResult.data,
          reviewState:
            candidateResult.data.reviewState === "candidate"
              ? "needs_review"
              : "rejected_by_guard",
          requiredHumanReview: true,
          approvedForReview: false,
          issueCodes: [
            ...new Set([
              ...candidateResult.data.issueCodes,
              "BOUNDARY_VIOLATION" as const,
            ]),
          ],
          issueNotes: [
            ...candidateResult.data.issueNotes,
            "Boundary reviewer results remain advisory and require human review.",
          ],
        };
      }

      return candidateResult.data;
    },
  });

  return llmCriticResultSchema.parse(result.output);
}
