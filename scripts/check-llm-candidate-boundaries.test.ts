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
});
