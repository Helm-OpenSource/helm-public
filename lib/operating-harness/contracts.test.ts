import { describe, expect, it } from "vitest";

import { sha256 } from "../expert-capability/hashing";
import {
  validateEvalCasePromotion,
  validateFeedbackRecord,
} from "../expert-capability/validators";
import {
  syntheticBusinessObjectAlias,
  syntheticEvalCasePromotion,
  syntheticEvidenceRef,
  syntheticFeedbackRecord,
  syntheticJudgementPacket,
  syntheticSignalEvent,
} from "./fixtures";
import {
  validateBusinessObjectAlias,
  validateEvidenceRef,
  validateOperatingHarnessJudgementPacket,
  validateSignalEvent,
} from "./validators";

describe("operating harness canonical contracts", () => {
  it("accepts a content-bound public-safe canonical chain", () => {
    expect(validateEvidenceRef(syntheticEvidenceRef())).toEqual({ ok: true, errors: [] });
    expect(validateBusinessObjectAlias(syntheticBusinessObjectAlias())).toEqual({
      ok: true,
      errors: [],
    });
    expect(validateSignalEvent(syntheticSignalEvent())).toEqual({ ok: true, errors: [] });
    expect(validateOperatingHarnessJudgementPacket(syntheticJudgementPacket())).toEqual({
      ok: true,
      errors: [],
    });
    expect(validateFeedbackRecord(syntheticFeedbackRecord())).toEqual({
      ok: true,
      errors: [],
    });
    expect(validateEvalCasePromotion(syntheticEvalCasePromotion())).toEqual({
      ok: true,
      errors: [],
    });
  });

  it("rejects lifecycle state fields on SignalEvent instead of accepting a second truth source", () => {
    const mutated = {
      ...syntheticSignalEvent(),
      transitionFrom: "LINKED",
      transitionTo: "JUDGED",
      currentBlockerType: null,
    };

    const validation = validateSignalEvent(mutated);

    expect(validation.ok).toBe(false);
    expect(validation.errors).toContain("signal_event_contains_authoritative_state");
  });

  it("rejects raw evidence, embedded content, and missing snapshot hashes", () => {
    const raw = {
      ...syntheticEvidenceRef(),
      sourceSnapshotHash: "",
      redactionStatus: "raw_blocked",
      contentIncluded: true,
      rawPayload: "private source body",
    };

    const validation = validateEvidenceRef(raw);

    expect(validation.ok).toBe(false);
    expect(validation.errors).toEqual(
      expect.arrayContaining([
        "invalid_source_snapshot_hash",
        "raw_or_private_evidence_forbidden",
        "evidence_content_must_not_be_included",
      ]),
    );
  });

  it("rejects an evidence snapshot swap unless the evidence receipt is restamped", () => {
    const swapped = {
      ...syntheticEvidenceRef(),
      sourceSnapshotHash: sha256("different source snapshot"),
    };

    const validation = validateEvidenceRef(swapped);

    expect(validation.ok).toBe(false);
    expect(validation.errors).toContain("evidence_ref_content_hash_mismatch");
  });

  it("requires the signal receipt to cover its evidence binding root", () => {
    const rebound = {
      ...syntheticSignalEvent(),
      evidenceRootHash: sha256("different evidence binding root"),
    };

    const validation = validateSignalEvent(rebound);

    expect(validation.ok).toBe(false);
    expect(validation.errors).toContain("signal_event_content_hash_mismatch");
  });

  it("rejects cross-tenant or person-level business object aliases", () => {
    const unsafe = {
      ...syntheticBusinessObjectAlias(),
      crossTenantProjection: true,
      personAttributionMode: "person_level",
    };

    const validation = validateBusinessObjectAlias(unsafe);

    expect(validation.ok).toBe(false);
    expect(validation.errors).toEqual(
      expect.arrayContaining([
        "cross_tenant_business_object_alias_forbidden",
        "person_level_business_object_alias_forbidden",
      ]),
    );
  });

  it("rejects tampered or action-bearing judgement packets", () => {
    const unsafe = {
      ...syntheticJudgementPacket(),
      disposition: "auto_send_customer_update",
      commitmentClass: "commitment",
      humanReviewerRequired: false,
      forbiddenActionRefs: ["send:customer"],
    };

    const validation = validateOperatingHarnessJudgementPacket(unsafe);

    expect(validation.ok).toBe(false);
    expect(validation.errors).toEqual(
      expect.arrayContaining([
        "judgement_packet_content_hash_mismatch",
        "non_advice_commitment_class",
        "human_reviewer_not_required",
        "forbidden_action_refs_present",
        "action_disposition_present",
      ]),
    );
  });

  it("rejects non-JSON input graphs without throwing", () => {
    const cyclic = syntheticSignalEvent() as unknown as Record<string, unknown>;
    cyclic.self = cyclic;

    expect(validateSignalEvent(cyclic)).toEqual({
      ok: false,
      errors: ["input_graph_contains_reused_reference"],
    });
  });
});
