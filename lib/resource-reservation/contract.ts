/**
 * Resource-neutral wire contract; no store, authentication or runtime activation.
 * Inputs must be decoded data, not executable objects (Proxy traps are outside
 * this boundary). A valid proofRef is a reference, never proof verification.
 */
import { createHash } from "node:crypto";

export const RESOURCE_RESERVATION_VERSION = "helm.resource-vector/v1" as const;
export type ResourceRequirement = Readonly<{ scopeRef: string; generation: number; units: number }>;
export type ReserveRequestInput = Readonly<{
  operationRef: string;
  topologyRevision: string;
  requirements: readonly ResourceRequirement[];
}>;
export type ReserveRequest = Readonly<{
  operationRef: string;
  topologyRevision: string;
  requirements: readonly ResourceRequirement[];
  vectorDigest: string;
}>;
export type ReleaseRequest = Readonly<{
  operationRef: string;
  scopeRefs: readonly string[];
  proofRef: string;
  claimGeneration: number;
}>;
export type ReservationRefusal = "conflict" | "exhausted" | "stale_topology" | "unverified" | "fenced";
export type ReserveOutcome =
  | Readonly<{ kind: "admitted" | "existing"; operationRef: string; vectorDigest: string }>
  | Readonly<{ kind: "refused"; reason: ReservationRefusal }>;
export type ReleaseOutcome =
  | Readonly<{ kind: "released" | "already_released"; scopeRefs: readonly string[] }>
  | Readonly<{ kind: "refused"; reason: "unverified" | "claim_conflict" | "unknown_operation" | "scope_conflict" }>;

/**
 * Adapter obligations, NOT guarantees supplied by these pure functions:
 * reserveAll locks a trusted topology revision and the complete sorted resource
 * set in one transaction, checks trusted generations/ceilings and records both
 * counters and immutable operation demand. A retry is existing ONLY when the
 * entire frozen request matches; a vector digest alone omits topology identity.
 * On refusal or error there must be no partial reservation. Scope identity and
 * authorization come from the trusted adapter, never from a caller's string.
 *
 * releaseWithEvidence verifies domain evidence against the frozen operation,
 * claim generation and requested scopes, then atomically CASes held -> released
 * and decrements exactly once. Unknown outcomes/expired deadlines NEVER release.
 * A resource may remain held after other resources for that operation end.
 * Store/network ambiguity is not a successful release or safe-to-repeat effect.
 */
export interface AtomicResourceReservationPort {
  reserveAll(request: ReserveRequest): Promise<ReserveOutcome>;
  releaseWithEvidence(request: ReleaseRequest): Promise<ReleaseOutcome>;
}

function invalid(): never { throw new Error("resource_contract_invalid"); }
function fields(value: unknown, expected: readonly string[]): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) invalid();
  const keys = Reflect.ownKeys(value);
  if (keys.length !== expected.length || keys.some(key => typeof key !== "string" || !expected.includes(key))) invalid();
  const copy: Record<string, unknown> = Object.create(null);
  for (const key of expected) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) invalid();
    copy[key] = descriptor.value;
  }
  return copy;
}
function list(value: unknown): unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length === 0) invalid();
  if (Reflect.ownKeys(value).length !== value.length + 1) invalid();
  const copy: unknown[] = [];
  for (let index = 0; index < value.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) invalid();
    copy.push(descriptor.value);
  }
  return copy;
}
function ref(value: unknown): string {
  if (typeof value !== "string" || value.length > 128 || !/^[A-Za-z0-9][A-Za-z0-9:._-]*$/.test(value)) invalid();
  return value;
}
function positiveInteger(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) invalid();
  return value;
}
const lexical = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;

/** Duplicate paths to one resource collapse only when generation AND units agree.
 * Independent consumption must be aggregated explicitly by the domain planner.
 */
export function normalizeResourceVector(input: unknown): readonly ResourceRequirement[] {
  const scopes = new Map<string, ResourceRequirement>();
  for (const item of list(input)) {
    const raw = fields(item, ["scopeRef", "generation", "units"]);
    const requirement = Object.freeze({ scopeRef: ref(raw.scopeRef), generation: positiveInteger(raw.generation), units: positiveInteger(raw.units) });
    const previous = scopes.get(requirement.scopeRef);
    if (previous && (previous.units !== requirement.units || previous.generation !== requirement.generation)) {
      throw new Error("resource_vector_conflict");
    }
    scopes.set(requirement.scopeRef, requirement);
  }
  return Object.freeze([...scopes.values()].sort((a, b) => lexical(a.scopeRef, b.scopeRef)));
}

/** Digest covers canonical demand only, not identity, approval or submission. */
export function resourceVectorDigest(input: unknown): string {
  const vector = normalizeResourceVector(input);
  return createHash("sha256").update(JSON.stringify([
    RESOURCE_RESERVATION_VERSION, vector.map(item => [item.scopeRef, item.generation, item.units]),
  ])).digest("hex");
}
/** Builder: normalize the three-field ReserveRequestInput and compute digest. */
export function normalizeReserveRequest(input: unknown): ReserveRequest {
  const raw = fields(input, ["operationRef", "topologyRevision", "requirements"]);
  const requirements = normalizeResourceVector(raw.requirements);
  return Object.freeze({ operationRef: ref(raw.operationRef), topologyRevision: ref(raw.topologyRevision), requirements, vectorDigest: resourceVectorDigest(requirements) });
}
export function normalizeReleaseRequest(input: unknown): ReleaseRequest {
  const raw = fields(input, ["operationRef", "scopeRefs", "proofRef", "claimGeneration"]);
  const scopeRefs = Object.freeze([...new Set(list(raw.scopeRefs).map(ref))].sort(lexical));
  return Object.freeze({ operationRef: ref(raw.operationRef), scopeRefs, proofRef: ref(raw.proofRef), claimGeneration: positiveInteger(raw.claimGeneration) });
}

/** Validate the complete four-field wire request; recompute, never trust digest.
 * This checks integrity of canonical demand, NOT authorization or authentication.
 */
export function validateReserveRequest(input: unknown): ReserveRequest {
  const raw = fields(input, ["operationRef", "topologyRevision", "requirements", "vectorDigest"]);
  const normalized = normalizeReserveRequest({ operationRef: raw.operationRef, topologyRevision: raw.topologyRevision, requirements: raw.requirements });
  if (raw.vectorDigest !== normalized.vectorDigest) throw new Error("resource_digest_mismatch");
  return normalized;
}
