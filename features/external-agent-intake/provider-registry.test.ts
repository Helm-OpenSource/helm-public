import { describe, expect, it } from "vitest";
import {
  EXTERNAL_AGENT_PROVIDER_PROFILES,
  KNOWN_EXTERNAL_AGENT_PROVIDER_IDS,
  getExternalAgentProviderProfile,
  isKnownExternalAgentProvider,
  listProviderProfiles,
} from "./provider-registry";
import {
  EXTERNAL_AGENT_ARTIFACT_FIXTURES,
  EXTERNAL_AGENT_INTAKE_UNKNOWN_PROVIDER_ID,
} from "./provider-fixtures";

const EXPECTED_PROVIDER_IDS = ["coze_manual", "openclaw_local", "dify_manual"] as const;

const REQUIRED_PROHIBITED_USES = [
  "create_must_push_directly",
  "write_memory_directly",
  "send_customer_message",
] as const;

describe("external-agent-intake provider registry", () => {
  it("contains exactly the three first-phase provider profiles", () => {
    expect(EXTERNAL_AGENT_PROVIDER_PROFILES).toHaveLength(3);
    expect(listProviderProfiles()).toHaveLength(3);
  });

  it("exposes provider ids in deterministic order", () => {
    expect(KNOWN_EXTERNAL_AGENT_PROVIDER_IDS).toEqual(EXPECTED_PROVIDER_IDS);
    expect(
      EXTERNAL_AGENT_PROVIDER_PROFILES.map((profile) => profile.providerId),
    ).toEqual(EXPECTED_PROVIDER_IDS);
  });

  it("never declares a side-effecting maxEffectMode in Phase 1", () => {
    for (const profile of EXTERNAL_AGENT_PROVIDER_PROFILES) {
      expect(profile.maxEffectMode).not.toBe("side_effecting");
    }
  });

  it("keeps first-phase provider posture conservative instead of over-trusting external platforms", () => {
    expect(getExternalAgentProviderProfile("coze_manual")).toMatchObject({
      dataResidency: "unknown",
      auditability: "partial_trace",
      replayability: "not_replayable",
      tenantIsolation: "provider_project_scoped",
      supportsRedaction: false,
      supportsOutputSchema: true,
      defaultTrustTier: "low",
    });

    expect(getExternalAgentProviderProfile("openclaw_local")).toMatchObject({
      dataResidency: "local",
      auditability: "partial_trace",
      replayability: "best_effort_replay",
      tenantIsolation: "unknown",
      humanReviewNative: false,
      supportsRedaction: false,
      supportsOutputSchema: false,
      defaultTrustTier: "medium",
    });

    expect(getExternalAgentProviderProfile("dify_manual")).toMatchObject({
      dataResidency: "unknown",
      auditability: "partial_trace",
      replayability: "best_effort_replay",
      tenantIsolation: "provider_project_scoped",
      supportsRedaction: false,
      supportsOutputSchema: true,
      defaultTrustTier: "low",
    });
  });

  it("prohibits Must Push, memory, send, and an official-write boundary for every provider", () => {
    for (const profile of EXTERNAL_AGENT_PROVIDER_PROFILES) {
      for (const requiredProhibition of REQUIRED_PROHIBITED_USES) {
        expect(
          profile.prohibitedUses,
          `provider ${profile.providerId} missing prohibition ${requiredProhibition}`,
        ).toContain(requiredProhibition);
      }
      const hasOfficialWriteBoundary = profile.prohibitedUses.some((rule) =>
        rule.includes("official_write"),
      );
      expect(
        hasOfficialWriteBoundary,
        `provider ${profile.providerId} must declare an official-write boundary`,
      ).toBe(true);
    }
  });

  it("looks profiles up by id and reports unknown providers as such", () => {
    for (const providerId of EXPECTED_PROVIDER_IDS) {
      const profile = getExternalAgentProviderProfile(providerId);
      expect(profile?.providerId).toBe(providerId);
      expect(isKnownExternalAgentProvider(providerId)).toBe(true);
    }

    expect(getExternalAgentProviderProfile("does_not_exist")).toBeNull();
    expect(isKnownExternalAgentProvider("does_not_exist")).toBe(false);
    expect(
      isKnownExternalAgentProvider(EXTERNAL_AGENT_INTAKE_UNKNOWN_PROVIDER_ID),
    ).toBe(false);
  });
});

describe("external-agent-intake fixture metadata", () => {
  it("has 22 unique EA-* fixture ids", () => {
    expect(EXTERNAL_AGENT_ARTIFACT_FIXTURES).toHaveLength(22);

    const ids = EXTERNAL_AGENT_ARTIFACT_FIXTURES.map((fixture) => fixture.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const id of ids) {
      expect(id).toMatch(/^EA-\d{3}$/);
    }
  });

  it("references known providers except the explicit EA-014 unknown case", () => {
    for (const fixture of EXTERNAL_AGENT_ARTIFACT_FIXTURES) {
      const { providerId } = fixture.artifact;
      if (fixture.id === "EA-014") {
        expect(providerId).toBe(EXTERNAL_AGENT_INTAKE_UNKNOWN_PROVIDER_ID);
        expect(isKnownExternalAgentProvider(providerId)).toBe(false);
        expect(fixture.expectedDisposition).toBe("reject");
      } else {
        expect(
          isKnownExternalAgentProvider(providerId),
          `fixture ${fixture.id} references unknown provider ${providerId}`,
        ).toBe(true);
      }
    }
  });
});
