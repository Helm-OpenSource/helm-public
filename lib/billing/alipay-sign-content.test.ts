import { describe, expect, it } from "vitest";

import { buildAlipaySignContent } from "@/lib/billing/alipay";

describe("buildAlipaySignContent", () => {
  it("orders keys by ASCII (code-unit), not locale", () => {
    // Alipay RSA2 signing is defined over ASCII-ordered keys. ASCII puts an
    // uppercase letter (A=65) before underscore (_=95); localeCompare reverses
    // them — which would produce a signature Alipay rejects.
    const content = buildAlipaySignContent({ a_: "1", aA: "2" });
    expect(content).toBe("aA=2&a_=1");
  });

  it("drops empty / null-ish values", () => {
    const content = buildAlipaySignContent({
      b: "2",
      a: "1",
      empty: "",
    });
    expect(content).toBe("a=1&b=2");
  });
});
