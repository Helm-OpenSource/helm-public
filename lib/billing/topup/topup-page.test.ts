import { describe, expect, it } from "vitest";
import { buildTopUpUrl, fenToYuanText, isOpenableTopUpUrl, isTopupAmountFen, parseSuggestedFen, yuanTextToFen } from "./topup-page";

describe("top-up page helpers", () => {
  it("only prefills an integer suggestedFen, rounded up to whole 100 yuan (owner 2026-11-12)", () => {
    expect(parseSuggestedFen("12345")).toBe(20_000); // a 123.45 yuan shortfall prefills 200 yuan
    expect(parseSuggestedFen("10000")).toBe(10_000);
    expect(parseSuggestedFen(["50", "1"])).toBe(10_000); // below 100 yuan: the minimum
    expect(parseSuggestedFen("900000000")).toBe(900_000_000); // no business cap
    expect(parseSuggestedFen("999999999999")).toBe(10_000_000_000); // only the technical bound
    expect([10_000, 50_000, 900_000_000].every(isTopupAmountFen)).toBe(true);
    expect([9_999, 10_050, 15_000, null, 10_000_010_000].some(isTopupAmountFen)).toBe(false);
    for (const raw of [undefined, "", "0", "-5", "1.5", "1e5", "abc", "1234567890123"]) expect(parseSuggestedFen(raw)).toBeNull();
  });

  it("builds the client URL from the APP_URL origin and the fixed path, which the client rule then accepts", () => {
    const origin = "https://helm.example.invalid";
    expect(buildTopUpUrl(origin)).toBe("https://helm.example.invalid/billing/topup");
    expect(buildTopUpUrl(origin, 4321)).toBe("https://helm.example.invalid/billing/topup?suggestedFen=10000");
    expect(buildTopUpUrl(origin, -1)).toBe("https://helm.example.invalid/billing/topup");
    expect(isOpenableTopUpUrl(buildTopUpUrl(origin, 4321), origin)).toBe(true);
    expect(buildTopUpUrl(origin, 123_456)).toBe("https://helm.example.invalid/billing/topup?suggestedFen=130000");
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
    // #550 review P3-2: a password segment alone, IP literals and allow-list suffixes are refused too.
    for (const url of ["https://:pw@helm.example.invalid/billing/topup", "https://10.0.0.1/billing/topup", "https://[::1]/billing/topup",
      "https://evil-pay.example.invalid/billing/topup", "https://x.pay.example.invalid/billing/topup"]) {
      expect(isOpenableTopUpUrl(url, login, ["pay.example.invalid"])).toBe(false);
    }
    // An IP literal is refused even when listed (or when it is the login host): hosts are names only.
    expect(isOpenableTopUpUrl("https://10.0.0.1/billing/topup", login, ["10.0.0.1"])).toBe(false);
    expect(isOpenableTopUpUrl("https://10.0.0.1/billing/topup", "https://10.0.0.1")).toBe(false);
    expect(isOpenableTopUpUrl("https://[::1]/billing/topup", "https://[::1]")).toBe(false);
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
