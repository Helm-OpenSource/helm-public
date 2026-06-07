import { describe, it, expect } from "vitest";
import { parseScopeManifest, defaultScopeManifest } from "./scope-manifest";
import { signalMappingCandidateSchema } from "./mapping";
import { reviewPacketSchema } from "./review-packet";
import { CONTRACT_VERSION } from "./index";

describe("ScopeManifest contract", () => {
  it("applies safe defaults", () => {
    const m = defaultScopeManifest(".");
    expect(m.respectGitignore).toBe(true);
    expect(m.secretPreflight.mode).toBe("strict");
    expect(m.output.dir).toBe(".helm-profiler/runs");
    expect(m.dbCatalog.enabled).toBe(false);
  });

  it("rejects unknown keys (strict)", () => {
    expect(() => parseScopeManifest({ version: "1", bogus: true })).toThrow();
  });
});

describe("SignalMappingCandidate contract", () => {
  it("defaults state to candidate", () => {
    const c = signalMappingCandidateSchema.parse({
      id: "m1",
      sourceObjectId: "o1",
      targetEntity: "Opportunity",
      signalFamily: "advancement",
      confidence: 88,
      rationale: "structural match",
      origin: "ai",
    });
    expect(c.state).toBe("candidate");
  });

  it("rejects out-of-range confidence", () => {
    expect(() =>
      signalMappingCandidateSchema.parse({
        id: "m1",
        sourceObjectId: "o1",
        targetEntity: "Opportunity",
        signalFamily: "advancement",
        confidence: 140,
        rationale: "x",
        origin: "ai",
      }),
    ).toThrow();
  });
});

describe("ReviewPacket contract", () => {
  it("requires the P0-REQ-07 metadata fields", () => {
    expect(() =>
      reviewPacketSchema.parse({
        schemaVersion: "helm.source-profiler.review-packet.v1",
        sensitivity: "CONFIDENTIAL",
        requiredMetadata: { provider: "p" },
        run: {},
        codeScan: {},
        redactionStatus: "redacted",
      }),
    ).toThrow();
  });
});

describe("contract version", () => {
  it("is a semver string", () => {
    expect(CONTRACT_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
