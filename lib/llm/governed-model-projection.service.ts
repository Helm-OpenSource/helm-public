import "server-only";

import {
  canonicalJson,
  sha256,
} from "@/lib/expert-capability/hashing";
import {
  GOVERNED_MODEL_PROJECTION_AUTHORITY,
  recordGovernedModelProjectionReceipt,
} from "@/lib/llm/model-egress-store.service";

export type GovernedProjectionJsonValue =
  | null
  | boolean
  | number
  | string
  | readonly GovernedProjectionJsonValue[]
  | {
      readonly [key: string]: GovernedProjectionJsonValue;
    };

export type GovernedProjectionEngineRegistration = {
  engineKey: string;
  projectorRegistrationRef: string;
  projectorKey: string;
  projectorVersion: string;
  projectorImplementationHash: string;
  scannerRegistrationRef: string;
  scannerKey: string;
  scannerVersion: string;
  scannerImplementationHash: string;
  executionBoundary: "local_only";
};

export type GovernedProjectionResult<
  TPayload extends GovernedProjectionJsonValue,
> = {
  projectedPayload: TPayload;
  candidateEvidenceRefs: readonly string[];
  selectedEvidenceRefs: readonly string[];
  droppedEvidenceRefs: readonly string[];
  maxInputTokens: number;
  maxOutputTokens: number;
  remoteSafe: boolean;
  redactionStatus: "synthetic" | "redacted" | "alias_only";
  promptInjectionScanStatus: "passed" | "failed" | "not_run";
};

export type GovernedProjectionEngine<
  TLocalContext,
  TPayload extends GovernedProjectionJsonValue,
> = {
  registration: GovernedProjectionEngineRegistration;
  project: (input: {
    workspaceId: string;
    sourceAssetRefs: readonly string[];
    localContext: TLocalContext;
  }) => Promise<GovernedProjectionResult<TPayload>>;
};

export type GovernedModelProjectionServiceDependencies = {
  recordReceipt: typeof recordGovernedModelProjectionReceipt;
  now: () => Date;
};

const DEFAULT_DEPENDENCIES: GovernedModelProjectionServiceDependencies =
  {
    recordReceipt: recordGovernedModelProjectionReceipt,
    now: () => new Date(),
  };

export class GovernedModelProjectionError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "GovernedModelProjectionError";
    this.code = code;
  }
}

function assertGovernedProjectionJson(
  value: unknown,
  seen = new Set<object>(),
  depth = 0,
): asserts value is GovernedProjectionJsonValue {
  if (depth > 32) {
    throw new GovernedModelProjectionError(
      "projected_payload_depth_exceeded",
    );
  }
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new GovernedModelProjectionError(
        "projected_payload_number_invalid",
      );
    }
    return;
  }
  if (typeof value !== "object") {
    throw new GovernedModelProjectionError(
      "projected_payload_not_json",
    );
  }
  if (seen.has(value)) {
    throw new GovernedModelProjectionError(
      "projected_payload_cycle_detected",
    );
  }
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item) =>
      assertGovernedProjectionJson(item, seen, depth + 1),
    );
  } else {
    const prototype = Object.getPrototypeOf(value);
    if (
      prototype !== Object.prototype &&
      prototype !== null
    ) {
      throw new GovernedModelProjectionError(
        "projected_payload_not_plain_object",
      );
    }
    Object.values(value as Record<string, unknown>).forEach(
      (item) =>
        assertGovernedProjectionJson(item, seen, depth + 1),
    );
  }
  seen.delete(value);
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function computeRegistrationHash(
  registration: GovernedProjectionEngineRegistration,
  kind: "projector" | "scanner",
): string {
  return sha256(
    canonicalJson(
      kind === "projector"
        ? {
            schemaVersion:
              "helm.model-projector-registration/v1",
            engineKey: registration.engineKey,
            registrationRef:
              registration.projectorRegistrationRef,
            componentKey: registration.projectorKey,
            componentVersion: registration.projectorVersion,
            implementationHash:
              registration.projectorImplementationHash,
            executionBoundary:
              registration.executionBoundary,
          }
        : {
            schemaVersion:
              "helm.model-scanner-registration/v1",
            engineKey: registration.engineKey,
            registrationRef:
              registration.scannerRegistrationRef,
            componentKey: registration.scannerKey,
            componentVersion: registration.scannerVersion,
            implementationHash:
              registration.scannerImplementationHash,
            executionBoundary:
              registration.executionBoundary,
          },
    ),
  );
}

function validateEvidencePartition(input: {
  candidate: readonly string[];
  selected: readonly string[];
  dropped: readonly string[];
}): void {
  const candidate = uniqueSorted(input.candidate);
  const selected = uniqueSorted(input.selected);
  const dropped = uniqueSorted(input.dropped);
  if (
    selected.some((ref) => !candidate.includes(ref)) ||
    dropped.some((ref) => !candidate.includes(ref)) ||
    selected.some((ref) => dropped.includes(ref)) ||
    canonicalJson(uniqueSorted([...selected, ...dropped])) !==
      canonicalJson(candidate)
  ) {
    throw new GovernedModelProjectionError(
      "projection_evidence_partition_invalid",
    );
  }
}

export function createGovernedModelProjectionService<
  TLocalContext,
  TPayload extends GovernedProjectionJsonValue,
>(
  engines: readonly GovernedProjectionEngine<
    TLocalContext,
    TPayload
  >[],
  dependencies: GovernedModelProjectionServiceDependencies =
    DEFAULT_DEPENDENCIES,
) {
  const registry = new Map<
    string,
    GovernedProjectionEngine<TLocalContext, TPayload>
  >();
  for (const engine of engines) {
    if (
      !engine.registration.engineKey.trim() ||
      engine.registration.executionBoundary !== "local_only" ||
      registry.has(engine.registration.engineKey)
    ) {
      throw new GovernedModelProjectionError(
        "projection_engine_registration_invalid",
      );
    }
    registry.set(engine.registration.engineKey, Object.freeze(engine));
  }

  return async function project(input: {
    workspaceId: string;
    engineKey: string;
    idempotencyKey: string;
    sourceAssetRefs: readonly string[];
    localContext: TLocalContext;
    receiptTtlMs?: number;
  }) {
    const engine = registry.get(input.engineKey);
    if (!engine) {
      throw new GovernedModelProjectionError(
        "projection_engine_not_registered",
      );
    }
    const result = await engine.project({
      workspaceId: input.workspaceId,
      sourceAssetRefs: input.sourceAssetRefs,
      localContext: input.localContext,
    });
    assertGovernedProjectionJson(result.projectedPayload);
    validateEvidencePartition({
      candidate: result.candidateEvidenceRefs,
      selected: result.selectedEvidenceRefs,
      dropped: result.droppedEvidenceRefs,
    });
    const serializedPayload = canonicalJson(
      result.projectedPayload,
    );
    const projectedPayloadHash = sha256(serializedPayload);
    const projectedPayloadBytes = Buffer.byteLength(
      serializedPayload,
      "utf8",
    );
    const registration = engine.registration;
    const persisted = await dependencies.recordReceipt({
      authority: GOVERNED_MODEL_PROJECTION_AUTHORITY,
      workspaceId: input.workspaceId,
      idempotencyKey: input.idempotencyKey,
      sourceAssetRefs: input.sourceAssetRefs,
      candidateEvidenceRefs: result.candidateEvidenceRefs,
      selectedEvidenceRefs: result.selectedEvidenceRefs,
      droppedEvidenceRefs: result.droppedEvidenceRefs,
      projectedPayloadHash,
      projectedPayloadBytes,
      maxInputTokens: result.maxInputTokens,
      maxOutputTokens: result.maxOutputTokens,
      remoteSafe: result.remoteSafe,
      redactionStatus: result.redactionStatus,
      promptInjectionScanStatus:
        result.promptInjectionScanStatus,
      projectorRegistrationRef:
        registration.projectorRegistrationRef,
      projectorRegistrationHash: computeRegistrationHash(
        registration,
        "projector",
      ),
      projectorVersion: registration.projectorVersion,
      scannerRegistrationRef:
        registration.scannerRegistrationRef,
      scannerRegistrationHash: computeRegistrationHash(
        registration,
        "scanner",
      ),
      scannerVersion: registration.scannerVersion,
      receiptTtlMs: input.receiptTtlMs,
      now: dependencies.now(),
    });
    return {
      projectedPayload: result.projectedPayload,
      receipt: persisted.receipt,
      replayed: persisted.replayed,
    };
  };
}

