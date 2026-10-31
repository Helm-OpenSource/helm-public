import "server-only";
import { createPrivateKey, createPublicKey, sign, type KeyObject } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { canonicalJson, sha256 } from "../expert-capability/hashing";
import type { GovernedModelAdapterRegistration } from "./model-route-contracts";
import { MODEL_GOVERNANCE_PERSISTED_INT_MAX, validateGovernedModelAdapterRegistration } from "./model-route-contracts";
import { authorityDate, authorityHash, canonicalAuthorityJson, computeMaximumCharge, refuse } from "./trusted-spend-authority";
import { readTrustedSpendRecordInTransaction, type TrustedSpendRegistryConfig } from "./trusted-spend-authority-prisma";
import { assertUsageCollectorRealm, readUsageClaimInTransaction, readUsageGrantInTransaction, type UsageRegistryConfig } from "./trusted-usage-evidence-prisma";
import {
  bytesHash, decodeDashScopeChatCompletion, readUsageEvidence, DASHSCOPE_USAGE_SOURCE, USAGE_SCHEMA,
  type DashScopeUsageCall, type DashScopeUsageCapture, type DashScopeUsageCollector, type DashScopeUsageExchange,
  type DashScopeUsageRecord, type UsageEvidence, type UsageGrant,
} from "./trusted-usage-evidence";

/**
 * Metadata capture for one DashScope exchange: reads the claim and the ledger's pinned price before the send, then
 * writes one signed success evidence row in its own transaction. It attests our own capture, not a provider
 * signature, and only a complete answer reaches it: a refused record leaves no row, so the terminal cannot settle
 * and the reservation stays held as unknown. Only reviewed server composition constructs it. No env key, no retry.
 */
export async function createGovernedDashScopeUsageCollector(provided: {
  collectorClient: PrismaClient; chargeClient: PrismaClient; operationWriterClient: PrismaClient;
  registration: GovernedModelAdapterRegistration; grantId: string; usage: UsageRegistryConfig;
  spend: TrustedSpendRegistryConfig; privateKey: KeyObject; endpointFingerprint: string;
}): Promise<DashScopeUsageCollector> {
  const registration = JSON.parse(canonicalAuthorityJson(provided.registration)) as GovernedModelAdapterRegistration;
  const usage = { trustedAttestorGrants: Object.freeze({ ...provided.usage.trustedAttestorGrants }) };
  const spend = { ...provided.spend, trustedIssuerGrants: Object.freeze({ ...provided.spend.trustedIssuerGrants }) };
  // Import one immutable key object rather than keeping a caller-held one.
  const key = createPrivateKey(provided.privateKey.export({ type: "pkcs8", format: "pem" }));
  const publicKeyPem = createPublicKey(key).export({ type: "spki", format: "pem" }).toString();
  const { collectorClient, grantId, endpointFingerprint } = provided;
  await assertUsageCollectorRealm(provided);
  if (!validateGovernedModelAdapterRegistration(registration).valid) refuse("usage_registration_invalid");
  // A grant is bound to one source: a controlled-HTTP grant cannot attest this exchange, even with matching keys.
  const grantBound = (grant: UsageGrant) => grant.source === DASHSCOPE_USAGE_SOURCE && grant.adapterKey === registration.adapterKey &&
    grant.registrationHash === registration.contentHash && grant.endpointFingerprint === endpointFingerprint && grant.publicKeyPem === publicKeyPem;
  // Verify the independently pinned grant before exposing the collector.
  const factoryGrant = await collectorClient.$transaction(async (tx) => {
    const [row] = await tx.$queryRaw<Array<{ workspaceId: string }>>`SELECT workspaceId FROM LLMUsageAttestorGrant WHERE CAST(id AS BINARY)=CAST(${grantId} AS BINARY) FOR SHARE`;
    if (!row) refuse("usage_attestor_untrusted");
    return readUsageGrantInTransaction(tx, grantId, row.workspaceId, usage);
  });
  if (!grantBound(factoryGrant)) refuse("usage_factory_binding_invalid");

  async function snapshot(call: DashScopeUsageCall) {
    return collectorClient.$transaction(async (tx) => {
      const claim = await readUsageClaimInTransaction(tx, call.workspaceId, call.providerIdempotencyKey);
      const grant = await readUsageGrantInTransaction(tx, grantId, call.workspaceId, usage);
      const [clock] = await tx.$queryRaw<Array<{ now: Date }>>`SELECT UTC_TIMESTAMP(3) AS now`;
      if (claim.row.dispatchClaimHash !== call.dispatchClaimHash || claim.row.dispatchRuntimeHash !== call.dispatchRuntimeHash ||
          claim.decision.projectedPayloadHash !== call.projectedPayloadHash || claim.decision.routeRef !== call.route.routeId ||
          authorityHash(claim.decision.routeSnapshot) !== authorityHash(call.route) || claim.ledger.state !== "reserved" ||
          claim.row.dispatchLeaseExpiresAt! <= clock.now || !grantBound(grant) || grant.provider !== call.route.provider ||
          grant.model !== call.route.modelId || grant.modelVersion !== call.route.modelVersion ||
          grant.registrationHash !== claim.runtime.adapterRegistrationHash || endpointFingerprint !== claim.runtime.endpointFingerprint) refuse("usage_dispatch_binding_invalid");
      const price = await readTrustedSpendRecordInTransaction(tx, call.workspaceId, claim.ledger.priceBookRef, "price", spend, claim.ledger.priceBookHash);
      const fx = claim.ledger.fxSnapshotRef === null ? null : await readTrustedSpendRecordInTransaction(tx, call.workspaceId, claim.ledger.fxSnapshotRef, "fx", spend, claim.ledger.fxSnapshotHash);
      if (price.envelope.payload.sku !== grant.sku || price.envelope.payload.provider !== grant.provider || price.envelope.payload.model !== grant.model || price.envelope.version !== call.route.pricingVersion) refuse("usage_price_binding_invalid");
      for (const r of [price, ...(fx ? [fx] : [])]) if (r.grant.validUntil <= clock.now || authorityDate(r.envelope.validUntil) <= clock.now) refuse("usage_price_expired");
      const existing = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM LLMTrustedUsageEvidence WHERE workspaceId=${call.workspaceId} AND providerIdempotencyKey=${call.providerIdempotencyKey}`;
      if (existing.length) refuse("usage_evidence_already_exists");
      return { quoteHash: claim.ledger.quoteHash, price, fx, leaseRemainingMs: claim.row.dispatchLeaseExpiresAt!.getTime() - clock.now.getTime() };
    });
  }

  async function record(call: DashScopeUsageCall, pinned: Awaited<ReturnType<typeof snapshot>>, exchange: DashScopeUsageExchange): Promise<DashScopeUsageRecord> {
    const { route } = call;
    const requestModel = (JSON.parse(Buffer.from(exchange.requestBytes).toString("utf8")) as { model?: unknown }).model;
    if (typeof requestModel !== "string" || (requestModel !== route.modelId && requestModel !== route.modelVersion)) refuse("usage_request_binding_invalid");
    const decoded = decodeDashScopeChatCompletion(exchange.responseBytes, requestModel);
    // The gateway trims the reference before hashing it; padded bytes could never match the evidence hash.
    if (decoded.requestRef !== decoded.requestRef.trim()) refuse("usage_response_binding_invalid");
    // The gateway's terminal algorithm, not authorityHash: that refuses non-integers such as confidence.score.
    const outputContentHash = sha256(canonicalJson(exchange.output));
    if (outputContentHash !== sha256(canonicalJson(JSON.parse(decoded.rawOutput)))) refuse("usage_output_binding_invalid");
    const amount = computeMaximumCharge(pinned.price.envelope.payload, pinned.fx?.envelope.payload ?? null,
      BigInt(decoded.promptTokens), BigInt(decoded.completionTokens));
    if (amount > BigInt(MODEL_GOVERNANCE_PERSISTED_INT_MAX)) refuse("usage_cost_out_of_range");
    await collectorClient.$transaction(async (tx) => {
      const current = await readUsageClaimInTransaction(tx, call.workspaceId, call.providerIdempotencyKey);
      const grant = await readUsageGrantInTransaction(tx, grantId, call.workspaceId, usage);
      const [clock] = await tx.$queryRaw<Array<{ now: Date }>>`SELECT UTC_TIMESTAMP(3) AS now`;
      if (current.row.dispatchClaimHash !== call.dispatchClaimHash || current.row.dispatchRuntimeHash !== call.dispatchRuntimeHash ||
          current.ledger.state !== "reserved" || current.ledger.quoteHash !== pinned.quoteHash || !grantBound(grant) ||
          clock.now >= current.row.dispatchLeaseExpiresAt!) refuse("usage_capture_changed_or_expired");
      const evidence: UsageEvidence = { schema: USAGE_SCHEMA, workspaceId: call.workspaceId, decisionId: current.row.id,
        providerIdempotencyKey: call.providerIdempotencyKey, claimHash: call.dispatchClaimHash, runtimeHash: call.dispatchRuntimeHash,
        routeRef: route.routeId, grantId, grantHash: authorityHash(grant), pricingVersion: route.pricingVersion,
        priceRef: current.ledger.priceBookRef!, priceHash: current.ledger.priceBookHash!, fxRef: current.ledger.fxSnapshotRef,
        fxHash: current.ledger.fxSnapshotHash, quoteHash: current.ledger.quoteHash!, requestDigest: bytesHash(exchange.requestBytes), responseDigest: decoded.responseDigest,
        providerRequestRefHash: bytesHash(Buffer.from(decoded.requestRef)), outputContentHash,
        promptTokens: decoded.promptTokens, completionTokens: decoded.completionTokens, capturedAt: clock.now.toISOString(), requestDisposition: "accepted", outcome: "success" };
      const json = canonicalAuthorityJson(evidence), signature = sign(null, Buffer.from(json), key).toString("base64"), digest = authorityHash(evidence);
      readUsageEvidence(json, signature, grant);
      await tx.$executeRaw`INSERT INTO LLMTrustedUsageEvidence(id,workspaceId,decisionId,providerIdempotencyKey,grantId,envelopeJson,contentHash,signatureBase64,promptTokens,completionTokens)
        VALUES (${`usage:${current.row.id}`},${call.workspaceId},${current.row.id},${call.providerIdempotencyKey},${grantId},${json},${digest},${signature},${evidence.promptTokens},${evidence.completionTokens})`;
      const [saved] = await tx.$queryRaw<Array<{ contentHash: string }>>`SELECT contentHash FROM LLMTrustedUsageEvidence WHERE id=${`usage:${current.row.id}`}`;
      if (saved?.contentHash !== digest) refuse("usage_insert_readback_invalid");
    });
    return { providerRequestRef: decoded.requestRef, promptTokens: decoded.promptTokens, completionTokens: decoded.completionTokens, actualCostUsdMicros: Number(amount) };
  }

  return {
    binding: { adapterKey: registration.adapterKey, registrationHash: registration.contentHash, endpointFingerprint },
    async prepare(call): Promise<DashScopeUsageCapture> {
      const pinned = await snapshot(call);
      return { leaseRemainingMs: pinned.leaseRemainingMs, record: (exchange) => record(call, pinned, exchange) };
    },
  };
}
