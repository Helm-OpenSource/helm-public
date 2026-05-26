import { describe, expect, it } from "vitest";

import {
  DEFAULT_FOUNDER_INTERNAL_GATE_INPUT,
  FOUNDER_INTERNAL_GATE_FORBIDDEN_WORK,
  FOUNDER_INTERNAL_GATE_POSTURE,
  FOUNDER_INTERNAL_GATE_RULE_VERSION,
  FOUNDER_INTERNAL_GATE_RUNTIME_ADOPTION,
  POSITIVE_FOUNDER_INTERNAL_GATE_INPUT,
  evaluateFounderInternalGate,
  type FounderInternalGateInput,
} from "./founder-internal-gate";

function evaluate(patch: Partial<FounderInternalGateInput> = {}) {
  return evaluateFounderInternalGate({
    ...POSITIVE_FOUNDER_INTERNAL_GATE_INPUT,
    ...patch,
  });
}

describe("founder internal gate constants", () => {
  it("keeps the gate internal-only and runtime adoption no-go", () => {
    expect(FOUNDER_INTERNAL_GATE_RULE_VERSION).toBe("founder-internal-gate/v1");
    expect(FOUNDER_INTERNAL_GATE_POSTURE).toBe("OPC-Internal-Only");
    expect(FOUNDER_INTERNAL_GATE_RUNTIME_ADOPTION).toBe("No-Go");
  });

  it("forbids production, schema, API, mobile, write and auto-execution work", () => {
    const text = FOUNDER_INTERNAL_GATE_FORBIDDEN_WORK.join("\n");
    expect(text).toContain("data/queries.ts");
    expect(text).toContain("mobile read model");
    expect(text).toContain("Prisma schema");
    expect(text).toContain("API route");
    expect(text).toContain("production query adoption");
    expect(text).toContain("official write");
    expect(text).toContain("auto-execute");
  });
});

describe("evaluateFounderInternalGate", () => {
  it("defaults to Revise when founder approval and public-release proof are absent", () => {
    const result = evaluateFounderInternalGate(DEFAULT_FOUNDER_INTERNAL_GATE_INPUT);

    expect(result.decision).toBe("Revise");
    expect(result.productionQueryAdoptionAllowed).toBe(false);
    expect(result.runtimeIntegrationAllowed).toBe(false);
    expect(result.publicTrialAllowed).toBe(false);
    expect(result.blockers.join("\n")).toContain("Founder decision packet");
    expect(result.blockers.join("\n")).toContain("P0 public-release hygiene");
  });

  it("allows only disabled internal dogfooding preparation when all internal evidence is present", () => {
    const result = evaluateFounderInternalGate(POSITIVE_FOUNDER_INTERNAL_GATE_INPUT);

    expect(result.decision).toBe("Go-For-Disabled-Internal-Dogfooding");
    expect(result.runtimeAdoption).toBe("No-Go");
    expect(result.productionQueryAdoptionAllowed).toBe(false);
    expect(result.runtimeIntegrationAllowed).toBe(false);
    expect(result.publicTrialAllowed).toBe(false);
    expect(result.blockers).toEqual([]);
    expect(result.allowedNextStep).toContain("disabled-by-default internal dogfooding");
  });

  it("blocks if any review lens is missing", () => {
    const result = evaluate({
      reviewLenses: {
        ...POSITIVE_FOUNDER_INTERNAL_GATE_INPUT.reviewLenses,
        dataProtection: false,
      },
    });

    expect(result.decision).toBe("Revise");
    expect(result.blockers.join("\n")).toContain("five required review lenses");
  });

  it("blocks if public-release hygiene has any blocker", () => {
    const result = evaluate({
      publicReleaseHygiene: {
        ...POSITIVE_FOUNDER_INTERNAL_GATE_INPUT.publicReleaseHygiene,
        blockerCount: 1,
      },
    });

    expect(result.decision).toBe("Revise");
    expect(result.blockers.join("\n")).toContain("P0 public-release hygiene");
  });

  it("blocks if the internal scope attempts an API or page behavior change", () => {
    const result = evaluate({
      internalScope: {
        ...POSITIVE_FOUNDER_INTERNAL_GATE_INPUT.internalScope,
        noApiRouteChange: false,
        noPageBehaviorChange: false,
      },
    });

    expect(result.decision).toBe("Revise");
    expect(result.blockers.join("\n")).toContain("disabled, internal-only");
  });

  it("blocks if production query adoption is ever marked allowed", () => {
    const result = evaluate({
      productionQueryGate: {
        ...POSITIVE_FOUNDER_INTERNAL_GATE_INPUT.productionQueryGate,
        productionAdoptionAllowed: true,
      } as never,
    });

    expect(result.decision).toBe("Revise");
    expect(result.blockers.join("\n")).toContain("Production query adoption");
  });

  it("blocks if Ask Helm runtime integration is ever marked allowed", () => {
    const result = evaluate({
      askHelmRuntimeGate: {
        ...POSITIVE_FOUNDER_INTERNAL_GATE_INPUT.askHelmRuntimeGate,
        runtimeIntegrationAllowed: true,
      } as never,
    });

    expect(result.decision).toBe("Revise");
    expect(result.blockers.join("\n")).toContain("Ask Helm runtime adoption");
  });
});
