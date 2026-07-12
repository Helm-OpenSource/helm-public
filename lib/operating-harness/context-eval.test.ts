import { describe, expect, it } from "vitest";

import {
  computeTemporalContextGoldenPackContentHash,
  evaluateTemporalOperatingContext,
  validateTemporalContextEvaluationReportBinding,
} from "./context-eval";
import {
  computeEvidenceBindingRootHash,
  computeSignalEventContentHash,
} from "./contracts";
import {
  syntheticTemporalContextGoldenPack,
  syntheticTemporalOperatingContextInput,
} from "./context-fixtures";

describe("operating harness P3a context contract eval", () => {
  it("passes the synthetic contract case without claiming empirical lift", () => {
    const input = syntheticTemporalOperatingContextInput();
    const goldenPack = syntheticTemporalContextGoldenPack();
    const report = evaluateTemporalOperatingContext(input, goldenPack);

    expect(report.passed).toBe(true);
    expect(report.metrics.signalRecall).toBe(1);
    expect(report.metrics.precision).toBe(1);
    expect(report.metrics.evidenceCoverage).toBe(1);
    expect(report.metrics.reviewerCompleteness).toBe(1);
    expect(report.metrics.boundaryIncidentCount).toBe(0);
    expect(report.metrics.boundaryAttemptCount).toBe(0);
    expect(report.metrics.objectCoverage).toBe(1);
    expect(report.metrics.relationRecall).toBe(1);
    expect(report.metrics.relationPrecision).toBe(1);
    expect(report.metrics.heldoutLift).toBeNull();
    expect(report.metrics.feedbackToEvalConversionRate).toBeNull();
    expect(report.deterministicReplayStable).toBe(true);
    expect(report.empiricalGeneralizationProven).toBe(false);
    expect(report.modelAdvantageProven).toBe(false);
    expect(
      validateTemporalContextEvaluationReportBinding({
        input,
        goldenPack,
        report,
      }),
    ).toEqual({
      ok: true,
      errors: [],
    });
  });

  it("fails when the golden pack omits an emitted relation", () => {
    const input = syntheticTemporalOperatingContextInput();
    const goldenPack = syntheticTemporalContextGoldenPack();
    goldenPack.expectedRelations.pop();
    const { contentHash: _contentHash, ...content } = goldenPack;
    goldenPack.contentHash =
      computeTemporalContextGoldenPackContentHash(content);

    const report = evaluateTemporalOperatingContext(input, goldenPack);

    expect(report.passed).toBe(false);
    expect(report.metrics.relationRecall).toBe(1);
    expect(report.metrics.relationPrecision).toBeLessThan(1);
    expect(report.failures).toContain("relation_precision_below_1");
  });

  it("fails closed when the golden pack content is tampered", () => {
    const goldenPack = syntheticTemporalContextGoldenPack();
    goldenPack.expectedObjects[0].objectKind = "tampered_kind";

    const report = evaluateTemporalOperatingContext(
      syntheticTemporalOperatingContextInput(),
      goldenPack,
    );

    expect(report.passed).toBe(false);
    expect(report.failures).toContain(
      "context_golden_pack_content_hash_mismatch",
    );
  });

  it("returns a failed report instead of throwing on malformed golden JSON", () => {
    const malformed = { schemaVersion: "wrong", expectedRelations: null };
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;

    expect(() =>
      evaluateTemporalOperatingContext(
        syntheticTemporalOperatingContextInput(),
        malformed,
      ),
    ).not.toThrow();
    const report = evaluateTemporalOperatingContext(
      syntheticTemporalOperatingContextInput(),
      malformed,
    );
    expect(report.passed).toBe(false);
    expect(report.failures).toEqual(
      expect.arrayContaining([
        "invalid_context_golden_pack:schemaVersion:invalid_value",
      ]),
    );
    expect(() =>
      evaluateTemporalOperatingContext(
        syntheticTemporalOperatingContextInput(),
        cyclic,
      ),
    ).not.toThrow();
    expect(
      evaluateTemporalOperatingContext(
        syntheticTemporalOperatingContextInput(),
        cyclic,
      ).failures,
    ).toContain("input_graph_contains_reused_reference");
  });

  it("does not let extra evidence refs preserve a passing score", () => {
    const input = syntheticTemporalOperatingContextInput();
    const signal = input.signalEvents[0];
    signal.evidenceRefs.push(input.evidenceRefs[2].evidenceRef);
    signal.evidenceRootHash = computeEvidenceBindingRootHash([
      input.evidenceRefs[0],
      input.evidenceRefs[2],
    ]);
    const { contentHash: _contentHash, ...content } = signal;
    signal.contentHash = computeSignalEventContentHash(content);

    const report = evaluateTemporalOperatingContext(
      input,
      syntheticTemporalContextGoldenPack(),
    );

    expect(report.passed).toBe(false);
    expect(report.metrics.objectCoverage).toBeLessThan(1);
  });

  it("keeps report binding total for cyclic and non-JSON reports", () => {
    const input = syntheticTemporalOperatingContextInput();
    const goldenPack = syntheticTemporalContextGoldenPack();
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;

    expect(() =>
      validateTemporalContextEvaluationReportBinding({
        input,
        goldenPack,
        report: cyclic,
      }),
    ).not.toThrow();
    expect(
      validateTemporalContextEvaluationReportBinding({
        input,
        goldenPack,
        report: cyclic,
      }).errors,
    ).toContain("input_graph_contains_reused_reference");
    expect(() =>
      validateTemporalContextEvaluationReportBinding({
        input,
        goldenPack,
        report: { unsupported: 1n },
      }),
    ).not.toThrow();
    expect(
      validateTemporalContextEvaluationReportBinding({
        input,
        goldenPack,
        report: { unsupported: 1n },
      }).errors,
    ).toContain("context_evaluation_report_not_plain_json");
  });

  it("counts a blocked boundary attempt without reporting an escaped incident", () => {
    const input = syntheticTemporalOperatingContextInput();
    (input.evidenceRefs[0] as unknown as Record<string, unknown>).rawPayload =
      "blocked private content";

    const report = evaluateTemporalOperatingContext(
      input,
      syntheticTemporalContextGoldenPack(),
    );

    expect(report.passed).toBe(false);
    expect(report.metrics.boundaryAttemptCount).toBe(1);
    expect(report.metrics.boundaryIncidentCount).toBe(0);
  });
});
