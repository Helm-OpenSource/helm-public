import { describe, expect, it } from "vitest";
import { redactProviderErrorBody } from "@/lib/connectors/error-redaction";

describe("redactProviderErrorBody", () => {
  it("returns empty string for empty input", () => {
    expect(redactProviderErrorBody("")).toBe("");
  });

  it("redacts client_secret in JSON shape", () => {
    const body = '{"error":"invalid_client","client_secret":"abc123secret"}';
    const out = redactProviderErrorBody(body);
    expect(out).not.toContain("abc123secret");
    expect(out).toContain("[redacted]");
  });

  it("redacts access_token and refresh_token", () => {
    const body = '{"access_token":"abcd1234","refresh_token":"refresh-token-xyz"}';
    const out = redactProviderErrorBody(body);
    expect(out).not.toContain("abcd1234");
    expect(out).not.toContain("refresh-token-xyz");
  });

  it("redacts Bearer tokens in plain text", () => {
    const body = "request was: Authorization: Bearer abcdef1234567890ghij";
    const out = redactProviderErrorBody(body);
    expect(out).not.toContain("abcdef1234567890ghij");
    expect(out).toContain("Bearer [redacted]");
  });

  it("redacts password and api_key in URL-encoded shape", () => {
    const body = "error=denied&password=hunter2&api_key=apikeyvalue123";
    const out = redactProviderErrorBody(body);
    expect(out).not.toContain("hunter2");
    expect(out).not.toContain("apikeyvalue123");
  });

  it("redacts WeCom corpsecret when an upstream gateway echoes query strings", () => {
    const body = "upstream failed: https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=corp&corpsecret=wecom-corp-secret";
    const out = redactProviderErrorBody(body);

    expect(out).not.toContain("wecom-corp-secret");
    expect(out).toContain("corpsecret=[redacted]");
  });

  it("trims long bodies and adds an ASCII ellipsis", () => {
    const body = "x".repeat(500);
    const out = redactProviderErrorBody(body, 100);
    expect(out.length).toBeLessThanOrEqual(100);
    expect(out.endsWith("...")).toBe(true);
  });

  it("preserves non-sensitive provider error envelopes", () => {
    const body = '{"errcode":40013,"errmsg":"invalid corpid"}';
    expect(redactProviderErrorBody(body)).toBe(body);
  });
});
