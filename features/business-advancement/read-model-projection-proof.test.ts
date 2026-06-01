import { describe, expect, it } from "vitest";
import { ADVANCEMENT_SIGNAL_FIXTURES } from "./fixtures";
import { FIXTURE_FEASIBILITY_MATRIX } from "./read-model-feasibility";
import { buildMustPushAdapterResults } from "./must-push-adapter";
import {
  READ_MODEL_PROJECTION_PROOF,
  evaluateReadModelProjectionProof,
} from "./read-model-projection-proof";

const REQUIRED_SOURCE_TYPES = ["meeting", "tenant_resource", "crm"] as const;

const FORBIDDEN_AUTHORIZATION_PATTERNS = [
  "may add a schema",
  "may add schema",
  "may create schema",
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
] as const;

describe("READ_MODEL_PROJECTION_PROOF", () => {
  it("covers meeting, tenant_resource, and crm", () => {
    const covered = new Set(READ_MODEL_PROJECTION_PROOF.map((r) => r.sourceType));
    for (const required of REQUIRED_SOURCE_TYPES) {
      expect(
        covered.has(required),
        `source type "${required}" must be covered in the proof matrix`
      ).toBe(true);
    }
  });

  it("has exactly 3 rows — one per required source type", () => {
    expect(READ_MODEL_PROJECTION_PROOF).toHaveLength(3);
  });

  it("every proof row has non-empty required fields", () => {
    for (const row of READ_MODEL_PROJECTION_PROOF) {
      expect(
        row.coveredFixtureIds.length,
        `${row.sourceType}: coveredFixtureIds must not be empty`
      ).toBeGreaterThan(0);
      expect(
        row.projectedSignalTypes.length,
        `${row.sourceType}: projectedSignalTypes must not be empty`
      ).toBeGreaterThan(0);
      expect(
        row.existingReadModelPath.trim(),
        `${row.sourceType}: existingReadModelPath must not be empty`
      ).not.toBe("");
      expect(
        row.membershipCapabilityBoundaryNote.trim(),
        `${row.sourceType}: membershipCapabilityBoundaryNote must not be empty`
      ).not.toBe("");
      expect(
        row.whyNoSchemaOrExtractor.trim(),
        `${row.sourceType}: whyNoSchemaOrExtractor must not be empty`
      ).not.toBe("");
    }
  });

  it("every proof row has a valid readiness status", () => {
    const valid = [
      "projection_ready",
      "needs_thin_projection_review",
      "not_ready",
    ] as const;
    for (const row of READ_MODEL_PROJECTION_PROOF) {
      expect(
        (valid as readonly string[]).includes(row.readinessStatus),
        `${row.sourceType}: invalid readinessStatus "${row.readinessStatus}"`
      ).toBe(true);
    }
  });

  it("no proof row authorizes schema, runtime extractor, event ingestion, official write, auto execution, LLM ranking, or page behavior changes", () => {
    for (const row of READ_MODEL_PROJECTION_PROOF) {
      const fields = [
        row.membershipCapabilityBoundaryNote,
        row.whyNoSchemaOrExtractor,
      ];
      for (const field of fields) {
        const lower = field.toLowerCase();
        for (const pattern of FORBIDDEN_AUTHORIZATION_PATTERNS) {
          expect(
            lower.includes(pattern),
            `${row.sourceType}: field contains forbidden authorization pattern "${pattern}"`
          ).toBe(false);
        }
      }
    }
  });

  it("all covered fixture IDs exist as known Phase 1A fixtures", () => {
    const knownIds = new Set(
      ADVANCEMENT_SIGNAL_FIXTURES.map((f) => f.fixtureId)
    );
    for (const row of READ_MODEL_PROJECTION_PROOF) {
      for (const fixtureId of row.coveredFixtureIds) {
        expect(
          knownIds.has(fixtureId),
          `${row.sourceType}/${fixtureId}: fixture ID not found in Phase 1A fixture set`
        ).toBe(true);
      }
    }
  });

  it("all covered fixture IDs are active candidates from the Phase 2 adapter", () => {
    const adapterResults = buildMustPushAdapterResults(
      ADVANCEMENT_SIGNAL_FIXTURES,
      FIXTURE_FEASIBILITY_MATRIX
    );
    const activeIds = new Set(
      adapterResults
        .filter((r) => r.status === "active")
        .map((r) => r.fixtureId)
    );
    for (const row of READ_MODEL_PROJECTION_PROOF) {
      for (const fixtureId of row.coveredFixtureIds) {
        expect(
          activeIds.has(fixtureId),
          `${row.sourceType}/${fixtureId}: not an active Phase 2 adapter candidate`
        ).toBe(true);
      }
    }
  });

  it("no future_only or blocked fixture is covered as an active projection candidate", () => {
    const adapterResults = buildMustPushAdapterResults(
      ADVANCEMENT_SIGNAL_FIXTURES,
      FIXTURE_FEASIBILITY_MATRIX
    );
    const deferredIds = new Set(
      adapterResults
        .filter((r) => r.status === "deferred")
        .map((r) => r.fixtureId)
    );
    for (const row of READ_MODEL_PROJECTION_PROOF) {
      for (const fixtureId of row.coveredFixtureIds) {
        expect(
          deferredIds.has(fixtureId),
          `${row.sourceType}/${fixtureId}: deferred (future_only or blocked) fixture incorrectly covered as active`
        ).toBe(false);
      }
    }
  });
});

describe("evaluateReadModelProjectionProof", () => {
  it("all evaluator checks pass", () => {
    const result = evaluateReadModelProjectionProof();
    const failed = result.checks.filter((c) => !c.passed);
    expect(
      failed,
      `Failed checks: ${failed.map((c) => `${c.checkName}: ${c.detail}`).join("; ")}`
    ).toHaveLength(0);
    expect(result.allPassed).toBe(true);
  });

  it("covers exactly meeting, tenant_resource, crm", () => {
    const result = evaluateReadModelProjectionProof();
    const covered = new Set(result.coveredSourceTypes);
    expect(covered.has("meeting")).toBe(true);
    expect(covered.has("tenant_resource")).toBe(true);
    expect(covered.has("crm")).toBe(true);
  });

  it("total rows is 3", () => {
    const result = evaluateReadModelProjectionProof();
    expect(result.totalRows).toBe(3);
  });
});
