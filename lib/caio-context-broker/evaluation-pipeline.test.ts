import { describe, expect, it } from "vitest";

import {
  LOCAL_ONLY_FLAG_UNRESOLVED_DENY_REASON,
  LOCAL_ONLY_SOURCE_DENY_REASON,
  type CaioNegativeRule,
} from "@/lib/caio-context-broker/broker-contracts";
import {
  attemptRedaction,
  evaluateContextCandidate,
  type ContextCandidateInput,
  type ContextEligibility,
} from "@/lib/caio-context-broker/evaluation-pipeline";
import { enrichContextWithFailureSemantics } from "@/lib/caio-context-broker/failure-modes";

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
      localOnly: false,
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

describe("stage 2a — structural localOnly exclusion", () => {
  it("denies a localOnly source whose content is entirely clean", () => {
    // Before this stage existed the same candidate returned ALLOW: the flag was
    // carried on the descriptor and never read.
    const result = evaluateContextCandidate(
      candidate({
        source: {
          sourceProject: "proj-b",
          sourceRef: "readout:proj-b/acceptance-settlement",
          classification: "confidential",
          localOnly: true,
        },
      }),
    );
    expect(result.decision).toBe("DENY_EXTERNAL");
    expect(result.redactionReliable).toBe(false);
    expect(result.ruleHits).toContain(LOCAL_ONLY_SOURCE_DENY_REASON);
  });

  it("fails closed when the localOnly marking is unresolved", () => {
    const withoutFlag = {
      sourceProject: "proj-b",
      sourceRef: "doc:review-notes",
      classification: "internal",
    } as unknown as ContextCandidateInput["source"];
    const result = evaluateContextCandidate(
      candidate({ source: withoutFlag }),
    );
    expect(result.decision).toBe("DENY_EXTERNAL");
    expect(result.ruleHits).toContain(LOCAL_ONLY_FLAG_UNRESOLVED_DENY_REASON);
  });

  it("cannot be bypassed by full eligibility, clean content, or zero rules", () => {
    const result = evaluateContextCandidate(
      candidate({
        source: {
          sourceProject: "proj-b",
          sourceRef: "doc:local-note",
          classification: "public",
          localOnly: true,
        },
        content: "Nothing sensitive here at all.",
        eligibility: FULL_ELIGIBILITY,
        rules: [],
      }),
    );
    expect(result.decision).toBe("DENY_EXTERNAL");
    expect(result.ruleHits).toEqual([LOCAL_ONLY_SOURCE_DENY_REASON]);
  });

  it("only ever makes the outcome more restrictive and reports every stage", () => {
    // A localOnly source that would otherwise be REDACT_AND_ALLOW must become
    // DENY_EXTERNAL, and the content + enterprise hits stay in the report so
    // the structural exclusion is not an escape hatch out of policy.
    const result = evaluateContextCandidate(
      candidate({
        source: {
          sourceProject: "proj-b",
          sourceRef: "doc:review-notes",
          classification: "internal",
          localOnly: true,
        },
        content: `${CLEAN_CONTENT} Reach the pilot lead at pilot.lead@corp.example for details.`,
        rules: [publishedRule({ ruleKey: "deny-vendor" })],
      }),
    );
    expect(result.decision).toBe("DENY_EXTERNAL");
    expect(result.ruleHits[0]).toBe(LOCAL_ONLY_SOURCE_DENY_REASON);
    expect(result.ruleHits).toContain(
      "hard_boundary:unauthorized_identity_data",
    );
    expect(result.ruleHits).toContain("deny-vendor@v1");
  });

  it("keeps a localOnly source out of every external release set", async () => {
    // End-to-end through the failure-mode layer: a stored localOnly candidate
    // is excluded from the attached set instead of released.
    const outcome = await enrichContextWithFailureSemantics({
      retrieveStoredContext: async () => [
        {
          candidateId: "local-only",
          input: candidate({
            source: {
              sourceProject: "proj-b",
              sourceRef: "readout:proj-b/local-only",
              classification: "confidential",
              localOnly: true,
            },
          }),
        },
        { candidateId: "releasable", input: candidate() },
      ],
      userSubmitted: [],
    });
    expect(outcome.attachedStoredContext.map((item) => item.candidateId)).toEqual(
      ["releasable"],
    );
  });

  it("denies the request when a user-submitted item is localOnly", async () => {
    await expect(
      enrichContextWithFailureSemantics({
        retrieveStoredContext: async () => [],
        userSubmitted: [
          {
            itemId: "item-1",
            input: candidate({
              source: {
                sourceProject: "proj-b",
                sourceRef: "doc:local-only",
                classification: "internal",
                localOnly: true,
              },
            }),
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "caio_external_release_denied" });
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

// ---------------------------------------------------------------------------
// Adversarial review regressions (F1-F4)
// ---------------------------------------------------------------------------

const FILLER =
  "The delivery team documented the onboarding walkthrough, the release " +
  "cadence, the review rota, and the escalation ladder so that every " +
  "reviewer can follow the same checklist without asking for context in " +
  "the channel again and again during the quarter. ";

const REDACTABLE_SECRET = "pilot.lead@corp.example";
const KEYWORD_SECRET_LINE = "vault password: correct horse battery staple";

describe("F1 — no stage may skip a later stage", () => {
  const denyEverything = publishedRule({
    ruleKey: "deny-everything",
    ruleKind: "deny",
    pattern: { contentRegex: "[\\s\\S]*" },
  });
  const isolateWorkspace = publishedRule({
    ruleKey: "isolate-workspace",
    ruleKind: "no_cross_project_context",
    pattern: { sourceProject: "ignored" },
  });
  const isolateSourceProject = publishedRule({
    ruleKey: "isolate-proj-b",
    ruleKind: "no_cross_project_context",
    scopeKind: "project",
    scopeRef: "proj-b",
    pattern: { sourceProject: "ignored" },
  });

  const SECRET_BEARING = `${CLEAN_CONTENT} Reach the pilot lead at ${REDACTABLE_SECRET} for details.`;

  const MATRIX: ReadonlyArray<{
    label: string;
    rule: CaioNegativeRule;
    content: string;
    expectedRef: string;
  }> = [
    {
      label: "deny rule + clean content",
      rule: denyEverything,
      content: CLEAN_CONTENT,
      expectedRef: "deny-everything@v1",
    },
    {
      label: "deny rule + secret-bearing content",
      rule: denyEverything,
      content: SECRET_BEARING,
      expectedRef: "deny-everything@v1",
    },
    {
      label: "workspace no_cross_project_context + clean content",
      rule: isolateWorkspace,
      content: CLEAN_CONTENT,
      expectedRef: "isolate-workspace@v1",
    },
    {
      label: "workspace no_cross_project_context + secret-bearing content",
      rule: isolateWorkspace,
      content: SECRET_BEARING,
      expectedRef: "isolate-workspace@v1",
    },
    {
      label: "project no_cross_project_context + secret-bearing content",
      rule: isolateSourceProject,
      content: SECRET_BEARING,
      expectedRef: "isolate-proj-b@v1",
    },
    {
      label: "project no_cross_project_context + password content",
      rule: isolateSourceProject,
      content: `${CLEAN_CONTENT} password=hunter2secret`,
      expectedRef: "isolate-proj-b@v1",
    },
  ];

  it.each(MATRIX)("denies for $label", ({ rule, content, expectedRef }) => {
    const result = evaluateContextCandidate(
      candidate({ content, rules: [rule] }),
    );
    expect(result.decision).toBe("DENY_EXTERNAL");
    expect(result.ruleHits).toContain(expectedRef);
    expect(result.redactedContent).toBeUndefined();
  });

  it("a hard-boundary hit can only make the outcome more restrictive", () => {
    // Without any rule the same content is a reliable REDACT_AND_ALLOW; the
    // rule must not be skipped just because the content also trips a
    // redactable built-in detector.
    expect(
      evaluateContextCandidate(candidate({ content: SECRET_BEARING })).decision,
    ).toBe("REDACT_AND_ALLOW");
    const withRule = evaluateContextCandidate(
      candidate({ content: SECRET_BEARING, rules: [denyEverything] }),
    );
    expect(withRule.decision).toBe("DENY_EXTERNAL");
    expect(withRule.ruleHits).toContain(
      "hard_boundary:unauthorized_identity_data",
    );
    expect(withRule.ruleHits).toContain("deny-everything@v1");
  });

  it("reports hard-boundary hits before enterprise rule hits", () => {
    const result = evaluateContextCandidate(
      candidate({ content: SECRET_BEARING, rules: [denyEverything] }),
    );
    expect(
      result.ruleHits.indexOf("hard_boundary:unauthorized_identity_data"),
    ).toBeLessThan(result.ruleHits.indexOf("deny-everything@v1"));
  });
});

describe("F2 — marker categories are never redacted away", () => {
  const PAYLOAD =
    "the fallback root credential lives in the ops safe on floor three";

  it.each([
    ["LOCAL-ONLY", `LOCAL-ONLY ${PAYLOAD}`],
    ["[[LOCAL-ONLY]]", `[[LOCAL-ONLY]] ${PAYLOAD}`],
    ["INTERNAL USE ONLY", `INTERNAL USE ONLY ${PAYLOAD}`],
    ["DO NOT DISTRIBUTE", `DO NOT DISTRIBUTE ${PAYLOAD}`],
  ])("denies %s unconditionally and releases no payload", (_label, content) => {
    const padded = `${FILLER}${content}`;
    const result = evaluateContextCandidate(candidate({ content: padded }));
    expect(result.decision).toBe("DENY_EXTERNAL");
    expect(result.redactedContent).toBeUndefined();
    expect(result.redactionReliable).toBe(false);
    expect(JSON.stringify(result)).not.toContain(PAYLOAD);
    expect(
      result.ruleHits.some((hit) =>
        hit.startsWith("redaction:non_redactable_category:"),
      ),
    ).toBe(true);
  });
});

describe("F3 — no partial-span redaction of an unbounded secret", () => {
  it("never releases the tail of a keyword-introduced secret", () => {
    const result = evaluateContextCandidate(
      candidate({ content: `${FILLER}${KEYWORD_SECRET_LINE}` }),
    );
    expect(result.decision).toBe("DENY_EXTERNAL");
    expect(result.redactedContent).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain("horse battery staple");
    expect(result.ruleHits).toContain("hard_boundary:password");
  });

  it("denies when an enterprise redact match is a strict prefix of a longer token", () => {
    const result = evaluateContextCandidate(
      candidate({
        content: `${CLEAN_CONTENT} account CUST-1234-SECRET-9999 renewed.`,
        rules: [
          publishedRule({
            ruleKey: "mask-cust",
            ruleKind: "redact",
            pattern: { contentRegex: "CUST-\\d{4}" },
          }),
        ],
      }),
    );
    expect(result.decision).toBe("DENY_EXTERNAL");
    expect(result.redactedContent).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain("SECRET-9999");
    expect(result.ruleHits).toContain(
      "redaction:rule_match_not_token_bounded",
    );
  });

  it("denies when a built-in hit continues into adjacent non-whitespace text", () => {
    const result = evaluateContextCandidate(
      candidate({
        content: `${CLEAN_CONTENT} profile at ${REDACTABLE_SECRET}/private-notes today.`,
      }),
    );
    expect(result.decision).toBe("DENY_EXTERNAL");
    expect(
      result.ruleHits.some((hit) =>
        hit.startsWith("redaction:secret_extent_not_token_bounded:"),
      ),
    ).toBe(true);
    expect(JSON.stringify(result)).not.toContain("private-notes");
  });

  it("still redacts a token-bounded enterprise match", () => {
    const result = evaluateContextCandidate(
      candidate({
        content: `${CLEAN_CONTENT} account CUST-1234 renewed.`,
        rules: [
          publishedRule({
            ruleKey: "mask-cust",
            ruleKind: "redact",
            pattern: { contentRegex: "CUST-\\d{4}" },
          }),
        ],
      }),
    );
    expect(result.decision).toBe("REDACT_AND_ALLOW");
    expect(result.redactedContent).toContain("[REDACTED:mask-cust]");
  });
});

describe("F4 — reliability does not depend on caller-controlled length", () => {
  it("decides the same for a secret line alone and padded with filler", () => {
    const alone = evaluateContextCandidate(
      candidate({ content: KEYWORD_SECRET_LINE }),
    );
    const padded = evaluateContextCandidate(
      candidate({
        content: `${FILLER}${FILLER}${KEYWORD_SECRET_LINE}`,
      }),
    );
    expect(padded.decision).toBe(alone.decision);
    expect(alone.decision).toBe("DENY_EXTERNAL");
    expect(padded.decision).toBe("DENY_EXTERNAL");
    expect(JSON.stringify(padded)).not.toContain("horse battery staple");
  });

  it("denies when many distinct hard-boundary hits appear, however long the content", () => {
    const many = [
      "a@corp.example",
      "b@corp.example",
      "c@corp.example",
      "d@corp.example",
      "e@corp.example",
    ].join(" and ");
    const result = evaluateContextCandidate(
      candidate({ content: `${FILLER}${FILLER}${FILLER}contacts: ${many}` }),
    );
    expect(result.decision).toBe("DENY_EXTERNAL");
    expect(result.ruleHits).toContain(
      "redaction:too_many_hard_boundary_hits",
    );
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
