import "server-only";

import {
  canonicalJson,
  sha256,
} from "@/lib/expert-capability/hashing";
import type {
  ModelEgressCostBand,
  ModelEgressOutcome,
} from "@/lib/llm/model-egress-contracts";
import {
  computeProviderAdapterReadinessHash,
  validateGovernedModelAdapterRegistration,
  validateProviderAdapterReadinessReceipt,
  type GovernedModelAdapterRegistration,
  type ModelRouteTaskClass,
  type ProviderAdapterReadinessReceipt,
  type TenantModelRoute,
} from "@/lib/llm/model-route-contracts";
import {
  GOVERNED_MODEL_READINESS_AUTHORITY,
  recordProviderAdapterReadinessReceipt,
} from "@/lib/llm/model-route-policy-store.service";
import type {
  GovernedProviderRuntimeDescriptor,
} from "@/lib/llm/model-egress-store.service";

export type GovernedJsonValue =
  | null
  | boolean
  | number
  | string
  | readonly GovernedJsonValue[]
  | { readonly [key: string]: GovernedJsonValue };

export type GovernedModelAdapterPreflightObservation = {
  endpointFingerprint: string;
  credentialConfigured: boolean;
  observedAt: string;
  estimatedInputTokens: number;
  estimatedMaxCostUsdMicros: number;
};

export type GovernedModelAdapterPreflight = {
  runtime: GovernedProviderRuntimeDescriptor;
  estimatedInputTokens: number;
  estimatedMaxCostUsdMicros: number;
};

export type GovernedModelAdapterResult<
  TOutput extends GovernedJsonValue,
> = {
  outcome: ModelEgressOutcome;
  output?: TOutput;
  requestDisposition: "not_accepted" | "accepted" | "unknown";
  providerRequestRef: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  actualCostUsdMicros: number | null;
  costCurrency: "USD" | null;
  pricingVersion: string | null;
  costBand: ModelEgressCostBand;
  errorCode: string | null;
};

export type GovernedModelAdapterReconciliation<
  TOutput extends GovernedJsonValue,
> =
  | {
      status: "terminal";
      result: GovernedModelAdapterResult<TOutput>;
    }
  | {
      status: "not_found";
      errorCode: string;
    }
  | {
      status: "unknown";
      errorCode: string | null;
    };

export type GovernedModelReadinessProbeObservation = {
  endpointFingerprint: string;
  credentialConfigured: boolean;
  modelProbeStatus: "ready" | "not_ready";
  capabilityRefs: readonly string[];
  evidenceRefs: readonly string[];
  checkedAt: string;
  expiresAt: string;
};

export type GovernedModelProviderAdapter<
  TPayload extends GovernedJsonValue,
  TOutput extends GovernedJsonValue,
> = {
  registration: GovernedModelAdapterRegistration;
  probeReadiness: (input: {
    workspaceId: string;
    route: TenantModelRoute;
  }) => Promise<GovernedModelReadinessProbeObservation>;
  preflight: (input: {
    workspaceId: string;
    route: TenantModelRoute;
    taskClass: ModelRouteTaskClass;
    projectedPayloadHash: string;
    projectedPayloadBytes: number;
    requestedMaxOutputTokens: number;
  }) => Promise<GovernedModelAdapterPreflightObservation>;
  invoke: (input: {
    workspaceId: string;
    route: TenantModelRoute;
    taskClass: ModelRouteTaskClass;
    taskRef: string;
    projectedPayload: TPayload;
    projectedPayloadHash: string;
    requestedMaxOutputTokens: number;
    providerIdempotencyKey: string;
    dispatchClaimHash: string;
    dispatchRuntimeHash: string;
    signal: AbortSignal;
  }) => Promise<GovernedModelAdapterResult<TOutput>>;
  reconcile?: (input: {
    workspaceId: string;
    route: TenantModelRoute;
    taskClass: ModelRouteTaskClass;
    taskRef: string;
    projectedPayloadHash: string;
    requestedMaxOutputTokens: number;
    providerIdempotencyKey: string;
    dispatchClaimHash: string;
    dispatchRuntimeHash: string;
    signal: AbortSignal;
  }) => Promise<GovernedModelAdapterReconciliation<TOutput>>;
};

export type RegisteredGovernedModelAdapter<
  TPayload extends GovernedJsonValue,
  TOutput extends GovernedJsonValue,
> = {
  readonly registration: Readonly<GovernedModelAdapterRegistration>;
  readonly probeReadiness: GovernedModelProviderAdapter<
    TPayload,
    TOutput
  >["probeReadiness"];
  readonly preflight: GovernedModelProviderAdapter<
    TPayload,
    TOutput
  >["preflight"];
  readonly invoke: GovernedModelProviderAdapter<
    TPayload,
    TOutput
  >["invoke"];
  readonly reconcile:
    | GovernedModelProviderAdapter<
        TPayload,
        TOutput
      >["reconcile"]
    | null;
};

export type GovernedModelAdapterRegistry<
  TPayload extends GovernedJsonValue,
  TOutput extends GovernedJsonValue,
> = {
  resolve: (
    route: TenantModelRoute,
  ) => RegisteredGovernedModelAdapter<TPayload, TOutput> | null;
  registrations: () => readonly Readonly<GovernedModelAdapterRegistration>[];
};

export class GovernedModelAdapterRegistryError extends Error {
  readonly reasons: readonly string[];

  constructor(message: string, reasons: readonly string[] = []) {
    super(reasons.length > 0 ? `${message}: ${reasons.join("; ")}` : message);
    this.name = "GovernedModelAdapterRegistryError";
    this.reasons = reasons;
  }
}

function immutableRegistration(
  registration: GovernedModelAdapterRegistration,
): Readonly<GovernedModelAdapterRegistration> {
  return Object.freeze({
    ...registration,
    supportedDeploymentForms: Object.freeze([
      ...registration.supportedDeploymentForms,
    ]),
  });
}

export function createGovernedModelAdapterRegistry<
  TPayload extends GovernedJsonValue,
  TOutput extends GovernedJsonValue,
>(
  adapters: readonly GovernedModelProviderAdapter<TPayload, TOutput>[],
): GovernedModelAdapterRegistry<TPayload, TOutput> {
  const byKey = new Map<
    string,
    RegisteredGovernedModelAdapter<TPayload, TOutput>
  >();
  for (const adapter of adapters) {
    const validation = validateGovernedModelAdapterRegistration(
      adapter.registration,
    );
    if (!validation.valid) {
      throw new GovernedModelAdapterRegistryError(
        "adapter_registration_invalid",
        validation.errors,
      );
    }
    if (byKey.has(adapter.registration.adapterKey)) {
      throw new GovernedModelAdapterRegistryError(
        "duplicate_adapter_registration",
        [adapter.registration.adapterKey],
      );
    }
    const registration = immutableRegistration(
      adapter.registration,
    );
    byKey.set(
      registration.adapterKey,
      Object.freeze({
        registration,
        probeReadiness: adapter.probeReadiness.bind(adapter),
        preflight: adapter.preflight.bind(adapter),
        invoke: adapter.invoke.bind(adapter),
        reconcile: adapter.reconcile
          ? adapter.reconcile.bind(adapter)
          : null,
      }),
    );
  }

  const registrationSnapshot = Object.freeze(
    [...byKey.values()]
      .map((entry) => entry.registration)
      .sort((left, right) =>
        left.adapterKey.localeCompare(right.adapterKey),
      ),
  );
  return Object.freeze({
    resolve: (route: TenantModelRoute) => {
      const entry = byKey.get(route.adapterKey) ?? null;
      if (
        !entry ||
        entry.registration.provider !== route.provider ||
        !entry.registration.supportedDeploymentForms.includes(
          route.deploymentForm,
        )
      ) {
        return null;
      }
      return entry;
    },
    registrations: () => registrationSnapshot,
  });
}

export function buildRegisteredAdapterRuntime<
  TPayload extends GovernedJsonValue,
  TOutput extends GovernedJsonValue,
>(input: {
  adapter: RegisteredGovernedModelAdapter<TPayload, TOutput>;
  route: TenantModelRoute;
  observation: GovernedModelAdapterPreflightObservation;
}): GovernedProviderRuntimeDescriptor {
  return {
    provider: input.adapter.registration.provider,
    modelId: input.route.modelId,
    modelVersion: input.route.modelVersion,
    adapterKey: input.adapter.registration.adapterKey,
    adapterVersion: input.adapter.registration.adapterVersion,
    adapterRegistrationRef:
      input.adapter.registration.registrationRef,
    adapterRegistrationHash:
      input.adapter.registration.contentHash,
    deploymentForm: input.route.deploymentForm,
    jurisdiction: input.route.jurisdiction,
    region: input.route.region,
    endpointFingerprint:
      input.observation.endpointFingerprint,
    credentialRef: input.route.credentialRef,
    adapterRegistered: true,
    credentialConfigured:
      input.observation.credentialConfigured,
    observedAt: input.observation.observedAt,
  };
}

function readinessReceiptId(input: {
  workspaceRef: string;
  route: TenantModelRoute;
  registrationHash: string;
  checkedAt: string;
  endpointFingerprint: string;
}): string {
  const digest = sha256(canonicalJson(input)).slice(
    "sha256:".length,
  );
  return `readiness:provider-adapter:${digest}`;
}

export async function probeAndRecordRegisteredAdapterReadiness<
  TPayload extends GovernedJsonValue,
  TOutput extends GovernedJsonValue,
>(input: {
  registry: GovernedModelAdapterRegistry<TPayload, TOutput>;
  workspaceId: string;
  actorUserId: string;
  idempotencyKey: string;
  route: TenantModelRoute;
  english?: boolean;
}) {
  const adapter = input.registry.resolve(input.route);
  if (!adapter) {
    throw new GovernedModelAdapterRegistryError(
      "adapter_not_registered_for_route",
    );
  }
  const observation = await adapter.probeReadiness({
    workspaceId: input.workspaceId,
    route: input.route,
  });
  const workspaceRef = `workspace:${input.workspaceId}`;
  const receiptId = readinessReceiptId({
    workspaceRef,
    route: input.route,
    registrationHash: adapter.registration.contentHash,
    checkedAt: observation.checkedAt,
    endpointFingerprint: observation.endpointFingerprint,
  });
  const candidate: ProviderAdapterReadinessReceipt = {
    schemaVersion:
      "helm.provider-adapter-readiness-receipt/v1",
    receiptId,
    workspaceRef,
    provider: adapter.registration.provider,
    modelId: input.route.modelId,
    modelVersion: input.route.modelVersion,
    adapterKey: adapter.registration.adapterKey,
    adapterVersion: adapter.registration.adapterVersion,
    adapterRegistrationRef:
      adapter.registration.registrationRef,
    adapterRegistrationHash:
      adapter.registration.contentHash,
    deploymentForm: input.route.deploymentForm,
    jurisdiction: input.route.jurisdiction,
    region: input.route.region,
    endpointFingerprint: observation.endpointFingerprint,
    credentialRef: input.route.credentialRef,
    adapterRegistered: true,
    credentialConfigured:
      observation.credentialConfigured,
    modelProbeStatus: observation.modelProbeStatus,
    capabilityRefs: [...observation.capabilityRefs],
    checkedAt: observation.checkedAt,
    expiresAt: observation.expiresAt,
    evidenceRefs: [...observation.evidenceRefs],
    rawCredentialIncluded: false,
    contentHash: "sha256:pending",
  };
  const receipt: ProviderAdapterReadinessReceipt = {
    ...candidate,
    contentHash: computeProviderAdapterReadinessHash(candidate),
  };
  const validation =
    validateProviderAdapterReadinessReceipt(receipt);
  if (!validation.valid) {
    throw new GovernedModelAdapterRegistryError(
      "adapter_readiness_probe_invalid",
      validation.errors,
    );
  }
  return recordProviderAdapterReadinessReceipt({
    authority: GOVERNED_MODEL_READINESS_AUTHORITY,
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    idempotencyKey: input.idempotencyKey,
    receipt,
    english: input.english,
  });
}
