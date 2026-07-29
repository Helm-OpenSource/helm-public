import { describe, expect, it } from "vitest";

import type { CaioNegativeRule } from "@/lib/caio-context-broker/broker-contracts";
import {
  attemptRedaction,
  evaluateContextCandidate,
  type ContextCandidateInput,
  type ContextEligibility,
} from "@/lib/caio-context-broker/evaluation-pipeline";

const FULL_ELIGIBILITY: ContextEligibility = {
  identityAuthenticated: true,
  workspaceEligible: true,
  projectEligible: true,
  sourceIpAllowed: true,
  userCanAccessSource: true,
};

const CLEAN_CONTENT =
  "The quarterly review praised the smoother onboarding flow and asked the " +
  "delivery team to keep the same cadence for the next release train.";

function candidate(
  overrides: Partial<ContextCandidateInput> = {},
): ContextCandidateInput {
  return {
    workspaceId: "ws-1",
    requestingProject: "proj-a",
    source: {
      sourceProject: "proj-b",
      sourceRef: "doc:review-notes",
      classification: "internal",
    },
    content: CLEAN_CONTENT,
    eligibility: FULL_ELIGIBILITY,
    rules: [],
    policyVersion: "policy-v1",
    ...overrides,
  };
}

function publishedRule(
  overrides: Partial<CaioNegativeRule> = {},
): CaioNegativeRule {
  return {
    id: `rule:${overrides.ruleKey ?? "rk"}:${overrides.version ?? 1}`,
    workspaceId: "ws-1",
    ruleKey: "rk",
    scopeKind: "workspace",
    scopeRef: null,
    ruleKind: "deny",
    pattern: { sourceProject: "proj-b" },
    version: 1,
    status: "published",
    createdByRef: "user:a",
    publishedByRef: "user:owner",
    createdAt: "2026-07-29T00:00:00.000Z",
    publishedAt: "2026-07-29T00:01:00.000Z",
    revokedAt: null,
    ...overrides,
  };
}

describe("stage 1 — eligibility fails closed", () => {
  it.each([
    "identityAuthenticated",
    "workspaceEligible",
    "projectEligible",
    "sourceIpAllowed",
    "userCanAccessSource",
  ] as const)("denies when %s is false", (flag) => {
    const result = evaluateContextCandidate(
      candidate({
        eligibility: { ...FULL_ELIGIBILITY, [flag]: false },
      }),
    );
    expect(result.decision).toBe("DENY_EXTERNAL");
    expect(result.ruleHits).toEqual([`eligibility:${flag}`]);
  });

  it("denies when an eligibility flag is missing entirely", () => {
    const result = evaluateContextCandidate(
      candidate({
        eligibility: {
          ...FULL_ELIGIBILITY,
          sourceIpAllowed: undefined,
        } as unknown as ContextEligibility,
      }),
    );
    expect(result.decision).toBe("DENY_EXTERNAL");
    expect(result.ruleHits).toEqual(["eligibility:sourceIpAllowed"]);
  });

  it("eligibility denial short-circuits before content scanning", () => {
    const result = evaluateContextCandidate(
      candidate({
        content: "password=hunter2secret",
        eligibility: { ...FULL_ELIGIBILITY, identityAuthenticated: false },
      }),
    );
    expect(result.ruleHits).toEqual(["eligibility:identityAuthenticated"]);
  });
});

describe("stage 2 — built-in hard boundaries", () => {
  it("redacts a small inline secret and stays reliable", () => {
    const result = evaluateContextCandidate(
      candidate({
        content: `${CLEAN_CONTENT} Reach the pilot lead at pilot.lead@corp.example for details.`,
      }),
    );
    expect(result.decision).toBe("REDACT_AND_ALLOW");
    expect(result.redactionReliable).toBe(true);
    expect(result.redactedContent).toContain(
      "[REDACTED:unauthorized_identity_data]",
    );
    expect(result.redactedContent).not.toContain("pilot.lead@corp.example");
    expect(result.ruleHits).toContain(
      "hard_boundary:unauthorized_identity_data",
    );
  });

  it("denies when a multi-line private key spans structure", () => {
    const result = evaluateContextCandidate(
      candidate({
        content: `${CLEAN_CONTENT}\n-----BEGIN PRIVATE KEY-----\nMIIabc\n-----END PRIVATE KEY-----`,
      }),
    );
    expect(result.decision).toBe("DENY_EXTERNAL");
    expect(result.ruleHits).toContain("hard_boundary:private_key");
    expect(result.ruleHits).toContain("redaction:secret_spans_structure");
    expect(result.redactedContent).toBeUndefined();
  });

  it("denies when more than 30% of the content would be redacted", () => {
    const result = evaluateContextCandidate(
      candidate({ content: "token sk-abcdefghijklmnopqrstuvwx ok" }),
    );
    expect(result.decision).toBe("DENY_EXTERNAL");
    expect(result.ruleHits).toContain(
      "redaction:redaction_budget_exceeded",
    );
  });

  it("an allow-looking enterprise rule cannot override a hard-boundary hit", () => {
    const allowLooking = {
      ...publishedRule({ ruleKey: "look-allow" }),
      ruleKind: "allow",
    } as unknown as CaioNegativeRule;
    const result = evaluateContextCandidate(
      candidate({
        content: `${CLEAN_CONTENT} password=hunter2secret trailing note.`,
        rules: [allowLooking],
      }),
    );
    expect(result.decision).not.toBe("ALLOW");
    expect(result.ruleHits).toContain("hard_boundary:password");
  });
});

describe("redaction reliability re-scan", () => {
  it("flags a residual hit when a span only partially covers the secrets", () => {
    const content =
      "contact first.person@corp.example and second.person@corp.example today";
    const attempt = attemptRedaction(content, [
      { start: content.indexOf("first"), end: content.indexOf(" and"), label: "x" },
    ]);
    expect(attempt.reliable).toBe(false);
    expect(attempt.reasons).toContain("residual_hit_after_redaction");
    expect(attempt.redacted).toBeNull();
  });

  it("rejects invalid spans instead of guessing", () => {
    const attempt = attemptRedaction("short", [
      { start: 2, end: 99, label: "x" },
    ]);
    expect(attempt.reliable).toBe(false);
    expect(attempt.reasons).toContain("invalid_redaction_span");
  });
});

describe("stage 3 — enterprise negative rules", () => {
  it("applies a published deny rule with a version-pinned hit", () => {
    const result = evaluateContextCandidate(
      candidate({
        rules: [publishedRule({ ruleKey: "block-proj-b", version: 3 })],
      }),
    );
    expect(result.decision).toBe("DENY_EXTERNAL");
    expect(result.ruleHits).toEqual(["block-proj-b@v3"]);
  });

  it("ignores draft and revoked rules", () => {
    const result = evaluateContextCandidate(
      candidate({
        rules: [
          publishedRule({ ruleKey: "draft-rule", status: "draft" }),
          publishedRule({ ruleKey: "revoked-rule", status: "revoked" }),
        ],
      }),
    );
    expect(result.decision).toBe("ALLOW");
  });

  it("ignores rules from another workspace", () => {
    const result = evaluateContextCandidate(
      candidate({
        rules: [publishedRule({ workspaceId: "ws-other" })],
      }),
    );
    expect(result.decision).toBe("ALLOW");
  });

  it("redacts targeted rule matches reliably", () => {
    const result = evaluateContextCandidate(
      candidate({
        content: `${CLEAN_CONTENT} The launch codename-orion stays internal.`,
        rules: [
          publishedRule({
            ruleKey: "block-internal-names",
            ruleKind: "redact",
            pattern: { contentRegex: "codename-\\w+" },
          }),
        ],
      }),
    );
    expect(result.decision).toBe("REDACT_AND_ALLOW");
    expect(result.redactedContent).toContain(
      "[REDACTED:block-internal-names]",
    );
    expect(result.redactedContent).not.toContain("codename-orion");
    expect(result.ruleHits).toEqual(["block-internal-names@v1"]);
  });

  it("denies when a redact rule still matches the redacted output", () => {
    const result = evaluateContextCandidate(
      candidate({
        content: `${CLEAN_CONTENT} The marker REDACTED-PLANS stays internal.`,
        rules: [
          publishedRule({
            ruleKey: "self-matching",
            ruleKind: "redact",
            pattern: { contentRegex: "REDACTED\\S+" },
          }),
        ],
      }),
    );
    expect(result.decision).toBe("DENY_EXTERNAL");
    expect(result.ruleHits).toContain(
      "redaction:residual_hit_after_redaction",
    );
  });

  it("denies for a descriptor-only redact rule (nothing targeted to remove)", () => {
    const result = evaluateContextCandidate(
      candidate({
        rules: [
          publishedRule({
            ruleKey: "redact-all-proj-b",
            ruleKind: "redact",
            pattern: { sourceProject: "proj-b" },
          }),
        ],
      }),
    );
    expect(result.decision).toBe("DENY_EXTERNAL");
    expect(result.ruleHits).toContain(
      "redaction:rule_without_content_regex",
    );
  });

  it("only applies project-scoped rules to the involved projects", () => {
    const unrelatedProjectRule = publishedRule({
      ruleKey: "deny-proj-z",
      scopeKind: "project",
      scopeRef: "proj-z",
      pattern: { classification: "internal" },
    });
    expect(
      evaluateContextCandidate(candidate({ rules: [unrelatedProjectRule] }))
        .decision,
    ).toBe("ALLOW");
    const involvedProjectRule = publishedRule({
      ruleKey: "deny-proj-b",
      scopeKind: "project",
      scopeRef: "proj-b",
      pattern: { classification: "internal" },
    });
    expect(
      evaluateContextCandidate(candidate({ rules: [involvedProjectRule] }))
        .decision,
    ).toBe("DENY_EXTERNAL");
  });

  it("blocks cross-project flow under a no_cross_project_context rule", () => {
    const result = evaluateContextCandidate(
      candidate({
        rules: [
          publishedRule({
            ruleKey: "isolate-workspace",
            ruleKind: "no_cross_project_context",
            pattern: { sourceProject: "ignored" },
          }),
        ],
      }),
    );
    expect(result.decision).toBe("DENY_EXTERNAL");
    expect(result.ruleHits).toEqual(["isolate-workspace@v1"]);
  });
});

describe("stage 4 — default allow", () => {
  it("allows an eligible clean cross-project candidate", () => {
    const result = evaluateContextCandidate(candidate());
    expect(result.decision).toBe("ALLOW");
    expect(result.ruleHits).toEqual([]);
    expect(result.redactionReliable).toBe(true);
    expect(result.redactedContent).toBeUndefined();
  });
});
