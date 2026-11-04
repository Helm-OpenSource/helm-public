import { describe, expect, it } from "vitest";

import {
  authorizeCaioAttentionOperation,
  CAIO_ATTENTION_STATUSES,
  canReadCaioAttentionCase,
  isCaioAttentionResponse,
  isCaioAttentionTerminal,
  nextCaioAttentionStatus,
  type CaioAttentionActor,
  type CaioAttentionCaseParties,
  type CaioAttentionOperation,
} from "./state-machine";

const parties: CaioAttentionCaseParties = {
  status: "DISPOSITION_SUBMITTED", commandVersion: 2, confirmedByUserId: "u_owner", primaryUserId: "u_primary",
  ccUserIds: ["u_cc"], escalationUserId: "u_outcome", reviewerUserIds: ["u_reviewer", "u_admin"], reviewerVersion: 3,
};
const actor = (userId: string, role: CaioAttentionActor["role"] = "OTHER", extra: Partial<CaioAttentionActor> = {}): CaioAttentionActor => ({
  userId, role, sameWorkspace: true, active: true, canReviewGovernedActions: true, ...extra,
});
const disposition = { commandVersion: 2, superseded: false, isLatestInVersion: true, submittedByUserId: "u_primary" };
const review = (who: CaioAttentionActor, overrides: Partial<Parameters<typeof authorizeCaioAttentionOperation>[0]> = {}) =>
  authorizeCaioAttentionOperation({ op: "reviewAccept", actor: who, parties, expectedCommandVersion: 2, reviewerVersion: 3, disposition, ...overrides });

describe("transitions", () => {
  it("follows the lifecycle graph", () => {
    expect(nextCaioAttentionStatus("SUGGESTED", "confirm")).toBe("DISPATCHED");
    expect(nextCaioAttentionStatus("SUGGESTED", "defer")).toBe("DEFERRED");
    expect(nextCaioAttentionStatus("DEFERRED", "resumeDeferred")).toBe("SUGGESTED");
    expect(nextCaioAttentionStatus("DISPATCHED", "submitDisposition")).toBe("DISPOSITION_SUBMITTED");
    expect(nextCaioAttentionStatus("DISPOSITION_SUBMITTED", "reviewReturn")).toBe("DISPATCHED");
    expect(nextCaioAttentionStatus("DISPOSITION_SUBMITTED", "reissue")).toBe("DISPATCHED");
    expect(nextCaioAttentionStatus("DISPOSITION_SUBMITTED", "reviewAccept")).toBe("CLOSED");
    expect(nextCaioAttentionStatus("DISPATCHED", "reviewAccept")).toBeNull();
    expect(nextCaioAttentionStatus("SUGGESTED", "submitDisposition")).toBeNull();
  });

  it("terminal statuses accept no operation", () => {
    const ops: CaioAttentionOperation[] = ["confirm", "defer", "resumeDeferred", "dismiss", "cancel", "reissue", "assignReviewers", "ack", "note", "submitDisposition", "reviewAccept", "reviewReturn"];
    for (const status of CAIO_ATTENTION_STATUSES.filter(isCaioAttentionTerminal)) {
      for (const op of ops) expect(nextCaioAttentionStatus(status, op)).toBeNull();
    }
    expect(CAIO_ATTENTION_STATUSES.filter(isCaioAttentionTerminal)).toEqual(["DISMISSED", "CANCELLED", "CLOSED"]);
  });
});

describe("authorizeCaioAttentionOperation", () => {
  it("allows a listed reviewer with a current disposition", () => {
    expect(review(actor("u_reviewer"))).toEqual({ ok: true });
  });

  it("T-C2: a stale command version fails", () => {
    expect(authorizeCaioAttentionOperation({ op: "note", actor: actor("u_primary"), parties, expectedCommandVersion: 1 }))
      .toEqual({ ok: false, reason: "stale_command_version" });
  });

  it("T-C4: submitter, primary and cc cannot review", () => {
    const withAll = { ...parties, reviewerUserIds: ["u_primary", "u_cc", "u_reviewer"] };
    expect(review(actor("u_primary"), { parties: withAll })).toEqual({ ok: false, reason: "separation_of_duties" });
    expect(review(actor("u_cc"), { parties: withAll })).toEqual({ ok: false, reason: "separation_of_duties" });
    expect(review(actor("u_reviewer"), { disposition: { ...disposition, submittedByUserId: "u_reviewer" } }))
      .toEqual({ ok: false, reason: "separation_of_duties" });
  });

  it("T-RV1/T-RV2/T-RV3/T-RV4: outsiders learn nothing; revoked or stale reviewers are refused", () => {
    expect(review(actor("u_operator"))).toEqual({ ok: false, reason: "not_found" });
    expect(review(actor("u_reviewer", "OTHER", { sameWorkspace: false }))).toEqual({ ok: false, reason: "not_found" });
    expect(review(actor("u_reviewer", "OTHER", { active: false }))).toEqual({ ok: false, reason: "not_found" });
    expect(review(actor("u_reviewer", "OTHER", { canReviewGovernedActions: false }))).toEqual({ ok: false, reason: "forbidden" });
    expect(review(actor("u_reviewer"), { reviewerVersion: 2 })).toEqual({ ok: false, reason: "stale_reviewer_version" });
  });

  it("T-RV6: reassigning reviewers keeps the disposition reviewable; superseded ones are not", () => {
    const reassigned = { ...parties, reviewerUserIds: ["u_new"], reviewerVersion: 4 };
    expect(review(actor("u_new"), { parties: reassigned, reviewerVersion: 4 })).toEqual({ ok: true });
    expect(review(actor("u_reviewer"), { disposition: { ...disposition, superseded: true } })).toEqual({ ok: false, reason: "disposition_not_current" });
    expect(review(actor("u_reviewer"), { disposition: { ...disposition, isLatestInVersion: false } })).toEqual({ ok: false, reason: "disposition_not_current" });
  });

  it("T-V6a: an unassigned ADMIN can read with audit but cannot submit or review", () => {
    const admin = actor("u_admin2", "ADMIN");
    expect(canReadCaioAttentionCase(admin, parties)).toEqual({ ok: true, auditRead: true });
    expect(review(admin)).toEqual({ ok: false, reason: "forbidden" });
    expect(authorizeCaioAttentionOperation({ op: "submitDisposition", actor: admin, parties: { ...parties, status: "DISPATCHED" }, expectedCommandVersion: 2 }))
      .toEqual({ ok: false, reason: "forbidden" });
  });

  it("T-V6b/T-V6c: an assigned ADMIN can submit as primary and review as a listed reviewer", () => {
    const asPrimary = { ...parties, status: "DISPATCHED" as const, primaryUserId: "u_admin" , reviewerUserIds: ["u_reviewer"] };
    expect(authorizeCaioAttentionOperation({ op: "submitDisposition", actor: actor("u_admin", "ADMIN"), parties: asPrimary, expectedCommandVersion: 2 }))
      .toEqual({ ok: true });
    expect(review(actor("u_admin", "ADMIN"))).toEqual({ ok: true });
  });

  it("T-V6d: confirm-class operations are OWNER only, whatever the ADMIN's assignment", () => {
    const suggested = { ...parties, status: "SUGGESTED" as const, commandVersion: 0, confirmedByUserId: null };
    const dispatched = { ...parties, status: "DISPATCHED" as const };
    const cases: [CaioAttentionOperation, CaioAttentionCaseParties][] = [
      ["confirm", suggested], ["defer", suggested], ["dismiss", suggested],
      ["cancel", dispatched], ["reissue", dispatched], ["assignReviewers", dispatched],
    ];
    for (const [op, state] of cases) {
      const input = { op: op as Exclude<CaioAttentionOperation, "resumeDeferred">, parties: state, expectedCommandVersion: state.commandVersion };
      expect(authorizeCaioAttentionOperation({ ...input, actor: actor("u_admin", "ADMIN") })).toEqual({ ok: false, reason: "forbidden" });
      expect(authorizeCaioAttentionOperation({ ...input, actor: actor("u_owner", "OWNER") })).toEqual({ ok: true });
    }
  });
});

describe("visibility and response", () => {
  it("T-V4/T-V5: before confirmation prefilled people cannot read; only OWNER and ADMIN can", () => {
    const suggested = { ...parties, status: "SUGGESTED" as const, commandVersion: 0, confirmedByUserId: null };
    expect(canReadCaioAttentionCase(actor("u_primary"), suggested).ok).toBe(false);
    expect(canReadCaioAttentionCase(actor("u_cc"), { ...suggested, status: "DEFERRED" }).ok).toBe(false);
    expect(canReadCaioAttentionCase(actor("u_owner", "OWNER"), suggested)).toEqual({ ok: true, auditRead: false });
    expect(canReadCaioAttentionCase(actor("u_admin9", "ADMIN"), suggested)).toEqual({ ok: true, auditRead: true });
  });

  it("T-V1: unrelated members cannot read; earlier participants read only once terminal", () => {
    expect(canReadCaioAttentionCase(actor("u_member"), parties).ok).toBe(false);
    expect(canReadCaioAttentionCase(actor("u_old"), parties, ["u_old"]).ok).toBe(false);
    expect(canReadCaioAttentionCase(actor("u_old"), { ...parties, status: "CLOSED" }, ["u_old"]).ok).toBe(true);
    expect(canReadCaioAttentionCase(actor("u_cc"), parties)).toEqual({ ok: true, auditRead: false });
  });

  it("T-N2: only the current primary's ack, note or submit is a response", () => {
    expect(isCaioAttentionResponse("note", "u_cc", parties)).toBe(false);
    expect(isCaioAttentionResponse("note", "u_outcome", parties)).toBe(false);
    expect(isCaioAttentionResponse("ack", "u_primary", parties)).toBe(true);
    expect(isCaioAttentionResponse("reviewReturn", "u_primary", parties)).toBe(false);
  });
});
