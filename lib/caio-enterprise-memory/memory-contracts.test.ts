import { describe, expect, it } from "vitest";

import {
  CAIO_MEMORY_STATES,
  CANDIDATE_TTL_MS,
  CaioMemoryError,
  EPHEMERAL_TTL_MS,
  LEGAL_MEMORY_TRANSITIONS,
  assertLegalMemoryTransition,
  memoryCandidateCreateSchema,
  type CaioMemoryState,
} from "@/lib/caio-enterprise-memory/memory-contracts";

const LEGAL_PAIRS: ReadonlyArray<[CaioMemoryState, CaioMemoryState]> = [
  ["candidate", "ephemeral"],
  ["candidate", "rejected"],
  ["candidate", "expired"],
  ["ephemeral", "verified"],
  ["ephemeral", "expired"],
];

describe("memory transition table", () => {
  it("declares TTLs of 7 days for candidates and 90 days for ephemerals", () => {
    expect(CANDIDATE_TTL_MS).toBe(7 * 24 * 60 * 60 * 1_000);
    expect(EPHEMERAL_TTL_MS).toBe(90 * 24 * 60 * 60 * 1_000);
  });

  it("allows exactly the five legal transitions", () => {
    for (const from of CAIO_MEMORY_STATES) {
      for (const to of CAIO_MEMORY_STATES) {
        const legal = LEGAL_PAIRS.some(
          ([legalFrom, legalTo]) => legalFrom === from && legalTo === to,
        );
        if (legal) {
          expect(() => assertLegalMemoryTransition(from, to)).not.toThrow();
        } else {
          expect(() => assertLegalMemoryTransition(from, to)).toThrow(
            CaioMemoryError,
          );
        }
      }
    }
  });

  it("throws the typed illegal_transition error", () => {
    try {
      assertLegalMemoryTransition("verified", "candidate");
      expect.unreachable("verified is terminal");
    } catch (error) {
      expect(error).toBeInstanceOf(CaioMemoryError);
      expect((error as CaioMemoryError).code).toBe("illegal_transition");
    }
  });

  it("marks verified, rejected, and expired as terminal", () => {
    expect(LEGAL_MEMORY_TRANSITIONS.verified).toEqual([]);
    expect(LEGAL_MEMORY_TRANSITIONS.rejected).toEqual([]);
    expect(LEGAL_MEMORY_TRANSITIONS.expired).toEqual([]);
  });
});

describe("candidate creation contract", () => {
  const base = {
    workspaceId: "ws-1",
    createdByRef: "user:a",
    body: "Adopted playbook step for renewals.",
  };

  it("accepts a minimal creation input", () => {
    expect(() => memoryCandidateCreateSchema.parse(base)).not.toThrow();
  });

  it("refuses any attempt to choose an initial state", () => {
    expect(() =>
      memoryCandidateCreateSchema.parse({ ...base, state: "verified" }),
    ).toThrow();
    expect(() =>
      memoryCandidateCreateSchema.parse({ ...base, state: "candidate" }),
    ).toThrow();
  });

  it("refuses empty bodies", () => {
    expect(() =>
      memoryCandidateCreateSchema.parse({ ...base, body: "" }),
    ).toThrow();
  });
});
