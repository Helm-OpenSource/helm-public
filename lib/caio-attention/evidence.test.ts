import { describe, expect, it } from "vitest";

import { evaluateCaioAttentionReviewEvidence, parseCaioAttentionEvidenceRefs } from "./evidence";

const dispatchedAt = new Date("2026-01-05T02:00:00.000Z");
const disposedAt = new Date("2026-01-05T06:00:00.000Z");
const context = { workspaceId: "ws_1", detectorId: "detector-a", dispatchedAt, disposedAt };
const at = (iso: string) => new Date(iso);
const evaluate = (evidenceRefs: string[], resolved: Parameters<typeof evaluateCaioAttentionReviewEvidence>[0]["resolved"], extra: { attested?: string[]; note?: string } = {}) =>
  evaluateCaioAttentionReviewEvidence({ evidenceRefs, resolved, attestedExternalRefs: extra.attested ?? [], reviewNote: extra.note ?? "Checked.", context });

describe("parseCaioAttentionEvidenceRefs", () => {
  it("classifies kinds and rejects URLs, free text, duplicates and oversize lists", () => {
    expect(parseCaioAttentionEvidenceRefs(["audit-log:a1", "caio-tick:t1", "ticket:sys.42"])).toEqual({ ok: true, refs: [
      { ref: "audit-log:a1", kind: "audit-log", role: "primary" },
      { ref: "caio-tick:t1", kind: "caio-tick", role: "auxiliary" },
      { ref: "ticket:sys.42", kind: "ticket", role: "external" },
    ] });
    expect(parseCaioAttentionEvidenceRefs(["https://example.test/x"])).toEqual({ ok: false, errorCode: "evidence_ref_invalid" });
    expect(parseCaioAttentionEvidenceRefs(["https:x"])).toEqual({ ok: false, errorCode: "evidence_ref_invalid" });
    expect(parseCaioAttentionEvidenceRefs(["free text"])).toEqual({ ok: false, errorCode: "evidence_ref_invalid" });
    expect(parseCaioAttentionEvidenceRefs(["ticket:a/b"])).toEqual({ ok: false, errorCode: "evidence_ref_invalid" });
    expect(parseCaioAttentionEvidenceRefs(["ticket:a", "ticket:a"])).toEqual({ ok: false, errorCode: "evidence_ref_duplicate" });
    expect(parseCaioAttentionEvidenceRefs(Array.from({ length: 11 }, (_, i) => `ticket:${i}`)))
      .toEqual({ ok: false, errorCode: "evidence_ref_too_many" });
  });
});

describe("evaluateCaioAttentionReviewEvidence", () => {
  const audit = (createdAt: string, workspaceId = "ws_1") => ({ ref: "audit-log:a1", found: true, workspaceId, createdAt: at(createdAt) });

  it("accepts a primary audit-log inside dispatch .. disposal + 24h", () => {
    expect(evaluate(["audit-log:a1"], [audit("2026-01-05T02:00:00.000Z")])).toEqual({ ok: true });
    expect(evaluate(["audit-log:a1"], [audit("2026-01-06T06:00:00.000Z")])).toEqual({ ok: true });
    expect(evaluate(["audit-log:a1"], [audit("2026-01-06T06:00:00.001Z")]))
      .toEqual({ ok: false, reasons: ["evidence_insufficient", "evidence_invalid:audit-log:a1"] });
    expect(evaluate(["audit-log:a1"], [audit("2026-01-05T01:59:59.999Z")]).ok).toBe(false);
    expect(evaluate(["audit-log:a1"], [audit("2026-01-05T03:00:00.000Z", "ws_2")]).ok).toBe(false);
    expect(evaluate(["audit-log:a1"], [])).toMatchObject({ ok: false });
  });

  it("a completed tick after dispatch is valid but never sufficient alone", () => {
    const tick = { ref: "caio-tick:t1", found: true, workspaceId: "ws_1", tickStatus: "COMPLETED", bucketStart: at("2026-01-05T02:10:00.000Z") };
    expect(evaluate(["caio-tick:t1"], [tick])).toEqual({ ok: false, reasons: ["evidence_insufficient"] });
    expect(evaluate(["caio-tick:t1"], [{ ...tick, bucketStart: at("2026-01-05T01:50:00.000Z") }]))
      .toEqual({ ok: false, reasons: ["evidence_insufficient", "evidence_invalid:caio-tick:t1"] });
  });

  it("a detector evaluation must be the same detector, NO_HIT and after disposal", () => {
    const evaluation = { ref: "caio-detector-evaluation:e1", found: true, workspaceId: "ws_1", detectorId: "detector-a", outcome: "NO_HIT", bucketStart: at("2026-01-05T06:00:00.000Z") };
    const refs = ["caio-detector-evaluation:e1", "execution-receipt:r1"];
    const receipt = { ref: "execution-receipt:r1", found: true, workspaceId: "ws_1", createdAt: at("2026-01-05T03:00:00.000Z") };
    expect(evaluate(refs, [evaluation, receipt])).toEqual({ ok: true });
    for (const broken of [{ outcome: "HIT" }, { detectorId: "detector-b" }, { bucketStart: at("2026-01-05T05:50:00.000Z") }]) {
      expect(evaluate(refs, [{ ...evaluation, ...broken }, receipt]))
        .toEqual({ ok: false, reasons: ["evidence_invalid:caio-detector-evaluation:e1"] });
    }
  });

  it("external refs count only when the reviewer ticks them, and the note is always required", () => {
    expect(evaluate(["ticket:sys.42"], [])).toEqual({ ok: false, reasons: ["evidence_insufficient"] });
    expect(evaluate(["ticket:sys.42"], [], { attested: ["ticket:sys.42"] })).toEqual({ ok: true });
    expect(evaluate(["ticket:sys.42"], [], { attested: ["ticket:sys.42", "ticket:other"] }))
      .toEqual({ ok: false, reasons: ["attested_ref_not_submitted"] });
    expect(evaluate(["ticket:sys.42"], [], { attested: ["ticket:sys.42"], note: "  " }))
      .toEqual({ ok: false, reasons: ["review_note_required"] });
  });
});
