import { describe, it, expect } from "vitest";
import {
  DIAGNOSTIC_COMMANDS,
  PUBLIC_CORE_AUTOMATABLE_RISKS,
  diagnosticCommandSchema,
  isPublicCoreAutomatable,
  validateRegistryWithinPublicCore,
} from "./command-registry";

function cmd(overrides: Record<string, unknown>) {
  return diagnosticCommandSchema.parse({
    id: "x",
    command: "noop",
    repoOwner: "helm-public",
    risk: "read",
    outputSchemaRef: "X",
    ...overrides,
  });
}

describe("DIAGNOSTIC_COMMANDS registry", () => {
  it("loads and only contains read/local_draft live automation", () => {
    expect(DIAGNOSTIC_COMMANDS.length).toBeGreaterThan(0);
    for (const c of DIAGNOSTIC_COMMANDS) {
      expect(PUBLIC_CORE_AUTOMATABLE_RISKS.has(c.risk)).toBe(true);
      expect(isPublicCoreAutomatable(c)).toBe(true);
    }
  });

  it("is clean against the Public Core validator", () => {
    expect(validateRegistryWithinPublicCore(DIAGNOSTIC_COMMANDS)).toEqual([]);
  });
});

describe("diagnosticCommandSchema", () => {
  it("rejects unknown keys (strict)", () => {
    expect(() => cmd({ bogus: true })).toThrow();
  });
});

describe("validateRegistryWithinPublicCore", () => {
  it("accepts read and local_draft", () => {
    expect(validateRegistryWithinPublicCore([cmd({ risk: "read" }), cmd({ id: "y", risk: "local_draft" })])).toEqual([]);
  });

  it("rejects a higher-risk entry that is not disabled", () => {
    const v = validateRegistryWithinPublicCore([cmd({ risk: "external_write" })]);
    expect(v.map((x) => x.rule)).toContain("risk-ceiling");
  });

  it("allows a higher-risk entry only when explicitly disabled", () => {
    const v = validateRegistryWithinPublicCore([cmd({ risk: "activation", disabled: true })]);
    expect(v.map((x) => x.rule)).not.toContain("risk-ceiling");
  });

  it("rejects unknown forbidden-action tokens", () => {
    const v = validateRegistryWithinPublicCore([cmd({ forbiddenActions: ["not_a_real_action"] })]);
    expect(v.map((x) => x.rule)).toContain("unknown-forbidden-action");
  });

  it("rejects boundary-breaching side effects", () => {
    const v = validateRegistryWithinPublicCore([cmd({ sideEffects: ["performs network writeback"] })]);
    expect(v.map((x) => x.rule)).toContain("forbidden-side-effect");
  });

  it("requires sibling-repo entries to be read-only ownership pointers", () => {
    const v = validateRegistryWithinPublicCore([cmd({ repoOwner: "sibling-repo", risk: "local_draft" })]);
    expect(v.map((x) => x.rule)).toContain("sibling-repo-pointer-only");
  });
});
