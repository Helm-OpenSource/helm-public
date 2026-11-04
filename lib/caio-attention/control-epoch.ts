/**
 * Numeric rules of the intake-control protocol: deployment epochs, readiness revocation, open epochs and
 * pause requests. Pure judgements; the control CLI applies them under `SELECT ... FOR UPDATE` on the
 * control row, and entry points evaluate the gate under `FOR SHARE`.
 *
 * Revocation contract: deploy-begin records the node's revocation watermark at the current epoch E
 * (before the increment), then advances the epoch to E+1; attest-node writes E+1. Recovery and guard
 * downgrade revoke at the current epoch without advancing, so only a later begin -> attest reopens.
 * A readiness proof is valid only if not revoked and its epoch is strictly greater than the watermark.
 */

export function caioAttentionDeployBegin(currentEpoch: number): { revokedEpoch: number; nextEpoch: number } {
  return { revokedEpoch: currentEpoch, nextEpoch: currentEpoch + 1 };
}

/** deploy-recover and guard-downgrade: revoke the node's proofs at the current epoch, no increment. */
export function caioAttentionRevokeInPlace(currentEpoch: number): { revokedEpoch: number } {
  return { revokedEpoch: currentEpoch };
}

export type CaioAttentionReadiness = Readonly<{
  nodeId: string;
  deploymentId: string;
  epoch: number;
  closeCapabilityVersion: number;
  guardVersion: number;
  revokedAt: Date | null;
}>;

export function isCaioAttentionReadinessValid(proof: CaioAttentionReadiness, nodeRevokedEpoch: number | null): boolean {
  return proof.revokedAt === null && (nodeRevokedEpoch === null || proof.epoch > nodeRevokedEpoch);
}

/** Only resume advances openEpoch, always past every pause request seen, including forged future ones. */
export function nextCaioAttentionOpenEpoch(openEpoch: number, pauseRequestEpochs: readonly number[]): number {
  return Math.max(openEpoch, ...pauseRequestEpochs) + 1;
}

/** Entry gate: monotone in the request set, so inserting a pause request can only close the gate. */
export function isCaioAttentionIntakeOpen(intakeState: string, openEpoch: number, pauseRequestEpochs: readonly number[]): boolean {
  return intakeState === "OPEN" && !pauseRequestEpochs.includes(openEpoch);
}

export type CaioAttentionLease = Readonly<{
  intakeState: string;
  epoch: number;
  leaseToken: string | null;
  leaseNodeId: string | null;
  leaseTargetDeploymentId: string | null;
  leaseExpiresAt: Date | null;
}>;

/** Barrier before every link(): the whole (token, node, target, epoch) tuple must still match. */
export function evaluateCaioAttentionLeaseHold(
  lease: CaioAttentionLease,
  request: Readonly<{ token: string; nodeId: string; targetDeploymentId: string; epoch: number }>,
): { ok: true } | { ok: false; reason: "not_deploying" | "lease_fenced" } {
  if (lease.intakeState !== "DEPLOYING") return { ok: false, reason: "not_deploying" };
  const matches = lease.leaseToken === request.token && lease.leaseNodeId === request.nodeId
    && lease.leaseTargetDeploymentId === request.targetDeploymentId && lease.epoch === request.epoch;
  return matches ? { ok: true } : { ok: false, reason: "lease_fenced" };
}

/**
 * Recovery runs on the lease holder's host under the same exclusive host lock. A suspended deployer still
 * holds that lock, so recovery fails until it has exited. The requested node must be this host and the
 * lease's node, and the lease must have expired.
 */
export function evaluateCaioAttentionRecover(input: Readonly<{
  lease: CaioAttentionLease; requestNodeId: string; localNodeId: string; hostLockAcquired: boolean; now: Date;
}>): { ok: true } | { ok: false; reason: "host_lock_held" | "node_mismatch" | "no_lease" | "lease_not_expired" } {
  if (!input.hostLockAcquired) return { ok: false, reason: "host_lock_held" };
  if (input.requestNodeId !== input.localNodeId || input.requestNodeId !== input.lease.leaseNodeId) {
    return { ok: false, reason: "node_mismatch" };
  }
  if (!input.lease.leaseToken || !input.lease.leaseExpiresAt) return { ok: false, reason: "no_lease" };
  return input.lease.leaseExpiresAt.getTime() <= input.now.getTime() ? { ok: true } : { ok: false, reason: "lease_not_expired" };
}

export type CaioAttentionResumeBlock =
  | "not_paused" | "lease_present" | "expected_nodes_empty" | "readiness_missing" | "capability_too_low"
  | "guard_too_low" | "heartbeat_mismatch" | "reminders_disabled" | "pause_request_unacknowledged";

export function evaluateCaioAttentionResume(input: Readonly<{
  intakeState: string;
  leaseToken: string | null;
  openEpoch: number;
  requiredCloseCapability: number;
  minGuardVersion: number;
  expectedNodeIds: readonly string[];
  readiness: readonly CaioAttentionReadiness[];
  revokedEpochByNode: Readonly<Record<string, number>>;
  heartbeats: readonly { nodeId: string; deploymentId: string; lastSeenAt: Date; remindersEnabled: boolean }[];
  heartbeatFreshMs: number;
  pauseRequests: readonly { id: string; openEpoch: number }[];
  acknowledgedPauseRequestIds: readonly string[];
  now: Date;
}>): CaioAttentionResumeBlock[] {
  const blocks = new Set<CaioAttentionResumeBlock>();
  if (input.intakeState !== "PAUSED") blocks.add("not_paused");
  if (input.leaseToken) blocks.add("lease_present");
  if (input.expectedNodeIds.length === 0) blocks.add("expected_nodes_empty");
  for (const nodeId of input.expectedNodeIds) {
    const proofs = input.readiness.filter((p) => p.nodeId === nodeId && isCaioAttentionReadinessValid(p, input.revokedEpochByNode[nodeId] ?? null));
    const proof = proofs.sort((a, b) => b.epoch - a.epoch)[0];
    if (!proof) { blocks.add("readiness_missing"); continue; }
    if (proof.closeCapabilityVersion < input.requiredCloseCapability) blocks.add("capability_too_low");
    if (proof.guardVersion < input.minGuardVersion) blocks.add("guard_too_low");
    const beat = input.heartbeats.find((h) => h.nodeId === nodeId);
    if (!beat || beat.deploymentId !== proof.deploymentId || input.now.getTime() - beat.lastSeenAt.getTime() > input.heartbeatFreshMs) {
      blocks.add("heartbeat_mismatch");
    }
  }
  if (!input.heartbeats.some((h) => input.expectedNodeIds.includes(h.nodeId) && h.remindersEnabled)) blocks.add("reminders_disabled");
  if (input.pauseRequests.some((r) => r.openEpoch === input.openEpoch && !input.acknowledgedPauseRequestIds.includes(r.id))) {
    blocks.add("pause_request_unacknowledged");
  }
  return [...blocks].sort();
}
