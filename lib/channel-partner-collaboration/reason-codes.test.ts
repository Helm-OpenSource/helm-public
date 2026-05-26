import { describe, expect, it } from "vitest";

import {
  CHANNEL_PARTNER_REASON_CODES,
  isKnownChannelPartnerReasonCode,
} from "./reason-codes";

describe("channel partner reason-code registry", () => {
  it("registry values are unique", () => {
    const values = Object.values(CHANNEL_PARTNER_REASON_CODES);
    expect(new Set(values).size).toBe(values.length);
  });

  it("isKnownChannelPartnerReasonCode accepts every registered value", () => {
    for (const value of Object.values(CHANNEL_PARTNER_REASON_CODES)) {
      expect(isKnownChannelPartnerReasonCode(value)).toBe(true);
    }
  });

  it("rejects strings not in the registry", () => {
    expect(isKnownChannelPartnerReasonCode("some_made_up_code")).toBe(false);
    expect(isKnownChannelPartnerReasonCode("")).toBe(false);
  });

  it("values are snake_case ASCII (no spaces, no upper, no unicode)", () => {
    for (const value of Object.values(CHANNEL_PARTNER_REASON_CODES)) {
      expect(value).toMatch(/^[a-z0-9_]+$/);
    }
  });
});
