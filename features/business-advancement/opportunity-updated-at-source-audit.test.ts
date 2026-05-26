import { describe, expect, it } from "vitest";
import {
  OPPORTUNITY_UPDATED_AT_SOURCE_AUDIT,
  deriveSourceAuditConclusion,
  evaluateOpportunityUpdatedAtSourceAudit,
} from "./opportunity-updated-at-source-audit";

const FORBIDDEN_AUTHORIZATION_PATTERNS = [
  "may add a schema",
  "may add schema",
  "may create schema",
  "authorizes schema design",
  "may add runtime extractor",
  "may add a runtime extractor",
  "may create extractor",
  "may add event queue",
  "may create event queue",
  "authorizes official write",
  "may auto-write",
  "may auto write",
  "grants execution authority",
  "may auto-send",
  "may auto send",
  "may auto-approve",
  "may auto approve",
  "llm may determine",
  "llm may rank",
  "may change page behavior",
  "may add api route",
  "approves runtime adoption",
  "approves production query adoption",
] as const;

const REQUIRED_BOUNDARY_PHRASES = [
  "recommendation != commitment",
  "explanation != approval",
  "draft != send",
  "proof != external write success",
] as const;

describe("OPPORTUNITY_UPDATED_AT_SOURCE_AUDIT", () => {
  it("contains at least one audit row", () => {
    expect(OPPORTUNITY_UPDATED_AT_SOURCE_AUDIT.length).toBeGreaterThan(0);
  });

  it("every row has a non-empty filePath", () => {
    for (const row of OPPORTUNITY_UPDATED_AT_SOURCE_AUDIT) {
      expect(row.filePath.trim(), `${row.writerId}: filePath`).not.toBe("");
    }
  });

  it("every row has a non-empty evidenceLocator", () => {
    for (const row of OPPORTUNITY_UPDATED_AT_SOURCE_AUDIT) {
      expect(
        row.evidenceLocator.trim(),
        `${row.writerId}: evidenceLocator`,
      ).not.toBe("");
    }
  });

  it("every row has a non-empty evidenceSummary", () => {
    for (const row of OPPORTUNITY_UPDATED_AT_SOURCE_AUDIT) {
      expect(
        row.evidenceSummary.trim(),
        `${row.writerId}: evidenceSummary`,
      ).not.toBe("");
    }
  });

  it("every row has non-empty boundaryNotes", () => {
    for (const row of OPPORTUNITY_UPDATED_AT_SOURCE_AUDIT) {
      expect(
        row.boundaryNotes.length,
        `${row.writerId}: boundaryNotes must be non-empty`,
      ).toBeGreaterThan(0);
      for (const note of row.boundaryNotes) {
        expect(note.trim()).not.toBe("");
      }
    }
  });

  it("every writerId is unique", () => {
    const seen = new Set<string>();
    for (const row of OPPORTUNITY_UPDATED_AT_SOURCE_AUDIT) {
      expect(seen.has(row.writerId), `duplicate writerId ${row.writerId}`).toBe(
        false,
      );
      seen.add(row.writerId);
    }
  });

  it("read-only rows are not classified as writers", () => {
    for (const row of OPPORTUNITY_UPDATED_AT_SOURCE_AUDIT) {
      if (row.operationKind === "read_only_reference") {
        expect(
          row.touchesOpportunityRows,
          `${row.writerId}: touchesOpportunityRows must be false`,
        ).toBe(false);
        expect(
          row.sourceClass,
          `${row.writerId}: sourceClass must be read_only`,
        ).toBe("read_only");
        expect(
          row.updatedAtBehavior,
          `${row.writerId}: updatedAtBehavior must be no_write`,
        ).toBe("no_write");
        expect(
          row.stalenessHeuristicImpact,
          `${row.writerId}: stalenessHeuristicImpact must be none`,
        ).toBe("none");
      }
      if (row.sourceClass === "read_only") {
        expect(
          row.operationKind,
          `${row.writerId}: read_only sourceClass requires read_only_reference operationKind`,
        ).toBe("read_only_reference");
      }
    }
  });

  it("at least one read-only row is present to make the writer/reader distinction explicit", () => {
    const readOnlyRows = OPPORTUNITY_UPDATED_AT_SOURCE_AUDIT.filter(
      (row) => row.operationKind === "read_only_reference",
    );
    expect(readOnlyRows.length).toBeGreaterThan(0);
  });

  it("at least one writer row exists", () => {
    const writers = OPPORTUNITY_UPDATED_AT_SOURCE_AUDIT.filter(
      (row) => row.touchesOpportunityRows,
    );
    expect(writers.length).toBeGreaterThan(0);
  });

  it("no row grants runtime, schema, or execution authority", () => {
    for (const row of OPPORTUNITY_UPDATED_AT_SOURCE_AUDIT) {
      const fields: string[] = [row.evidenceSummary, ...row.boundaryNotes];
      for (const field of fields) {
        const lower = field.toLowerCase();
        for (const pattern of FORBIDDEN_AUTHORIZATION_PATTERNS) {
          expect(
            lower.includes(pattern),
            `${row.writerId}: forbidden authorization pattern "${pattern}"`,
          ).toBe(false);
        }
      }
    }
  });

  it("every row's boundaryNotes preserve recommendation/explanation/draft/proof distinctions", () => {
    for (const row of OPPORTUNITY_UPDATED_AT_SOURCE_AUDIT) {
      const combined = row.boundaryNotes.join(" \n ").toLowerCase();
      for (const phrase of REQUIRED_BOUNDARY_PHRASES) {
        expect(
          combined.includes(phrase),
          `${row.writerId}: boundaryNotes must include "${phrase}"`,
        ).toBe(true);
      }
    }
  });

  it("the dingtalk hourly-cron writer is captured as the load-bearing system / mixed evidence", () => {
    const dingtalkRow = OPPORTUNITY_UPDATED_AT_SOURCE_AUDIT.find((row) =>
      row.filePath.endsWith("lib/connectors/dingtalk-ingestion.ts"),
    );
    expect(dingtalkRow).toBeDefined();
    expect(["system", "mixed"]).toContain(dingtalkRow!.sourceClass);
    expect(dingtalkRow!.updatedAtBehavior).toBe("prisma_auto_bump_possible");
    expect(["unsafe", "conditional"]).toContain(
      dingtalkRow!.stalenessHeuristicImpact,
    );
  });
});

describe("deriveSourceAuditConclusion", () => {
  it("returns incomplete_audit when given an empty list", () => {
    const decision = deriveSourceAuditConclusion([]);
    expect(decision.conclusion).toBe("incomplete_audit");
  });

  it("returns conditional_requires_runtime_guard when a system / mixed auto-bump writer exists", () => {
    const decision = deriveSourceAuditConclusion([
      {
        writerId: "TEST-MIXED",
        filePath: "lib/example.ts",
        evidenceLocator: "lib/example.ts:1",
        operationKind: "update",
        sourceClass: "mixed",
        touchesOpportunityRows: true,
        updatedAtBehavior: "prisma_auto_bump_possible",
        stalenessHeuristicImpact: "unsafe",
        evidenceSummary: "synthetic test row",
        boundaryNotes: [
          "recommendation != commitment",
          "explanation != approval",
          "draft != send",
          "proof != external write success",
        ],
      },
    ]);
    expect(decision.conclusion).toBe("conditional_requires_runtime_guard");
  });

  it("returns safe_for_later_thin_read_model_planning only when all writers are human and not conditional", () => {
    const decision = deriveSourceAuditConclusion([
      {
        writerId: "TEST-HUMAN",
        filePath: "features/example.ts",
        evidenceLocator: "features/example.ts:1",
        operationKind: "update",
        sourceClass: "human",
        touchesOpportunityRows: true,
        updatedAtBehavior: "prisma_auto_bump_possible",
        stalenessHeuristicImpact: "safe",
        evidenceSummary: "synthetic human test row",
        boundaryNotes: [
          "recommendation != commitment",
          "explanation != approval",
          "draft != send",
          "proof != external write success",
        ],
      },
    ]);
    expect(decision.conclusion).toBe("safe_for_later_thin_read_model_planning");
  });

  it("real audit set yields conditional_requires_runtime_guard given the dingtalk hourly-cron evidence", () => {
    const decision = deriveSourceAuditConclusion(
      OPPORTUNITY_UPDATED_AT_SOURCE_AUDIT,
    );
    expect(decision.conclusion).toBe("conditional_requires_runtime_guard");
    expect(decision.residualBlockers.length).toBeGreaterThan(0);
  });
});

describe("evaluateOpportunityUpdatedAtSourceAudit", () => {
  it("all evaluator checks pass", () => {
    const result = evaluateOpportunityUpdatedAtSourceAudit();
    const failed = result.checks.filter((c) => !c.passed);
    expect(
      failed,
      `Failed checks: ${failed
        .map((c) => `${c.checkName}: ${c.detail}`)
        .join("; ")}`,
    ).toHaveLength(0);
    expect(result.allPassed).toBe(true);
  });

  it("totalRows equals the number of audit rows", () => {
    const result = evaluateOpportunityUpdatedAtSourceAudit();
    expect(result.totalRows).toBe(OPPORTUNITY_UPDATED_AT_SOURCE_AUDIT.length);
  });

  it("writerRowCount + readOnlyRowCount equals totalRows", () => {
    const result = evaluateOpportunityUpdatedAtSourceAudit();
    expect(result.writerRowCount + result.readOnlyRowCount).toBe(
      result.totalRows,
    );
  });

  it("conclusion is conditional_requires_runtime_guard for the real audit set", () => {
    const result = evaluateOpportunityUpdatedAtSourceAudit();
    expect(result.conclusion.conclusion).toBe(
      "conditional_requires_runtime_guard",
    );
  });

  it("has 8 evaluator checks", () => {
    const result = evaluateOpportunityUpdatedAtSourceAudit();
    expect(result.checks).toHaveLength(8);
  });
});
