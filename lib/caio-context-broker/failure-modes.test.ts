import { describe, expect, it } from "vitest";

import {
  CaioContextBrokerError,
  CONTEXT_ENRICHMENT_SKIPPED_MARKER,
} from "@/lib/caio-context-broker/broker-contracts";
import type {
  ContextCandidateInput,
  ContextEligibility,
} from "@/lib/caio-context-broker/evaluation-pipeline";
import {
  COMBINED_RELEASE_DENIED_REASON,
  enrichContextWithFailureSemantics,
  type StoredContextCandidate,
} from "@/lib/caio-context-broker/failure-modes";

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

function input(
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

function stored(candidateId: string): StoredContextCandidate {
  return { candidateId, input: input() };
}

describe("retrieval failure semantics", () => {
  it("attaches no stored content and marks the request when retrieval throws", async () => {
    const outcome = await enrichContextWithFailureSemantics({
      retrieveStoredContext: async () => {
        throw new Error("store down");
      },
      userSubmitted: [{ itemId: "u1", input: input() }],
    });
    expect(outcome.continuation).toBe("proceed");
    expect(outcome.marker).toBe(CONTEXT_ENRICHMENT_SKIPPED_MARKER);
    expect(outcome.attachedStoredContext).toEqual([]);
    expect(outcome.userSubmitted).toHaveLength(1);
    expect(outcome.userSubmitted[0]!.result.decision).toBe("ALLOW");
  });

  it("attaches no stored content and marks the request when retrieval times out", async () => {
    const outcome = await enrichContextWithFailureSemantics({
      retrieveStoredContext: () => new Promise(() => {}),
      retrievalTimeoutMs: 20,
      userSubmitted: [{ itemId: "u1", input: input() }],
    });
    expect(outcome.marker).toBe(CONTEXT_ENRICHMENT_SKIPPED_MARKER);
    expect(outcome.attachedStoredContext).toEqual([]);
    expect(outcome.userSubmitted).toHaveLength(1);
  });

  it("attaches evaluated stored context on the healthy path without a marker", async () => {
    const outcome = await enrichContextWithFailureSemantics({
      retrieveStoredContext: async () => [stored("s1")],
      userSubmitted: [],
    });
    expect(outcome.marker).toBeNull();
    expect(outcome.attachedStoredContext).toHaveLength(1);
    expect(outcome.attachedStoredContext[0]!.candidateId).toBe("s1");
    expect(outcome.attachedStoredContext[0]!.releasableContent).toBe(
      CLEAN_CONTENT,
    );
  });

  it("never attaches stored context that is denied", async () => {
    const denied: StoredContextCandidate = {
      candidateId: "s-denied",
      input: input({
        eligibility: { ...FULL_ELIGIBILITY, userCanAccessSource: false },
      }),
    };
    const outcome = await enrichContextWithFailureSemantics({
      retrieveStoredContext: async () => [denied, stored("s-ok")],
      userSubmitted: [],
    });
    expect(
      outcome.attachedStoredContext.map((item) => item.candidateId),
    ).toEqual(["s-ok"]);
  });
});

describe("user-submitted inputs always run the full pipeline", () => {
  it("continues with redacted user content on a reliable REDACT_AND_ALLOW", async () => {
    const outcome = await enrichContextWithFailureSemantics({
      retrieveStoredContext: async () => [],
      userSubmitted: [
        {
          itemId: "u1",
          input: input({
            content: `${CLEAN_CONTENT} Reach the pilot lead at pilot.lead@corp.example for details.`,
          }),
        },
      ],
    });
    expect(outcome.userSubmitted[0]!.result.decision).toBe("REDACT_AND_ALLOW");
    expect(outcome.userSubmitted[0]!.releasableContent).not.toContain(
      "pilot.lead@corp.example",
    );
  });

  it("fails closed with a 422 typed error on DENY_EXTERNAL", async () => {
    const attempt = enrichContextWithFailureSemantics({
      retrieveStoredContext: async () => [],
      userSubmitted: [
        {
          itemId: "u1",
          input: input({
            content: `${CLEAN_CONTENT}\n-----BEGIN PRIVATE KEY-----\nMIIabc\n-----END PRIVATE KEY-----`,
          }),
        },
      ],
    });
    await expect(attempt).rejects.toMatchObject({
      name: "CaioContextBrokerError",
      code: "caio_external_release_denied",
      httpStatus: 422,
    });
  });

  it("fails closed with a 422 typed error when the check itself is unavailable", async () => {
    const attempt = enrichContextWithFailureSemantics({
      retrieveStoredContext: async () => [],
      userSubmitted: [{ itemId: "u1", input: input() }],
      dependencies: {
        evaluate: () => {
          throw new Error("scanner offline");
        },
      },
    });
    await expect(attempt).rejects.toBeInstanceOf(CaioContextBrokerError);
    await expect(attempt).rejects.toMatchObject({
      code: "caio_external_release_denied",
      httpStatus: 422,
    });
  });

  it("denies user inputs even while stored retrieval is already failing", async () => {
    const attempt = enrichContextWithFailureSemantics({
      retrieveStoredContext: async () => {
        throw new Error("store down");
      },
      userSubmitted: [
        {
          itemId: "u1",
          input: input({
            eligibility: { ...FULL_ELIGIBILITY, sourceIpAllowed: false },
          }),
        },
      ],
    });
    await expect(attempt).rejects.toMatchObject({
      code: "caio_external_release_denied",
    });
  });

  it("drops a stored candidate and marks the request when its check throws", async () => {
    let calls = 0;
    const outcome = await enrichContextWithFailureSemantics({
      retrieveStoredContext: async () => [stored("s1")],
      userSubmitted: [],
      dependencies: {
        evaluate: () => {
          calls += 1;
          throw new Error("scanner offline");
        },
      },
    });
    expect(calls).toBe(1);
    expect(outcome.attachedStoredContext).toEqual([]);
    expect(outcome.marker).toBe(CONTEXT_ENRICHMENT_SKIPPED_MARKER);
  });
});

// ---------------------------------------------------------------------------
// F6 — a secret split across candidates must not be released piecewise
// ---------------------------------------------------------------------------

describe("F6 — combined release re-scan across candidates", () => {
  // A PEM key split so that neither half trips a detector on its own.
  const PEM_HEAD = "runbook excerpt: -----BEGIN RSA PRIVATE KEY";
  const PEM_BODY =
    "-----\nMIIBOgIBAAJBAKsplitacrosstwocandidates\n-----END RSA PRIVATE KEY-----";

  it("releases each half on its own (the per-candidate blind spot)", async () => {
    for (const half of [PEM_HEAD, PEM_BODY]) {
      const outcome = await enrichContextWithFailureSemantics({
        retrieveStoredContext: async () => [
          { candidateId: "s1", input: input({ content: half }) },
        ],
        userSubmitted: [],
      });
      expect(outcome.attachedStoredContext).toHaveLength(1);
      expect(outcome.attachedStoredContext[0]!.result.decision).toBe("ALLOW");
    }
  });

  it("denies the whole stored release set when the concatenation trips a hard boundary", async () => {
    const outcome = await enrichContextWithFailureSemantics({
      retrieveStoredContext: async () => [
        { candidateId: "s1", input: input({ content: PEM_HEAD }) },
        { candidateId: "s2", input: input({ content: PEM_BODY }) },
      ],
      userSubmitted: [],
    });
    expect(outcome.attachedStoredContext).toEqual([]);
    expect(outcome.marker).toBe(CONTEXT_ENRICHMENT_SKIPPED_MARKER);
    expect(outcome.combinedReleaseDenialReasons).toContain(
      `${COMBINED_RELEASE_DENIED_REASON}:private_key`,
    );
    expect(JSON.stringify(outcome)).not.toContain(
      "MIIBOgIBAAJBAKsplitacrosstwocandidates",
    );
  });

  it("fails closed with a 422 when user-submitted items combine into a hit", async () => {
    const attempt = enrichContextWithFailureSemantics({
      retrieveStoredContext: async () => [],
      userSubmitted: [
        { itemId: "u1", input: input({ content: PEM_HEAD }) },
        { itemId: "u2", input: input({ content: PEM_BODY }) },
      ],
    });
    await expect(attempt).rejects.toMatchObject({
      name: "CaioContextBrokerError",
      code: "caio_external_release_denied",
      httpStatus: 422,
    });
  });

  it("fails closed when a user item combines with stored context", async () => {
    const attempt = enrichContextWithFailureSemantics({
      retrieveStoredContext: async () => [
        { candidateId: "s1", input: input({ content: PEM_BODY }) },
      ],
      userSubmitted: [{ itemId: "u1", input: input({ content: PEM_HEAD }) }],
    });
    await expect(attempt).rejects.toMatchObject({
      code: "caio_external_release_denied",
    });
  });

  it("leaves a clean release set untouched", async () => {
    const outcome = await enrichContextWithFailureSemantics({
      retrieveStoredContext: async () => [stored("s1"), stored("s2")],
      userSubmitted: [{ itemId: "u1", input: input() }],
    });
    expect(outcome.attachedStoredContext).toHaveLength(2);
    expect(outcome.marker).toBeNull();
    expect(outcome.combinedReleaseDenialReasons).toEqual([]);
  });
});

