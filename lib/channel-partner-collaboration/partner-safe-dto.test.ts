import { describe, expect, it } from "vitest";

import {
  assertPartnerSafeRecommendationDto,
  containsForbiddenRawField,
} from "./partner-safe-dto";
import type { PartnerSafeRecommendationDTO } from "./types";

const SAFE_DTO: PartnerSafeRecommendationDTO = {
  recommendationAlias: "alias-rec-1",
  judgementCategory: "renewal_risk",
  reasonCode: "missing_check_in_two_weeks",
  status: "open",
  reviewPosture: "review_required",
};

describe("partner safe DTO black-list validator", () => {
  it("accepts a clean DTO", () => {
    expect(containsForbiddenRawField(SAFE_DTO)).toEqual({ ok: true });
    expect(() => assertPartnerSafeRecommendationDto(SAFE_DTO)).not.toThrow();
  });

  it("rejects when a top-level forbidden field leaks", () => {
    const dirty = { ...SAFE_DTO, signalSummary: "raw text from signal" };
    const r = containsForbiddenRawField(dirty);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.offendingField).toBe("signalSummary");
  });

  it("rejects when a nested forbidden field leaks", () => {
    const dirty = {
      ...SAFE_DTO,
      meta: { nested: { askHelmAnswer: "leaked answer text" } },
    };
    const r = containsForbiddenRawField(dirty);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.offendingField).toBe("askHelmAnswer");
  });

  it("rejects when forbidden field appears in array element", () => {
    const dirty = {
      ...SAFE_DTO,
      items: [{ ok: 1 }, { normalizedPayload: "leak" }],
    };
    const r = containsForbiddenRawField(dirty);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.offendingField).toBe("normalizedPayload");
  });

  it("internalSalesNotes triggers", () => {
    const dirty = { ...SAFE_DTO, internalSalesNotes: "anything" };
    const r = containsForbiddenRawField(dirty);
    expect(r.ok).toBe(false);
  });

  it("auditPayload triggers", () => {
    const dirty = { ...SAFE_DTO, auditPayload: {} };
    const r = containsForbiddenRawField(dirty);
    expect(r.ok).toBe(false);
  });

  it("assert helper throws with parsable message", () => {
    const dirty = { ...SAFE_DTO, inputSummary: "leak" } as PartnerSafeRecommendationDTO &
      Record<string, unknown>;
    expect(() =>
      assertPartnerSafeRecommendationDto(dirty as PartnerSafeRecommendationDTO),
    ).toThrow(/partner_safe_dto_only:forbidden_field=inputSummary/);
  });
});
