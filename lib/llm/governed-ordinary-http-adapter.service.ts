import "server-only";
import { createPrivateKey, createPublicKey, sign, type KeyObject } from "node:crypto";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { canonicalJson } from "../expert-capability/hashing";
import type { PrismaClient } from "@prisma/client";
import type { GovernedModelProviderAdapter } from "./governed-model-adapter-registry.service";
import type { OrdinaryPaidOutput, OrdinaryPaidPayload } from "./ordinary-paid-adapter-bridge.service";
import type { GovernedModelAdapterRegistration } from "./model-route-contracts";
import { validateGovernedModelAdapterRegistration } from "./model-route-contracts";
import { authorityDate, authorityHash, canonicalAuthorityJson, computeMaximumCharge, refuse } from "./trusted-spend-authority";
import { readTrustedSpendRecordInTransaction, type TrustedSpendRegistryConfig } from "./trusted-spend-authority-prisma";
import { readUsageClaimInTransaction, readUsageGrantInTransaction, type UsageRegistryConfig } from "./trusted-usage-evidence-prisma";
import { bytesHash, decodeControlledResponse, readUsageEvidence, USAGE_SCHEMA, type UsageEvidence } from "./trusted-usage-evidence";

type Identity = { databaseName: string; principal: string; serverUuid: string; lowerCaseNames: number };
async function identity(client: PrismaClient) {
  const [row] = await client.$queryRaw<Identity[]>`SELECT DATABASE() AS databaseName, CURRENT_USER() AS principal, @@server_uuid AS serverUuid, @@lower_case_table_names AS lowerCaseNames`;
  if (!row?.databaseName || !row.principal || !row.serverUuid) refuse("usage_realm_invalid");
  return row;
}
/** Only explicitly reviewed server composition can construct this adapter. No
 * public record(JSON), URL task field, default key, retry or env authority. The
 * decoder is a finite generic protocol; it is NOT a production provider SKU. */
export async function createGovernedOrdinaryHttpAdapter(provided: {
  collectorClient: PrismaClient; chargeClient: PrismaClient; operationWriterClient: PrismaClient;
  registration: GovernedModelAdapterRegistration; grantId: string; usage: UsageRegistryConfig;
  spend: TrustedSpendRegistryConfig; privateKey: KeyObject; endpoint: string;
  endpointFingerprint: string; timeoutMs: number; maximumResponseBytes: number;
}): Promise<GovernedModelProviderAdapter<OrdinaryPaidPayload, OrdinaryPaidOutput>> {
  const input = { ...provided, registration: JSON.parse(canonicalAuthorityJson(provided.registration)) as GovernedModelAdapterRegistration,
    usage: { trustedAttestorGrants: Object.freeze({ ...provided.usage.trustedAttestorGrants }) },
    spend: { ...provided.spend, trustedIssuerGrants: Object.freeze({ ...provided.spend.trustedIssuerGrants }) },
    privateKey: createPrivateKey(provided.privateKey.export({ type: "pkcs8", format: "pem" })) };
  const [collector, charge, writer] = await Promise.all([identity(input.collectorClient), identity(input.chargeClient), identity(input.operationWriterClient)]);
  if ([charge, writer].some((r) => r.databaseName !== collector.databaseName || r.serverUuid !== collector.serverUuid) ||
      new Set([collector.principal, charge.principal, writer.principal]).size !== 3) refuse("usage_realm_invalid");
  // The collector must be insert-only for evidence and read-only elsewhere.
  // SHOW GRANTS includes schema/global/role privileges; no inherited wildcard
  // grant or administrative identity is accepted as this limited collector.
  const grants = await input.collectorClient.$queryRawUnsafe<Array<Record<string, string>>>("SHOW GRANTS");
  const allowed = new Set(["ModelRouteDecision", "LLMSpendLedgerEntry", "LLMUsageAttestorGrant", "LLMTrustedUsageEvidence", "LLMSpendAuthorityRecord", "LLMSpendIssuerGrant", "Membership", "User"]);
  const tableName = (name: string) => collector.lowerCaseNames === 0 ? name : name.toLowerCase();
  const allowedNames = new Set([...allowed].map(tableName));
  let evidenceInsert = false;
  for (const row of grants) for (const value of Object.values(row)) {
    if (/^GRANT USAGE ON \*\.\* TO /u.test(value)) continue;
    const match = /^GRANT (.+?) ON `([^`]+)`\.`([^`]+)` TO /u.exec(value);
    if (!match || match[2] !== collector.databaseName || !allowedNames.has(match[3])) refuse("usage_collector_acl_invalid");
    const table = match[3], privilege = match[1];
    const columns = /^SELECT \(([^)]+)\)$/u.exec(privilege)?.[1].replaceAll("`", "").split(", ").map((c) => c.toLowerCase()).sort().join(",");
    if (table === tableName("User")) {
      if (columns !== "id") refuse("usage_collector_acl_invalid");
    } else if (table === tableName("Membership")) {
      if (columns !== "role,status,userid,workspaceid") refuse("usage_collector_acl_invalid");
    } else if (table === tableName("LLMTrustedUsageEvidence")) {
      if (!["SELECT", "SELECT, INSERT", "INSERT, SELECT"].includes(privilege)) refuse("usage_collector_acl_invalid");
      if (privilege !== "SELECT") evidenceInsert = true;
    } else if (privilege !== "SELECT") refuse("usage_collector_acl_invalid");
  }
  if (!evidenceInsert) refuse("usage_collector_acl_invalid");
  const validation = validateGovernedModelAdapterRegistration(input.registration);
  if (!validation.valid) refuse("usage_registration_invalid");
  const registration = Object.freeze({ ...input.registration, supportedDeploymentForms: Object.freeze([...input.registration.supportedDeploymentForms]) });
  const usage = { trustedAttestorGrants: Object.freeze({ ...input.usage.trustedAttestorGrants }) };
  const spend = { ...input.spend, trustedIssuerGrants: Object.freeze({ ...input.spend.trustedIssuerGrants }) };
  const endpoint = new URL(input.endpoint);
  if (endpoint.username || endpoint.password || endpoint.hash || endpoint.search ||
      !(endpoint.protocol === "https:" || (endpoint.protocol === "http:" && endpoint.hostname === "127.0.0.1")) ||
      !Number.isSafeInteger(input.timeoutMs) || input.timeoutMs < 1 || input.timeoutMs > 30_000 ||
      !Number.isSafeInteger(input.maximumResponseBytes) || input.maximumResponseBytes < 1 || input.maximumResponseBytes > 65_536) refuse("usage_transport_bounds_invalid");
  // Import one immutable key object rather than keeping caller-mutable PEM.
  const key = createPrivateKey(input.privateKey.export({ type: "pkcs8", format: "pem" }));
  const grantId = input.grantId;
  const fingerprint = authorityHash({ schema: "helm.controlled-http-endpoint/v1", origin: endpoint.origin, path: endpoint.pathname });
  if (fingerprint !== input.endpointFingerprint) refuse("usage_endpoint_binding_invalid");
  // Verify the independently pinned grant before exposing an invoke function.
  const factoryGrant = await input.collectorClient.$transaction(async (tx) => {
    const [row] = await tx.$queryRaw<Array<{ workspaceId: string }>>`SELECT workspaceId FROM LLMUsageAttestorGrant WHERE CAST(id AS BINARY)=CAST(${grantId} AS BINARY) FOR SHARE`;
    if (!row) refuse("usage_attestor_untrusted");
    return readUsageGrantInTransaction(tx, grantId, row.workspaceId, usage);
  });
  if (factoryGrant.registrationHash !== registration.contentHash || factoryGrant.adapterKey !== registration.adapterKey ||
      factoryGrant.endpointFingerprint !== fingerprint || createPublicKey(key).export({ type: "spki", format: "pem" }).toString() !== factoryGrant.publicKeyPem) refuse("usage_factory_binding_invalid");
  const timeoutMs = input.timeoutMs, maximum = input.maximumResponseBytes;
  const attempted = new Set<string>();
  return {
    registration,
    async probeReadiness() { return { endpointFingerprint: fingerprint, credentialConfigured: true, modelProbeStatus: "not_ready",
      capabilityRefs: [], evidenceRefs: [], checkedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString() }; },
    async preflight({ route }) { return { endpointFingerprint: fingerprint, credentialConfigured: true, observedAt: new Date().toISOString(), estimatedInputTokens: route.maxInputTokens, estimatedMaxCostUsdMicros: route.maxCostUsdMicros }; },
    async invoke(originalCall) {
      const payloadText = canonicalJson(originalCall.projectedPayload);
      if (Buffer.byteLength(payloadText) > 120_000 || bytesHash(Buffer.from(payloadText)) !== originalCall.projectedPayloadHash) refuse("usage_payload_binding_invalid");
      // Snapshot task/route/payload before the first asynchronous read. The signal
      // remains the actual cancellation handle; it grants no evidence authority.
      const call = { ...originalCall, route: JSON.parse(canonicalJson(originalCall.route)) as typeof originalCall.route,
        projectedPayload: JSON.parse(payloadText) as OrdinaryPaidPayload };
      const tag = authorityHash({ workspaceId: call.workspaceId, key: call.providerIdempotencyKey });
      if (attempted.size >= 65_536 || attempted.has(tag) || call.signal.aborted) refuse("usage_dispatch_already_attempted");
      const snapshot = await input.collectorClient.$transaction(async (tx) => {
        const claim = await readUsageClaimInTransaction(tx, call.workspaceId, call.providerIdempotencyKey);
        const grant = await readUsageGrantInTransaction(tx, grantId, call.workspaceId, usage);
        const [clock] = await tx.$queryRaw<Array<{ now: Date }>>`SELECT UTC_TIMESTAMP(3) AS now`;
        if (claim.row.dispatchClaimHash !== call.dispatchClaimHash || claim.row.dispatchRuntimeHash !== call.dispatchRuntimeHash ||
            claim.decision.projectedPayloadHash !== call.projectedPayloadHash || claim.decision.routeRef !== call.route.routeId ||
            authorityHash(claim.decision.routeSnapshot) !== authorityHash(call.route) || claim.ledger.state !== "reserved" ||
            claim.row.dispatchLeaseExpiresAt! <= clock.now || grant.adapterKey !== registration.adapterKey ||
            grant.registrationHash !== registration.contentHash || grant.provider !== call.route.provider || grant.model !== call.route.modelId ||
            grant.modelVersion !== call.route.modelVersion || grant.endpointFingerprint !== fingerprint ||
            grant.registrationHash !== claim.runtime.adapterRegistrationHash || fingerprint !== claim.runtime.endpointFingerprint ||
            createPublicKey(key).export({ type: "spki", format: "pem" }).toString() !== grant.publicKeyPem) refuse("usage_dispatch_binding_invalid");
        const price = await readTrustedSpendRecordInTransaction(tx, call.workspaceId, claim.ledger.priceBookRef, "price", spend, claim.ledger.priceBookHash);
        const fx = claim.ledger.fxSnapshotRef === null ? null : await readTrustedSpendRecordInTransaction(tx, call.workspaceId, claim.ledger.fxSnapshotRef, "fx", spend, claim.ledger.fxSnapshotHash);
        if (price.envelope.payload.sku !== grant.sku || price.envelope.payload.provider !== grant.provider || price.envelope.payload.model !== grant.model || price.envelope.version !== call.route.pricingVersion) refuse("usage_price_binding_invalid");
        for (const r of [price, ...(fx ? [fx] : [])]) if (r.grant.validUntil <= clock.now || authorityDate(r.envelope.validUntil) <= clock.now) refuse("usage_price_expired");
        const existing = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM LLMTrustedUsageEvidence WHERE workspaceId=${call.workspaceId} AND providerIdempotencyKey=${call.providerIdempotencyKey}`;
        if (existing.length) refuse("usage_evidence_already_exists");
        return { ...claim, grant, price, fx };
      });
      const requestBytes = Buffer.from(canonicalJson({ schema: "helm.controlled-model-request/v1", requestId: call.providerIdempotencyKey, payload: call.projectedPayload }));
      if (requestBytes.length > 131_072) refuse("usage_request_size_invalid");
      attempted.add(tag); // No implicit retry, including lost evidence ACK.
      const remaining = Math.min(timeoutMs, snapshot.row.dispatchLeaseExpiresAt!.getTime() - Date.now());
      if (remaining <= 0) refuse("usage_dispatch_expired");
      const responseBytes = await new Promise<Buffer>((resolve, reject) => {
        let settled = false;
        const finish = (error?: Error, bytes?: Buffer) => {
          if (settled) return; settled = true; clearTimeout(timer); call.signal.removeEventListener("abort", abort);
          if (error) { req.destroy(); reject(new Error("trusted_usage_transport_unknown")); } else resolve(bytes!);
        };
        const req = (endpoint.protocol === "https:" ? httpsRequest : httpRequest)(endpoint, { method: "POST", agent: false,
          headers: { "content-type": "application/json", "content-length": String(requestBytes.length) } }, (res) => {
          if (res.statusCode !== 200) { res.destroy(); finish(new Error("status")); return; }
          const chunks: Buffer[] = []; let size = 0;
          res.on("data", (chunk: Buffer) => { size += chunk.length; if (size > maximum) { res.destroy(); finish(new Error("size")); } else chunks.push(Buffer.from(chunk)); });
          res.on("end", () => finish(undefined, Buffer.concat(chunks))); res.on("error", () => finish(new Error("response")));
          res.on("aborted", () => finish(new Error("aborted")));
        });
        const abort = () => finish(new Error("abort"));
        const timer = setTimeout(abort, remaining);
        req.on("error", () => finish(new Error("request"))); call.signal.addEventListener("abort", abort, { once: true });
        if (call.signal.aborted) abort(); else req.end(requestBytes);
      });
      const decoded = decodeControlledResponse(responseBytes, call.providerIdempotencyKey, call.route.modelVersion);
      const amount = computeMaximumCharge(snapshot.price.envelope.payload, snapshot.fx?.envelope.payload ?? null,
        BigInt(decoded.promptTokens), BigInt(decoded.completionTokens));
      if (amount > BigInt(Number.MAX_SAFE_INTEGER)) refuse("usage_cost_out_of_range");
      const e = await input.collectorClient.$transaction(async (tx) => {
        const current = await readUsageClaimInTransaction(tx, call.workspaceId, call.providerIdempotencyKey);
        const grant = await readUsageGrantInTransaction(tx, grantId, call.workspaceId, usage);
        const [clock] = await tx.$queryRaw<Array<{ now: Date }>>`SELECT UTC_TIMESTAMP(3) AS now`;
        if (current.row.dispatchClaimHash !== call.dispatchClaimHash || current.row.dispatchRuntimeHash !== call.dispatchRuntimeHash ||
            current.ledger.state !== "reserved" || current.ledger.quoteHash !== snapshot.ledger.quoteHash || clock.now >= current.row.dispatchLeaseExpiresAt!) refuse("usage_capture_changed_or_expired");
        const evidence: UsageEvidence = { schema: USAGE_SCHEMA, workspaceId: call.workspaceId, decisionId: current.row.id,
          providerIdempotencyKey: call.providerIdempotencyKey, claimHash: call.dispatchClaimHash, runtimeHash: call.dispatchRuntimeHash,
          routeRef: call.route.routeId, grantId, grantHash: authorityHash(grant), pricingVersion: call.route.pricingVersion,
          priceRef: current.ledger.priceBookRef!, priceHash: current.ledger.priceBookHash!, fxRef: current.ledger.fxSnapshotRef,
          fxHash: current.ledger.fxSnapshotHash, quoteHash: current.ledger.quoteHash!, requestDigest: bytesHash(requestBytes), responseDigest: bytesHash(responseBytes),
          providerRequestRefHash: bytesHash(Buffer.from(decoded.requestRef)), outputContentHash: authorityHash(decoded.output),
          promptTokens: decoded.promptTokens, completionTokens: decoded.completionTokens, capturedAt: clock.now.toISOString(), requestDisposition: "accepted", outcome: "success" };
        const json = canonicalAuthorityJson(evidence), signature = sign(null, Buffer.from(json), key).toString("base64"), digest = authorityHash(evidence);
        readUsageEvidence(json, signature, grant);
        await tx.$executeRaw`INSERT INTO LLMTrustedUsageEvidence(id,workspaceId,decisionId,providerIdempotencyKey,grantId,envelopeJson,contentHash,signatureBase64,promptTokens,completionTokens)
          VALUES (${`usage:${current.row.id}`},${call.workspaceId},${current.row.id},${call.providerIdempotencyKey},${grantId},${json},${digest},${signature},${evidence.promptTokens},${evidence.completionTokens})`;
        const [saved] = await tx.$queryRaw<Array<{ contentHash: string }>>`SELECT contentHash FROM LLMTrustedUsageEvidence WHERE id=${`usage:${current.row.id}`}`;
        if (saved?.contentHash !== digest) refuse("usage_insert_readback_invalid");
        return evidence;
      });
      return { outcome: "success", output: decoded.output, requestDisposition: "accepted", providerRequestRef: decoded.requestRef,
        promptTokens: e.promptTokens, completionTokens: e.completionTokens, actualCostUsdMicros: Number(amount), costCurrency: "USD",
        pricingVersion: call.route.pricingVersion, costBand: "low", errorCode: null };
    },
  };
}
