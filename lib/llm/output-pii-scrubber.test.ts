import { describe, expect, it } from "vitest";
import { detectPIIInOutput } from "@/lib/llm/output-pii-scrubber";

describe("output-pii-scrubber · empty / clean text", () => {
  it("returns no hits for empty string", () => {
    const r = detectPIIInOutput("");
    expect(r.detected).toBe(false);
    expect(r.hits).toHaveLength(0);
  });

  it("returns no hits for clean ASCII text", () => {
    const r = detectPIIInOutput("This is a meeting brief. Customer asked about pricing.");
    expect(r.detected).toBe(false);
  });

  it("returns no hits for clean Chinese text", () => {
    const r = detectPIIInOutput("张三先生表示希望了解价格政策，建议下周复核。");
    expect(r.detected).toBe(false);
  });
});

describe("output-pii-scrubber · Chinese mobile", () => {
  it("detects 11-digit Chinese mobile", () => {
    const r = detectPIIInOutput("Contact: 13800138000");
    expect(r.detected).toBe(true);
    expect(r.hits.some((h) => h.type === "chinese_mobile")).toBe(true);
  });

  it("detects mobile with +86 prefix", () => {
    const r = detectPIIInOutput("Phone +8613800138000");
    expect(r.detected).toBe(true);
    expect(r.hits.some((h) => h.type === "chinese_mobile")).toBe(true);
  });

  it("does not flag random 11-digit sequences starting with 12 (not mobile prefix)", () => {
    const r = detectPIIInOutput("Order ID 12345678901");
    expect(r.hits.filter((h) => h.type === "chinese_mobile")).toHaveLength(0);
  });

  it("masks the sample value (no full PII echoed)", () => {
    const r = detectPIIInOutput("Contact: 13800138000");
    const hit = r.hits.find((h) => h.type === "chinese_mobile");
    expect(hit?.sample).not.toBe("13800138000");
    expect(hit?.sample).toContain("***");
  });
});

describe("output-pii-scrubber · email", () => {
  it("detects email", () => {
    const r = detectPIIInOutput("Reach out to alice@acme.com next week.");
    expect(r.detected).toBe(true);
    expect(r.hits.some((h) => h.type === "email")).toBe(true);
  });

  it("does not flag @example.com / @example.org / @example.net synthetic addresses", () => {
    const r = detectPIIInOutput("Reach test1@example.com and test2@example.org.");
    expect(r.hits.filter((h) => h.type === "email")).toHaveLength(0);
  });
});

describe("output-pii-scrubber · bank card", () => {
  it("detects Luhn-valid 16-digit card", () => {
    // 4532015112830366 is a Luhn-valid test Visa number
    const r = detectPIIInOutput("Card: 4532015112830366");
    expect(r.detected).toBe(true);
    expect(r.hits.some((h) => h.type === "bank_card")).toBe(true);
  });

  it("does not flag Luhn-invalid 16-digit sequences", () => {
    const r = detectPIIInOutput("ID 1234567890123456");
    expect(r.hits.filter((h) => h.type === "bank_card")).toHaveLength(0);
  });
});

describe("output-pii-scrubber · multiple PII types in same text", () => {
  it("collects all hits", () => {
    const text =
      "客户 alice@acme.com / 13800138000 反馈正面。";
    const r = detectPIIInOutput(text);
    expect(r.detected).toBe(true);
    expect(r.hits.length).toBeGreaterThanOrEqual(2);
    expect(r.hits.some((h) => h.type === "email")).toBe(true);
    expect(r.hits.some((h) => h.type === "chinese_mobile")).toBe(true);
  });
});
