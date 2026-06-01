import { describe, expect, it } from "vitest";
import {
  BusinessAdvancementInvariantViolationError,
  assertCommitmentOverdueFlagIsCandidateOnly,
  assertNoOfficialWriteIntent,
  assertRankingSourceIsDeterministic,
  assertSingleWorkspaceScope,
  assertTpqrIdInScope,
} from "@/lib/business-advancement/invariant-guards";

describe("business-advancement / invariant-guards", () => {
  it("blocks writes to Commitment.overdueFlag", () => {
    expect(() => assertCommitmentOverdueFlagIsCandidateOnly({})).not.toThrow();
    expect(() =>
      assertCommitmentOverdueFlagIsCandidateOnly({ overdueFlag: true }),
    ).toThrowError(BusinessAdvancementInvariantViolationError);
  });

  it("only allows the deterministic ranking source allow-list", () => {
    expect(() =>
      assertRankingSourceIsDeterministic("deterministic_thin_read_model"),
    ).not.toThrow();
    expect(() =>
      assertRankingSourceIsDeterministic("deterministic_thin_read_model_with_calibration"),
    ).not.toThrow();
    expect(() => assertRankingSourceIsDeterministic("llm_final_ranking"))
      .toThrowError(BusinessAdvancementInvariantViolationError);
  });

  it("rejects cross-workspace observation", () => {
    expect(() =>
      assertSingleWorkspaceScope({
        requestedWorkspaceId: "ws-1",
        observedWorkspaceIds: ["ws-1"],
      }),
    ).not.toThrow();
    expect(() =>
      assertSingleWorkspaceScope({
        requestedWorkspaceId: "ws-1",
        observedWorkspaceIds: ["ws-1", "ws-2"],
      }),
    ).toThrowError(BusinessAdvancementInvariantViolationError);
  });

  it("only accepts in-scope TPQR ids", () => {
    expect(() => assertTpqrIdInScope("TPQR-001")).not.toThrow();
    expect(() => assertTpqrIdInScope("TPQR-003")).not.toThrow();
    expect(() => assertTpqrIdInScope("TPQR-004")).not.toThrow();
    expect(() => assertTpqrIdInScope("TPQR-002"))
      .toThrowError(BusinessAdvancementInvariantViolationError);
    expect(() => assertTpqrIdInScope("TPQR-005"))
      .toThrowError(BusinessAdvancementInvariantViolationError);
  });

  it("rejects payloads carrying official-write intent keys", () => {
    expect(() => assertNoOfficialWriteIntent({})).not.toThrow();
    expect(() => assertNoOfficialWriteIntent({ candidate: true })).not.toThrow();
    for (const forbidden of [
      "officialWrite",
      "execute",
      "autoCommit",
      "autoApprove",
      "autoSend",
      "scheduleSend",
      "promoteToCommitment",
      "writeAcrossWorkspace",
    ]) {
      expect(() => assertNoOfficialWriteIntent({ [forbidden]: true }))
        .toThrowError(BusinessAdvancementInvariantViolationError);
    }
  });
});
