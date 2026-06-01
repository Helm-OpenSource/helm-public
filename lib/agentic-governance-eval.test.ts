import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runExternalAgentIntakeEval } from "@/features/external-agent-intake/intake-decision";
import {
  AGENTIC_GOVERNANCE_MESSAGING_DOCUMENT_SCAN_TARGETS,
  loadMessagingScanDocuments,
  printAgenticGovernanceEvalReport,
  runAgenticGovernanceEval,
  type AgenticGovernanceEvalResult,
} from "@/scripts/agentic-governance-eval";

let fixtureRoot: string;

function writeFixture(relativePath: string, content: string): void {
  const fullPath = path.join(fixtureRoot, relativePath);
  mkdirSync(path.dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content, "utf8");
}

function customTarget(relativePath = "docs/product/copy.md") {
  return {
    id: "fixture-copy",
    path: relativePath,
    surface: "requirements" as const,
  };
}

function passingResult(): AgenticGovernanceEvalResult {
  writeFixture(
    customTarget().path,
    "Helm stays review-first, candidate-only, and boundary-aware.",
  );

  return runAgenticGovernanceEval({
    repoRoot: fixtureRoot,
    messagingDocumentScanTargets: [customTarget()],
  });
}

describe("agentic governance eval seam", () => {
  beforeEach(() => {
    fixtureRoot = mkdtempSync(path.join(tmpdir(), "helm-agentic-eval-"));
  });

  afterEach(() => {
    rmSync(fixtureRoot, { force: true, recursive: true });
  });

  it("runs as a pure seam and passes with injected docs scan targets", () => {
    const result = passingResult();

    expect(result.passed).toBe(true);
    expect(result.messagingDocuments).toHaveLength(1);
    expect(result.messagingDocumentLoadErrors).toHaveLength(0);
    expect(result.messaging.documentRewriteRequired).toBe(0);
    expect(result.messaging.documentRejected).toBe(0);
  });

  it("reports missing docs scan targets without exiting the process", () => {
    const result = runAgenticGovernanceEval({
      repoRoot: fixtureRoot,
      messagingDocumentScanTargets: [customTarget("docs/product/missing.md")],
    });

    expect(result.passed).toBe(false);
    expect(result.messagingDocuments).toHaveLength(0);
    expect(result.messagingDocumentLoadErrors).toEqual([
      expect.objectContaining({
        targetPath: "docs/product/missing.md",
        message:
          "Agentic governance messaging scan target missing: docs/product/missing.md",
      }),
    ]);
  });

  it("keeps document loading directly testable", () => {
    writeFixture("docs/product/copy.md", "Agentic governance is bounded by review.");

    const result = loadMessagingScanDocuments({
      repoRoot: fixtureRoot,
      messagingDocumentScanTargets: [customTarget()],
    });

    expect(result.errors).toHaveLength(0);
    expect(result.documents).toEqual([
      expect.objectContaining({
        id: "fixture-copy",
        path: "docs/product/copy.md",
        content: "Agentic governance is bounded by review.",
      }),
    ]);
  });

  it("loads expanded high-risk messaging docs from the default target registry", () => {
    const expectedDefaultTargetPaths = [
      "GOVERNANCE.md",
      "SECURITY.md",
      "docs/pilot/PUBLIC_TRIAL_RUNBOOK.md",
      "docs/legal/HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md",
      "docs/operations/RELEASE_READINESS_RECEIPT_CHECKLIST.md",
      "docs/product/HELM_EXTERNAL_AGENT_INTAKE_PRD.md",
    ];

    const defaultTargetPaths = AGENTIC_GOVERNANCE_MESSAGING_DOCUMENT_SCAN_TARGETS.map(
      (target) => target.path,
    );
    const result = loadMessagingScanDocuments();

    expect(defaultTargetPaths).toEqual(
      expect.arrayContaining(expectedDefaultTargetPaths),
    );
    expect(result.errors).toHaveLength(0);
    expect(result.documents.map((document) => document.path)).toEqual(
      expect.arrayContaining(expectedDefaultTargetPaths),
    );
  });

  it("aggregates child gate failures into the final result", () => {
    writeFixture(
      customTarget().path,
      "Helm stays review-first, candidate-only, and boundary-aware.",
    );

    const result = runAgenticGovernanceEval({
      repoRoot: fixtureRoot,
      messagingDocumentScanTargets: [customTarget()],
      runExternalAgentIntakeEval: () => ({
        ...runExternalAgentIntakeEval(),
        overallPassed: false,
      }),
    });

    expect(result.intake.overallPassed).toBe(false);
    expect(result.connectors.overallPassed).toBe(true);
    expect(result.messaging.overallPassed).toBe(true);
    expect(result.marketSignals.overallPassed).toBe(true);
    expect(result.backOffice.overallPassed).toBe(true);
    expect(result.passed).toBe(false);
  });

  it("prints the failed aggregate without throwing", () => {
    const result = {
      ...passingResult(),
      passed: false,
      messagingDocumentLoadErrors: [
        {
          targetPath: "docs/product/missing.md",
          absolutePath: path.join(fixtureRoot, "docs/product/missing.md"),
          message:
            "Agentic governance messaging scan target missing: docs/product/missing.md",
        },
      ],
    };
    const logs: string[] = [];
    const errors: string[] = [];

    expect(() =>
      printAgenticGovernanceEvalReport(result, {
        log: (message) => logs.push(message),
        error: (message) => errors.push(message),
      }),
    ).not.toThrow();
    expect(logs.join("\n")).toContain("Messaging Document Scan Errors");
    expect(errors.join("\n")).toContain("Agentic governance eval FAILED");
  });
});
