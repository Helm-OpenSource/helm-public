import { describe, expect, it } from "vitest";

import { normalizeName, normalizeDomain } from "@/lib/imports/crm-types";

describe("normalizeName", () => {
  it("canonicalizes full-width characters so they match their plain forms", () => {
    // Real data is routinely entered full-width; these must dedup together.
    expect(normalizeName("ＡＢＣ公司")).toBe(normalizeName("ABC公司"));
    expect(normalizeName("ＡＢＣ公司")).toBe("abc公司");
  });

  it("trims, collapses whitespace, and lowercases", () => {
    expect(normalizeName("  Acme   Robotics ")).toBe("acme robotics");
  });

  it("handles null/undefined", () => {
    expect(normalizeName(null)).toBe("");
    expect(normalizeName(undefined)).toBe("");
  });
});

describe("normalizeDomain", () => {
  it("strips scheme / www / path", () => {
    expect(normalizeDomain("https://www.acme.io/contact")).toBe("acme.io");
  });
});
