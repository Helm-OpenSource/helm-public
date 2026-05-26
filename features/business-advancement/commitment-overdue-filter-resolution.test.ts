import { describe, expect, it } from "vitest";
import {
  COMMITMENT_OVERDUE_FILTER_EVIDENCE,
  deriveCommitmentOverdueFilterDecision,
  evaluateCommitmentOverdueFilterResolution,
  type CommitmentOverdueEvidenceRow,
} from "./commitment-overdue-filter-resolution";

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

const REQUIRED_REPO_TRUTH_LOCATORS = [
  "prisma/schema.prisma:3929",
  "lib/memory/shared.ts:254",
  "lib/memory/commitment.service.ts:72",
  "lib/memory/commitment.service.ts:112",
  "lib/memory/commitment.service.ts:194",
  "data/queries.ts:351",
  "features/meetings/queries.ts:437",
] as const;

describe("COMMITMENT_OVERDUE_FILTER_EVIDENCE", () => {
  it("contains at least one evidence row", () => {
    expect(COMMITMENT_OVERDUE_FILTER_EVIDENCE.length).toBeGreaterThan(0);
  });

  it("every row has a non-empty evidenceId", () => {
    for (const row of COMMITMENT_OVERDUE_FILTER_EVIDENCE) {
      expect(row.evidenceId.trim(), "evidenceId").not.toBe("");
    }
  });

  it("every row has a non-empty filePath", () => {
    for (const row of COMMITMENT_OVERDUE_FILTER_EVIDENCE) {
      expect(row.filePath.trim(), `${row.evidenceId}: filePath`).not.toBe("");
    }
  });

  it("every row has a non-empty evidenceLocator", () => {
    for (const row of COMMITMENT_OVERDUE_FILTER_EVIDENCE) {
      expect(
        row.evidenceLocator.trim(),
        `${row.evidenceId}: evidenceLocator`,
      ).not.toBe("");
    }
  });

  it("every row has a non-empty evidenceSummary", () => {
    for (const row of COMMITMENT_OVERDUE_FILTER_EVIDENCE) {
      expect(
        row.evidenceSummary.trim(),
        `${row.evidenceId}: evidenceSummary`,
      ).not.toBe("");
    }
  });

  it("every row has non-empty boundaryNotes", () => {
    for (const row of COMMITMENT_OVERDUE_FILTER_EVIDENCE) {
      expect(
        row.boundaryNotes.length,
        `${row.evidenceId}: boundaryNotes must be non-empty`,
      ).toBeGreaterThan(0);
      for (const note of row.boundaryNotes) {
        expect(note.trim()).not.toBe("");
      }
    }
  });

  it("every evidenceId is unique", () => {
    const seen = new Set<string>();
    for (const row of COMMITMENT_OVERDUE_FILTER_EVIDENCE) {
      expect(
        seen.has(row.evidenceId),
        `duplicate evidenceId ${row.evidenceId}`,
      ).toBe(false);
      seen.add(row.evidenceId);
    }
  });

  it("every row's boundaryNotes preserve recommendation/explanation/draft/proof distinctions", () => {
    for (const row of COMMITMENT_OVERDUE_FILTER_EVIDENCE) {
      const combined = row.boundaryNotes.join(" \n ").toLowerCase();
      for (const phrase of REQUIRED_BOUNDARY_PHRASES) {
        expect(
          combined.includes(phrase),
          `${row.evidenceId}: boundaryNotes must include "${phrase}"`,
        ).toBe(true);
      }
    }
  });

  it("no row authorizes auto-write, auto-send, execution authority, LLM ranking, or schema design", () => {
    for (const row of COMMITMENT_OVERDUE_FILTER_EVIDENCE) {
      const fields: string[] = [
        row.evidenceSummary,
        ...row.boundaryNotes,
      ];
      for (const field of fields) {
        const lower = field.toLowerCase();
        for (const pattern of FORBIDDEN_AUTHORIZATION_PATTERNS) {
          expect(
            lower.includes(pattern),
            `${row.evidenceId}: field contains forbidden authorization pattern "${pattern}"`,
          ).toBe(false);
        }
      }
    }
  });

  it("cites all required repo-truth locators across the matrix", () => {
    const allLocators = COMMITMENT_OVERDUE_FILTER_EVIDENCE.map(
      (row) => row.evidenceLocator,
    ).join(" | ");
    for (const locator of REQUIRED_REPO_TRUTH_LOCATORS) {
      expect(
        allLocators.includes(locator),
        `Required repo-truth locator "${locator}" must be cited at least once`,
      ).toBe(true);
    }
  });

  it("includes an explicit maintenance_absence row that drives the conservative conclusion", () => {
    const absenceRows = COMMITMENT_OVERDUE_FILTER_EVIDENCE.filter(
      (row) => row.evidenceKind === "maintenance_absence",
    );
    expect(
      absenceRows.length,
      "PF3A-003 must record at least one maintenance_absence row",
    ).toBeGreaterThan(0);
    for (const row of absenceRows) {
      expect(row.derivationKind).toBe("absent");
      expect(row.maintenanceProofForPersistedColumn).toBe(false);
    }
  });

  it("no row claims maintenanceProofForPersistedColumn=true (current repo has no such proof)", () => {
    for (const row of COMMITMENT_OVERDUE_FILTER_EVIDENCE) {
      expect(
        row.maintenanceProofForPersistedColumn,
        `${row.evidenceId}: must not claim maintenanceProofForPersistedColumn=true without separate evidence`,
      ).toBe(false);
    }
  });

  it("persisted-column read rows are NOT marked safe_for_time_sensitive_filter", () => {
    for (const row of COMMITMENT_OVERDUE_FILTER_EVIDENCE) {
      if (
        row.evidenceKind === "persisted_column_read" &&
        row.derivationKind === "persisted_column"
      ) {
        expect(
          row.safetyAssessment,
          `${row.evidenceId}: persisted-column read must not be marked safe`,
        ).not.toBe("safe_for_time_sensitive_filter");
      }
    }
  });

  it("includes an explicit filter_planning_note that refuses runtime adoption", () => {
    const planningRows = COMMITMENT_OVERDUE_FILTER_EVIDENCE.filter(
      (row) => row.evidenceKind === "filter_planning_note",
    );
    expect(
      planningRows.length,
      "PF3A-003 must record at least one filter_planning_note row",
    ).toBeGreaterThan(0);
    for (const row of planningRows) {
      const combined = `${row.evidenceSummary} ${row.boundaryNotes.join(" ")}`.toLowerCase();
      expect(
        combined.includes("not authorize"),
        `${row.evidenceId}: planning note must refuse runtime adoption`,
      ).toBe(true);
      const namesSafeDirection =
        combined.includes("duedate/status") ||
        combined.includes("deriveoverdueflag");
      expect(
        namesSafeDirection,
        `${row.evidenceId}: planning note must name the dueDate/status heuristic or deriveOverdueFlag derivation`,
      ).toBe(true);
      const guardsAgainstSole =
        combined.includes("must not use the persisted") ||
        combined.includes("must not be used as the only") ||
        combined.includes("only time-sensitive filter");
      expect(
        guardsAgainstSole,
        `${row.evidenceId}: planning note must guard against using the persisted column as the only time-sensitive filter`,
      ).toBe(true);
    }
  });

  it("evidenceKind, derivationKind, and safetyAssessment values are within the allowed vocabulary", () => {
    const allowedKinds = new Set([
      "schema_definition",
      "derive_helper",
      "write_path",
      "read_time_derivation",
      "persisted_column_read",
      "maintenance_absence",
      "filter_planning_note",
    ]);
    const allowedDerivations = new Set([
      "persisted_column",
      "read_time_derivation",
      "schema_only",
      "absent",
      "planning_only",
    ]);
    const allowedSafety = new Set([
      "safe_for_time_sensitive_filter",
      "stale_by_design_for_time_sensitive_filter",
      "neutral_storage_definition",
      "neutral_helper_definition",
      "neutral_write_path",
      "neutral_planning_note",
    ]);
    for (const row of COMMITMENT_OVERDUE_FILTER_EVIDENCE) {
      expect(allowedKinds.has(row.evidenceKind), row.evidenceId).toBe(true);
      expect(allowedDerivations.has(row.derivationKind), row.evidenceId).toBe(true);
      expect(allowedSafety.has(row.safetyAssessment), row.evidenceId).toBe(true);
    }
  });
});

describe("deriveCommitmentOverdueFilterDecision", () => {
  it("returns incomplete_evidence when given an empty matrix", () => {
    const decision = deriveCommitmentOverdueFilterDecision([]);
    expect(decision.conclusion).toBe("incomplete_evidence");
    expect(decision.residualBlockers.length).toBeGreaterThan(0);
  });

  it("returns prefer_read_time_derivation for the current repo evidence", () => {
    const decision = deriveCommitmentOverdueFilterDecision(
      COMMITMENT_OVERDUE_FILTER_EVIDENCE,
    );
    expect(decision.conclusion).toBe("prefer_read_time_derivation");
    expect(decision.recommendedFutureFilter.toLowerCase()).toContain(
      "duedate",
    );
    const lower = decision.recommendedFutureFilter.toLowerCase();
    expect(
      lower.includes("status not in") ||
        lower.includes("deriveoverdueflag"),
      "recommendedFutureFilter must name dueDate/status heuristic or deriveOverdueFlag",
    ).toBe(true);
  });

  it("returns blocked_no_maintenance_evidence when neither absence nor proof is present", () => {
    const onlyReads: CommitmentOverdueEvidenceRow[] = [
      {
        evidenceId: "TEST-PERSISTED-READ",
        filePath: "data/queries.ts",
        evidenceLocator: "data/queries.ts:351",
        evidenceKind: "persisted_column_read",
        derivationKind: "persisted_column",
        safetyAssessment: "stale_by_design_for_time_sensitive_filter",
        evidenceSummary: "test fixture row",
        maintenanceProofForPersistedColumn: false,
        boundaryNotes: [
          "recommendation != commitment - test row",
          "explanation != approval - test row",
          "draft != send - test row",
          "proof != external write success - test row",
        ],
      },
    ];
    const decision = deriveCommitmentOverdueFilterDecision(onlyReads);
    expect(decision.conclusion).toBe("blocked_no_maintenance_evidence");
  });

  it("returns persisted_column_safe_with_maintenance_proof when a maintenance proof row is present", () => {
    const withProof: CommitmentOverdueEvidenceRow[] = [
      {
        evidenceId: "TEST-MAINTENANCE-PROOF",
        filePath: "lib/maintenance/test.ts",
        evidenceLocator: "lib/maintenance/test.ts:1",
        evidenceKind: "write_path",
        derivationKind: "persisted_column",
        safetyAssessment: "safe_for_time_sensitive_filter",
        evidenceSummary: "test fixture: maintenance proof row",
        maintenanceProofForPersistedColumn: true,
        boundaryNotes: [
          "recommendation != commitment - test row",
          "explanation != approval - test row",
          "draft != send - test row",
          "proof != external write success - test row",
        ],
      },
    ];
    const decision = deriveCommitmentOverdueFilterDecision(withProof);
    expect(decision.conclusion).toBe(
      "persisted_column_safe_with_maintenance_proof",
    );
  });

  it("blocks when the matrix only contains maintenance_absence rows without a safe direction", () => {
    const onlyAbsence: CommitmentOverdueEvidenceRow[] = [
      {
        evidenceId: "TEST-ABSENCE",
        filePath: "(absent)",
        evidenceLocator: "(absent)",
        evidenceKind: "maintenance_absence",
        derivationKind: "absent",
        safetyAssessment: "stale_by_design_for_time_sensitive_filter",
        evidenceSummary: "test fixture: absence row",
        maintenanceProofForPersistedColumn: false,
        boundaryNotes: [
          "recommendation != commitment - test row",
          "explanation != approval - test row",
          "draft != send - test row",
          "proof != external write success - test row",
        ],
      },
    ];
    const decision = deriveCommitmentOverdueFilterDecision(onlyAbsence);
    expect(decision.conclusion).toBe("blocked_no_safe_derivation_evidence");
  });

  it("returns prefer_read_time_derivation when maintenance_absence is paired with a safe direction", () => {
    const absenceWithSafeDirection: CommitmentOverdueEvidenceRow[] = [
      {
        evidenceId: "TEST-ABSENCE",
        filePath: "(absent)",
        evidenceLocator: "(absent)",
        evidenceKind: "maintenance_absence",
        derivationKind: "absent",
        safetyAssessment: "stale_by_design_for_time_sensitive_filter",
        evidenceSummary: "test fixture: absence row",
        maintenanceProofForPersistedColumn: false,
        boundaryNotes: [
          "recommendation != commitment - test row",
          "explanation != approval - test row",
          "draft != send - test row",
          "proof != external write success - test row",
        ],
      },
      {
        evidenceId: "TEST-READ-TIME",
        filePath: "lib/memory/commitment.service.ts",
        evidenceLocator: "lib/memory/commitment.service.ts:72",
        evidenceKind: "read_time_derivation",
        derivationKind: "read_time_derivation",
        safetyAssessment: "safe_for_time_sensitive_filter",
        evidenceSummary: "test fixture: read-time derivation row",
        maintenanceProofForPersistedColumn: false,
        boundaryNotes: [
          "recommendation != commitment - test row",
          "explanation != approval - test row",
          "draft != send - test row",
          "proof != external write success - test row",
        ],
      },
    ];
    const decision = deriveCommitmentOverdueFilterDecision(
      absenceWithSafeDirection,
    );
    expect(decision.conclusion).toBe("prefer_read_time_derivation");
  });
});

describe("evaluateCommitmentOverdueFilterResolution", () => {
  it("all evaluator checks pass against the current evidence matrix", () => {
    const result = evaluateCommitmentOverdueFilterResolution();
    const failed = result.checks.filter((c) => !c.passed);
    expect(
      failed,
      `Failed checks: ${failed.map((c) => `${c.checkName}: ${c.detail}`).join("; ")}`,
    ).toHaveLength(0);
    expect(result.allPassed).toBe(true);
  });

  it("totalRows matches the matrix length", () => {
    const result = evaluateCommitmentOverdueFilterResolution();
    expect(result.totalRows).toBe(COMMITMENT_OVERDUE_FILTER_EVIDENCE.length);
  });

  it("decision is prefer_read_time_derivation under current repo evidence", () => {
    const result = evaluateCommitmentOverdueFilterResolution();
    expect(result.decision.conclusion).toBe("prefer_read_time_derivation");
  });

  it("counts persisted reads, read-time derivations, and maintenance absence accurately", () => {
    const result = evaluateCommitmentOverdueFilterResolution();
    expect(result.persistedColumnReadCount).toBeGreaterThan(0);
    expect(result.readTimeDerivationCount).toBeGreaterThan(0);
    expect(result.maintenanceAbsenceCount).toBeGreaterThan(0);
    expect(result.maintenanceProofCount).toBe(0);
  });

  it("evaluator surfaces 10 checks", () => {
    const result = evaluateCommitmentOverdueFilterResolution();
    expect(result.checks).toHaveLength(10);
  });
});
