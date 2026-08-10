import { caioProPublicSafeRefSchema } from "./caio-pro-fde-cross-repo-contract";

export type CaioOperatingQuestionPackProviderScope = Readonly<{
  workspaceId: string;
  workspaceRef: string;
  portfolioRef: string;
  actorUserRef: string;
  requestId: string;
  signal?: AbortSignal;
}>;

/**
 * Deployment-supplied Pack seam. Public Core owns the contract and consumer;
 * the Pack implementation remains outside this repository.
 */
export type CaioOperatingQuestionPackProvider = Readonly<{
  providerId: string;
  resolveOperatingInput(
    scope: CaioOperatingQuestionPackProviderScope,
  ): Promise<unknown>;
}>;

export type CaioOperatingQuestionPackProviderRegistryErrorCode =
  | "PACK_PROVIDER_INVALID"
  | "PACK_PROVIDER_NOT_MOUNTED"
  | "PACK_PROVIDER_ALREADY_MOUNTED";

export class CaioOperatingQuestionPackProviderRegistryError extends Error {
  readonly code: CaioOperatingQuestionPackProviderRegistryErrorCode;

  constructor(code: CaioOperatingQuestionPackProviderRegistryErrorCode) {
    super(code.toLowerCase());
    this.name = "CaioOperatingQuestionPackProviderRegistryError";
    this.code = code;
  }
}

export type CaioOperatingQuestionPackProviderRegistry = Readonly<{
  register(provider: CaioOperatingQuestionPackProvider): void;
  resolve(): CaioOperatingQuestionPackProvider;
  mountedProviderCount(): number;
}>;

function assertProvider(
  provider: CaioOperatingQuestionPackProvider,
): CaioOperatingQuestionPackProvider {
  const providerId = caioProPublicSafeRefSchema.safeParse(
    typeof provider === "object" && provider !== null
      ? provider.providerId
      : undefined,
  );
  if (
    typeof provider !== "object" ||
    provider === null ||
    !providerId.success ||
    providerId.data !== provider.providerId ||
    typeof provider.resolveOperatingInput !== "function"
  ) {
    throw new CaioOperatingQuestionPackProviderRegistryError(
      "PACK_PROVIDER_INVALID",
    );
  }
  return provider;
}

/**
 * A mount owns one registry instance. The second registration is rejected even
 * when it uses a different id, so provider precedence can never depend on order.
 */
export function createCaioOperatingQuestionPackProviderRegistry(): CaioOperatingQuestionPackProviderRegistry {
  let mounted: CaioOperatingQuestionPackProvider | null = null;
  return Object.freeze({
    register(provider) {
      const candidate = assertProvider(provider);
      if (mounted !== null) {
        throw new CaioOperatingQuestionPackProviderRegistryError(
          "PACK_PROVIDER_ALREADY_MOUNTED",
        );
      }
      mounted = candidate;
    },
    resolve() {
      if (mounted === null) {
        throw new CaioOperatingQuestionPackProviderRegistryError(
          "PACK_PROVIDER_NOT_MOUNTED",
        );
      }
      return mounted;
    },
    mountedProviderCount() {
      return mounted === null ? 0 : 1;
    },
  });
}

/** Named composition seam so the sole production registration is auditable. */
export function registerCaioOperatingQuestionPackProvider(input: {
  registry: CaioOperatingQuestionPackProviderRegistry;
  provider: CaioOperatingQuestionPackProvider;
}): void {
  input.registry.register(input.provider);
}
