import { describe, expect, it, vi } from "vitest";

import {
  CaioOperatingQuestionPackProviderRegistryError,
  createCaioOperatingQuestionPackProviderRegistry,
  type CaioOperatingQuestionPackProvider,
} from "./caio-operating-question-pack-provider-registry";

function provider(
  providerId: string,
): CaioOperatingQuestionPackProvider {
  return Object.freeze({
    providerId,
    resolveOperatingInput: vi.fn(async () => ({ authorityEffect: "none" })),
  });
}

describe("CAIO operating-question Pack provider registry", () => {
  it("resolves the sole mounted provider", () => {
    const registry = createCaioOperatingQuestionPackProviderRegistry();
    const mounted = provider("pack-provider:operating-input-v1");

    registry.register(mounted);

    expect(registry.resolve()).toBe(mounted);
    expect(registry.mountedProviderCount()).toBe(1);
  });

  it("fails closed when no Pack provider is mounted", () => {
    const registry = createCaioOperatingQuestionPackProviderRegistry();

    expect(() => registry.resolve()).toThrowError(
      expect.objectContaining<Partial<CaioOperatingQuestionPackProviderRegistryError>>({
        code: "PACK_PROVIDER_NOT_MOUNTED",
      }),
    );
    expect(registry.mountedProviderCount()).toBe(0);
  });

  it("rejects a second registration even when it uses another provider id", () => {
    const registry = createCaioOperatingQuestionPackProviderRegistry();
    registry.register(provider("pack-provider:first"));

    expect(() => registry.register(provider("pack-provider:second"))).toThrowError(
      expect.objectContaining<Partial<CaioOperatingQuestionPackProviderRegistryError>>({
        code: "PACK_PROVIDER_ALREADY_MOUNTED",
      }),
    );
    expect(registry.mountedProviderCount()).toBe(1);
  });

  it.each([
    ["empty id", { providerId: "", resolveOperatingInput: vi.fn() }],
    [
      "non-public id",
      {
        providerId: "https://private.example/provider",
        resolveOperatingInput: vi.fn(),
      },
    ],
    ["missing resolver", { providerId: "pack-provider:invalid" }],
  ])("rejects an invalid provider: %s", (_label, candidate) => {
    const registry = createCaioOperatingQuestionPackProviderRegistry();

    expect(() => registry.register(candidate as never)).toThrowError(
      expect.objectContaining<Partial<CaioOperatingQuestionPackProviderRegistryError>>({
        code: "PACK_PROVIDER_INVALID",
      }),
    );
    expect(registry.mountedProviderCount()).toBe(0);
  });
});
