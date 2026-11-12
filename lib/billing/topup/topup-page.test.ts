import { describe, expect, it } from "vitest";
import { buildTopUpUrl, fenToYuanText, isOpenableTopUpUrl, parseSuggestedFen, yuanTextToFen } from "./topup-page";

describe("top-up page helpers", () => {
  it("only prefills an integer suggestedFen, clamped into the per-order bounds", () => {
    expect(parseSuggestedFen("12345")).toBe(12345);
    expect(parseSuggestedFen(["50", "1"])).toBe(100); // below 1 yuan: the minimum
    expect(parseSuggestedFen("900000000")).toBe(5_000_000); // above the cap: the cap, the page says to split
    for (const raw of [undefined, "", "0", "-5", "1.5", "1e5", "abc", "1234567890123"]) expect(parseSuggestedFen(raw)).toBeNull();
  });

  it("builds the client URL from the APP_URL origin and the fixed path, which the client rule then accepts", () => {
    const origin = "https://helm.example.invalid";
    expect(buildTopUpUrl(origin)).toBe("https://helm.example.invalid/billing/topup");
    expect(buildTopUpUrl(origin, 4321)).toBe("https://helm.example.invalid/billing/topup?suggestedFen=4321");
    expect(buildTopUpUrl(origin, -1)).toBe("https://helm.example.invalid/billing/topup");
    expect(isOpenableTopUpUrl(buildTopUpUrl(origin, 4321), origin)).toBe(true);
  });

  it("follows the 2026-11-12 client rule: https, port 443, same or allow-listed host, no credentials; the path is not checked", () => {
    const login = "https://helm.example.invalid";
    expect(isOpenableTopUpUrl("https://helm.example.invalid/any/other/path?x=1", login)).toBe(true);
    expect(isOpenableTopUpUrl("https://helm.example.invalid:443/billing/topup", login)).toBe(true);
    expect(isOpenableTopUpUrl("https://pay.example.invalid/billing/topup", login, ["pay.example.invalid"])).toBe(true);
    for (const url of ["http://helm.example.invalid/billing/topup", "https://helm.example.invalid:8443/billing/topup",
      "https://someone@helm.example.invalid/billing/topup", "https://evil.example.invalid/billing/topup",
      "https://sub.helm.example.invalid/billing/topup", "https://127.0.0.1/billing/topup", "not a url"]) {
      expect(isOpenableTopUpUrl(url, login)).toBe(false);
    }
    // Port 443 only, even when the login origin itself runs elsewhere (a non-standard port needs a contract change first).
    expect(isOpenableTopUpUrl("https://helm.example.invalid:8443/billing/topup", "https://helm.example.invalid:8443")).toBe(false);
  });

  it("converts yuan text to fen exactly and back", () => {
    expect(yuanTextToFen("10.05")).toBe(1005);
    expect(yuanTextToFen(" 500 ")).toBe(50_000);
    expect(yuanTextToFen("0.1")).toBe(10);
    for (const text of ["", "1.005", "-1", "1e3", "01", "1,000"]) expect(yuanTextToFen(text)).toBeNull();
    expect(fenToYuanText(1005)).toBe("10.05");
  });
});
