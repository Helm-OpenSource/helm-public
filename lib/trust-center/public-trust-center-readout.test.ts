import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

import {
  PUBLIC_TRUST_CENTER_READOUT_RULE_VERSION,
  buildPublicTrustCenterReadout,
  type TrustCenterFixtureLike,
} from "./public-trust-center-readout";

const FIXTURE = JSON.parse(
  readFileSync(
    "docs/product/fixtures/ai-shelf-trust-center-contract.fixture.json",
    "utf8",
  ),
) as TrustCenterFixtureLike;

describe("buildPublicTrustCenterReadout", () => {
  it("builds a bilingual readout from the real committed fixture", () => {
    const zh = buildPublicTrustCenterReadout({ english: false, fixture: FIXTURE });
    const en = buildPublicTrustCenterReadout({ english: true, fixture: FIXTURE });

    expect(zh.ok && zh.ruleVersion).toBe(PUBLIC_TRUST_CENTER_READOUT_RULE_VERSION);
    if (zh.ok && en.ok) {
      expect(zh.sections.map((s) => s.key)).toEqual([
        "consent-and-notice",
        "retention-and-withdrawal",
        "audit",
        "certification-status",
      ]);
      expect(zh.sections.every((s) => s.evidenceRef.length > 0)).toBe(true);
      expect(zh.grayDeviceRedlines.length).toBe(8);
      expect(zh.grayDeviceRedlines).toContain("隐蔽录音设备");
      expect(en.grayDeviceRedlines).toContain("Covert recording devices");
      expect(zh.nonClaimNote).toContain("不是法律意见");
      expect(en.nonClaimNote).toContain("not legal advice");
    }
  });

  it("fails closed when any forbidden flag is true", () => {
    const result = buildPublicTrustCenterReadout({
      english: false,
      fixture: {
        ...FIXTURE,
        forbiddenFlags: { ...FIXTURE.forbiddenFlags, isReseller: true },
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toBe("TRUST_FIXTURE_UNSAFE");
      expect(result.offendingFlags).toEqual(["isReseller"]);
    }
  });

  it("fails closed when public safety contains-flags flip to true", () => {
    const result = buildPublicTrustCenterReadout({
      english: true,
      fixture: {
        ...FIXTURE,
        publicSafety: { ...FIXTURE.publicSafety, containsRealCustomer: true },
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.offendingFlags).toContain("containsRealCustomer");
    }
  });

  it("never renders unblocked redlines as blocked", () => {
    const result = buildPublicTrustCenterReadout({
      english: true,
      fixture: {
        ...FIXTURE,
        grayDeviceRedlines: {
          ...FIXTURE.grayDeviceRedlines,
          covertDevice: "allowed",
        },
      },
    });
    if (result.ok) {
      expect(result.grayDeviceRedlines).not.toContain(
        "Covert recording devices",
      );
      expect(result.grayDeviceRedlines.length).toBe(7);
    }
  });
});
