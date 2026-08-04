// CAIO audit state — the single canonical audit-gate port for HTTP surfaces.
//
// WHY THIS FILE EXISTS
// The gateway HTTP core declares its own audit-gate port
// (`claimDispatch({requestId, route, principal, now}): Promise<void>`) which
// cannot be satisfied by the audit gate: it carries no modelAlias, no inputHash
// and no policyVersion, while the minimal receipt requires all three and is
// `.strict()`, so a pass-through adapter would throw ZodError on every request.
// Its field names also disagree with the receipt (`workspace`/`client` vs
// `workspaceId`/`clientType`), and it has no way to express a receipt conflict,
// which collapsed a permanent 409 into a retryable 503 with an undefined
// Retry-After.
//
// This module fixes the audit side of that mismatch by publishing ONE canonical
// port that HTTP surfaces consume unchanged:
//   - CaioCanonicalAuditGatePort           the port to depend on
//   - createCaioCanonicalAuditGatePort()   adapter over the audit gate
//   - toCaioMinimalAuditReceipt()          documented field mapping
//   - CAIO_CANONICAL_AUDIT_CLAIM_FIELD_MAP the mapping, as data
//   - caioAuditWireRefusal()               refusal -> HTTP status/code/Retry-After
//   - caioGatewayReadinessFromAuditGate()  4 gate states -> 3 readiness states
//
// Every refusal outcome carries a DEFINED retryAfterSeconds (`number | null`,
// never undefined), so a transport can emit Retry-After only when it is a
// number and never serialize `undefined`.

import { z } from "zod";

import {
  CAIO_AUDIT_RETRY_AFTER_HEADER,
  caioMinimalAuditReceiptSchema,
  type CaioAuditGateReadiness,
  type CaioMinimalAuditReceipt,
} from "@/lib/caio-audit-state/audit-state-contracts";
import type {
  CaioAuditClaimResult,
  CaioAuditGate,
} from "@/lib/caio-audit-state/audit-gate.service";
import {
  parseCaioDeploymentPosture,
  type CaioDeploymentPosture,
} from "@/lib/caio-audit-state/deployment-posture";

/**
 * Canonical claim shape. Field names follow the request-path vocabulary
 * (`workspaceId`, `clientType`) rather than the storage vocabulary
 * (`workspace`, `client`); toCaioMinimalAuditReceipt() is the only place the
 * two are bridged.
 *
 * `route` deliberately does NOT exist here: an HTTP route is not a governed
 * receipt field, and the receipt is a closed six-field set. A surface that only
 * knows the route cannot claim a dispatch — the claim must be issued where the
 * alias binding is resolved (the model proxy engine).
 */
export type CaioCanonicalAuditClaim = Readonly<{
  requestId: string;
  workspaceId: string;
  clientType: string;
  modelAlias: string;
  inputHash: string;
  policyVersion: string;
}>;

/**
 * Strict canonical claim schema. `.strict()` mirrors the receipt contract: a
 * caller that adds a key (prompt, body, route, credential) is refused outright
 * rather than having it silently dropped, so the closed set stays visible at the
 * port boundary and not only at the storage boundary.
 */
export const caioCanonicalAuditClaimSchema = z
  .object({
    requestId: z.string().min(1).max(200),
    workspaceId: z.string().min(1).max(200),
    clientType: z.string().min(1).max(200),
    modelAlias: z.string().min(1).max(200),
    inputHash: z.string().regex(/^(?:sha256:)?[a-f0-9]{64}$/),
    policyVersion: z.string().min(1).max(200),
  })
  .strict();

/**
 * Canonical claim field -> minimal receipt field.
 *
 * `posture` is deliberately ABSENT from this map: it is not a claim field. The
 * receipt's seventh field comes from the gate's construction-time declaration,
 * never from the caller (see toCaioMinimalAuditReceipt below), so no HTTP
 * surface can choose the posture its receipts are recorded under.
 */
export const CAIO_CANONICAL_AUDIT_CLAIM_FIELD_MAP = Object.freeze({
  requestId: "requestId",
  workspaceId: "workspace",
  clientType: "client",
  modelAlias: "modelAlias",
  inputHash: "inputHash",
  policyVersion: "policyVersion",
} as const);

/**
 * Bridges the canonical claim vocabulary to the persisted receipt shape.
 *
 * `posture` is a REQUIRED second argument rather than part of the claim: the
 * caller of this function is the adapter below, which reads it off the gate it
 * wraps. A request can never reach this parameter.
 */
export function toCaioMinimalAuditReceipt(
  claim: CaioCanonicalAuditClaim,
  posture: CaioDeploymentPosture,
): CaioMinimalAuditReceipt {
  const parsed = caioCanonicalAuditClaimSchema.parse(claim);
  return caioMinimalAuditReceiptSchema.parse({
    requestId: parsed.requestId,
    client: parsed.clientType,
    workspace: parsed.workspaceId,
    modelAlias: parsed.modelAlias,
    inputHash: parsed.inputHash,
    policyVersion: parsed.policyVersion,
    posture: parseCaioDeploymentPosture(posture),
  });
}

export type CaioCanonicalAuditGateOutcome =
  | Readonly<{
      status: "allowed";
      receiptId: string;
      persistedVia: "primary" | "emergency_queue";
      dispatchAttempt: number;
    }>
  | Readonly<{
      status: "audit_unavailable" | "receipt_conflict" | "replay_limit_exceeded";
      errorCode: string;
      httpStatus: number;
      /** Never undefined; null means retrying cannot help. */
      retryAfterSeconds: number | null;
    }>;

export type CaioCanonicalAuditGatePort = Readonly<{
  /**
   * The deployment posture this port's gate was constructed with. Published on
   * the port so consumers (the model proxy, the readiness/liveness surfaces)
   * report and cross-check the posture actually in force instead of declaring
   * a second, possibly divergent one.
   */
  posture: CaioDeploymentPosture;
  claimDispatch(
    claim: CaioCanonicalAuditClaim,
  ): Promise<CaioCanonicalAuditGateOutcome>;
}>;

/**
 * Maps a gate refusal to its wire form. Exhaustive over
 * CaioAuditClaimRefusalReason: an unknown reason is reported as a 503
 * audit-unavailable rather than being treated as allowed.
 */
export function caioAuditWireRefusal(
  refusal: Extract<CaioAuditClaimResult, { allowed: false }>,
): Extract<CaioCanonicalAuditGateOutcome, { errorCode: string }> {
  switch (refusal.reason) {
    case "receipt_conflict":
      return {
        status: "receipt_conflict",
        errorCode: refusal.errorCode,
        httpStatus: refusal.httpStatus,
        retryAfterSeconds: refusal.retryAfterSeconds ?? null,
      };
    case "replay_limit_exceeded":
      return {
        status: "replay_limit_exceeded",
        errorCode: refusal.errorCode,
        httpStatus: refusal.httpStatus,
        retryAfterSeconds: refusal.retryAfterSeconds ?? null,
      };
    case "audit_unavailable":
    case "recovery_rate_limited":
      return {
        status: "audit_unavailable",
        errorCode: refusal.errorCode,
        httpStatus: refusal.httpStatus,
        retryAfterSeconds: refusal.retryAfterSeconds ?? null,
      };
    default: {
      const unexpected: never = refusal.reason;
      void unexpected;
      return {
        status: "audit_unavailable",
        errorCode: "caio_audit_unavailable",
        httpStatus: 503,
        retryAfterSeconds: refusal.retryAfterSeconds ?? null,
      };
    }
  }
}

/**
 * Adapter: audit gate -> canonical port. A thrown gate error (malformed or
 * reserved receipt) is NOT swallowed: it propagates so the transport fails the
 * request closed, exactly as the gateway's own contract comment requires.
 */
export function createCaioCanonicalAuditGatePort(
  gate: CaioAuditGate,
): CaioCanonicalAuditGatePort {
  return Object.freeze({
    posture: gate.posture,
    async claimDispatch(claim) {
      const result = await gate.claimDispatch(
        toCaioMinimalAuditReceipt(claim, gate.posture),
      );
      if (result.allowed) {
        return Object.freeze({
          status: "allowed" as const,
          receiptId: result.receiptId,
          persistedVia: result.persistedVia,
          dispatchAttempt: result.dispatchAttempt,
        });
      }
      return Object.freeze(caioAuditWireRefusal(result));
    },
  });
}

/**
 * The gateway readiness probe has three states; the gate has four. RECOVERING
 * is reported as "degraded" (the node is serving under an admission cap, so it
 * is neither fully ready nor unable to persist).
 */
export function caioGatewayReadinessFromAuditGate(
  readiness: CaioAuditGateReadiness,
): "ready" | "degraded" | "unavailable" {
  switch (readiness) {
    case "ready":
      return "ready";
    case "degraded":
    case "recovering":
      return "degraded";
    case "unavailable":
      return "unavailable";
    default: {
      const unexpected: never = readiness;
      void unexpected;
      return "unavailable";
    }
  }
}

/** Header a transport must emit when retryAfterSeconds is a number. */
export const CAIO_CANONICAL_RETRY_AFTER_HEADER = CAIO_AUDIT_RETRY_AFTER_HEADER;
