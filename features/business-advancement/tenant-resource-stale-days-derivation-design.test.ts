import { describe, expect, it } from "vitest";
import {
  DERIVED_STALE_DAYS_CALIBRATION,
  DERIVED_STALE_DAYS_EVIDENCE,
  DERIVED_STALE_DAYS_FORMULA,
  DERIVED_STALE_DAYS_SOURCE_CATALOG,
  PF3A005_ADOPTION_POSTURE,
  SELECTED_DERIVED_STALE_DAYS_SOURCE,
  applyTpqr005CalibrationRule,
  computeDerivedStaleDays,
  evaluateDerivedStaleDaysDerivationDesign,
  type PlanningTenantResourceTimingFixture,
  type StaleDaysSourceCandidateId,
} from "./tenant-resource-stale-days-derivation-design";

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
  "extends tenantresourceoperatingimpactitem",
  "adds derivedstaledays to tenantresourceoperatingimpactitem",
  "modifies the impact item type",
] as const;

const REQUIRED_BOUNDARY_PHRASES = [
  "recommendation != commitment",
  "explanation != approval",
  "draft != send",
  "proof != external write success",
] as const;

const REQUIRED_REPO_TRUTH_LOCATORS = [
  "lib/tenant-resources/workspace-operating-impact-query.ts:38",
  "lib/tenant-resources/workspace-operating-impact-query.ts:56",
  "lib/tenant-resources/workspace-operating-impact-query.ts:71",
  "lib/tenant-resources/readiness.ts:270",
  "lib/tenant-resources/readiness.ts:356",
  "lib/tenant-resources/evidence-detail.ts:175",
  "lib/tenant-resources/operating-impact.ts:24",
  "features/mobile/lib/mobile-command-read-model.ts:350",
  "features/business-advancement/thin-projection-query-review.ts:315",
  "features/business-advancement/runtime-readiness-preflight.ts:187",
  "features/business-advancement/runtime-guard-resolution-plan.ts:218",
] as const;

const REQUIRED_GUARD_CANDIDATES: readonly StaleDaysSourceCandidateId[] = [
  "connector_last_synced_at",
  "import_source_updated_at",
  "import_job_finished_at",
];

describe("DERIVED_STALE_DAYS_EVIDENCE", () => {
  it("contains at least one evidence row", () => {
    expect(DERIVED_STALE_DAYS_EVIDENCE.length).toBeGreaterThan(0);
  });

  it("every row has a non-empty evidenceId", () => {
    for (const row of DERIVED_STALE_DAYS_EVIDENCE) {
      expect(row.evidenceId.trim(), "evidenceId").not.toBe("");
    }
  });

  it("every row has a non-empty filePath", () => {
    for (const row of DERIVED_STALE_DAYS_EVIDENCE) {
      expect(row.filePath.trim(), `${row.evidenceId}: filePath`).not.toBe("");
    }
  });

  it("every row has a non-empty evidenceLocator", () => {
    for (const row of DERIVED_STALE_DAYS_EVIDENCE) {
      expect(
        row.evidenceLocator.trim(),
        `${row.evidenceId}: evidenceLocator`,
      ).not.toBe("");
    }
  });

  it("every row has a non-empty evidenceSummary", () => {
    for (const row of DERIVED_STALE_DAYS_EVIDENCE) {
      expect(
        row.evidenceSummary.trim(),
        `${row.evidenceId}: evidenceSummary`,
      ).not.toBe("");
    }
  });

  it("every row has non-empty boundaryNotes", () => {
    for (const row of DERIVED_STALE_DAYS_EVIDENCE) {
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
    for (const row of DERIVED_STALE_DAYS_EVIDENCE) {
      expect(
        seen.has(row.evidenceId),
        `duplicate evidenceId ${row.evidenceId}`,
      ).toBe(false);
      seen.add(row.evidenceId);
    }
  });

  it("every row's boundaryNotes preserve recommendation/explanation/draft/proof distinctions", () => {
    for (const row of DERIVED_STALE_DAYS_EVIDENCE) {
      const combined = row.boundaryNotes.join(" \n ").toLowerCase();
      for (const phrase of REQUIRED_BOUNDARY_PHRASES) {
        expect(
          combined.includes(phrase),
          `${row.evidenceId}: boundaryNotes must include "${phrase}"`,
        ).toBe(true);
      }
    }
  });

  it("no row authorizes auto-write, auto-send, execution authority, LLM ranking, schema design, runtime adoption, or type-surface change", () => {
    for (const row of DERIVED_STALE_DAYS_EVIDENCE) {
      const fields: string[] = [row.evidenceSummary, ...row.boundaryNotes];
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
    const allLocators = DERIVED_STALE_DAYS_EVIDENCE.map(
      (row) => row.evidenceLocator,
    ).join(" | ");
    for (const locator of REQUIRED_REPO_TRUTH_LOCATORS) {
      expect(
        allLocators.includes(locator),
        `Required repo-truth locator "${locator}" must be cited at least once`,
      ).toBe(true);
    }
  });

  it("evidenceKind values are within the allowed vocabulary", () => {
    const allowedKinds = new Set([
      "selected_query_source",
      "readiness_normalization",
      "readout_observed_at_definition",
      "impact_item_type_truth",
      "existing_filter_call_site",
      "tpqr005_proposal",
      "phase3_preflight_doc",
      "phase3a_guard_doc",
      "design_decision_note",
    ]);
    for (const row of DERIVED_STALE_DAYS_EVIDENCE) {
      expect(allowedKinds.has(row.evidenceKind), row.evidenceId).toBe(true);
    }
  });

  it("includes evidence rows that cover all three PF3A-005 guard candidates", () => {
    const candidates = new Set<string>();
    for (const row of DERIVED_STALE_DAYS_EVIDENCE) {
      if (row.relatedSourceCandidate) {
        candidates.add(row.relatedSourceCandidate);
      }
    }
    for (const required of REQUIRED_GUARD_CANDIDATES) {
      expect(
        candidates.has(required),
        `evidence matrix must cover guard candidate "${required}"`,
      ).toBe(true);
    }
  });

  it("records the existing loadTenantResourceIssues filter call site without a derivedStaleDays branch today", () => {
    const callSiteRows = DERIVED_STALE_DAYS_EVIDENCE.filter(
      (row) => row.evidenceKind === "existing_filter_call_site",
    );
    expect(callSiteRows.length).toBeGreaterThan(0);
    for (const row of callSiteRows) {
      const lower = row.evidenceSummary.toLowerCase();
      expect(lower.includes("loadtenantresourceissues")).toBe(true);
      expect(lower.includes("severity")).toBe(true);
      expect(lower.includes("proofrequired")).toBe(true);
      expect(lower.includes("followthroughstatus")).toBe(true);
      expect(lower.includes("no derivedstaledays branch today")).toBe(true);
    }
  });

  it("records the impact item type truth without authorising any type-surface change", () => {
    const typeRows = DERIVED_STALE_DAYS_EVIDENCE.filter(
      (row) => row.evidenceKind === "impact_item_type_truth",
    );
    expect(typeRows.length).toBeGreaterThan(0);
    for (const row of typeRows) {
      const lower = row.evidenceSummary.toLowerCase();
      expect(lower.includes("tenantresourceoperatingimpactitem")).toBe(true);
      expect(
        lower.includes("no derivedstaledays") ||
          lower.includes("no derivedstaledays / staledays / lastsyncedat field"),
      ).toBe(true);
      expect(lower.includes("separate type-surface review")).toBe(true);
    }
  });
});

describe("DERIVED_STALE_DAYS_SOURCE_CATALOG", () => {
  it("includes the three PF3A-005 guard candidates plus exactly one selected normalised source", () => {
    const ids = DERIVED_STALE_DAYS_SOURCE_CATALOG.map((entry) => entry.candidateId);
    for (const required of REQUIRED_GUARD_CANDIDATES) {
      expect(ids).toContain(required);
    }
    expect(ids).toContain("readiness_timing_observed_at_normalized");
    const selectedEntries = DERIVED_STALE_DAYS_SOURCE_CATALOG.filter(
      (entry) => entry.verdict === "selected",
    );
    expect(selectedEntries).toHaveLength(1);
    expect(selectedEntries[0].candidateId).toBe(
      "readiness_timing_observed_at_normalized",
    );
  });

  it("rejects connector.lastSyncedAt as automated-sync-only", () => {
    const entry = DERIVED_STALE_DAYS_SOURCE_CATALOG.find(
      (e) => e.candidateId === "connector_last_synced_at",
    );
    expect(entry).toBeDefined();
    expect(entry?.verdict).toBe("rejected_automated_sync_only");
  });

  it("rejects importSource.updatedAt as too narrow", () => {
    const entry = DERIVED_STALE_DAYS_SOURCE_CATALOG.find(
      (e) => e.candidateId === "import_source_updated_at",
    );
    expect(entry).toBeDefined();
    expect(entry?.verdict).toBe("rejected_too_narrow");
  });

  it("rejects importJob.finishedAt as job-timing-only", () => {
    const entry = DERIVED_STALE_DAYS_SOURCE_CATALOG.find(
      (e) => e.candidateId === "import_job_finished_at",
    );
    expect(entry).toBeDefined();
    expect(entry?.verdict).toBe("rejected_job_timing_only");
  });

  it("every catalog entry preserves the human-meaningful vs automated-sync limitation note", () => {
    for (const entry of DERIVED_STALE_DAYS_SOURCE_CATALOG) {
      expect(entry.limitationNote.trim()).not.toBe("");
      const combined =
        `${entry.semantics} ${entry.verdictRationale} ${entry.limitationNote}`.toLowerCase();
      for (const pattern of FORBIDDEN_AUTHORIZATION_PATTERNS) {
        expect(
          combined.includes(pattern),
          `${entry.candidateId}: catalog text contains forbidden pattern "${pattern}"`,
        ).toBe(false);
      }
    }
  });

  it("the selected entry's limitation note still labels the result as evidence-freshness staleness, not human inactivity", () => {
    const entry = DERIVED_STALE_DAYS_SOURCE_CATALOG.find(
      (e) => e.candidateId === "readiness_timing_observed_at_normalized",
    );
    expect(entry).toBeDefined();
    const lower = entry!.limitationNote.toLowerCase();
    expect(lower.includes("evidence-freshness staleness")).toBe(true);
    expect(lower.includes("not human inactivity")).toBe(true);
    expect(lower.includes("type-surface")).toBe(true);
  });
});

describe("DERIVED_STALE_DAYS_FORMULA", () => {
  it("selectedSource matches SELECTED_DERIVED_STALE_DAYS_SOURCE", () => {
    expect(DERIVED_STALE_DAYS_FORMULA.selectedSource).toBe(
      SELECTED_DERIVED_STALE_DAYS_SOURCE,
    );
    expect(SELECTED_DERIVED_STALE_DAYS_SOURCE).toBe(
      "readiness_timing_observed_at_normalized",
    );
  });

  it("formulaExpression spells out floor / max(0, ...) / 86_400_000", () => {
    const expression = DERIVED_STALE_DAYS_FORMULA.formulaExpression;
    expect(expression).toContain("derivedStaleDays");
    expect(expression).toContain("floor");
    expect(expression).toContain("max(0,");
    expect(expression).toContain("referenceClockMs - observedAtMs");
    expect(expression).toContain("86_400_000");
  });

  it("threshold is strictly > 14 with take: 2 and deterministic ordering", () => {
    expect(DERIVED_STALE_DAYS_FORMULA.thresholdForTpqr005Filter).toBe(14);
    expect(DERIVED_STALE_DAYS_FORMULA.thresholdComparator).toBe(
      "strictly_greater_than",
    );
    expect(DERIVED_STALE_DAYS_FORMULA.noiseGuardTake).toBe(2);
    expect(DERIVED_STALE_DAYS_FORMULA.noiseGuardOrderBy).toBe(
      "derivedStaleDays_desc_then_resource_key_asc",
    );
  });

  it("null/invalid/future observedAt rules are explicit and the staleness label is honest", () => {
    expect(DERIVED_STALE_DAYS_FORMULA.nullObservedAtRule).toBe(
      "null_returns_null_unknown",
    );
    expect(DERIVED_STALE_DAYS_FORMULA.invalidObservedAtRule).toBe(
      "invalid_string_returns_null_unknown",
    );
    expect(DERIVED_STALE_DAYS_FORMULA.futureObservedAtRule).toBe(
      "future_returns_null_unknown_not_negative_not_stale",
    );
    expect(DERIVED_STALE_DAYS_FORMULA.stalenessLabel).toBe(
      "evidence_freshness_staleness_not_human_inactivity",
    );
  });

  it("sourceExpression names lib/tenant-resources/evidence-detail.ts:175", () => {
    expect(DERIVED_STALE_DAYS_FORMULA.sourceExpression).toContain(
      "lib/tenant-resources/evidence-detail.ts:175",
    );
    expect(DERIVED_STALE_DAYS_FORMULA.sourceExpression).toContain(
      "resource.connection.lastSyncAt ?? resource.updatedAt",
    );
  });
});

describe("computeDerivedStaleDays", () => {
  const referenceClock = "2026-04-26T00:00:00.000Z";

  it("returns 0 when observedAt equals the reference clock", () => {
    const result = computeDerivedStaleDays({
      resourceKey: "case_exact",
      observedAt: referenceClock,
      referenceClock,
    });
    expect(result).toBe(0);
  });

  it("returns null for null observedAt (unknown / not filterable, not stale)", () => {
    const result = computeDerivedStaleDays({
      resourceKey: "case_null",
      observedAt: null,
      referenceClock,
    });
    expect(result).toBeNull();
  });

  it("returns null for an invalid observedAt string", () => {
    const result = computeDerivedStaleDays({
      resourceKey: "case_invalid",
      observedAt: "not-a-date",
      referenceClock,
    });
    expect(result).toBeNull();
  });

  it("returns null for a future observedAt (never negative, never stale)", () => {
    const result = computeDerivedStaleDays({
      resourceKey: "case_future",
      observedAt: "2026-05-01T00:00:00.000Z",
      referenceClock,
    });
    expect(result).toBeNull();
  });

  it("returns 13 for a 13-day-old observedAt (just below the > 14 threshold)", () => {
    const result = computeDerivedStaleDays({
      resourceKey: "case_13",
      observedAt: "2026-04-13T00:00:00.000Z",
      referenceClock,
    });
    expect(result).toBe(13);
  });

  it("returns 14 for a 14-day-old observedAt (exactly equal to the threshold; fails strictly > 14)", () => {
    const result = computeDerivedStaleDays({
      resourceKey: "case_14",
      observedAt: "2026-04-12T00:00:00.000Z",
      referenceClock,
    });
    expect(result).toBe(14);
  });

  it("returns 15 for a 15-day-old observedAt (just above the > 14 threshold)", () => {
    const result = computeDerivedStaleDays({
      resourceKey: "case_15",
      observedAt: "2026-04-11T00:00:00.000Z",
      referenceClock,
    });
    expect(result).toBe(15);
  });

  it("accepts Date objects equivalently to ISO strings", () => {
    const result = computeDerivedStaleDays({
      resourceKey: "case_date_object",
      observedAt: new Date("2026-04-11T00:00:00.000Z"),
      referenceClock: new Date(referenceClock),
    });
    expect(result).toBe(15);
  });
});

describe("applyTpqr005CalibrationRule", () => {
  it("filters strictly > 14, orders by derivedStaleDays DESC then resourceKey ASC, takes 2", () => {
    const fixtures: PlanningTenantResourceTimingFixture[] = [
      {
        resourceKey: "connector:conn_b",
        observedAt: "2026-03-17T00:00:00.000Z",
        referenceClock: "2026-04-26T00:00:00.000Z",
      },
      {
        resourceKey: "connector:conn_a",
        observedAt: "2026-03-17T00:00:00.000Z",
        referenceClock: "2026-04-26T00:00:00.000Z",
      },
      {
        resourceKey: "import_source:src_c",
        observedAt: "2026-04-06T00:00:00.000Z",
        referenceClock: "2026-04-26T00:00:00.000Z",
      },
      {
        resourceKey: "capture_session:cap_d",
        observedAt: "2026-04-11T00:00:00.000Z",
        referenceClock: "2026-04-26T00:00:00.000Z",
      },
    ];
    const result = applyTpqr005CalibrationRule(fixtures);
    expect(result).toEqual(["connector:conn_a", "connector:conn_b"]);
  });

  it("excludes fixtures with derivedStaleDays equal to 14 or 13 (strictly > 14)", () => {
    const fixtures: PlanningTenantResourceTimingFixture[] = [
      {
        resourceKey: "connector:boundary_13",
        observedAt: "2026-04-13T00:00:00.000Z",
        referenceClock: "2026-04-26T00:00:00.000Z",
      },
      {
        resourceKey: "connector:boundary_14",
        observedAt: "2026-04-12T00:00:00.000Z",
        referenceClock: "2026-04-26T00:00:00.000Z",
      },
      {
        resourceKey: "connector:boundary_15",
        observedAt: "2026-04-11T00:00:00.000Z",
        referenceClock: "2026-04-26T00:00:00.000Z",
      },
    ];
    const result = applyTpqr005CalibrationRule(fixtures);
    expect(result).toEqual(["connector:boundary_15"]);
  });

  it("treats null / invalid / future observedAt as unknown and excludes them from the > 14 filter", () => {
    const fixtures: PlanningTenantResourceTimingFixture[] = [
      {
        resourceKey: "connector:null_observed",
        observedAt: null,
        referenceClock: "2026-04-26T00:00:00.000Z",
      },
      {
        resourceKey: "connector:invalid_observed",
        observedAt: "not-a-date",
        referenceClock: "2026-04-26T00:00:00.000Z",
      },
      {
        resourceKey: "connector:future_observed",
        observedAt: "2026-04-29T00:00:00.000Z",
        referenceClock: "2026-04-26T00:00:00.000Z",
      },
      {
        resourceKey: "connector:thirty_days_stale",
        observedAt: "2026-03-27T00:00:00.000Z",
        referenceClock: "2026-04-26T00:00:00.000Z",
      },
    ];
    const result = applyTpqr005CalibrationRule(fixtures);
    expect(result).toEqual(["connector:thirty_days_stale"]);
  });

  it("returns an empty array when no fixture is strictly older than 14 days (take: 2 cannot manufacture noise)", () => {
    const fixtures: PlanningTenantResourceTimingFixture[] = [
      {
        resourceKey: "connector:fresh_2",
        observedAt: "2026-04-24T00:00:00.000Z",
        referenceClock: "2026-04-26T00:00:00.000Z",
      },
      {
        resourceKey: "import_source:fresh_7",
        observedAt: "2026-04-19T00:00:00.000Z",
        referenceClock: "2026-04-26T00:00:00.000Z",
      },
      {
        resourceKey: "capture_session:fresh_14",
        observedAt: "2026-04-12T00:00:00.000Z",
        referenceClock: "2026-04-26T00:00:00.000Z",
      },
    ];
    const result = applyTpqr005CalibrationRule(fixtures);
    expect(result).toEqual([]);
  });

  it("documented calibration cases all match the recorded expected top resource keys", () => {
    for (const calibrationCase of DERIVED_STALE_DAYS_CALIBRATION) {
      const actual = applyTpqr005CalibrationRule(calibrationCase.fixtures);
      expect(
        actual,
        `${calibrationCase.caseId}: expected ${calibrationCase.expectedTopResourceKeys.join(",")} got ${actual.join(",")}`,
      ).toEqual([...calibrationCase.expectedTopResourceKeys]);
    }
  });
});

describe("evaluateDerivedStaleDaysDerivationDesign", () => {
  it("all evaluator checks pass against the current evidence matrix", () => {
    const result = evaluateDerivedStaleDaysDerivationDesign();
    const failed = result.checks.filter((c) => !c.passed);
    expect(
      failed,
      `Failed checks: ${failed.map((c) => `${c.checkName}: ${c.detail}`).join("; ")}`,
    ).toHaveLength(0);
    expect(result.allPassed).toBe(true);
  });

  it("totalRows matches the matrix length", () => {
    const result = evaluateDerivedStaleDaysDerivationDesign();
    expect(result.totalRows).toBe(DERIVED_STALE_DAYS_EVIDENCE.length);
  });

  it("selectedSource is readiness_timing_observed_at_normalized", () => {
    const result = evaluateDerivedStaleDaysDerivationDesign();
    expect(result.selectedSource).toBe(
      "readiness_timing_observed_at_normalized",
    );
  });

  it("selectedFormulaExpression spells out the floor / max / 86_400_000 shape", () => {
    const result = evaluateDerivedStaleDaysDerivationDesign();
    expect(result.selectedFormulaExpression).toContain("floor");
    expect(result.selectedFormulaExpression).toContain("max(0,");
    expect(result.selectedFormulaExpression).toContain("86_400_000");
  });

  it("catalogCandidates contains the three guard candidates plus the normalised source", () => {
    const result = evaluateDerivedStaleDaysDerivationDesign();
    for (const required of REQUIRED_GUARD_CANDIDATES) {
      expect(result.catalogCandidates).toContain(required);
    }
    expect(result.catalogCandidates).toContain(
      "readiness_timing_observed_at_normalized",
    );
  });

  it("evaluator surfaces every named check exactly once", () => {
    const result = evaluateDerivedStaleDaysDerivationDesign();
    const names = result.checks.map((c) => c.checkName);
    const expected = [
      "at_least_one_evidence_row",
      "every_row_has_non_empty_evidence_and_boundary",
      "evidence_ids_are_unique",
      "repo_truth_locators_cited",
      "boundary_notes_preserve_recommendation_explanation_draft_proof",
      "no_row_grants_runtime_schema_or_execution_authority",
      "evidence_kinds_and_source_candidates_valid",
      "catalog_covers_three_guard_candidates",
      "exactly_one_selected_candidate_matches_formula",
      "selected_source_is_readiness_observed_at_normalized",
      "formula_shape_is_explicit_and_planning_only",
      "compute_handles_null_invalid_future_observed_at",
      "fourteen_day_threshold_examples_resolved",
      "take_two_calibration_cases_match_expected",
      "design_note_refuses_runtime_and_type_surface_adoption",
      "all_three_guard_candidates_covered_by_evidence",
      "posture_formula_status_is_selected_for_planning",
      "posture_human_meaningful_staleness_gate_not_cleared",
      "posture_semantic_scope_is_evidence_freshness_only",
      "posture_next_required_decision_blocks_runtime_adoption",
      "posture_selected_source_matches_formula",
      "posture_notes_preserve_gate_not_cleared_language",
      "no_row_implies_full_runtime_or_thin_read_model_readiness",
    ];
    expect(names).toEqual(expected);
  });

  it("exposes the PF3A-005 adoption posture in the eval summary", () => {
    const result = evaluateDerivedStaleDaysDerivationDesign();
    expect(result.adoptionPosture).toBe(PF3A005_ADOPTION_POSTURE);
    expect(result.adoptionPosture.humanMeaningfulStalenessGate).toBe(
      "not_cleared",
    );
    expect(result.adoptionPosture.nextRequiredDecision).toBe(
      "stop_or_explicit_scope_downgrade_before_runtime_adoption",
    );
  });
});

describe("PF3A005_ADOPTION_POSTURE", () => {
  it("selectedSource agrees with the formula and the selected source constant", () => {
    expect(PF3A005_ADOPTION_POSTURE.selectedSource).toBe(
      "readiness_timing_observed_at_normalized",
    );
    expect(PF3A005_ADOPTION_POSTURE.selectedSource).toBe(
      SELECTED_DERIVED_STALE_DAYS_SOURCE,
    );
    expect(PF3A005_ADOPTION_POSTURE.selectedSource).toBe(
      DERIVED_STALE_DAYS_FORMULA.selectedSource,
    );
  });

  it("formulaStatus is selected_for_planning, not approved or runtime-ready", () => {
    expect(PF3A005_ADOPTION_POSTURE.formulaStatus).toBe(
      "selected_for_planning",
    );
  });

  it("humanMeaningfulStalenessGate is explicitly not_cleared", () => {
    expect(PF3A005_ADOPTION_POSTURE.humanMeaningfulStalenessGate).toBe(
      "not_cleared",
    );
  });

  it("semanticScope is evidence_freshness_only_not_human_inactivity", () => {
    expect(PF3A005_ADOPTION_POSTURE.semanticScope).toBe(
      "evidence_freshness_only_not_human_inactivity",
    );
  });

  it("nextRequiredDecision blocks runtime adoption until stop or explicit scope downgrade", () => {
    expect(PF3A005_ADOPTION_POSTURE.nextRequiredDecision).toBe(
      "stop_or_explicit_scope_downgrade_before_runtime_adoption",
    );
  });

  it("postureNotes preserve gate-not-cleared / human-meaningful-staleness / stop-or-downgrade language", () => {
    expect(PF3A005_ADOPTION_POSTURE.postureNotes.length).toBeGreaterThan(0);
    const combined = PF3A005_ADOPTION_POSTURE.postureNotes
      .join(" \n ")
      .toLowerCase();
    expect(combined).toContain("does not clear");
    expect(combined).toContain("human-meaningful staleness");
    expect(combined).toContain("stop and re-surface");
    expect(combined).toContain("evidence-freshness-only");
    expect(combined).toContain("does not authorize");
  });

  it("postureNotes do not imply the gate is cleared or that PF3A-005 alone is runtime-ready", () => {
    const forbiddenReadinessPhrases = [
      "human-meaningful staleness gate cleared",
      "human-meaningful staleness guard cleared",
      "human-meaningful staleness cleared",
      "guard fully cleared",
      "gate fully cleared",
      "pf3a-005 fully resolved",
      "pf3a-005 fully cleared",
      "pf3a-005 unconditionally resolved",
      "pf3a-005 implementation-ready",
      "thin read-model planning go",
      "thin read-model go",
      "runtime adoption ready",
      "ready for runtime adoption",
      "ready for thin read-model planning",
      "approved for thin read-model planning",
      "approved for runtime adoption",
      "fully clears the human-meaningful staleness",
      "clears the human-meaningful staleness guard",
      "clears the human-meaningful staleness gate",
    ];
    for (const note of PF3A005_ADOPTION_POSTURE.postureNotes) {
      const lower = note.toLowerCase();
      for (const phrase of forbiddenReadinessPhrases) {
        expect(
          lower.includes(phrase),
          `posture note must not include forbidden readiness phrase "${phrase}"`,
        ).toBe(false);
      }
    }
  });
});

describe("evidence + catalog do not imply gate-cleared / runtime-ready posture", () => {
  const FORBIDDEN_READINESS_PHRASES = [
    "human-meaningful staleness gate cleared",
    "human-meaningful staleness guard cleared",
    "human-meaningful staleness cleared",
    "guard fully cleared",
    "gate fully cleared",
    "pf3a-005 fully resolved",
    "pf3a-005 fully cleared",
    "pf3a-005 unconditionally resolved",
    "pf3a-005 implementation-ready",
    "thin read-model planning go",
    "thin read-model go",
    "runtime adoption ready",
    "ready for runtime adoption",
    "ready for thin read-model planning",
    "approved for thin read-model planning",
    "approved for runtime adoption",
    "fully clears the human-meaningful staleness",
    "clears the human-meaningful staleness guard",
    "clears the human-meaningful staleness gate",
  ] as const;

  it("no evidence row contains a forbidden readiness/gate-cleared phrase", () => {
    for (const row of DERIVED_STALE_DAYS_EVIDENCE) {
      const fields: string[] = [row.evidenceSummary, ...row.boundaryNotes];
      for (const field of fields) {
        const lower = field.toLowerCase();
        for (const phrase of FORBIDDEN_READINESS_PHRASES) {
          expect(
            lower.includes(phrase),
            `${row.evidenceId}: must not contain forbidden readiness phrase "${phrase}"`,
          ).toBe(false);
        }
      }
    }
  });

  it("no source-catalog entry contains a forbidden readiness/gate-cleared phrase", () => {
    for (const entry of DERIVED_STALE_DAYS_SOURCE_CATALOG) {
      const fields = [
        entry.semantics,
        entry.verdictRationale,
        entry.limitationNote,
      ];
      for (const field of fields) {
        const lower = field.toLowerCase();
        for (const phrase of FORBIDDEN_READINESS_PHRASES) {
          expect(
            lower.includes(phrase),
            `${entry.candidateId}: must not contain forbidden readiness phrase "${phrase}"`,
          ).toBe(false);
        }
      }
    }
  });
});
