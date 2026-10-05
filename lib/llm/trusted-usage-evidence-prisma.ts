import type { Prisma } from "@prisma/client";
import { parseStoredModelRouteDecision, type GovernedSpendAuthority } from "./model-egress-store.service";
import { authorityDate, authorityHash, refuse } from "./trusted-spend-authority";
import { readUsageEvidence, readUsageGrant, type UsageGrant } from "./trusted-usage-evidence";
export type UsageRegistryConfig = { trustedAttestorGrants: Readonly<Record<string, string>> };
export type UsageGrantRow = { id: string; workspaceId: string; envelopeJson: string; contentHash: string; revokedAt: Date | null };
export async function readUsageGrantInTransaction(tx: Prisma.TransactionClient, id: string,
  workspaceId: string, pins: UsageRegistryConfig): Promise<UsageGrant> {
  const [row] = await tx.$queryRaw<UsageGrantRow[]>`SELECT id, workspaceId, envelopeJson, contentHash, revokedAt
    FROM LLMUsageAttestorGrant WHERE CAST(id AS BINARY)=CAST(${id} AS BINARY) FOR SHARE`;
  if (!row || row.id !== id || row.workspaceId !== workspaceId || row.revokedAt !== null || pins.trustedAttestorGrants[id] !== row.contentHash) refuse("usage_attestor_untrusted");
  const grant = readUsageGrant(row.envelopeJson);
  if (authorityHash(grant) !== row.contentHash || grant.id !== id || grant.workspaceId !== workspaceId) refuse("usage_grant_corrupt");
  const [clock] = await tx.$queryRaw<Array<{ now: Date }>>`SELECT UTC_TIMESTAMP(3) AS now`;
  if (clock.now < authorityDate(grant.validFrom) || clock.now >= authorityDate(grant.validUntil)) refuse("usage_attestor_expired");
  return grant;
}
export type VerifiedTerminalUsage = Awaited<ReturnType<typeof verifyTrustedUsageInTransaction>>;
/** Must run inside the original charge transaction; never opens another client. */
export async function verifyTrustedUsageInTransaction(input: Parameters<GovernedSpendAuthority["verifyTerminal"]>[0], pins: UsageRegistryConfig) {
  const { tx, workspaceId, decision, reserved } = input;
  const [row] = await tx.$queryRaw<Array<{ envelopeJson: string; signatureBase64: string; contentHash: string;
    grantId: string; decisionId: string; promptTokens: bigint; completionTokens: bigint }>>`
    SELECT envelopeJson, signatureBase64, contentHash, grantId, decisionId, promptTokens, completionTokens FROM LLMTrustedUsageEvidence
    WHERE CAST(workspaceId AS BINARY)=CAST(${workspaceId} AS BINARY)
      AND CAST(providerIdempotencyKey AS BINARY)=CAST(${reserved.attemptRef} AS BINARY) FOR SHARE`;
  if (!row) refuse("trusted_usage_evidence_unavailable");
  const grant = await readUsageGrantInTransaction(tx, row.grantId, workspaceId, pins);
  const e = readUsageEvidence(row.envelopeJson, row.signatureBase64, grant);
  const claim = await readUsageClaimInTransaction(tx, workspaceId, reserved.attemptRef);
  const route = decision.routeSnapshot;
  if (!route || authorityHash(e) !== row.contentHash || e.decisionId !== decision.decisionId || row.decisionId !== e.decisionId ||
      e.providerIdempotencyKey !== reserved.attemptRef || e.workspaceId !== workspaceId ||
      e.claimHash !== input.dispatchClaimHash || e.runtimeHash !== claim.row.dispatchRuntimeHash ||
      e.routeRef !== route.routeId || e.pricingVersion !== input.pricingVersion ||
      e.priceRef !== reserved.priceBookRef || e.priceHash !== reserved.priceBookHash ||
      e.fxRef !== reserved.fxSnapshotRef || e.fxHash !== reserved.fxSnapshotHash || e.quoteHash !== reserved.quoteHash ||
      e.providerRequestRefHash !== input.providerRequestRefHash || e.outputContentHash !== input.outputContentHash ||
      e.promptTokens !== input.promptTokens || e.completionTokens !== input.completionTokens ||
      row.promptTokens !== BigInt(e.promptTokens) || row.completionTokens !== BigInt(e.completionTokens) ||
      input.requestDisposition !== e.requestDisposition || input.outcome !== e.outcome ||
      grant.adapterKey !== route.adapterKey || grant.registrationHash !== claim.runtime.adapterRegistrationHash ||
      grant.provider !== reserved.provider || grant.model !== reserved.model || grant.modelVersion !== route.modelVersion ||
      grant.endpointFingerprint !== claim.runtime.endpointFingerprint) refuse("usage_terminal_binding_invalid");
  const [clock] = await tx.$queryRaw<Array<{ now: Date }>>`SELECT UTC_TIMESTAMP(3) AS now`;
  if (!claim.row.dispatchClaimedAt || !claim.row.dispatchLeaseExpiresAt || authorityDate(e.capturedAt) < claim.row.dispatchClaimedAt ||
      authorityDate(e.capturedAt) > clock.now || authorityDate(e.capturedAt) >= claim.row.dispatchLeaseExpiresAt) refuse("usage_capture_time_invalid");
  return { evidence: e, grant, now: clock.now };
}

export async function readUsageClaimInTransaction(tx: Prisma.TransactionClient, workspaceId: string, key: string) {
  const [locked] = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM ModelRouteDecision
    WHERE CAST(workspaceId AS BINARY)=CAST(${workspaceId} AS BINARY)
    AND CAST(dispatchProviderIdempotencyKey AS BINARY)=CAST(${key} AS BINARY) FOR SHARE`;
  if (!locked) refuse("usage_claim_missing");
  const row = await tx.modelRouteDecision.findUniqueOrThrow({ where: { id: locked.id } });
  const decision = parseStoredModelRouteDecision(row);
  if (row.workspaceId !== workspaceId || row.dispatchProviderIdempotencyKey !== key || !row.dispatchRuntimeJson ||
      !row.dispatchRuntimeHash || !row.dispatchClaimHash || !row.dispatchLeaseExpiresAt || !row.dispatchClaimedAt) refuse("usage_claim_missing");
  const runtime = JSON.parse(row.dispatchRuntimeJson) as import("./model-egress-store.service").GovernedProviderRuntimeDescriptor;
  if (authorityHash(runtime) !== row.dispatchRuntimeHash) refuse("usage_runtime_corrupt");
  const ledger = await tx.lLMSpendLedgerEntry.findUniqueOrThrow({ where: { workspaceId_attemptRef: { workspaceId, attemptRef: key } } });
  if (ledger.operationRef !== row.id || ledger.contractVersion !== 2 || ledger.provenanceState !== "complete") refuse("usage_ledger_invalid");
  return { row, decision, runtime, ledger };
}
