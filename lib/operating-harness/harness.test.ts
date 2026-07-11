import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import type {
  ASet,
  BSet,
  PreRegistration,
  RunInput,
} from "../expert-capability/contracts";
import {
  computeHarnessManifestContentHash,
  computeHarnessRevisionContentHash,
  computeHarnessShadowReceiptContentHash,
} from "./harness-contracts";
import { sha256 } from "../expert-capability/hashing";
import {
  syntheticFleetHarnessSource,
  syntheticHarnessPair,
  syntheticHarnessSource,
} from "./harness-fixtures";
import { evaluateHarnessShadow } from "./harness-shadow";
import {
  validateHarnessManifest,
  validateHarnessRevisionBinding,
  validateHarnessShadowReceipt,
} from "./harness-validators";

const packsDir = path.resolve(
  __dirname,
  "..",
  "..",
  "templates",
  "expert-capability",
  "packs",
);

function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(path.join(packsDir, name), "utf8")) as T;
}

function expertEvaluationInput() {
  return {
    preRegistration: readJson<PreRegistration>("pre-registration.json"),
    runInput: readJson<RunInput>("run-input.json"),
    aSet: readJson<ASet>("a-correction-set.json"),
    bSet: readJson<BSet>("b-heldout-eval-set.json"),
  };
}

function shadowInput() {
  const pair = syntheticHarnessPair();
  return {
    ...pair,
    expertEvaluation: expertEvaluationInput(),
    sourceBindings: [{ source: syntheticHarnessSource(), promotion: null }],
  };
}

describe("operating harness manifest and revision", () => {
  it("accepts a content-bound baseline and shadow candidate", () => {
    const pair = syntheticHarnessPair();

    expect(validateHarnessManifest(pair.baselineManifest)).toEqual({ ok: true, errors: [] });
    expect(validateHarnessManifest(pair.candidateManifest)).toEqual({ ok: true, errors: [] });
    expect(
      validateHarnessRevisionBinding({
        revision: pair.baselineRevision,
        manifest: pair.baselineManifest,
        parentRevision: null,
        parentManifest: null,
      }),
    ).toEqual({ ok: true, errors: [] });
    expect(
      validateHarnessRevisionBinding({
        revision: pair.candidateRevision,
        manifest: pair.candidateManifest,
        parentRevision: pair.baselineRevision,
        parentManifest: pair.baselineManifest,
      }),
    ).toEqual({ ok: true, errors: [] });
  });

  it("rejects manifest tampering and action authority", () => {
    const { candidateManifest } = syntheticHarnessPair();
    const tampered = {
      ...candidateManifest,
      allowedSourceClasses: ["fleet_customer_health"],
      actionAuthority: "write",
    };

    const validation = validateHarnessManifest(tampered);

    expect(validation.ok).toBe(false);
    expect(validation.errors).toEqual(
      expect.arrayContaining([
        "harness_manifest_content_hash_mismatch",
        "forbidden_manifest_source_class:fleet_customer_health",
        "invalid_harness_manifest:actionAuthority:invalid_value",
      ]),
    );
  });

  it("rejects protected-component mutation even when all hashes are restamped", () => {
    const pair = syntheticHarnessPair();
    const components = pair.candidateManifest.components.map((component) =>
      component.componentKind === "evaluator"
        ? {
            ...component,
            revisionRef: "evaluator:mutated-v2",
            contentHash: computeHarnessManifestContentHash({
              ...pair.candidateManifest,
              components: [],
            }),
          }
        : component,
    );
    const manifestContent = { ...pair.candidateManifest, components };
    const { contentHash: _oldManifestHash, ...manifestWithoutHash } = manifestContent;
    const candidateManifest = {
      ...manifestWithoutHash,
      contentHash: computeHarnessManifestContentHash(manifestWithoutHash),
    };
    const revisionContent = {
      ...pair.candidateRevision,
      manifestHash: candidateManifest.contentHash,
    };
    const { contentHash: _oldRevisionHash, ...revisionWithoutHash } = revisionContent;
    const candidateRevision = {
      ...revisionWithoutHash,
      contentHash: computeHarnessRevisionContentHash(revisionWithoutHash),
    };

    expect(
      validateHarnessRevisionBinding({
        revision: candidateRevision,
        manifest: candidateManifest,
        parentRevision: pair.baselineRevision,
        parentManifest: pair.baselineManifest,
      }).errors,
    ).toContain("protected_component_changed:evaluator");
  });

  it("requires rollback, fallback, owner review, and no self-promotion", () => {
    const pair = syntheticHarnessPair();
    const unsafe = {
      ...pair.candidateRevision,
      fallbackRevisionId: null,
      rollbackManifestHash: null,
      ownerReviewRequired: false,
      promotionTriggered: true,
    };

    const validation = validateHarnessRevisionBinding({
      revision: unsafe,
      manifest: pair.candidateManifest,
      parentRevision: pair.baselineRevision,
      parentManifest: pair.baselineManifest,
    });

    expect(validation.ok).toBe(false);
    expect(validation.errors).toEqual(
      expect.arrayContaining([
        "shadow_candidate_missing_fallback_revision",
        "shadow_candidate_missing_rollback_manifest",
        "invalid_harness_revision:ownerReviewRequired:invalid_value",
        "invalid_harness_revision:promotionTriggered:invalid_value",
      ]),
    );
  });

  it("keeps canonical-chain and source/use policy changes outside evolution", () => {
    const pair = syntheticHarnessPair();
    const { contentHash: _oldHash, ...content } = pair.candidateManifest;
    const changedContent = {
      ...content,
      canonicalChainRef: "helm.operating-harness.canonical-chain.v2",
      allowedSourceClasses: ["synthetic_public" as const],
      intendedUses: ["heldout_eval" as const],
    };
    const candidateManifest = {
      ...changedContent,
      contentHash: computeHarnessManifestContentHash(changedContent),
    };
    const { contentHash: _oldRevisionHash, ...revisionContent } = pair.candidateRevision;
    const changedRevisionContent = {
      ...revisionContent,
      manifestHash: candidateManifest.contentHash,
    };
    const candidateRevision = {
      ...changedRevisionContent,
      contentHash: computeHarnessRevisionContentHash(changedRevisionContent),
    };

    expect(
      validateHarnessRevisionBinding({
        revision: candidateRevision,
        manifest: candidateManifest,
        parentRevision: pair.baselineRevision,
        parentManifest: pair.baselineManifest,
      }).errors,
    ).toEqual(
      expect.arrayContaining([
        "canonical_chain_changed",
        "protected_manifest_source_classes_changed",
        "protected_manifest_intended_uses_changed",
      ]),
    );
  });

  it("rejects component identity drift and a tampered parent revision", () => {
    const pair = syntheticHarnessPair();
    const components = pair.candidateManifest.components.map((component) =>
      component.componentKind === "judgement_fusion"
        ? { ...component, componentRef: "component:replacement-fusion" }
        : component,
    );
    const { contentHash: _oldManifestHash, ...manifestContent } = pair.candidateManifest;
    const changedManifestContent = { ...manifestContent, components };
    const candidateManifest = {
      ...changedManifestContent,
      contentHash: computeHarnessManifestContentHash(changedManifestContent),
    };
    const { contentHash: _oldCandidateHash, ...candidateContent } = pair.candidateRevision;
    const changedCandidateContent = {
      ...candidateContent,
      manifestHash: candidateManifest.contentHash,
    };
    const candidateRevision = {
      ...changedCandidateContent,
      contentHash: computeHarnessRevisionContentHash(changedCandidateContent),
    };
    const parentRevision = {
      ...pair.baselineRevision,
      contentHash: sha256("tampered parent revision"),
    };

    const validation = validateHarnessRevisionBinding({
      revision: candidateRevision,
      manifest: candidateManifest,
      parentRevision,
      parentManifest: pair.baselineManifest,
    });

    expect(validation.errors).toEqual(
      expect.arrayContaining([
        "component_identity_changed:judgement_fusion",
        "parent_revision_content_hash_mismatch",
      ]),
    );
  });

  it("rejects cyclic or killed parent revisions before hashing or fallback binding", () => {
    const pair = syntheticHarnessPair();
    const cyclicParent = structuredClone(pair.baselineRevision) as unknown as Record<
      string,
      unknown
    >;
    cyclicParent.self = cyclicParent;

    expect(() =>
      validateHarnessRevisionBinding({
        revision: pair.candidateRevision,
        manifest: pair.candidateManifest,
        parentRevision: cyclicParent,
        parentManifest: pair.baselineManifest,
      }),
    ).not.toThrow();
    expect(
      validateHarnessRevisionBinding({
        revision: pair.candidateRevision,
        manifest: pair.candidateManifest,
        parentRevision: cyclicParent,
        parentManifest: pair.baselineManifest,
      }).errors,
    ).toContain("parent_revision:input_graph_contains_reused_reference");

    const { contentHash: _oldHash, ...parentContent } = pair.baselineRevision;
    const killedContent = {
      ...parentContent,
      status: "killed" as const,
      fallbackRevisionId: "oh-expert-v-1",
      rollbackManifestHash: pair.baselineManifest.contentHash,
    };
    const killedParent = {
      ...killedContent,
      contentHash: computeHarnessRevisionContentHash(killedContent),
    };
    expect(
      validateHarnessRevisionBinding({
        revision: pair.candidateRevision,
        manifest: pair.candidateManifest,
        parentRevision: killedParent,
        parentManifest: pair.baselineManifest,
      }).errors,
    ).toContain("parent_revision_killed");
  });
});

describe("operating harness shadow evaluation", () => {
  it("reuses the existing held-out evaluator and emits a content-bound shadow-only receipt", () => {
    const receipt = evaluateHarnessShadow(shadowInput());

    expect(receipt.verdict).toBe("shadow_pass");
    expect(receipt.eligibleForOwnerReview).toBe(true);
    expect(receipt.hardGateFailures).toEqual([]);
    expect(receipt.qualityDerivation).toBe("expert_pre_registered_a_b");
    expect(receipt.qualityScope).toBe("heldout_corpus_projection");
    expect(receipt.candidateQuality.signalRecall).toBe(1);
    expect(receipt.candidateQuality.heldoutLift).toBeGreaterThan(0);
    expect(receipt.promotionTriggered).toBe(false);
    expect(receipt.productionAuthorityGranted).toBe(false);
    expect(receipt.contentHash).toBe(
      computeHarnessShadowReceiptContentHash(
        Object.fromEntries(
          Object.entries(receipt).filter(([key]) => key !== "contentHash"),
        ) as never,
      ),
    );
    expect(validateHarnessShadowReceipt(receipt)).toEqual({ ok: true, errors: [] });
  });

  it("rejects a forged non-fail receipt without source-gate evidence", () => {
    const valid = evaluateHarnessShadow(shadowInput());
    const { contentHash: _oldHash, ...content } = valid;
    const forgedContent = { ...content, sourceGateCount: 0 };
    const forged = {
      ...forgedContent,
      contentHash: computeHarnessShadowReceiptContentHash(forgedContent),
    };

    expect(validateHarnessShadowReceipt(forged).errors).toContain(
      "non_fail_shadow_receipt_has_no_source_gate",
    );
  });

  it("blocks fleet customer health before shadow evaluation", () => {
    const input = shadowInput();
    input.sourceBindings = [{ source: syntheticFleetHarnessSource(), promotion: null }];

    const receipt = evaluateHarnessShadow(input);

    expect(receipt.verdict).toBe("fail");
    expect(receipt.eligibleForOwnerReview).toBe(false);
    expect(receipt.hardGateFailures).toContain(
      "source_gate:source_class_forbidden_from_improvement_loop:fleet_customer_health",
    );
  });

  it("requires every shadow source to declare held-out evaluation use", () => {
    const input = shadowInput();
    input.sourceBindings = [
      {
        source: {
          ...syntheticHarnessSource(),
          allowedUses: ["public_eval", "fixture_validation"],
        },
        promotion: null,
      },
    ];

    expect(evaluateHarnessShadow(input).hardGateFailures).toContain(
      "source_not_allowed_for_heldout_eval:0",
    );
  });

  it("binds the candidate and baseline revisions to the existing pre-registration", () => {
    const input = shadowInput();
    input.expertEvaluation.runInput.candidateRevisionId = "another-revision";

    const receipt = evaluateHarnessShadow(input);

    expect(receipt.verdict).toBe("fail");
    expect(receipt.hardGateFailures).toContain("candidate_revision_not_bound_to_run_input");
  });

  it("blocks incomplete quality evidence and escaped boundary incidents", () => {
    const incomplete = shadowInput();
    incomplete.expertEvaluation.bSet.cases = [];
    expect(evaluateHarnessShadow(incomplete).hardGateFailures).toContain(
      "candidate_quality_report_incomplete",
    );

    const incident = shadowInput();
    const trap = incident.expertEvaluation.bSet.cases.find(
      (item) => item.kind === "boundary_trap",
    )!;
    trap.outputs.candidate.commitmentClass = "commitment";
    expect(evaluateHarnessShadow(incident).hardGateFailures).toContain(
      "candidate_boundary_incident_present",
    );
  });

  it("fails closed when the candidate regresses a canonical quality metric", () => {
    const input = shadowInput();
    for (const item of input.expertEvaluation.bSet.cases) {
      item.outputs.candidate.disposition = "wrong_disposition";
    }

    const receipt = evaluateHarnessShadow(input);

    expect(receipt.verdict).toBe("fail");
    expect(receipt.hardGateFailures).toEqual(
      expect.arrayContaining([
        "candidate_signal_recall_regressed",
        "candidate_precision_regressed",
      ]),
    );
  });

  it("emits a valid fail receipt for missing sources and malformed manifests or eval cases", () => {
    const noSource = shadowInput();
    noSource.sourceBindings = [];
    const noSourceReceipt = evaluateHarnessShadow(noSource);
    expect(noSourceReceipt.hardGateFailures).toContain("source_binding_missing");
    expect(validateHarnessShadowReceipt(noSourceReceipt).ok).toBe(true);

    const malformed = shadowInput();
    delete (malformed.candidateManifest as unknown as Record<string, unknown>)
      .allowedSourceClasses;
    delete (
      malformed.sourceBindings[0].source as unknown as Record<string, unknown>
    ).allowedUses;
    delete (
      malformed.expertEvaluation.bSet.cases[0].outputs as unknown as Record<
        string,
        unknown
      >
    ).previous;

    expect(() => evaluateHarnessShadow(malformed)).not.toThrow();
    const receipt = evaluateHarnessShadow(malformed);
    expect(receipt.verdict).toBe("fail");
    expect(receipt.hardGateFailures).toEqual(
      expect.arrayContaining([
        "candidate_manifest:invalid_harness_manifest:allowedSourceClasses:invalid_type",
        "source_not_allowed_for_heldout_eval:0",
        "expert_evaluator_exception",
      ]),
    );
    expect(validateHarnessShadowReceipt(receipt)).toEqual({ ok: true, errors: [] });

    const malformedMetric = shadowInput();
    (
      malformedMetric.expertEvaluation.preRegistration.metricDefinition as unknown as Record<
        string,
        unknown
      >
    ).w1 = {};
    expect(() => evaluateHarnessShadow(malformedMetric)).not.toThrow();
    const metricReceipt = evaluateHarnessShadow(malformedMetric);
    expect(metricReceipt.verdict).toBe("fail");
    expect(metricReceipt.hardGateFailures).toContain("expert_evaluator_exception");
    expect(metricReceipt.expertEvaluation.candidateWeighted).toBe(0);
    expect(validateHarnessShadowReceipt(metricReceipt)).toEqual({ ok: true, errors: [] });
  });
});
