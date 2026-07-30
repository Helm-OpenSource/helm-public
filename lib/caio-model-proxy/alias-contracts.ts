// CAIO model proxy — stable alias contracts.
//
// The enterprise LAN gateway never exposes upstream provider model names to
// clients. Clients (Codex over the native OpenAI Responses API, WorkBuddy over
// Chat Completions) address models exclusively through stable CAIO aliases;
// the binding maps an alias to one upstream provider model plus the policy
// keys that govern where the request is allowed to go. Fallback between
// bindings is fail-closed: a candidate is only equivalent when every governed
// dimension matches exactly.

import { z } from "zod";

export const CAIO_MODEL_PROTOCOLS = [
  "responses",
  "chat_completions",
] as const;

export const caioModelProtocolSchema = z.enum(CAIO_MODEL_PROTOCOLS);
export type CaioModelProtocol = z.infer<typeof caioModelProtocolSchema>;

export const CAIO_CODEX_DEFAULT_ALIAS = "caio-codex-default";
export const CAIO_WORKBUDDY_DEFAULT_ALIAS = "caio-workbuddy-default";

// The stable alias surface the gateway commits to. Each entry pins the client
// protocol the alias serves AND the client type the alias is granted to by
// default; the two protocols remain separate clients.
export const CAIO_STABLE_MODEL_ALIASES = [
  {
    alias: CAIO_CODEX_DEFAULT_ALIAS,
    protocol: "responses",
    clientType: "codex",
  },
  {
    alias: CAIO_WORKBUDDY_DEFAULT_ALIAS,
    protocol: "chat_completions",
    clientType: "workbuddy",
  },
] as const satisfies readonly {
  alias: string;
  protocol: CaioModelProtocol;
  clientType: string;
}[];

export const caioModelAliasSchema = z
  .string()
  .min(3)
  .max(64)
  .regex(/^[a-z][a-z0-9-]*[a-z0-9]$/);

export const caioCredentialRefSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{1,64}$/);

const policyKeySchema = z.string().min(1).max(200);

const endpointBaseUrlSchema = z
  .string()
  .min(1)
  .max(500)
  .regex(/^https?:\/\/[^\s]+$/u);

export const CAIO_ALIAS_BINDING_STATUSES = ["active", "disabled"] as const;
export const caioAliasBindingStatusSchema = z.enum(
  CAIO_ALIAS_BINDING_STATUSES,
);
export type CaioAliasBindingStatus = z.infer<
  typeof caioAliasBindingStatusSchema
>;

const bindingCoreShape = {
  alias: caioModelAliasSchema,
  protocol: caioModelProtocolSchema,
  providerKey: policyKeySchema,
  upstreamModel: z.string().min(1).max(200),
  credentialRef: caioCredentialRefSchema,
  endpointBaseUrl: endpointBaseUrlSchema,
  region: policyKeySchema,
  dataRetentionPolicyKey: policyKeySchema,
  trainingUsePolicyKey: policyKeySchema,
  dataAuthorizationKey: policyKeySchema,
  policyVersion: z.string().min(1).max(100),
  status: caioAliasBindingStatusSchema,
} as const;

// A fallback candidate carries the full binding shape (minus further nesting)
// so the equivalence rule can be evaluated against the same fields.
export const caioModelAliasFallbackCandidateSchema = z
  .object(bindingCoreShape)
  .strict();

export type CaioModelAliasFallbackCandidate = z.infer<
  typeof caioModelAliasFallbackCandidateSchema
>;

export const caioModelAliasBindingSchema = z
  .object({
    ...bindingCoreShape,
    fallbackCandidates: z
      .array(caioModelAliasFallbackCandidateSchema)
      .max(8),
  })
  .strict();

export type CaioModelAliasBinding = z.infer<
  typeof caioModelAliasBindingSchema
>;

// OpenAI-compatible /v1/models response shape.
export type CaioModelListEntry = {
  id: string;
  object: "model";
  owned_by: "caio-gateway";
};

export type CaioModelListResponse = {
  object: "list";
  data: CaioModelListEntry[];
};

// Only aliases that are BOTH granted to the caller and active are listed.
// Anything else (unknown grant, disabled binding) is silently absent — the
// list is the discovery surface, and discovery must not leak ungranted or
// suspended routes.
export function listModelsForGrant(input: {
  bindings: readonly CaioModelAliasBinding[];
  grantedAliases: readonly string[];
}): CaioModelListResponse {
  const granted = new Set(input.grantedAliases);
  const seen = new Set<string>();
  const data: CaioModelListEntry[] = [];
  for (const binding of input.bindings) {
    if (binding.status !== "active") continue;
    if (!granted.has(binding.alias)) continue;
    if (seen.has(binding.alias)) continue;
    seen.add(binding.alias);
    data.push({
      id: binding.alias,
      object: "model",
      owned_by: "caio-gateway",
    });
  }
  data.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { object: "list", data };
}

/**
 * The DEFAULT alias grant for a client type, derived from the stable alias
 * surface above. Fail-closed: a client type the surface does not model gets an
 * empty grant, never a wildcard.
 */
export function caioDefaultGrantedAliases(
  clientType: string,
): readonly string[] {
  return Object.freeze(
    CAIO_STABLE_MODEL_ALIASES.filter(
      (entry) => entry.clientType === clientType,
    ).map((entry) => entry.alias),
  );
}

/**
 * Resolve the alias grant a caller actually holds.
 *
 * Two sources, in this order:
 *   1. An EXPLICIT grant carried by the caller's audience context. When
 *      present it is authoritative (including an empty grant, which grants
 *      nothing), because it is the per-token configuration an operator set —
 *      the client cannot supply it.
 *   2. Otherwise the client type's default grant from the stable alias surface.
 *
 * Every entry is validated against the alias schema, so a malformed value can
 * never widen a grant: unparseable entries are dropped rather than trusted.
 * The result is a SET so callers cannot accidentally treat "present in the
 * configured bindings" as "granted to this caller".
 */
export function resolveCaioGrantedAliases(
  input: Readonly<{
    clientType: string;
    grantedAliases?: readonly string[];
  }>,
): ReadonlySet<string> {
  const source =
    input.grantedAliases === undefined
      ? caioDefaultGrantedAliases(input.clientType)
      : input.grantedAliases;
  const granted = new Set<string>();
  for (const candidate of source) {
    if (caioModelAliasSchema.safeParse(candidate).success) {
      granted.add(candidate);
    }
  }
  return granted;
}

// Governed dimensions that must match EXACTLY for a fallback to be allowed.
// providerKey inclusion makes cross-provider fallback structurally impossible.
// policyVersion inclusion makes it impossible for a fallback to execute under a
// different policy than the one the request's audit receipt names: the receipt
// records the primary binding's policyVersion, so a candidate on another policy
// version would make the durable audit record describe a policy that did not
// govern the dispatch.
export const CAIO_FALLBACK_EQUIVALENCE_DIMENSIONS = [
  "providerKey",
  "protocol",
  "region",
  "dataRetentionPolicyKey",
  "trainingUsePolicyKey",
  "dataAuthorizationKey",
  "policyVersion",
] as const;

export type CaioFallbackEquivalenceDimension =
  (typeof CAIO_FALLBACK_EQUIVALENCE_DIMENSIONS)[number];

type FallbackComparable = Partial<
  Record<CaioFallbackEquivalenceDimension, unknown>
> & { status?: unknown };

function isKnownDimensionValue(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.trim().toLowerCase() !== "unknown"
  );
}

// Fail-closed fallback equivalence: true ONLY when every governed dimension is
// present, known, and identical on both sides. Any missing, empty, or
// "unknown" value on either side denies the fallback. A candidate that is not
// explicitly active is also denied.
export function isFallbackAllowed(
  primary: FallbackComparable | null | undefined,
  candidate: FallbackComparable | null | undefined,
): boolean {
  if (!primary || typeof primary !== "object") return false;
  if (!candidate || typeof candidate !== "object") return false;
  if (candidate.status !== "active") return false;
  for (const dimension of CAIO_FALLBACK_EQUIVALENCE_DIMENSIONS) {
    const primaryValue = primary[dimension];
    const candidateValue = candidate[dimension];
    if (!isKnownDimensionValue(primaryValue)) return false;
    if (!isKnownDimensionValue(candidateValue)) return false;
    if (primaryValue !== candidateValue) return false;
  }
  return true;
}
