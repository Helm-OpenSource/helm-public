import { describe, expect, it } from "vitest";

import {
  caioAttentionDeployBegin,
  caioAttentionRevokeInPlace,
  evaluateCaioAttentionLeaseHold,
  evaluateCaioAttentionRecover,
  evaluateCaioAttentionResume,
  isCaioAttentionIntakeOpen,
  isCaioAttentionReadinessValid,
  nextCaioAttentionOpenEpoch,
  type CaioAttentionLease,
  type CaioAttentionReadiness,
} from "./control-epoch";

const now = new Date("2026-01-05T04:00:00.000Z");
const proof = (nodeId: string, epoch: number, extra: Partial<CaioAttentionReadiness> = {}): CaioAttentionReadiness => ({
  nodeId, deploymentId: `d-${nodeId}`, epoch, closeCapabilityVersion: 1, guardVersion: 1, revokedAt: null, ...extra,
});
const beat = (nodeId: string, extra: Partial<{ deploymentId: string; lastSeenAt: Date; remindersEnabled: boolean }> = {}) => ({
  nodeId, deploymentId: `d-${nodeId}`, lastSeenAt: now, remindersEnabled: true, ...extra,
});
const resume = (overrides: Partial<Parameters<typeof evaluateCaioAttentionResume>[0]> = {}) => evaluateCaioAttentionResume({
  intakeState: "PAUSED", leaseToken: null, openEpoch: 4, requiredCloseCapability: 1, minGuardVersion: 1,
  expectedNodeIds: ["x", "y"], readiness: [proof("x", 7), proof("y", 7)], revokedEpochByNode: {},
  heartbeats: [beat("x"), beat("y")], heartbeatFreshMs: 180_000, pauseRequests: [], acknowledgedPauseRequestIds: [], now, ...overrides,
});

/** Applies deploy-begin for one node: mark its proofs revoked, set the watermark to E, advance to E+1. */
function begin(state: { epoch: number; proofs: CaioAttentionReadiness[]; revoked: Record<string, number> }, nodeId: string) {
  const { revokedEpoch, nextEpoch } = caioAttentionDeployBegin(state.epoch);
  return {
    epoch: nextEpoch,
    proofs: state.proofs.map((p) => (p.nodeId === nodeId && !p.revokedAt ? { ...p, revokedAt: now } : p)),
    revoked: { ...state.revoked, [nodeId]: revokedEpoch },
  };
}

describe("revocation epochs (REREVIEW5 P2-1)", () => {
  const start = { epoch: 5, proofs: [proof("x", 5), proof("y", 5)], revoked: {} as Record<string, number> };

  it("records the old epoch E, advances to E+1, and the E+1 attest is valid", () => {
    expect(caioAttentionDeployBegin(5)).toEqual({ revokedEpoch: 5, nextEpoch: 6 });
    const s = begin(start, "x");
    const attested = proof("x", s.epoch); // attest writes the current epoch, E+1
    expect(isCaioAttentionReadinessValid(attested, s.revoked.x)).toBe(true);
    expect(isCaioAttentionReadinessValid(proof("x", 5), s.revoked.x)).toBe(false);
    // T-P13: y keeps its older, unrevoked proof and still counts.
    expect(resume({ readiness: [...s.proofs, attested], revokedEpochByNode: s.revoked })).toEqual([]);
  });

  it("normal redeploy twice: each new attest beats the previous watermark", () => {
    let s = begin(start, "x");
    s = { ...s, proofs: [...s.proofs, proof("x", s.epoch)] };
    s = begin(s, "x");
    expect(s.revoked.x).toBe(6);
    expect(isCaioAttentionReadinessValid(proof("x", 6), s.revoked.x)).toBe(false);
    expect(isCaioAttentionReadinessValid(proof("x", s.epoch), s.revoked.x)).toBe(true);
  });

  it("recover revokes in place, so only a later begin -> attest reopens", () => {
    let s = begin(start, "x"); // epoch 6, deploy crashed before attest
    s = { ...s, revoked: { ...s.revoked, x: caioAttentionRevokeInPlace(s.epoch).revokedEpoch } };
    expect(resume({ readiness: s.proofs, revokedEpochByNode: s.revoked })).toEqual(["readiness_missing"]);
    s = begin(s, "x");
    expect(resume({ readiness: [...s.proofs, proof("x", s.epoch)], revokedEpochByNode: s.revoked })).toEqual([]);
  });

  it("T-P12: guard downgrade keeps resume refused until the guard is restored and re-attested", () => {
    let s = { ...start, revoked: { x: caioAttentionRevokeInPlace(5).revokedEpoch } };
    s = { ...s, proofs: s.proofs.map((p) => (p.nodeId === "x" ? { ...p, revokedAt: now } : p)) };
    expect(resume({ readiness: s.proofs, revokedEpochByNode: s.revoked })).toEqual(["readiness_missing"]);
    s = begin(s, "x");
    expect(resume({ readiness: [...s.proofs, proof("x", s.epoch, { guardVersion: 0 })], revokedEpochByNode: s.revoked })).toEqual(["guard_too_low"]);
    expect(resume({ readiness: [...s.proofs, proof("x", s.epoch)], revokedEpochByNode: s.revoked })).toEqual([]);
  });
});

describe("open epoch and pause requests", () => {
  it("T-U2: any request at the current open epoch closes the gate", () => {
    expect(isCaioAttentionIntakeOpen("OPEN", 4, [])).toBe(true);
    expect(isCaioAttentionIntakeOpen("OPEN", 4, [3, 4])).toBe(false);
    expect(isCaioAttentionIntakeOpen("PAUSED", 4, [])).toBe(false);
    expect(isCaioAttentionIntakeOpen("DEPLOYING", 4, [])).toBe(false);
  });

  it("T-U3: a forged future-epoch request cannot land on the next open epoch", () => {
    const next = nextCaioAttentionOpenEpoch(4, [4, 9]);
    expect(next).toBe(10);
    expect(isCaioAttentionIntakeOpen("OPEN", next, [4, 9])).toBe(true);
  });

  it("T-U4: resume needs every request of the current open epoch acknowledged", () => {
    const pauseRequests = [{ id: "p1", openEpoch: 4 }, { id: "p2", openEpoch: 3 }];
    expect(resume({ pauseRequests })).toEqual(["pause_request_unacknowledged"]);
    expect(resume({ pauseRequests, acknowledgedPauseRequestIds: ["p1"] })).toEqual([]);
  });
});

describe("resume preconditions", () => {
  it("T-P9/T-P7: refuses empty node lists, missing proofs, stale or mismatched heartbeats and disabled reminders", () => {
    expect(resume({ expectedNodeIds: [] })).toEqual(["expected_nodes_empty", "reminders_disabled"]);
    expect(resume({ readiness: [proof("x", 7)] })).toEqual(["readiness_missing"]);
    expect(resume({ heartbeats: [beat("x"), beat("y", { deploymentId: "d-old" })] })).toEqual(["heartbeat_mismatch"]);
    expect(resume({ heartbeats: [beat("x"), beat("y", { lastSeenAt: new Date(now.getTime() - 180_001) })] })).toEqual(["heartbeat_mismatch"]);
    expect(resume({ heartbeats: [beat("x", { remindersEnabled: false }), beat("y", { remindersEnabled: false })] })).toEqual(["reminders_disabled"]);
    expect(resume({ readiness: [proof("x", 7), proof("y", 7, { closeCapabilityVersion: 0 })] })).toEqual(["capability_too_low"]);
    expect(resume({ intakeState: "DEPLOYING", leaseToken: "t" })).toEqual(["lease_present", "not_paused"]);
  });
});

describe("T-P10 split (REREVIEW5 P2-3)", () => {
  const lease: CaioAttentionLease = {
    intakeState: "DEPLOYING", epoch: 6, leaseToken: "tok-a", leaseNodeId: "x", leaseTargetDeploymentId: "d-new",
    leaseExpiresAt: new Date(now.getTime() - 1),
  };
  const recover = (overrides: Partial<Parameters<typeof evaluateCaioAttentionRecover>[0]> = {}) =>
    evaluateCaioAttentionRecover({ lease, requestNodeId: "x", localNodeId: "x", hostLockAcquired: true, now, ...overrides });

  it("T-P10a: a suspended deployer still holds the host lock, so recovery fails even with an expired lease", () => {
    expect(recover({ hostLockAcquired: false })).toEqual({ ok: false, reason: "host_lock_held" });
    expect(recover({ requestNodeId: "y", localNodeId: "y" })).toEqual({ ok: false, reason: "node_mismatch" });
    expect(recover({ localNodeId: "y" })).toEqual({ ok: false, reason: "node_mismatch" });
    expect(recover({ lease: { ...lease, leaseExpiresAt: new Date(now.getTime() + 1) } })).toEqual({ ok: false, reason: "lease_not_expired" });
  });

  it("T-P10b: after the deployer exits and recovery -> begin -> attest -> end -> resume, its old token is fenced", () => {
    expect(recover()).toEqual({ ok: true });
    const oldHold = { token: "tok-a", nodeId: "x", targetDeploymentId: "d-new", epoch: 6 };
    // Recovery leaves PAUSED with no lease; a later deployment owns a new token and epoch.
    expect(evaluateCaioAttentionLeaseHold({ ...lease, intakeState: "PAUSED", leaseToken: null }, oldHold)).toEqual({ ok: false, reason: "not_deploying" });
    const newLease = { ...lease, epoch: 7, leaseToken: "tok-b" };
    expect(evaluateCaioAttentionLeaseHold(newLease, oldHold)).toEqual({ ok: false, reason: "lease_fenced" });
    expect(evaluateCaioAttentionLeaseHold(newLease, { ...oldHold, token: "tok-b" })).toEqual({ ok: false, reason: "lease_fenced" });
    expect(evaluateCaioAttentionLeaseHold(newLease, { ...oldHold, token: "tok-b", epoch: 7 })).toEqual({ ok: true });
    expect(evaluateCaioAttentionLeaseHold({ ...newLease, intakeState: "OPEN" }, { ...oldHold, token: "tok-b", epoch: 7 })).toEqual({ ok: false, reason: "not_deploying" });
  });
});
