import { describe, expect, it } from "vitest";

import {
  CAIO_CITATION_LABEL_PATTERN,
  CaioContextBrokerError,
  HARD_BOUNDARY_CATEGORIES,
  HARD_BOUNDARY_DETECTORS,
  caioNegativeRuleSchema,
  detectHardBoundaryHits,
  formatCitationLabel,
  matchesNegativeRule,
  ruleHitRef,
} from "@/lib/caio-context-broker/broker-contracts";

// Synthetic credential-shaped fixture built by concatenation so the
// public-release static line scan never matches a URL-embedded credential.
const FAKE_CONNECTION_STRING = [
  "mysql:",
  "//",
  "root:",
  "hunter2@",
  "db.internal",
  ":3306/app",
].join("");

describe("citation labels", () => {
  it("formats ordinals as [CAIO:S<n>]", () => {
    expect(formatCitationLabel(1)).toBe("[CAIO:S1]");
    expect(formatCitationLabel(12)).toBe("[CAIO:S12]");
    expect(CAIO_CITATION_LABEL_PATTERN.test("[CAIO:S3]")).toBe(true);
    expect(CAIO_CITATION_LABEL_PATTERN.test("[CAIO:S0]")).toBe(false);
    expect(CAIO_CITATION_LABEL_PATTERN.test("CAIO:S1")).toBe(false);
  });

  it("rejects non-positive ordinals with a typed error", () => {
    expect(() => formatCitationLabel(0)).toThrow(CaioContextBrokerError);
  });
});

describe("hard boundary detection", () => {
  it("covers every declared category with at least one detector", () => {
    const covered = new Set(
      HARD_BOUNDARY_DETECTORS.map((detector) => detector.category),
    );
    // unauthorized_material / local_only markers plus shared patterns must
    // leave no declared category without a detector.
    for (const category of HARD_BOUNDARY_CATEGORIES) {
      expect(covered.has(category)).toBe(true);
    }
  });

  it("detects PEM private key blocks", () => {
    const hits = detectHardBoundaryHits(
      "config\n-----BEGIN PRIVATE KEY-----\nMIIabc\n-----END PRIVATE KEY-----\n",
    );
    expect(hits.some((hit) => hit.category === "private_key")).toBe(true);
  });

  it("detects CA private key material", () => {
    const hits = detectHardBoundaryHits(
      "-----BEGIN CA PRIVATE KEY-----\nMIIabc\n-----END CA PRIVATE KEY-----",
    );
    expect(hits.some((hit) => hit.category === "ca_private_key")).toBe(true);
  });

  it("detects passwords, connection strings, and session tokens", () => {
    expect(
      detectHardBoundaryHits("password=hunter2secret").map(
        (hit) => hit.category,
      ),
    ).toContain("password");
    expect(
      detectHardBoundaryHits(
        `db at ${FAKE_CONNECTION_STRING}`,
      ).map((hit) => hit.category),
    ).toContain("connection_string");
    expect(
      detectHardBoundaryHits(
        "session_token=abcdefabcdefabcdefabcdef",
      ).map((hit) => hit.category),
    ).toContain("api_or_session_token");
  });

  it("reuses the shared sensitive-value patterns with category mapping", () => {
    expect(
      detectHardBoundaryHits("mail me at person@company.example please").map(
        (hit) => hit.category,
      ),
    ).toContain("unauthorized_identity_data");
    expect(
      detectHardBoundaryHits("Bearer abcdefghijklmnopqrstuvwx").map(
        (hit) => hit.category,
      ),
    ).toContain("api_or_session_token");
    expect(
      detectHardBoundaryHits("key sk-abcdefghijklmnopqrstuvwx here").map(
        (hit) => hit.category,
      ),
    ).toContain("api_or_session_token");
  });

  it("detects local-only and unauthorized-material markers and serials", () => {
    expect(
      detectHardBoundaryHits("this note is LOCAL_ONLY forever").map(
        (hit) => hit.category,
      ),
    ).toContain("local_only_marker");
    expect(
      detectHardBoundaryHits("DO NOT DISTRIBUTE outside the team").map(
        (hit) => hit.category,
      ),
    ).toContain("unauthorized_material");
    expect(
      detectHardBoundaryHits("device serial: FA23K9Q1 shipped").map(
        (hit) => hit.category,
      ),
    ).toContain("raw_serial_number");
  });

  it("returns no hits for clean prose and empty content", () => {
    expect(
      detectHardBoundaryHits(
        "The quarterly review praised the smoother onboarding flow.",
      ),
    ).toEqual([]);
    expect(detectHardBoundaryHits("")).toEqual([]);
  });
});

describe("negative rule contract", () => {
  const baseRule = {
    id: "caio-context-rule:abc",
    workspaceId: "ws-1",
    ruleKey: "block-vendor-notes",
    scopeKind: "workspace" as const,
    scopeRef: null,
    ruleKind: "deny" as const,
    pattern: { sourceProject: "vendor" },
    version: 2,
    status: "published" as const,
    createdByRef: "user:a",
    publishedByRef: "user:owner",
    createdAt: "2026-07-29T00:00:00.000Z",
    publishedAt: "2026-07-29T00:01:00.000Z",
    revokedAt: null,
  };

  it("accepts a published workspace rule and pins version refs", () => {
    const rule = caioNegativeRuleSchema.parse(baseRule);
    expect(ruleHitRef(rule)).toBe("block-vendor-notes@v2");
  });

  it("requires scopeRef for project-scoped rules", () => {
    expect(() =>
      caioNegativeRuleSchema.parse({
        ...baseRule,
        scopeKind: "project",
        scopeRef: null,
      }),
    ).toThrow();
  });

  it("requires at least one pattern criterion", () => {
    expect(() =>
      caioNegativeRuleSchema.parse({ ...baseRule, pattern: {} }),
    ).toThrow();
  });

  it("matches descriptors and content with AND semantics", () => {
    const source = {
      sourceProject: "vendor",
      sourceRef: "doc:contract-7",
      classification: "confidential",
    };
    expect(matchesNegativeRule(baseRule, source, "anything")).toBe(true);
    expect(
      matchesNegativeRule(
        { pattern: { sourceProject: "vendor", sourceRefPrefix: "doc:" } },
        source,
        "anything",
      ),
    ).toBe(true);
    expect(
      matchesNegativeRule(
        { pattern: { sourceProject: "vendor", classification: "public" } },
        source,
        "anything",
      ),
    ).toBe(false);
    expect(
      matchesNegativeRule(
        { pattern: { contentRegex: "secret-codename" } },
        source,
        "mentions secret-codename here",
      ),
    ).toBe(true);
    expect(
      matchesNegativeRule(
        { pattern: { contentRegex: "secret-codename" } },
        source,
        "clean text",
      ),
    ).toBe(false);
  });

  it("fails closed when a stored contentRegex is broken", () => {
    expect(
      matchesNegativeRule(
        { pattern: { contentRegex: "([" } },
        {
          sourceProject: "vendor",
          sourceRef: "doc:x",
          classification: "internal",
        },
        "anything",
      ),
    ).toBe(true);
  });
});
