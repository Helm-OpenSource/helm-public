import "server-only";

import type { CaioAccessPrincipal } from "@/lib/caio-access-gateway/token-store.service";
import { canonicalJson, sha256 } from "@/lib/expert-capability/hashing";

import {
  parseCaioOperatingQuestionGenerationRequest,
  type CaioOperatingQuestionGenerationRequest,
} from "./caio-operating-question-generation-route-contract";
import { CaioInitializationGateStoreError } from "./caio-initialization-gate-store.service";
import {
  type CaioOperatingQuestionPackProviderRegistry,
  CaioOperatingQuestionPackProviderRegistryError,
} from "./caio-operating-question-pack-provider-registry";
import {
  CaioOperatingQuestionStoreError,
  generateCaioOperatingQuestionPortfolioFromPackInput,
} from "./caio-operating-question-store.service";
import {
  CAIO_PRO_FDE_CROSS_REPO_INTERFACE_DESCRIPTOR,
  caioProPackOperatingInputSchema,
} from "./caio-pro-fde-cross-repo-contract";

export const CAIO_OPERATING_QUESTION_PRODUCTION_GENERATOR_REF =
  "generator:caio-operating-question-pack-semantic-v1" as const;
export const CAIO_OPERATING_QUESTION_PRODUCTION_MODEL_REF =
  "model:deterministic-core-policy-v1" as const;

export type CaioOperatingQuestionProductionCallerErrorCode =
  | "REQUEST_INVALID"
  | "PRINCIPAL_NOT_AUTHORIZED"
  | "PACK_PROVIDER_NOT_MOUNTED"
  | "PACK_PROVIDER_CONFIGURATION_INVALID"
  | "PACK_PROVIDER_RESOLUTION_FAILED"
  | "PACK_OPERATING_INPUT_INVALID"
  | "PACK_PROVIDER_SCOPE_MISMATCH"
  | "GENERATION_REJECTED";

export class CaioOperatingQuestionProductionCallerError extends Error {
  readonly code: CaioOperatingQuestionProductionCallerErrorCode;

  constructor(code: CaioOperatingQuestionProductionCallerErrorCode) {
    super(code.toLowerCase());
    this.name = "CaioOperatingQuestionProductionCallerError";
    this.code = code;
  }
}

export type CaioOperatingQuestionProductionCaller = (input: {
  principal: CaioAccessPrincipal;
  requestId: string;
  request: CaioOperatingQuestionGenerationRequest;
  signal?: AbortSignal;
}) => ReturnType<typeof generateCaioOperatingQuestionPortfolioFromPackInput>;

function resolveMountedProvider(
  registry: CaioOperatingQuestionPackProviderRegistry,
) {
  try {
    return registry.resolve();
  } catch (error) {
    if (error instanceof CaioOperatingQuestionPackProviderRegistryError) {
      throw new CaioOperatingQuestionProductionCallerError(
        error.code === "PACK_PROVIDER_NOT_MOUNTED"
          ? "PACK_PROVIDER_NOT_MOUNTED"
          : "PACK_PROVIDER_CONFIGURATION_INVALID",
      );
    }
    throw error;
  }
}

/**
 * The sole production adapter from authenticated gateway scope to the S2
 * generator/store. G0 and the evidence snapshot are reloaded and locked by S2;
 * neither is accepted from this route or trusted from the mounted Pack value.
 */
export function createCaioOperatingQuestionProductionCaller(input: {
  providerRegistry: CaioOperatingQuestionPackProviderRegistry;
}): CaioOperatingQuestionProductionCaller {
  return async (call) => {
    if (
      call.principal.audience !== "mcp" ||
      call.principal.clientType !== "workbuddy"
    ) {
      throw new CaioOperatingQuestionProductionCallerError(
        "PRINCIPAL_NOT_AUTHORIZED",
      );
    }
    const request = (() => {
      try {
        return parseCaioOperatingQuestionGenerationRequest(call.request);
      } catch {
        throw new CaioOperatingQuestionProductionCallerError("REQUEST_INVALID");
      }
    })();
    const provider = resolveMountedProvider(input.providerRegistry);
    let provided: unknown;
    try {
      provided = await provider.resolveOperatingInput({
        workspaceId: call.principal.workspaceId,
        workspaceRef: `workspace:${call.principal.workspaceId}`,
        portfolioRef: request.portfolioRef,
        actorUserRef: call.principal.userRef,
        requestId: call.requestId,
        ...(call.signal ? { signal: call.signal } : {}),
      });
    } catch (error) {
      if (error instanceof CaioOperatingQuestionProductionCallerError) {
        throw error;
      }
      throw new CaioOperatingQuestionProductionCallerError(
        "PACK_PROVIDER_RESOLUTION_FAILED",
      );
    }
    const packOperatingInput = caioProPackOperatingInputSchema.safeParse(provided);
    if (!packOperatingInput.success) {
      throw new CaioOperatingQuestionProductionCallerError(
        "PACK_OPERATING_INPUT_INVALID",
      );
    }
    if (
      packOperatingInput.data.workspaceRef !==
        `workspace:${call.principal.workspaceId}` ||
      packOperatingInput.data.portfolioRef !== request.portfolioRef
    ) {
      throw new CaioOperatingQuestionProductionCallerError(
        "PACK_PROVIDER_SCOPE_MISMATCH",
      );
    }
    try {
      return await generateCaioOperatingQuestionPortfolioFromPackInput({
        interfaceDescriptor: CAIO_PRO_FDE_CROSS_REPO_INTERFACE_DESCRIPTOR,
        packOperatingInput: packOperatingInput.data,
        workspaceId: call.principal.workspaceId,
        actorUserId: call.principal.userRef,
        generationKey: request.generationKey,
        generatorRef: CAIO_OPERATING_QUESTION_PRODUCTION_GENERATOR_REF,
        modelRef: CAIO_OPERATING_QUESTION_PRODUCTION_MODEL_REF,
        // Request ids are deliberately excluded: the gateway creates a new one
        // for every attempt, while generationKey is the canonical replay key.
        auditRefs: [
          provider.providerId,
          `gateway-generation:${sha256(
            canonicalJson({
              workspaceId: call.principal.workspaceId,
              portfolioRef: request.portfolioRef,
              generationKey: request.generationKey,
            }),
          )}`,
        ],
      });
    } catch (error) {
      if (
        error instanceof CaioOperatingQuestionStoreError ||
        error instanceof CaioInitializationGateStoreError
      ) {
        throw new CaioOperatingQuestionProductionCallerError(
          "GENERATION_REJECTED",
        );
      }
      throw error;
    }
  };
}
