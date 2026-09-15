import { describe, expect, it } from "vitest";

import { validateOperatingHarnessJudgementPacket } from "@/lib/operating-harness/validators";

import type { CaioInferenceInput } from "./contracts";
import { CAIO_INFERENCE_INPUT_SCHEMA_VERSION, computeCaioInferenceInputHash } from "./contracts";
import { buildCaioInferenceJudgementPacket } from "./judgement-packet";
import type { CaioLayeredJudgement } from "./layered-judgement";

const NOW = new Date("2026-09-16T04:00:00.000Z");

function inferenceInput(overrides: Partial<CaioInferenceInput> = {}): CaioInferenceInput {
  return {
    schemaVersion: CAIO_INFERENCE_INPUT_SCHEMA_VERSION,
    workspaceId: "cworkspaceaaaaaaaaaaaaaaa",
    taskClass: "hourly_diagnosis",
    windowStart: "2026-09-16T02:00:00.000Z",
    windowEnd: "2026-09-16T03:00:00.000Z",
    snapshotRefs: [{ snapshotId: "csnapshotaaaaaaaaaaaaaaaa", snapshotHash: `sha256:${"a".repeat(64)}` }],
    evidenceRefs: ["evidence:metric-a", "evidence:metric-b"],
    supplements: [{ key: "cases.lifecycle-summary", counts: { caseCount: 12, staleObservationCases: null } }],
    ...overrides,
  };
}

function layered(overrides: Partial<CaioLayeredJudgement> = {}): CaioLayeredJudgement {
  return {
    schemaVersion: "helm.caio.layered-judgement.v1",
    facts: [{ statement: "Dead letters rose in the last hour.", evidenceRefs: ["evidence:metric-a"] }],
    inferences: [],
    risks: [{ statement: "Follow-ups may be missed.", severity: "medium", evidenceRefs: ["evidence:metric-b"] }],
    unknowns: [{ statement: "Whether the provider callback is delayed." }],
    suggestions: [],
    confidence: { band: "medium", score: null },
    ...overrides,
  };
}

describe("buildCaioInferenceJudgementPacket", () => {
  it("builds a valid advice packet bound to the frozen input", () => {
    const input = inferenceInput();
    const built = buildCaioInferenceJudgementPacket({
      workspaceId: input.workspaceId,
      jobId: "cjobaaaaaaaaaaaaaaaaaaaaa",
      inferenceInput: input,
      layered: layered(),
      now: NOW,
    });

    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(validateOperatingHarnessJudgementPacket(built.packet)).toEqual({ ok: true, errors: [] });
    expect(built.packet).toMatchObject({
      inputSnapshotRef: computeCaioInferenceInputHash(input),
      commitmentClass: "advice",
      humanReviewerRequired: true,
      forbiddenActionRefs: [],
      disposition: "caio.layered-judgement.v1",
      signalEventRefs: ["caio-snapshot.csnapshotaaaaaaaaaaaaaaaa"],
      businessObjectAliasRef: "caio-workspace.cworkspaceaaaaaaaaaaaaaaa",
      confidence: { band: "medium", score: null, method: "model_assisted", calibrationRef: null },
      createdAt: NOW.toISOString(),
    });
    expect(built.packet.evidenceRefs).toEqual(["evidence:metric-a", "evidence:metric-b"]);
  });

  it("carries only the evidence the judgement cited, in input order", () => {
    const input = inferenceInput({ evidenceRefs: ["evidence:metric-a", "evidence:metric-b", "evidence:metric-c"] });
    const built = buildCaioInferenceJudgementPacket({
      workspaceId: input.workspaceId,
      jobId: "cjobaaaaaaaaaaaaaaaaaaaaa",
      inferenceInput: input,
      layered: layered({
        facts: [{ statement: "Only C matters.", evidenceRefs: ["evidence:metric-c"] }],
        risks: [],
      }),
      now: NOW,
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.packet.evidenceRefs).toEqual(["evidence:metric-c"]);
  });

  it("falls back to the input evidence universe when the judgement cites nothing", () => {
    const input = inferenceInput();
    const built = buildCaioInferenceJudgementPacket({
      workspaceId: input.workspaceId,
      jobId: "cjobaaaaaaaaaaaaaaaaaaaaa",
      inferenceInput: input,
      layered: layered({ facts: [], risks: [] }),
      now: NOW,
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.packet.evidenceRefs).toEqual(input.evidenceRefs);
  });

  it("refuses an input that carries no evidence or no snapshot at all", () => {
    for (const broken of [inferenceInput({ evidenceRefs: [] }), inferenceInput({ snapshotRefs: [] })]) {
      expect(
        buildCaioInferenceJudgementPacket({
          workspaceId: broken.workspaceId,
          jobId: "cjobaaaaaaaaaaaaaaaaaaaaa",
          inferenceInput: broken,
          layered: layered(),
          now: NOW,
        }),
      ).toEqual({ ok: false, code: "malformed_output" });
    }
  });

  it("refuses refs the public packet contract cannot carry", () => {
    const input = inferenceInput({ evidenceRefs: ["evidence:metric a"] });
    expect(
      buildCaioInferenceJudgementPacket({
        workspaceId: input.workspaceId,
        jobId: "cjobaaaaaaaaaaaaaaaaaaaaa",
        inferenceInput: input,
        layered: layered({ facts: [], risks: [] }),
        now: NOW,
      }),
    ).toEqual({ ok: false, code: "malformed_output" });
  });
});
