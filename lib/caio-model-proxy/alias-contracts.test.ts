import { describe, expect, it } from "vitest";

import {
  CAIO_CODEX_DEFAULT_ALIAS,
  CAIO_FALLBACK_EQUIVALENCE_DIMENSIONS,
  CAIO_STABLE_MODEL_ALIASES,
  CAIO_WORKBUDDY_DEFAULT_ALIAS,
  caioModelAliasBindingSchema,
  isCaioSecureUpstreamEndpoint,
  isFallbackAllowed,
  listModelsForGrant,
  type CaioModelAliasBinding,
  type CaioModelAliasFallbackCandidate,
} from "./alias-contracts";

function makeCandidate(
  overrides: Partial<CaioModelAliasFallbackCandidate> = {},
): CaioModelAliasFallbackCandidate {
  return {
    alias: "caio-codex-fallback",
    protocol: "responses",
    providerKey: "provider-a",
    upstreamModel: "provider-a-large-2",
    credentialRef: "provider-a-key",
    endpointBaseUrl: "https://lan-gw.example.internal/v1",
    region: "cn-hangzhou",
    dataRetentionPolicyKey: "retention-30d",
    trainingUsePolicyKey: "no-training",
    dataAuthorizationKey: "auth-tier-1",
    policyVersion: "policy-v3",
    status: "active",
    ...overrides,
  };
}

function makeBinding(
  overrides: Partial<CaioModelAliasBinding> = {},
): CaioModelAliasBinding {
  return {
    ...makeCandidate(),
    alias: CAIO_CODEX_DEFAULT_ALIAS,
    upstreamModel: "provider-a-large-1",
    fallbackCandidates: [],
    ...overrides,
  };
}

describe("stable aliases", () => {
  it("pins caio-codex-default to the responses protocol", () => {
    const entry = CAIO_STABLE_MODEL_ALIASES.find(
      (a) => a.alias === CAIO_CODEX_DEFAULT_ALIAS,
    );
    expect(entry?.protocol).toBe("responses");
  });

  it("pins caio-workbuddy-default to the chat_completions protocol", () => {
    const entry = CAIO_STABLE_MODEL_ALIASES.find(
      (a) => a.alias === CAIO_WORKBUDDY_DEFAULT_ALIAS,
    );
    expect(entry?.protocol).toBe("chat_completions");
  });
});

describe("caioModelAliasBindingSchema", () => {
  it("accepts a complete binding with fallback candidates", () => {
    const binding = makeBinding({
      fallbackCandidates: [makeCandidate()],
    });
    expect(caioModelAliasBindingSchema.parse(binding)).toEqual(binding);
  });

  it("rejects a credentialRef containing dots or slashes", () => {
    for (const bad of ["../escape", "a.b", "a/b", "UPPER", ""]) {
      expect(
        caioModelAliasBindingSchema.safeParse(
          makeBinding({ credentialRef: bad }),
        ).success,
      ).toBe(false);
    }
  });

  it("rejects unknown extra fields (strict shape)", () => {
    const withExtra = {
      ...makeBinding(),
      rawPrompt: "leak",
    } as unknown;
    expect(
      caioModelAliasBindingSchema.safeParse(withExtra).success,
    ).toBe(false);
  });

  it("rejects an invalid protocol", () => {
    expect(
      caioModelAliasBindingSchema.safeParse(
        makeBinding({ protocol: "completions" as never }),
      ).success,
    ).toBe(false);
  });
});

describe("listModelsForGrant", () => {
  const bindings = [
    makeBinding(),
    makeBinding({
      alias: CAIO_WORKBUDDY_DEFAULT_ALIAS,
      protocol: "chat_completions",
    }),
    makeBinding({ alias: "caio-codex-disabled", status: "disabled" }),
  ];

  it("returns only granted, active aliases in the OpenAI shape", () => {
    const result = listModelsForGrant({
      bindings,
      grantedAliases: [
        CAIO_CODEX_DEFAULT_ALIAS,
        "caio-codex-disabled",
        "caio-not-configured",
      ],
    });
    expect(result).toEqual({
      object: "list",
      data: [
        {
          id: CAIO_CODEX_DEFAULT_ALIAS,
          object: "model",
          owned_by: "caio-gateway",
        },
      ],
    });
  });

  it("returns an empty list when nothing is granted", () => {
    expect(
      listModelsForGrant({ bindings, grantedAliases: [] }).data,
    ).toEqual([]);
  });

  it("does not list disabled bindings even when granted", () => {
    const result = listModelsForGrant({
      bindings,
      grantedAliases: ["caio-codex-disabled"],
    });
    expect(result.data).toEqual([]);
  });

  it("deduplicates repeated grants", () => {
    const result = listModelsForGrant({
      bindings,
      grantedAliases: [
        CAIO_CODEX_DEFAULT_ALIAS,
        CAIO_CODEX_DEFAULT_ALIAS,
      ],
    });
    expect(result.data).toHaveLength(1);
  });
});

describe("isFallbackAllowed (fail-closed equivalence)", () => {
  it("allows a candidate identical on every governed dimension", () => {
    expect(isFallbackAllowed(makeBinding(), makeCandidate())).toBe(true);
  });

  it("allows a candidate that differs only in upstreamModel and credentialRef", () => {
    expect(
      isFallbackAllowed(
        makeBinding(),
        makeCandidate({
          upstreamModel: "provider-a-large-3",
          credentialRef: "provider-a-key-b",
        }),
      ),
    ).toBe(true);
  });

  // Every governed dimension mismatch must independently deny fallback.
  const mismatches: Record<
    (typeof CAIO_FALLBACK_EQUIVALENCE_DIMENSIONS)[number],
    string
  > = {
    providerKey: "provider-b",
    protocol: "chat_completions",
    region: "us-east-1",
    dataRetentionPolicyKey: "retention-90d",
    trainingUsePolicyKey: "training-allowed",
    dataAuthorizationKey: "auth-tier-2",
    // F5: policyVersion is governed, so a candidate under a looser policy
    // version can no longer receive traffic under the original receipt.
    policyVersion: "policy-v9-looser",
  };

  for (const dimension of CAIO_FALLBACK_EQUIVALENCE_DIMENSIONS) {
    it(`denies fallback when ${dimension} differs`, () => {
      expect(
        isFallbackAllowed(
          makeBinding(),
          makeCandidate({ [dimension]: mismatches[dimension] } as Partial<
            CaioModelAliasFallbackCandidate
          >),
        ),
      ).toBe(false);
    });

    it(`denies fallback when ${dimension} is missing on the candidate`, () => {
      const candidate = { ...makeCandidate() } as Record<string, unknown>;
      delete candidate[dimension];
      expect(isFallbackAllowed(makeBinding(), candidate)).toBe(false);
    });

    it(`denies fallback when ${dimension} is missing on the primary`, () => {
      const primary = { ...makeBinding() } as Record<string, unknown>;
      delete primary[dimension];
      expect(isFallbackAllowed(primary, makeCandidate())).toBe(false);
    });

    it(`denies fallback when ${dimension} is empty or unknown`, () => {
      expect(
        isFallbackAllowed(
          makeBinding(),
          makeCandidate({ [dimension]: "" } as Partial<
            CaioModelAliasFallbackCandidate
          >),
        ),
      ).toBe(false);
      expect(
        isFallbackAllowed(
          makeBinding(),
          makeCandidate({ [dimension]: "unknown" } as Partial<
            CaioModelAliasFallbackCandidate
          >),
        ),
      ).toBe(false);
    });
  }

  it("F5: governs policyVersion so a fallback can never execute under a different policy", () => {
    expect([...CAIO_FALLBACK_EQUIVALENCE_DIMENSIONS]).toContain("policyVersion");
    expect(
      isFallbackAllowed(
        makeBinding(),
        makeCandidate({ policyVersion: "policy-v9-looser" }),
      ),
    ).toBe(false);
  });

  it("always denies cross-provider fallback", () => {
    expect(
      isFallbackAllowed(
        makeBinding(),
        makeCandidate({ providerKey: "provider-b" }),
      ),
    ).toBe(false);
  });

  it("denies a candidate that is not active", () => {
    expect(
      isFallbackAllowed(makeBinding(), makeCandidate({ status: "disabled" })),
    ).toBe(false);
  });

  it("denies null/undefined inputs", () => {
    expect(isFallbackAllowed(null, makeCandidate())).toBe(false);
    expect(isFallbackAllowed(makeBinding(), null)).toBe(false);
    expect(isFallbackAllowed(undefined, undefined)).toBe(false);
  });
});

describe("upstream endpoint transport", () => {
  const binding = (endpointBaseUrl: string) => ({
    alias: "caio-codex-default",
    protocol: "responses",
    providerKey: "vendor-a",
    upstreamModel: "m-1",
    credentialRef: "vendor-a-key",
    endpointBaseUrl,
    region: "r1",
    dataRetentionPolicyKey: "retain-none",
    trainingUsePolicyKey: "no-training",
    dataAuthorizationKey: "authorized",
    policyVersion: "p1",
    status: "active",
    fallbackCandidates: [],
  });

  it("refuses a plaintext HTTP endpoint on a routable host", () => {
    for (const url of [
      "http://api.example.com/v1",
      `http://${[10, 0, 0, 5].join(".")}:8080`,
      "http://[2001:db8::1]/v1",
      "http://localhost.evil.example.com",
    ]) {
      expect(isCaioSecureUpstreamEndpoint(url)).toBe(false);
      expect(
        caioModelAliasBindingSchema.safeParse(binding(url)).success,
      ).toBe(false);
    }
  });

  it("accepts https and only loopback plain http", () => {
    for (const url of [
      "https://api.example.com/v1",
      "http://127.0.0.1:8081/v1",
      "http://[::1]:8081",
      "http://localhost:8081/v1",
    ]) {
      expect(isCaioSecureUpstreamEndpoint(url)).toBe(true);
      expect(
        caioModelAliasBindingSchema.safeParse(binding(url)).success,
      ).toBe(true);
    }
  });
});
