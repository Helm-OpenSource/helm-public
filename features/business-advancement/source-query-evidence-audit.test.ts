import { describe, expect, it } from "vitest";
import {
  ALL_PHASE3G_EVIDENCE_ROWS,
  PHASE3G_QUERY_SHAPE_RECORDS,
  PHASE3G_RULE_VERSION,
  TPQR001_EVIDENCE_ROWS,
  TPQR003_EVIDENCE_ROWS,
  TPQR004_EVIDENCE_ROWS,
  evaluatePhase3gSourceQueryEvidence,
  type Phase3gEvidenceRow,
  type Phase3gQuestion,
  type Phase3gTpqrId,
} from "./source-query-evidence-audit";

const SIX_PHASE3F_QUESTIONS: readonly Phase3gQuestion[] = [
  "Q1_tpqr001_safe_readonly_source",
  "Q2_tpqr003_explicit_clock_source",
  "Q3_tpqr004_crm_generic_dedup_boundary",
  "Q4_workspace_membership_inherited",
  "Q5_family_disable_switch",
  "Q6_audit_bundle_fields",
];

const THREE_FAMILIES: readonly Phase3gTpqrId[] = ["TPQR-001", "TPQR-003", "TPQR-004"];

describe("Phase 3G source-query evidence audit", () => {
  it("all evidence rows carry the correct rule version", () => {
    for (const row of ALL_PHASE3G_EVIDENCE_ROWS) {
      expect(row.ruleVersion).toBe(PHASE3G_RULE_VERSION);
    }
  });

  it("evidence rows cover all six Phase 3F gate questions", () => {
    const presentQuestions = new Set(
      ALL_PHASE3G_EVIDENCE_ROWS.map((row) => row.question),
    );
    for (const question of SIX_PHASE3F_QUESTIONS) {
      expect(presentQuestions.has(question)).toBe(true);
    }
  });

  it("evidence rows cover all three families", () => {
    const presentFamilies = new Set(
      ALL_PHASE3G_EVIDENCE_ROWS.map((row) => row.tpqrId),
    );
    for (const family of THREE_FAMILIES) {
      expect(presentFamilies.has(family)).toBe(true);
    }
  });

  it("CONDITIONAL and gap_evidence rows have non-empty gapDetail", () => {
    const needsGap = ALL_PHASE3G_EVIDENCE_ROWS.filter(
      (row) => row.verdict === "CONDITIONAL" || row.kind === "gap_evidence",
    );
    expect(needsGap.length).toBeGreaterThan(0);
    for (const row of needsGap) {
      expect(row.gapDetail).not.toBeNull();
      expect((row.gapDetail ?? "").trim().length).toBeGreaterThan(0);
    }
  });

  it("PASS verdict rows have null gapDetail", () => {
    const passRows = ALL_PHASE3G_EVIDENCE_ROWS.filter(
      (row) => row.verdict === "PASS",
    );
    expect(passRows.length).toBeGreaterThan(0);
    for (const row of passRows) {
      expect(row.gapDetail).toBeNull();
    }
  });

  it("no query shape has persistedFlagAuthority=true", () => {
    for (const shape of PHASE3G_QUERY_SHAPE_RECORDS) {
      expect(shape.persistedFlagAuthority).toBe(false);
    }
  });

  it("all query shapes inherit workspace scope", () => {
    for (const shape of PHASE3G_QUERY_SHAPE_RECORDS) {
      expect(shape.workspaceScopeInherited).toBe(true);
    }
  });

  it("TPQR-003 query shape requires explicit clock, not Date.now()", () => {
    const tpqr003Shapes = PHASE3G_QUERY_SHAPE_RECORDS.filter(
      (shape) => shape.tpqrId === "TPQR-003",
    );
    expect(tpqr003Shapes.length).toBeGreaterThan(0);
    for (const shape of tpqr003Shapes) {
      expect(shape.explicitClockRequired).toBe(true);
      expect(shape.whereClause).toContain(":referenceClockMs");
      expect(shape.whereClause).not.toContain("Date.now");
    }
  });

  it("TPQR-003 query shape excludes persisted overdueFlag from WHERE clause", () => {
    const tpqr003Shapes = PHASE3G_QUERY_SHAPE_RECORDS.filter(
      (shape) => shape.tpqrId === "TPQR-003",
    );
    expect(tpqr003Shapes.length).toBeGreaterThan(0);
    for (const shape of tpqr003Shapes) {
      expect(shape.whereClause.toLowerCase()).not.toContain("overdueflag");
    }
  });

  it("TPQR-004 defines both CRM-linked and generic producer shapes", () => {
    const shapeIds = PHASE3G_QUERY_SHAPE_RECORDS
      .filter((shape) => shape.tpqrId === "TPQR-004")
      .map((shape) => shape.shapeId);
    expect(shapeIds).toContain("tpqr004_crm_linked_producer");
    expect(shapeIds).toContain("tpqr004_generic_producer");
  });

  it("TPQR-004 CRM-linked producer uses opportunityId IS NOT NULL boundary", () => {
    const crm = PHASE3G_QUERY_SHAPE_RECORDS.find(
      (shape) => shape.shapeId === "tpqr004_crm_linked_producer",
    );
    expect(crm).toBeDefined();
    expect(crm?.whereClause).toContain("opportunityId IS NOT NULL");
  });

  it("all query shapes document a disable switch", () => {
    for (const shape of PHASE3G_QUERY_SHAPE_RECORDS) {
      expect(shape.disableSwitch.trim().length).toBeGreaterThan(0);
    }
  });

  it("evaluator passes all checks and returns No-Go runtime posture", () => {
    const summary = evaluatePhase3gSourceQueryEvidence();
    expect(summary.allPassed).toBe(true);
    expect(summary.totalChecks).toBe(10);
    expect(summary.passed).toBe(10);
    expect(summary.runtimeAdoptionPosture).toBe("No-Go");
    expect(summary.ruleVersion).toBe(PHASE3G_RULE_VERSION);
  });

  it("evaluator check names match expected list", () => {
    const summary = evaluatePhase3gSourceQueryEvidence();
    expect(summary.checks.map((check) => check.checkName)).toEqual([
      "all_evidence_rows_have_correct_rule_version",
      "all_six_phase3f_questions_answered",
      "all_three_families_have_evidence",
      "no_persisted_flag_authority_in_query_shapes",
      "all_query_shapes_inherit_workspace_scope",
      "tpqr003_query_shape_requires_explicit_clock",
      "tpqr004_has_both_crm_and_generic_producer_shapes",
      "all_query_shapes_have_disable_switches",
      "no_runtime_adoption_in_audit",
      "gap_evidence_rows_have_gap_detail",
    ]);
  });

  it("nextAllowedWork describes Phase 3H, not runtime adoption", () => {
    const summary = evaluatePhase3gSourceQueryEvidence();
    expect(summary.nextAllowedWork).toContain("Phase 3H");
    expect(summary.nextAllowedWork.toLowerCase()).not.toContain("runtime adoption");
  });

  it("TPQR-001 evidence covers Q1 safe read-only source boundary", () => {
    const q1Rows = TPQR001_EVIDENCE_ROWS.filter(
      (row) => row.question === "Q1_tpqr001_safe_readonly_source",
    );
    expect(q1Rows.length).toBeGreaterThan(0);
    const hasSchemaEvidence = q1Rows.some(
      (row: Phase3gEvidenceRow) => row.kind === "schema_evidence",
    );
    const hasQueryEvidence = q1Rows.some(
      (row: Phase3gEvidenceRow) => row.kind === "query_evidence",
    );
    expect(hasSchemaEvidence).toBe(true);
    expect(hasQueryEvidence).toBe(true);
  });

  it("TPQR-001 evidence shows approvalTask absence is the blocked-decision source, not persisted flag", () => {
    const schemaRows = TPQR001_EVIDENCE_ROWS.filter(
      (row) => row.kind === "schema_evidence",
    );
    const approvalTaskRow = schemaRows.find((row) =>
      row.finding.includes("approvalTask"),
    );
    expect(approvalTaskRow).toBeDefined();
    expect(approvalTaskRow?.finding).toContain("approvalTask IS NULL");
  });

  it("TPQR-003 evidence identifies Date.now() as the current gap", () => {
    const gapRows = TPQR003_EVIDENCE_ROWS.filter(
      (row) => row.question === "Q2_tpqr003_explicit_clock_source",
    );
    const dateNowRow = gapRows.find((row) =>
      row.finding.includes("Date.now()"),
    );
    expect(dateNowRow).toBeDefined();
    expect(dateNowRow?.verdict).toBe("CONDITIONAL");
  });

  it("TPQR-004 evidence identifies missing CRM-linked producer as a gap", () => {
    const q3Rows = TPQR004_EVIDENCE_ROWS.filter(
      (row) => row.question === "Q3_tpqr004_crm_generic_dedup_boundary",
    );
    const crmGapRow = q3Rows.find((row) => row.kind === "gap_evidence");
    expect(crmGapRow).toBeDefined();
    expect(crmGapRow?.verdict).toBe("CONDITIONAL");
    expect(crmGapRow?.gapDetail).toContain("CRM-linked producer");
  });

  it("workspace membership evidence present for all three families", () => {
    for (const family of THREE_FAMILIES) {
      const membershipRows = ALL_PHASE3G_EVIDENCE_ROWS.filter(
        (row) =>
          row.tpqrId === family &&
          row.question === "Q4_workspace_membership_inherited",
      );
      expect(membershipRows.length).toBeGreaterThan(0);
    }
  });

  it("disable switch evidence present for all three families", () => {
    for (const family of THREE_FAMILIES) {
      const switchRows = ALL_PHASE3G_EVIDENCE_ROWS.filter(
        (row) =>
          row.tpqrId === family &&
          row.question === "Q5_family_disable_switch",
      );
      expect(switchRows.length).toBeGreaterThan(0);
    }
  });

  it("audit bundle field evidence present for all three families", () => {
    for (const family of THREE_FAMILIES) {
      const auditRows = ALL_PHASE3G_EVIDENCE_ROWS.filter(
        (row) =>
          row.tpqrId === family &&
          row.question === "Q6_audit_bundle_fields",
      );
      expect(auditRows.length).toBeGreaterThan(0);
    }
  });

  it("evaluator does not use a live runtime clock", () => {
    // The evaluator output must be deterministic across calls with no inputs.
    // If Date.now() were called internally, repeated invocations could differ.
    const a = evaluatePhase3gSourceQueryEvidence();
    const b = evaluatePhase3gSourceQueryEvidence();
    expect(a.allPassed).toBe(b.allPassed);
    expect(a.passed).toBe(b.passed);
    expect(a.totalChecks).toBe(b.totalChecks);
    expect(JSON.stringify(a.checks)).toBe(JSON.stringify(b.checks));
    // PHASE3G_REFERENCE_CLOCK_MS is a hardcoded constant, not Date.now().
    expect(a.ruleVersion).toBe(PHASE3G_RULE_VERSION);
  });
});
