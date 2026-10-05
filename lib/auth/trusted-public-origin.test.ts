import { describe, expect, it } from "vitest";
import { resolveTrustedPublicOrigin } from "./trusted-public-origin";

const production = { NODE_ENV: "production", APP_URL: "https://app.example.test" };
const hostile = new Headers({ host: "attacker.example", "x-forwarded-host": "other.example", "x-forwarded-proto": "javascript" });
describe("trusted public origin", () => {
  it("uses configured canonical origin despite hostile forwarding headers", () => {
    expect(resolveTrustedPublicOrigin(production, hostile)).toBe(production.APP_URL);
  });
  it.each([undefined, "", "not-url", "http://app.example.test", "javascript:alert(1)", "ftp://app.example.test", "https://user:pass@app.example.test", "https://app.example.test/path", "https://app.example.test/?x=1", "https://app.example.test/#x", "https://app.example.test\\evil", "https://app.example.test\n"])("fails closed in production for %s", value => {
    expect(() => resolveTrustedPublicOrigin({ NODE_ENV: "production", APP_URL: value }, new Headers({host: "localhost:3000"}))).toThrow("public_origin_invalid");
  });
  it.each(["localhost:3000", "127.0.0.1:3200", "[::1]:3000"])("allows exact development loopback %s", host => {
    expect(resolveTrustedPublicOrigin({ NODE_ENV: "development" }, new Headers({host, "x-forwarded-host": "attacker.example", "x-forwarded-proto": "https"}))).toBe(`http://${host}`);
  });
  it.each(["localhost.evil.example", "127.evil.example", "127.0.0.1.evil.example", "127.1", "evil-localhost.example", "localhost:3000,evil.example", "user@localhost:3000", "localhost:0", "localhost:65536", "localhost/path"])("rejects non-exact development host %s", host => {
    expect(() => resolveTrustedPublicOrigin({NODE_ENV: "development"}, new Headers({host}))).toThrow("public_origin_invalid");
  });
  it("does not fall back when configured origin is malformed, including development", () => {
    expect(() => resolveTrustedPublicOrigin({NODE_ENV: "development", APP_URL: "broken"}, new Headers({host:"localhost:3000"}))).toThrow("public_origin_invalid");
    expect(() => resolveTrustedPublicOrigin({NODE_ENV: "development", APP_URL: "http://external.example"}, hostile)).toThrow("public_origin_invalid");
  });
  it("supports local no-request tools and explicit local APP_URL", () => {
    expect(resolveTrustedPublicOrigin({NODE_ENV:"test"})).toBe("http://localhost:3000");
    expect(resolveTrustedPublicOrigin({NODE_ENV:"development",APP_URL:"http://localhost:3200/"})).toBe("http://localhost:3200");
  });
  it("requires explicit recognized non-production mode for development fallback", () => {
    expect(() => resolveTrustedPublicOrigin({})).toThrow("public_origin_invalid");
  });
});
