import { describe, expect, it } from "vitest";
import {
  MaxTokensExceededError,
  SANITY_CEILING_MULTIPLIER,
  applyMaxOutputTokensPolicy,
  resolveDefaultMaxOutputTokens,
  resolveSanityCeiling,
} from "@/lib/llm/max-tokens-policy";

describe("max-tokens-policy · resolveDefaultMaxOutputTokens", () => {
  it("returns per-task default for briefing", () => {
    expect(resolveDefaultMaxOutputTokens("CONTACT_BRIEFING")).toBe(1024);
  });

  it("returns per-task default for BI report review (highest task)", () => {
    expect(resolveDefaultMaxOutputTokens("BI_REPORT_REVIEW")).toBe(8192);
  });

  it("returns per-task default for memory extraction", () => {
    expect(resolveDefaultMaxOutputTokens("MEETING_MEMORY_EXTRACTION")).toBe(2048);
  });
});

describe("max-tokens-policy · resolveSanityCeiling", () => {
  it("returns 2x default for any task", () => {
    for (const task of ["CONTACT_BRIEFING", "BI_REPORT_REVIEW", "MEETING_MEMORY_EXTRACTION"] as const) {
      expect(resolveSanityCeiling(task)).toBe(
        resolveDefaultMaxOutputTokens(task) * SANITY_CEILING_MULTIPLIER,
      );
    }
  });
});

describe("max-tokens-policy · applyMaxOutputTokensPolicy", () => {
  it("returns per-task default when no override", () => {
    expect(
      applyMaxOutputTokensPolicy({ taskType: "CONTACT_BRIEFING" }),
    ).toBe(1024);
  });

  it("returns per-task default when override is null/undefined/zero", () => {
    expect(
      applyMaxOutputTokensPolicy({ taskType: "MEETING_BRIEFING", requestedMaxOutputTokens: 0 }),
    ).toBe(1024);
    expect(
      applyMaxOutputTokensPolicy({ taskType: "MEETING_BRIEFING", requestedMaxOutputTokens: undefined }),
    ).toBe(1024);
  });

  it("returns override when override is within ceiling", () => {
    expect(
      applyMaxOutputTokensPolicy({ taskType: "CONTACT_BRIEFING", requestedMaxOutputTokens: 1500 }),
    ).toBe(1500);
  });

  it("returns override at the ceiling boundary", () => {
    const ceiling = resolveSanityCeiling("CONTACT_BRIEFING"); // 2048
    expect(
      applyMaxOutputTokensPolicy({ taskType: "CONTACT_BRIEFING", requestedMaxOutputTokens: ceiling }),
    ).toBe(ceiling);
  });

  it("throws MaxTokensExceededError when override is above ceiling", () => {
    expect(() =>
      applyMaxOutputTokensPolicy({ taskType: "CONTACT_BRIEFING", requestedMaxOutputTokens: 99999 }),
    ).toThrow(MaxTokensExceededError);
  });

  it("MaxTokensExceededError carries taskType + requested + ceiling", () => {
    try {
      applyMaxOutputTokensPolicy({
        taskType: "MEETING_BRIEFING",
        requestedMaxOutputTokens: 5000,
      });
      expect.fail("Expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(MaxTokensExceededError);
      const e = err as MaxTokensExceededError;
      expect(e.taskType).toBe("MEETING_BRIEFING");
      expect(e.requested).toBe(5000);
      expect(e.ceiling).toBe(2048);
      expect(e.statusCode).toBe(422);
    }
  });

  it("floors non-integer override", () => {
    expect(
      applyMaxOutputTokensPolicy({ taskType: "CONTACT_BRIEFING", requestedMaxOutputTokens: 1500.7 }),
    ).toBe(1500);
  });
});
