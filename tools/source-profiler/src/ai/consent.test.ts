import { describe, it, expect } from "vitest";
import { evaluateAiConsent } from "./consent";

describe("evaluateAiConsent", () => {
  it("allows the local provider without consent", () => {
    const d = evaluateAiConsent({ providerKind: "local", consent: false });
    expect(d.allowed).toBe(true);
    expect(d.requiresConsent).toBe(false);
  });

  it("requires consent for remote providers", () => {
    expect(evaluateAiConsent({ providerKind: "openai", consent: false }).allowed).toBe(false);
    expect(evaluateAiConsent({ providerKind: "openai", consent: true }).allowed).toBe(true);
    expect(evaluateAiConsent({ providerKind: "anthropic", consent: false }).requiresConsent).toBe(true);
    expect(evaluateAiConsent({ providerKind: "custom", consent: false }).allowed).toBe(false);
  });
});
