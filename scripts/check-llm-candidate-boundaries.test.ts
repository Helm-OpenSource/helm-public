import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runLlmCandidateBoundaryCheck } from "@/scripts/check-llm-candidate-boundaries";

let tempRoot: string;

function writeFile(relativePath: string, content: string): void {
  const absolute = path.join(tempRoot, relativePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, content);
}

describe("check-llm-candidate-boundaries", () => {
  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "helm-llm-candidate-"));
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it("passes candidate-only critic modules", () => {
    writeFile(
      "lib/llm-workflows/example.ts",
      `
        import type { LLMCriticResult } from "@/lib/llm/intelligence-contracts";
        export const result: LLMCriticResult = {
          resultId: "r",
          candidateId: "c",
          packetId: "p",
          reviewState: "needs_review",
          requiredHumanReview: true,
          approvedForReview: false,
          issueCodes: [],
          issueNotes: [],
          missingEvidenceIds: [],
          counterarguments: [],
          boundaryDecision: "advisory_only"
        };
      `,
    );

    expect(runLlmCandidateBoundaryCheck(tempRoot).ok).toBe(true);
  });

  it("rejects unsafe review state literals", () => {
    writeFile(
      "lib/llm-workflows/example.ts",
      `
        import type { JudgementCandidate } from "@/lib/llm/intelligence-contracts";
        export const result: JudgementCandidate = {
          reviewState: "approved"
        } as JudgementCandidate;
      `,
    );

    const result = runLlmCandidateBoundaryCheck(tempRoot);

    expect(result.ok).toBe(false);
    expect(result.violations[0]?.rule).toBe("LLM-CANDIDATE-A");
  });

  it("rejects direct feedback writer imports from critic modules", () => {
    writeFile(
      "lib/recommendations/example.ts",
      `
        import type { LLMCriticResult } from "@/lib/llm/intelligence-contracts";
        import { submitRecommendationFeedback } from "@/lib/recommendations/recommendation-feedback.service";
        export type Result = LLMCriticResult;
        void submitRecommendationFeedback;
      `,
    );

    const result = runLlmCandidateBoundaryCheck(tempRoot);

    expect(result.ok).toBe(false);
    expect(result.violations[0]?.rule).toBe("LLM-CANDIDATE-B");
  });

  it("rejects direct Prisma preference writes from critic modules", () => {
    writeFile(
      "lib/recommendations/example.ts",
      `
        import type { LLMCriticResult } from "@/lib/llm/intelligence-contracts";
        import { db } from "@/lib/db";
        export async function persist(result: LLMCriticResult) {
          await db.preferenceSignal.create({ data: { id: result.resultId } });
        }
      `,
    );

    const result = runLlmCandidateBoundaryCheck(tempRoot);

    expect(result.ok).toBe(false);
    expect(result.violations[0]?.detail).toContain("must not directly write");
  });

  it("allows only transactional DRAFT/PENDING candidate materialization", () => {
    writeFile(
      "lib/llm/governed-candidate-materializer.ts",
      `
        import type { GovernedJudgementCandidate } from "@/lib/llm/governed-runtime-contracts";
        export async function materializeGovernedJudgementCandidate(candidate: GovernedJudgementCandidate) {
          return db.$transaction(async (tx) => {
            await tx.artifactBundle.create({ data: { status: ArtifactBundleStatus.DRAFT, systemOfRecordWrite: false } });
            await tx.artifactReview.create({ data: { status: ArtifactReviewStatus.PENDING } });
            await tx.auditLog.create({ data: { targetId: candidate.candidateId } });
          });
        }
      `,
    );

    expect(runLlmCandidateBoundaryCheck(tempRoot).ok).toBe(true);
  });

  it("rejects governed candidate materialization that creates an action or approval", () => {
    writeFile(
      "lib/llm/governed-candidate-materializer.ts",
      `
        import type { GovernedJudgementCandidate } from "@/lib/llm/governed-runtime-contracts";
        export async function materializeGovernedJudgementCandidate(candidate: GovernedJudgementCandidate) {
          await db.actionItem.create({ data: { title: candidate.candidateId } });
        }
      `,
    );

    const result = runLlmCandidateBoundaryCheck(tempRoot);
    expect(result.ok).toBe(false);
    expect(result.violations.some((v) => v.rule === "LLM-CANDIDATE-I")).toBe(true);
    expect(result.violations.some((v) => v.rule === "LLM-CANDIDATE-B")).toBe(true);
  });

  it("allows only capability-gated pending CREATE_TASK promotion", () => {
    writeFile(
      "lib/governed-intelligence/governed-candidate-review.ts",
      `
        export async function promoteGovernedJudgementCandidateToTask() {
          await assertWorkspaceGovernedCandidatePromotionServiceAccess({ actorType: ActorType.USER });
          return db.$transaction(async (tx) => {
            if (review.status !== ArtifactReviewStatus.CONFIRMED) return null;
            await tx.artifactBundle.updateMany({ data: { status: ArtifactBundleStatus.CONSUMED } });
            const action = await tx.actionItem.create({ data: {
              actionType: ActionType.CREATE_TASK,
              executionMode: ActionExecutionMode.REQUIRES_APPROVAL,
              contentAuthorship: ActorType.AI
            } });
            return tx.approvalTask.create({ data: {
              actionItemId: action.id,
              status: ApprovalStatus.PENDING,
              autoExecute: false
            } });
          });
        }
      `,
    );

    expect(runLlmCandidateBoundaryCheck(tempRoot).ok).toBe(true);
  });

  it("rejects candidate promotion that executes or skips pending approval", () => {
    writeFile(
      "lib/governed-intelligence/governed-candidate-review.ts",
      `
        export async function promoteGovernedJudgementCandidateToTask() {
          return executeActionItem("action-1");
        }
      `,
    );

    const result = runLlmCandidateBoundaryCheck(tempRoot);
    expect(result.ok).toBe(false);
    expect(result.violations.some((v) => v.rule === "LLM-CANDIDATE-J")).toBe(
      true,
    );
  });

  it("rejects LLM candidate modules importing the human promotion service", () => {
    writeFile(
      "lib/llm/example.ts",
      `
        import type { GovernedJudgementCandidate } from "@/lib/llm/governed-runtime-contracts";
        import { promoteGovernedJudgementCandidateToTask } from "@/lib/governed-intelligence/governed-candidate-review";
        export type Candidate = GovernedJudgementCandidate;
        void promoteGovernedJudgementCandidateToTask;
      `,
    );

    const result = runLlmCandidateBoundaryCheck(tempRoot);
    expect(result.ok).toBe(false);
    expect(result.violations.some((v) => v.rule === "LLM-CANDIDATE-B")).toBe(
      true,
    );
  });

  it("does not reject boundary wording inside prompt text", () => {
    writeFile(
      "lib/llm/example.ts",
      `
        import type { LLMCriticResult } from "@/lib/llm/intelligence-contracts";
        export const prompt = [
          "Do not create PreferenceSignal, PatternFact, ApprovalTask, or MemoryPromotion.",
          "Do not call connector activation or runCrmImport."
        ].join("\\n");
        export type Result = LLMCriticResult;
      `,
    );

    expect(runLlmCandidateBoundaryCheck(tempRoot).ok).toBe(true);
  });

  it("rejects banned v2 terms in candidate-aware modules", () => {
    writeFile(
      "lib/llm/example.ts",
      `
        import type { CounterfactualReviewerOutput } from "@/lib/llm/intelligence-contracts-v2";
        export const connectorHandle = "x";
        export type Result = CounterfactualReviewerOutput;
      `,
    );
    const result = runLlmCandidateBoundaryCheck(tempRoot);
    expect(result.ok).toBe(false);
    expect(result.violations[0]?.rule).toBe("LLM-CANDIDATE-C");
  });

  it("rejects a hard-coded skipped scan status in a source module", () => {
    writeFile(
      "lib/llm/example.ts",
      `
        export const receipt = { promptInjectionScanResult: { status: "skipped" } };
      `,
    );
    const result = runLlmCandidateBoundaryCheck(tempRoot);
    expect(result.ok).toBe(false);
    expect(result.violations.some((v) => v.rule === "LLM-CANDIDATE-D")).toBe(true);
  });

  it("rejects passing a selection receipt into an LLM prompt", () => {
    writeFile(
      "lib/llm-workflows/example.ts",
      `
        import type { LLMContextSelectionReceipt } from "@/lib/llm/intelligence-contracts-v2";
        export function buildPrompt(receipt: LLMContextSelectionReceipt) {
          return { userPrompt: JSON.stringify(receipt) };
        }
      `,
    );
    const result = runLlmCandidateBoundaryCheck(tempRoot);
    expect(result.ok).toBe(false);
    expect(result.violations.some((v) => v.rule === "LLM-CANDIDATE-E")).toBe(true);
  });

  it("rejects serializing a selection receipt even without a userPrompt literal", () => {
    writeFile(
      "lib/llm-workflows/example.ts",
      `
        import type { LLMContextSelectionReceipt } from "@/lib/llm/intelligence-contracts-v2";
        export function leak(receipt: LLMContextSelectionReceipt) {
          const blob = JSON.stringify(receipt);
          return blob;
        }
      `,
    );
    const result = runLlmCandidateBoundaryCheck(tempRoot);
    expect(result.ok).toBe(false);
    expect(result.violations.some((v) => v.rule === "LLM-CANDIDATE-E")).toBe(true);
  });

  it("allows referencing the selection receipt without a prompt/serialize/dispatch sink", () => {
    writeFile(
      "lib/llm/example.ts",
      `
        import type { LLMContextSelectionReceipt } from "@/lib/llm/intelligence-contracts-v2";
        import type { SelectedContextStub } from "@/lib/llm/intelligence-contracts-v2";
        export function pick(receipt: LLMContextSelectionReceipt): SelectedContextStub["objectRef"] {
          return receipt.objectRef;
        }
      `,
    );
    expect(runLlmCandidateBoundaryCheck(tempRoot).ok).toBe(true);
  });

  it("accepts the stub being passed into a prompt", () => {
    writeFile(
      "lib/llm-workflows/example.ts",
      `
        import type { SelectedContextStub } from "@/lib/llm/intelligence-contracts-v2";
        export function buildPrompt(stub: SelectedContextStub) {
          return { userPrompt: JSON.stringify(stub.selectedEvidenceRefs) };
        }
      `,
    );
    expect(runLlmCandidateBoundaryCheck(tempRoot).ok).toBe(true);
  });

  it("rejects passing rich local context directly into a prompt", () => {
    writeFile(
      "lib/llm-workflows/example.ts",
      `
        import type { RichLocalContextBundle } from "@/lib/llm/intelligence-contracts-v3";
        export function buildPrompt(bundle: RichLocalContextBundle) {
          return { userPrompt: JSON.stringify(bundle) };
        }
      `,
    );
    const result = runLlmCandidateBoundaryCheck(tempRoot);
    expect(result.ok).toBe(false);
    expect(result.violations.some((v) => v.rule === "LLM-CANDIDATE-F")).toBe(true);
  });

  it("rejects passing a private context build receipt into a prompt", () => {
    writeFile(
      "lib/llm-workflows/example.ts",
      `
        import type { PrivateContextBuildReceipt } from "@/lib/llm/governed-runtime-contracts";
        export function buildPrompt(receipt: PrivateContextBuildReceipt) {
          return { userPrompt: JSON.stringify(receipt) };
        }
      `,
    );
    const result = runLlmCandidateBoundaryCheck(tempRoot);
    expect(result.ok).toBe(false);
    expect(result.violations.some((v) => v.rule === "LLM-CANDIDATE-H")).toBe(true);
  });

  it("rejects passing a context egress decision receipt into a prompt", () => {
    writeFile(
      "lib/llm-workflows/example.ts",
      `
        import type { ContextEgressDecisionReceipt } from "@/lib/llm/governed-runtime-contracts";
        export function buildPrompt(receipt: ContextEgressDecisionReceipt) {
          return { userPrompt: JSON.stringify(receipt) };
        }
      `,
    );
    const result = runLlmCandidateBoundaryCheck(tempRoot);
    expect(result.ok).toBe(false);
    expect(result.violations.some((v) => v.rule === "LLM-CANDIDATE-H")).toBe(true);
  });

  it("rejects passing a private context receipt through a system prompt sink", () => {
    writeFile(
      "lib/llm-workflows/example.ts",
      `
        import type { ContextEgressDecisionReceipt } from "@/lib/llm/governed-runtime-contracts";
        export function renderPrompt(receipt: ContextEgressDecisionReceipt) {
          return { systemPrompt: JSON.stringify(receipt) };
        }
      `,
    );
    const result = runLlmCandidateBoundaryCheck(tempRoot);
    expect(result.ok).toBe(false);
    expect(result.violations.some((v) => v.rule === "LLM-CANDIDATE-H")).toBe(true);
  });

  it("allows private context receipts to be serialized for local audit storage", () => {
    writeFile(
      "lib/llm/example.ts",
      `
        import type { PrivateContextBuildReceipt } from "@/lib/llm/governed-runtime-contracts";
        export function serializeAuditReceipt(receipt: PrivateContextBuildReceipt) {
          return JSON.stringify(receipt);
        }
      `,
    );
    expect(runLlmCandidateBoundaryCheck(tempRoot).ok).toBe(true);
  });

  it("allows projected v3 stubs to enter prompt builders", () => {
    writeFile(
      "lib/llm-workflows/example.ts",
      `
        import type { SelectedContextStub } from "@/lib/llm/intelligence-contracts-v2";
        import type { ContextProjectionReceipt } from "@/lib/llm/intelligence-contracts-v3";
        export function buildPrompt(receipt: ContextProjectionReceipt, stub: SelectedContextStub) {
          void receipt.remoteSafe;
          return { userPrompt: JSON.stringify(stub.selectedEvidenceRefs) };
        }
      `,
    );
    expect(runLlmCandidateBoundaryCheck(tempRoot).ok).toBe(true);
  });

  it("rejects serializing a context projection receipt into a prompt", () => {
    writeFile(
      "lib/llm-workflows/example.ts",
      `
        import type { ContextProjectionReceipt } from "@/lib/llm/intelligence-contracts-v3";
        export function buildPrompt(projectionReceipt: ContextProjectionReceipt) {
          return { userPrompt: JSON.stringify(projectionReceipt) };
        }
      `,
    );
    const result = runLlmCandidateBoundaryCheck(tempRoot);
    expect(result.ok).toBe(false);
    expect(result.violations.some((v) => v.rule === "LLM-CANDIDATE-F")).toBe(true);
  });

  it("rejects passing a trajectory receipt directly into a prompt", () => {
    writeFile(
      "lib/llm-workflows/example.ts",
      `
        import type { LLMTaskTrajectoryReceipt } from "@/lib/llm/intelligence-contracts-v3";
        export function buildPrompt(receipt: LLMTaskTrajectoryReceipt) {
          return { userPrompt: JSON.stringify(receipt) };
        }
      `,
    );
    const result = runLlmCandidateBoundaryCheck(tempRoot);
    expect(result.ok).toBe(false);
    expect(result.violations.some((v) => v.rule === "LLM-CANDIDATE-F")).toBe(true);
  });

  it("rejects assignment-style external fetch calls from critic modules", () => {
    writeFile(
      "lib/llm-workflows/example.ts",
      `
        import type { LLMCriticResult } from "@/lib/llm/intelligence-contracts";
        export async function send(result: LLMCriticResult) {
          const response = await fetch("https://example.invalid/send", {
            method: "POST",
            body: result.resultId,
          });
          return response;
        }
      `,
    );

    const result = runLlmCandidateBoundaryCheck(tempRoot);

    expect(result.ok).toBe(false);
    expect(result.violations[0]?.detail).toContain("external sends");
  });

  it("rejects a v3 multi-pass workflow that bypasses the registered execution chain", () => {
    writeFile(
      "lib/llm-workflows/multi-pass-review.workflow.ts",
      `
        import type { ModelCapabilityProfile } from "@/lib/llm/intelligence-contracts-v3";
        export async function executeMultiPassReview(profile: ModelCapabilityProfile) {
          return { profile, reviewState: "candidate" };
        }
      `,
    );

    const result = runLlmCandidateBoundaryCheck(tempRoot);
    expect(result.ok).toBe(false);
    expect(result.violations.some((v) => v.rule === "LLM-CANDIDATE-G")).toBe(true);
  });
});
