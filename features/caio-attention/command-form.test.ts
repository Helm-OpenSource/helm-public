import { describe, expect, it } from "vitest";

import { parseCaioAttentionCommandForm } from "./command-form";

const base = { caseId: ["c1"], expectedCommandVersion: ["2"], clientRequestId: ["0b0a6f7e-1c2d-4e5f-8a9b-0c1d2e3f4a5b"] };

describe("parseCaioAttentionCommandForm", () => {
  it("rejects malformed identity fields, system-only operations and OWNER operations without a reason", () => {
    expect(parseCaioAttentionCommandForm({ ...base, op: ["ack"], caseId: ["../x"] })).toEqual({ ok: false });
    expect(parseCaioAttentionCommandForm({ ...base, op: ["ack"], clientRequestId: ["short"] })).toEqual({ ok: false });
    expect(parseCaioAttentionCommandForm({ ...base, op: ["resumeDeferred"] })).toEqual({ ok: false });
    expect(parseCaioAttentionCommandForm({ ...base, op: ["applySeverityRaise"] })).toEqual({ ok: false });
    expect(parseCaioAttentionCommandForm({ ...base, op: ["dismiss"] })).toEqual({ ok: false });
    expect(parseCaioAttentionCommandForm({ ...base, op: ["cancel"], reason: [" "] })).toEqual({ ok: false });
  });

  it("parses ack and a non-empty note", () => {
    expect(parseCaioAttentionCommandForm({ ...base, op: ["ack"] })).toMatchObject({ ok: true, input: { op: "ack", expectedCommandVersion: 2 } });
    expect(parseCaioAttentionCommandForm({ ...base, op: ["note"], text: ["  "] })).toEqual({ ok: false });
    expect(parseCaioAttentionCommandForm({ ...base, op: ["note"], text: ["x".repeat(2001)] })).toEqual({ ok: false });
    expect(parseCaioAttentionCommandForm({ ...base, op: ["note"], text: [" called back "] })).toMatchObject({ ok: true, input: { text: "called back" } });
  });

  it("passes the edited confirm command through, leaving people rules to the service", () => {
    const parsed = parseCaioAttentionCommandForm({
      ...base,
      op: ["confirm"],
      primaryUserId: ["u1"],
      ccUserIds: ["u2", "u2", ""],
      escalationUserId: [""],
      reviewerUserIds: ["u3"],
      committedDueAt: ["2026-11-04T12:00:00.000Z"],
    });
    expect(parsed).toEqual({
      ok: true,
      input: {
        ...{ caseId: "c1", expectedCommandVersion: 2, clientRequestId: base.clientRequestId[0] },
        op: "confirm",
        command: { primaryUserId: "u1", ccUserIds: ["u2"], escalationUserId: null, reviewerUserIds: ["u3"], committedDueAt: new Date("2026-11-04T12:00:00.000Z") },
      },
    });
    expect(parseCaioAttentionCommandForm({ ...base, op: ["confirm"], primaryUserId: ["u 1"] })).toEqual({ ok: false });
  });

  it("requires outcome, action, time and well-formed evidence on a disposition", () => {
    const disposition = {
      ...base,
      op: ["submitDisposition"],
      outcome: ["handled"],
      actionTaken: ["restarted the job"],
      disposedAt: ["2026-11-04T10:00:00.000Z"],
      evidenceRefs: ["audit-log:a1\r\n ticket:T-9 \n"],
    };
    expect(parseCaioAttentionCommandForm(disposition)).toMatchObject({ ok: true, input: { evidenceRefs: ["audit-log:a1", "ticket:T-9"], note: null } });
    expect(parseCaioAttentionCommandForm({ ...disposition, outcome: ["done"] })).toEqual({ ok: false });
    expect(parseCaioAttentionCommandForm({ ...disposition, disposedAt: ["yesterday"] })).toEqual({ ok: false });
    expect(parseCaioAttentionCommandForm({ ...disposition, evidenceRefs: ["https://example.com/x"] })).toEqual({ ok: false });
    expect(parseCaioAttentionCommandForm({ ...disposition, actionTaken: [""] })).toEqual({ ok: false });
  });

  it("requires a review note and the reviewer version", () => {
    const review = { ...base, op: ["reviewReturn"], dispositionId: ["d1"], reviewerVersion: ["1"], note: ["evidence missing"], attestedExternalRefs: ["ticket:T-9"] };
    expect(parseCaioAttentionCommandForm(review)).toMatchObject({ ok: true, input: { op: "reviewReturn", reviewerVersion: 1, attestedExternalRefs: ["ticket:T-9"] } });
    expect(parseCaioAttentionCommandForm({ ...review, note: [""] })).toEqual({ ok: false });
    expect(parseCaioAttentionCommandForm({ ...review, reviewerVersion: [""] })).toEqual({ ok: false });
  });

  it("parses the OWNER operations", () => {
    expect(parseCaioAttentionCommandForm({ ...base, op: ["dismiss"], reason: ["duplicate signal"] })).toMatchObject({ ok: true, input: { op: "dismiss", reason: "duplicate signal" } });
    expect(parseCaioAttentionCommandForm({ ...base, op: ["cancel"], reason: ["handled elsewhere"] })).toMatchObject({ ok: true, input: { op: "cancel" } });
    expect(parseCaioAttentionCommandForm({ ...base, op: ["defer"], deferredUntil: ["2026-11-05T01:00:00.000Z"], reason: [""] }))
      .toMatchObject({ ok: true, input: { op: "defer", deferredUntil: new Date("2026-11-05T01:00:00.000Z"), reason: null } });
    expect(parseCaioAttentionCommandForm({ ...base, op: ["defer"], deferredUntil: [""] })).toEqual({ ok: false });
    expect(parseCaioAttentionCommandForm({ ...base, op: ["reissue"], primaryUserId: ["u6"], reviewerUserIds: ["u4"] }))
      .toMatchObject({ ok: true, input: { op: "reissue", command: { primaryUserId: "u6", reviewerUserIds: ["u4"], committedDueAt: null } } });
    expect(parseCaioAttentionCommandForm({ ...base, op: ["assignReviewers"], reviewerVersion: ["3"], reviewerUserIds: ["u4", "u7"] }))
      .toMatchObject({ ok: true, input: { op: "assignReviewers", reviewerVersion: 3, reviewerUserIds: ["u4", "u7"] } });
    expect(parseCaioAttentionCommandForm({ ...base, op: ["assignReviewers"], reviewerVersion: ["3"] })).toEqual({ ok: false });
  });
});
