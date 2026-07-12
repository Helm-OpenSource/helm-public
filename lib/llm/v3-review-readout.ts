import { z } from "zod";

import { evaluateLLMTaskTrajectory } from "@/lib/llm/trajectory-harness";
import {
  judgementProposalBundleSchema,
  llmTaskTrajectoryReceiptSchema,
  sourceToSignalProposalBundleSchema,
  V3_SOURCE_PROPOSAL_FORBIDDEN_CAPABILITIES,
} from "@/lib/llm/intelligence-contracts-v3";
import { multiPassBoundaryReceiptSchema } from "@/lib/llm/multi-pass-contract";

export const LLM_V3_REVIEW_READOUT_RULE_VERSION =
  "llm-v3-review-readout/v1" as const;

export const LLM_V3_REVIEW_FORBIDDEN_CAPABILITIES =
  V3_SOURCE_PROPOSAL_FORBIDDEN_CAPABILITIES;

export const LLM_V3_REVIEW_EVIDENCE_KINDS = [
  "judgement_proposal",
  "source_to_signal_proposal",
  "task_trajectory",
  "multi_pass_boundary",
] as const;

const llmV3ReviewFixtureSchema = z
  .object({
    fixtureKind: z.literal("llm_v3_review"),
    fixtureVersion: z.literal("llm-v3-review.synthetic/v1"),
    generatedAt: z.string().datetime(),
    syntheticOnly: z.literal(true),
    judgementProposal: judgementProposalBundleSchema,
    sourceToSignalProposal: sourceToSignalProposalBundleSchema,
    trajectoryReceipt: llmTaskTrajectoryReceiptSchema,
    multiPassBoundaryReceipt: multiPassBoundaryReceiptSchema,
  })
  .strict()
  .superRefine((fixture, context) => {
    const sourceProposal = fixture.sourceToSignalProposal;
    const forbiddenCapabilities = new Set(
      sourceProposal.forbiddenCapabilityRefs,
    );

    if (!sourceProposal.sourceCandidateRef.startsWith("candidate-")) {
      context.addIssue({
        code: "custom",
        path: ["sourceToSignalProposal", "sourceCandidateRef"],
        message: "source candidate refs must use the candidate- prefix",
      });
    }
    if (sourceProposal.candidateOrigin !== "ai") {
      context.addIssue({
        code: "custom",
        path: ["sourceToSignalProposal", "candidateOrigin"],
        message: "the public review fixture must identify its AI candidate origin",
      });
    }
    if (sourceProposal.modelProfileKey !== "synthetic-local-v3") {
      context.addIssue({
        code: "custom",
        path: ["sourceToSignalProposal", "modelProfileKey"],
        message: "the public review fixture must use the synthetic local profile",
      });
    }
    if (sourceProposal.redactionProvenance !== "public_safe_synthetic") {
      context.addIssue({
        code: "custom",
        path: ["sourceToSignalProposal", "redactionProvenance"],
        message: "the public review fixture must carry public-safe synthetic provenance",
      });
    }

    for (const capability of LLM_V3_REVIEW_FORBIDDEN_CAPABILITIES) {
      if (!forbiddenCapabilities.has(capability)) {
        context.addIssue({
          code: "custom",
          path: ["sourceToSignalProposal", "forbiddenCapabilityRefs"],
          message: `the public review fixture must forbid ${capability}`,
        });
      }
    }

    if (
      forbiddenCapabilities.size !==
        LLM_V3_REVIEW_FORBIDDEN_CAPABILITIES.length ||
      sourceProposal.forbiddenCapabilityRefs.length !==
        LLM_V3_REVIEW_FORBIDDEN_CAPABILITIES.length
    ) {
      context.addIssue({
        code: "custom",
        path: ["sourceToSignalProposal", "forbiddenCapabilityRefs"],
        message: "the public review fixture must use the canonical capability set once each",
      });
    }

    if (
      fixture.trajectoryReceipt.modelProfileKey !==
      sourceProposal.modelProfileKey
    ) {
      context.addIssue({
        code: "custom",
        path: ["trajectoryReceipt", "modelProfileKey"],
        message: "trajectory and source proposal model profiles must match",
      });
    }
    if (
      fixture.multiPassBoundaryReceipt.profileKey !==
      sourceProposal.modelProfileKey
    ) {
      context.addIssue({
        code: "custom",
        path: ["multiPassBoundaryReceipt", "profileKey"],
        message: "multi-pass and source proposal model profiles must match",
      });
    }
    if (fixture.trajectoryReceipt.redactionStatus !== "synthetic") {
      context.addIssue({
        code: "custom",
        path: ["trajectoryReceipt", "redactionStatus"],
        message: "the public review trajectory must be synthetic",
      });
    }
  });

type LlmV3ReviewFixture = z.infer<typeof llmV3ReviewFixtureSchema>;

export type LlmV3CandidateBoundaryPosture =
  | "candidate_for_human_review"
  | "review_required"
  | "blocked_by_guard";

export interface LlmV3CandidateBoundary {
  readonly posture: LlmV3CandidateBoundaryPosture;
  readonly candidateMayEnterReview: boolean;
  readonly approvalGranted: false;
  readonly sideEffectsAuthorized: false;
  readonly humanDecisionRequired: true;
}

export interface LlmV3ReviewReadout {
  readonly ok: true;
  readonly ruleVersion: typeof LLM_V3_REVIEW_READOUT_RULE_VERSION;
  readonly fixtureKind: LlmV3ReviewFixture["fixtureKind"];
  readonly fixtureVersion: LlmV3ReviewFixture["fixtureVersion"];
  readonly generatedAt: string;
  readonly syntheticOnly: true;
  readonly evidenceKinds: typeof LLM_V3_REVIEW_EVIDENCE_KINDS;
  readonly judgementProposal: LlmV3ReviewFixture["judgementProposal"];
  readonly sourceToSignalProposal: LlmV3ReviewFixture["sourceToSignalProposal"];
  readonly trajectoryReceipt: LlmV3ReviewFixture["trajectoryReceipt"];
  readonly trajectoryEvaluation: ReturnType<typeof evaluateLLMTaskTrajectory>;
  readonly multiPassBoundaryReceipt: LlmV3ReviewFixture["multiPassBoundaryReceipt"];
  readonly candidateBoundary: LlmV3CandidateBoundary;
}

export interface LlmV3ReviewReadoutError {
  readonly ok: false;
  readonly errorCode: "LLM_V3_REVIEW_FIXTURE_INVALID";
  readonly issuePaths: readonly string[];
}

export type LlmV3ReviewReadoutResult =
  | LlmV3ReviewReadout
  | LlmV3ReviewReadoutError;

function formatIssuePaths(error: z.ZodError): string[] {
  const paths = error.issues.flatMap((issue) => {
    const parentPath = issue.path.map(String);
    const unrecognizedKeys =
      "keys" in issue && Array.isArray(issue.keys)
        ? issue.keys.map(String)
        : [];

    if (unrecognizedKeys.length > 0) {
      return unrecognizedKeys.map((key) =>
        [...parentPath, key].join("."),
      );
    }

    return [parentPath.join(".") || "$fixture"];
  });

  return [...new Set(paths)].sort();
}

function resolveCandidateBoundary(
  fixture: LlmV3ReviewFixture,
  trajectoryEvaluation: ReturnType<typeof evaluateLLMTaskTrajectory>,
): LlmV3CandidateBoundary {
  const proposalRejected =
    fixture.judgementProposal.reviewState === "rejected_by_guard" ||
    fixture.sourceToSignalProposal.reviewState === "rejected_by_guard";
  const boundaryRejected = ["reject", "quarantine"].includes(
    fixture.multiPassBoundaryReceipt.boundaryDecision,
  );
  const blocked =
    proposalRejected ||
    boundaryRejected ||
    trajectoryEvaluation.verdict === "fail";
  const candidateMayEnterReview =
    !blocked &&
    trajectoryEvaluation.verdict === "pass" &&
    fixture.judgementProposal.reviewState === "candidate" &&
    fixture.sourceToSignalProposal.reviewState === "candidate" &&
    fixture.multiPassBoundaryReceipt.boundaryDecision === "allow_candidate";

  return {
    posture: blocked
      ? "blocked_by_guard"
      : candidateMayEnterReview
        ? "candidate_for_human_review"
        : "review_required",
    candidateMayEnterReview,
    approvalGranted: false,
    sideEffectsAuthorized: false,
    humanDecisionRequired: true,
  };
}

export function buildV3ReviewReadout(
  input: unknown,
): LlmV3ReviewReadoutResult {
  const parsed = llmV3ReviewFixtureSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errorCode: "LLM_V3_REVIEW_FIXTURE_INVALID",
      issuePaths: formatIssuePaths(parsed.error),
    };
  }

  const trajectoryEvaluation = evaluateLLMTaskTrajectory(
    parsed.data.trajectoryReceipt,
  );

  return {
    ok: true,
    ruleVersion: LLM_V3_REVIEW_READOUT_RULE_VERSION,
    fixtureKind: parsed.data.fixtureKind,
    fixtureVersion: parsed.data.fixtureVersion,
    generatedAt: parsed.data.generatedAt,
    syntheticOnly: true,
    evidenceKinds: LLM_V3_REVIEW_EVIDENCE_KINDS,
    judgementProposal: parsed.data.judgementProposal,
    sourceToSignalProposal: parsed.data.sourceToSignalProposal,
    trajectoryReceipt: parsed.data.trajectoryReceipt,
    trajectoryEvaluation,
    multiPassBoundaryReceipt: parsed.data.multiPassBoundaryReceipt,
    candidateBoundary: resolveCandidateBoundary(
      parsed.data,
      trajectoryEvaluation,
    ),
  };
}
