import { describe, expect, it } from "vitest";
import {
  buildMessagingCopyCandidatesFromDocuments,
  evaluateMessagingCopyCandidate,
  runMessagingRewriteGuardEval,
} from "./messaging-rewrite-guard";

describe("agentic governance messaging rewrite guard", () => {
  it("allows approved Helm positioning without runtime rewrite", () => {
    const result = evaluateMessagingCopyCandidate({
      id: "approved",
      surface: "customer_facing",
      text: "Helm 是经营推进控制台，建议可复核，承诺只有你能签。",
      hasBoundaryNote: true,
      runtimePathChanged: false,
    });

    expect(result.decision).toBe("allow");
    expect(result.reasonCodes).toContain("approved_positioning");
    expect(result.rewriteSuggestions).toEqual([]);
  });

  it("requires rewrite when customer-facing agentic or execution copy lacks boundary note", () => {
    const result = evaluateMessagingCopyCandidate({
      id: "missing-boundary",
      surface: "customer_facing",
      text: "Helm brings agentic execution to revenue teams.",
      hasBoundaryNote: false,
      runtimePathChanged: false,
    });

    expect(result.decision).toBe("rewrite_required");
    expect(result.boundaryNoteRequired).toBe(true);
    expect(result.reasonCodes).toEqual(
      expect.arrayContaining([
        "customer_facing_sensitive_term",
        "customer_facing_missing_boundary_note",
      ]),
    );
    expect(result.rewriteSuggestions).toContain("经营推进控制台");
  });

  it("rejects forbidden agent OS and autonomous workforce overclaims outside boundary context", () => {
    const result = evaluateMessagingCopyCandidate({
      id: "overclaim",
      surface: "customer_facing",
      text: "Helm is the agent OS for an autonomous workforce.",
      hasBoundaryNote: true,
      runtimePathChanged: false,
    });

    expect(result.decision).toBe("reject");
    expect(result.reasonCodes).toContain("forbidden_positioning_overclaim");
  });

  it("allows forbidden phrases only in boundary or competitor-differentiation context", () => {
    const result = evaluateMessagingCopyCandidate({
      id: "boundary",
      surface: "boundary_doc",
      text: "Helm is not a workflow/orchestration platform.",
      hasBoundaryNote: true,
      runtimePathChanged: false,
    });

    expect(result.decision).toBe("allow_with_boundary_context");
    expect(result.reasonCodes).toContain("boundary_context");
  });

  it("rejects runtime rewrite attempts", () => {
    const result = evaluateMessagingCopyCandidate({
      id: "runtime",
      surface: "internal_doc",
      text: "Use an LLM runtime rewrite service for customer-facing claims.",
      hasBoundaryNote: true,
      runtimePathChanged: true,
    });

    expect(result.decision).toBe("reject");
    expect(result.reasonCodes).toContain("runtime_rewrite_not_allowed");
  });

  it("passes the offline fixture gate without accepting unsafe wording", () => {
    const summary = runMessagingRewriteGuardEval();

    expect(summary.totalCandidates).toBeGreaterThanOrEqual(7);
    expect(summary.expectedMatches).toBe(summary.totalCandidates);
    expect(summary.acceptedForbiddenPositioning).toBe(0);
    expect(summary.acceptedCustomerFacingSensitiveWithoutBoundary).toBe(0);
    expect(summary.runtimeRewriteAttempted).toBe(1);
    expect(summary.rewriteRequired).toBeGreaterThanOrEqual(1);
    expect(summary.rejected).toBeGreaterThanOrEqual(2);
    expect(summary.overallPassed).toBe(true);
  });

  it("builds document-scan candidates from sensitive agentic wording", () => {
    const candidates = buildMessagingCopyCandidatesFromDocuments([
      {
        id: "readme",
        path: "README.md",
        surface: "customer_facing",
        content: [
          "# Helm",
          "Helm is the agent OS for autonomous workforce execution.",
          "",
          "## 当前刻意不做",
          "- Helm is not a workflow/orchestration platform.",
        ].join("\n"),
      },
    ]);

    expect(candidates).toHaveLength(2);
    expect(candidates[0]).toMatchObject({
      id: "readme:2",
      source: "document_scan",
      sourcePath: "README.md",
      lineNumber: 2,
      hasBoundaryNote: false,
    });
    expect(candidates[1]).toMatchObject({
      id: "readme:5",
      source: "document_scan",
      sourcePath: "README.md",
      lineNumber: 5,
      hasBoundaryNote: true,
    });
  });

  it("fails document-scan eval when customer-facing docs need rewrite", () => {
    const candidates = buildMessagingCopyCandidatesFromDocuments([
      {
        id: "unsafe-readme",
        path: "README.md",
        surface: "customer_facing",
        content: "Helm brings agentic execution to every revenue workflow.",
      },
    ]);
    const summary = runMessagingRewriteGuardEval(candidates);

    expect(summary.documentCandidatesScanned).toBe(1);
    expect(summary.documentRewriteRequired).toBe(1);
    expect(summary.documentRejected).toBe(0);
    expect(summary.overallPassed).toBe(false);
  });
});
