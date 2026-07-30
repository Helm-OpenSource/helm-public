import { describe, expect, it } from "vitest";

import {
  CAIO_CITATION_LABEL_PATTERN,
  CaioContextBrokerError,
  HARD_BOUNDARY_CATEGORIES,
  HARD_BOUNDARY_DETECTORS,
  NON_REDACTABLE_HARD_BOUNDARY_CATEGORIES,
  caioNegativeRuleSchema,
  detectHardBoundaryHits,
  formatCitationLabel,
  isNonRedactableHardBoundaryCategory,
  matchesNegativeRule,
  ruleHitRef,
  type HardBoundaryCategory,
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

// Credential-shaped URLs are assembled by concatenation so no single source
// line contains a `scheme://user:password@host` literal.
function fakeUrl(
  scheme: string,
  user: string,
  password: string,
  hostAndPath: string,
): string {
  return [scheme, "://", user, ":", password, "@", hostAndPath].join("");
}

// Table-driven detector strength: every declared category is fed at least
// three realistic positive samples and two negative samples, and the
// CLASSIFICATION (not merely "some detector exists") is asserted. This
// replaces the earlier vacuous "each category has >= 1 detector" check, which
// passed while the detectors missed lowercase PEM headers, quoted passwords,
// postgresql/clickhouse/jdbc/sqlite connection strings, Authorization headers,
// vendor key prefixes, bare JWTs, cookies, PuTTY keys, and IPv6.
const DETECTOR_SAMPLES: ReadonlyArray<{
  category: HardBoundaryCategory;
  positives: readonly string[];
  negatives: readonly string[];
}> = [
  {
    category: "private_key",
    positives: [
      "-----BEGIN RSA PRIVATE KEY-----\nMIIBOgIBAAJBAK\n-----END RSA PRIVATE KEY-----",
      "-----begin openssh private key-----\nb3BlbnNzaC1rZXk\n-----end openssh private key-----",
      "-----BEGIN\tPRIVATE\tKEY-----\r\nMIIabc\r\n-----END PRIVATE KEY-----",
      "PuTTY-User-Key-File-2: ssh-rsa\nEncryption: none",
    ],
    negatives: [
      "the private key rotation runbook lives in the ops wiki",
      "-----BEGIN CERTIFICATE-----\nMIIabc\n-----END CERTIFICATE-----",
      "ssh-rsa AAAAB3Nza is the published host key fingerprint",
    ],
  },
  {
    category: "ca_private_key",
    positives: [
      "-----BEGIN CA PRIVATE KEY-----\nMIIabc\n-----END CA PRIVATE KEY-----",
      "-----begin ca private key-----\nMIIabc\n-----end ca private key-----",
      "the certificate authority private key is escrowed offline",
      "certificate-authority backup private_key handling",
    ],
    negatives: [
      "the certificate authority rotated its published bundle",
      "root CA certificate chain attached to the ticket",
    ],
  },
  {
    category: "password",
    positives: [
      "password=hunter2secret",
      "vault password: correct horse battery staple",
      'Password: "my long pass phrase"',
      "pwd=abc",
      "PWD = s3cret",
    ],
    negatives: [
      "rotate the password policy quarterly",
      "the passphrase escrow process is documented in the runbook",
    ],
  },
  {
    category: "connection_string",
    positives: [
      fakeUrl("mysql", "root", "password", "db.internal:3306/app"),
      fakeUrl("postgresql", "appuser", "secret", "warehouse.internal:5432/dw"),
      fakeUrl("clickhouse", "svc", "changeme", "analytics.internal:9000"),
      fakeUrl(
        "postgresql+psycopg2",
        "svc",
        "pass",
        "warehouse.internal:5432/dw",
      ),
      "jdbc:oracle:thin:scott/tiger@dbhost:1521:orcl",
      "sqlite:////var/lib/app/state.db",
    ],
    negatives: [
      "the mysql upgrade window is Thursday evening",
      "see https://docs.internal/runbooks/postgres for the steps",
    ],
  },
  {
    category: "api_or_session_token",
    positives: [
      "session_token=abcdefabcdefabcdefabcdef",
      "API_KEY=9f8e7d6c5b4a3f2e1d0c",
      "client_secret=s3cr3t-value-here",
      "Authorization: Basic dXNlcjpwYXNzd29yZDEyMw==",
      "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhIn0.c2ln",
      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.c2lnbmF0dXJl",
      "sk_live_00000000000000example",
      "ghp_0123456789abcdefghij0123456789abcd",
      "Cookie: JSESSIONID=3F2A9C1B7E5D8046; path=/",
      "AKIAIOSFODNN7EXAMPLE",
      "credential = abc123def456",
    ],
    negatives: [
      "the token bucket refills every second",
      "rotate credentials during the maintenance window",
      "bearer bonds share the naming with the bearer scheme",
    ],
  },
  {
    category: "raw_serial_number",
    positives: [
      "device serial: FA23K9Q1 shipped",
      "Serial Number = 4F8A2BQ9X1",
      "SN 4F8A2BQ9",
      "S/N: XR7742PLQ2",
    ],
    negatives: [
      "the serial rollout continues next week",
      "printer sn unknown at intake",
    ],
  },
  {
    category: "raw_identifier",
    positives: [
      "entity 9b2d1e5c-3f47-4a1e-8c9d-1a2b3c4d5e6f was updated",
      "trace 01890a5d-ac96-774b-bcce-b302099c8057 captured",
      "batch 9B2D1E5C-3F47-8A1E-8C9D-1A2B3C4D5E6F reprocessed",
    ],
    negatives: [
      "release train 2026-07-29 shipped on time",
      "commit 9b2d1e5c3f474a1e8c9d1a2b3c4d5e6f landed",
    ],
  },
  {
    category: "unauthorized_identity_data",
    positives: [
      "mail me at person@company.example please",
      "reach the duty phone 415 555 0132 today",
      "the host answers on 203.0.113.7 internally",
      "the host answers on 2001:0db8:85a3:0000:0000:8a2e:0370:7334",
      "link-local fe80::1c2d:3e4f responded",
    ],
    negatives: [
      "the onboarding flow improved after the review",
      "the sync starts at 10:30:45 UTC",
      "version 1.2.3 shipped to the pilot",
    ],
  },
  {
    category: "local_only_marker",
    positives: [
      "LOCAL-ONLY draft of the migration plan",
      "[[LOCAL-ONLY]] notes from the war room",
      "this note is LOCAL_ONLY forever",
      "local-only copy retained by the author",
    ],
    negatives: [
      "the archive is stored on the local disk",
      "only the local team reviewed the change",
    ],
  },
  {
    category: "unauthorized_material",
    positives: [
      "DO NOT DISTRIBUTE outside the team",
      "INTERNAL USE ONLY — pilot pricing",
      "UNAUTHORIZED MATERIAL attached for review",
      "DO NOT SHARE the appendix",
      "NOT FOR DISTRIBUTION beyond the steering group",
    ],
    negatives: [
      "distribute the summary widely after launch",
      "internal review completed without findings",
    ],
  },
];

describe("hard boundary detection", () => {
  it("declares a detector for every category (structural floor)", () => {
    const covered = new Set(
      HARD_BOUNDARY_DETECTORS.map((detector) => detector.category),
    );
    for (const category of HARD_BOUNDARY_CATEGORIES) {
      expect(covered.has(category)).toBe(true);
    }
  });

  it("exercises every category with realistic positive and negative samples", () => {
    expect(DETECTOR_SAMPLES.map((sample) => sample.category).sort()).toEqual(
      [...HARD_BOUNDARY_CATEGORIES].sort(),
    );
    for (const sample of DETECTOR_SAMPLES) {
      expect(sample.positives.length).toBeGreaterThanOrEqual(3);
      expect(sample.negatives.length).toBeGreaterThanOrEqual(2);
      for (const positive of sample.positives) {
        const categories = detectHardBoundaryHits(positive).map(
          (hit) => hit.category,
        );
        expect(
          categories,
          `expected ${sample.category} for: ${positive}`,
        ).toContain(sample.category);
      }
      for (const negative of sample.negatives) {
        const categories = detectHardBoundaryHits(negative).map(
          (hit) => hit.category,
        );
        expect(
          categories,
          `expected no ${sample.category} for: ${negative}`,
        ).not.toContain(sample.category);
      }
    }
  });

  it("classifies a UUID as an identifier, never as a serial number", () => {
    const categories = detectHardBoundaryHits(
      "entity 9b2d1e5c-3f47-4a1e-8c9d-1a2b3c4d5e6f was updated",
    ).map((hit) => hit.category);
    expect(categories).toContain("raw_identifier");
    expect(categories).not.toContain("raw_serial_number");
  });

  it("exports the non-redactable marker categories", () => {
    expect([...NON_REDACTABLE_HARD_BOUNDARY_CATEGORIES].sort()).toEqual([
      "local_only_marker",
      "unauthorized_material",
    ]);
    expect(isNonRedactableHardBoundaryCategory("local_only_marker")).toBe(true);
    expect(isNonRedactableHardBoundaryCategory("unauthorized_material")).toBe(
      true,
    );
    expect(isNonRedactableHardBoundaryCategory("password")).toBe(false);
    for (const hit of detectHardBoundaryHits("[[LOCAL-ONLY]] payload")) {
      if (hit.category === "local_only_marker") {
        expect(hit.redactability).toBe("non_redactable");
      }
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
