import { describe, expect, it } from "vitest";
import {
  DEFAULT_THIN_READ_MODEL_ADAPTER_ENABLED_FAMILIES,
  THIN_READ_MODEL_ADAPTER_ALLOWED_FAMILIES,
  THIN_READ_MODEL_ADAPTER_FIXTURE_SOURCE_ROWS,
  THIN_READ_MODEL_ADAPTER_FIXTURE_WORKSPACE_ID,
  THIN_READ_MODEL_ADAPTER_NO_GO_FAMILIES,
  buildThinReadModelAdapterCandidates,
  evaluateThinReadModelAdapterPlan,
  type ThinReadModelAdapterFamily,
  type ThinReadModelAdapterInput,
} from "./thin-read-model-adapter-planning";

const REQUIRED_BOUNDARY_PHRASES = [
  "recommendation != commitment",
  "explanation != approval",
  "draft != send",
  "proof != external write success",
] as const;

function enabledInput(): ThinReadModelAdapterInput {
  return {
    workspaceId: THIN_READ_MODEL_ADAPTER_FIXTURE_WORKSPACE_ID,
    referenceClockMs: 1777161600000,
    enabledFamilies: {
      blockedDecision: true,
      overdueCommitment: true,
      customerWaiting: true,
    },
    sourceRows: THIN_READ_MODEL_ADAPTER_FIXTURE_SOURCE_ROWS,
  };
}

describe("Phase 3E thin read-model adapter planning", () => {
  it("defaults every candidate family to disabled", () => {
    expect(DEFAULT_THIN_READ_MODEL_ADAPTER_ENABLED_FAMILIES).toEqual({
      blockedDecision: false,
      overdueCommitment: false,
      customerWaiting: false,
    });

    const built = buildThinReadModelAdapterCandidates({
      workspaceId: THIN_READ_MODEL_ADAPTER_FIXTURE_WORKSPACE_ID,
      referenceClockMs: 1777161600000,
      sourceRows: THIN_READ_MODEL_ADAPTER_FIXTURE_SOURCE_ROWS,
    });

    expect(built.candidates).toHaveLength(0);
    expect(built.familySummaries.every((row) => row.disabled)).toBe(true);
  });

  it("builds only the three Phase 3C-approved candidate families", () => {
    const built = buildThinReadModelAdapterCandidates(enabledInput());
    const families = new Set(built.candidates.map((candidate) => candidate.family));

    expect([...families].sort()).toEqual(
      [...THIN_READ_MODEL_ADAPTER_ALLOWED_FAMILIES].sort(),
    );
    expect(THIN_READ_MODEL_ADAPTER_NO_GO_FAMILIES).toEqual([
      "stalled_opportunity",
      "tenant_resource_stalled_case",
    ]);
    expect(built.candidates).toHaveLength(5);
    expect(built.candidates.some((candidate) => candidate.family === "blocked_decision")).toBe(true);
    expect(built.candidates.some((candidate) => candidate.family === "overdue_commitment")).toBe(true);
    expect(built.candidates.some((candidate) => candidate.family === "customer_waiting")).toBe(true);
  });

  it("keeps every adapter candidate review-required, scoped, bounded, and calibration-only", () => {
    const built = buildThinReadModelAdapterCandidates(enabledInput());

    for (const candidate of built.candidates) {
      expect(candidate.workspaceId).toBe(THIN_READ_MODEL_ADAPTER_FIXTURE_WORKSPACE_ID);
      expect(candidate.reviewPosture).toBe("review_required");
      expect(["open", "review"]).toContain(candidate.primaryAction.verb);
      expect(candidate.audit.thresholdStatus).toBe("calibration_placeholder");
      expect(candidate.audit.ruleVersion).toMatch(/^phase3e-thin-adapter\//);
      for (const phrase of REQUIRED_BOUNDARY_PHRASES) {
        expect(candidate.boundaryNote).toContain(phrase);
      }
    }
  });

  it("does not expose or rely on persisted overdueFlag for TPQR-003 output", () => {
    const built = buildThinReadModelAdapterCandidates(enabledInput());
    const flipped = buildThinReadModelAdapterCandidates({
      ...enabledInput(),
      sourceRows: {
        ...THIN_READ_MODEL_ADAPTER_FIXTURE_SOURCE_ROWS,
        overdueCommitment:
          THIN_READ_MODEL_ADAPTER_FIXTURE_SOURCE_ROWS.overdueCommitment.map(
            (row) => ({
              ...row,
              persistedOverdueFlag: !row.persistedOverdueFlag,
            }),
          ),
      },
    });

    const ids = built.candidates
      .filter((candidate) => candidate.family === "overdue_commitment")
      .map((candidate) => candidate.itemId);
    const flippedIds = flipped.candidates
      .filter((candidate) => candidate.family === "overdue_commitment")
      .map((candidate) => candidate.itemId);

    expect(flippedIds).toEqual(ids);
    for (const candidate of built.candidates.filter(
      (row) => row.family === "overdue_commitment",
    )) {
      expect(JSON.stringify(candidate)).not.toContain("persistedOverdueFlag");
    }
  });

  it("dedups customer_waiting by emailThreadId after producers", () => {
    const built = buildThinReadModelAdapterCandidates(enabledInput());
    const customerWaiting = built.candidates.filter(
      (candidate) => candidate.family === "customer_waiting",
    );
    const threadIds = customerWaiting.map((candidate) => candidate.audit.dedupKey);

    expect(new Set(threadIds).size).toBe(threadIds.length);
    expect(
      built.excluded.some(
        (row) =>
          row.family === "customer_waiting" &&
          row.reason === "deduped_by_email_thread_id_after_producers",
      ),
    ).toBe(true);
  });

  it("keeps deterministic ordering when source row order is reversed", () => {
    const built = buildThinReadModelAdapterCandidates(enabledInput());
    const reversed = buildThinReadModelAdapterCandidates({
      ...enabledInput(),
      sourceRows: {
        blockedDecision: [
          ...THIN_READ_MODEL_ADAPTER_FIXTURE_SOURCE_ROWS.blockedDecision,
        ].reverse(),
        overdueCommitment: [
          ...THIN_READ_MODEL_ADAPTER_FIXTURE_SOURCE_ROWS.overdueCommitment,
        ].reverse(),
        customerWaiting: [
          ...THIN_READ_MODEL_ADAPTER_FIXTURE_SOURCE_ROWS.customerWaiting,
        ].reverse(),
      },
    });

    expect(reversed.candidates.map((candidate) => candidate.itemId)).toEqual(
      built.candidates.map((candidate) => candidate.itemId),
    );
    expect(reversed.candidates.map((candidate) => candidate.sortKey)).toEqual(
      built.candidates.map((candidate) => candidate.sortKey),
    );
  });

  it("supports disabling any approved family without affecting the others", () => {
    const expectedMissing: ReadonlyArray<{
      key: "blockedDecision" | "overdueCommitment" | "customerWaiting";
      family: ThinReadModelAdapterFamily;
    }> = [
      { key: "blockedDecision", family: "blocked_decision" },
      { key: "overdueCommitment", family: "overdue_commitment" },
      { key: "customerWaiting", family: "customer_waiting" },
    ];

    for (const row of expectedMissing) {
      const built = buildThinReadModelAdapterCandidates({
        ...enabledInput(),
        enabledFamilies: {
          blockedDecision: true,
          overdueCommitment: true,
          customerWaiting: true,
          [row.key]: false,
        },
      });
      expect(built.candidates.some((candidate) => candidate.family === row.family)).toBe(false);
      expect(built.familySummaries.find((summary) => summary.family === row.family)?.disabled).toBe(true);
    }
  });

  it("evaluates the Phase 3E validation matrix", () => {
    const summary = evaluateThinReadModelAdapterPlan(enabledInput());

    expect(summary.allPassed).toBe(true);
    expect(summary.totalChecks).toBe(10);
    expect(summary.passed).toBe(10);
    expect(summary.checks.map((check) => check.checkName)).toEqual([
      "scope_only_phase3c_approved_families",
      "no_go_families_absent",
      "no_runtime_or_write_authority",
      "workspace_scope_inherited",
      "boundary_distinctions_present",
      "overdue_persisted_flag_non_authority",
      "customer_waiting_email_thread_deduped",
      "deterministic_when_inputs_reversed",
      "family_disable_switches_work",
      "audit_bundle_complete",
    ]);
  });
});
