import { describe, expect, it } from "vitest";
import { resolveMemberIdentifier } from "./member-identifier";

describe("resolveMemberIdentifier", () => {
  it("normalizes a valid email without treating it as a phone", () => {
    expect(resolveMemberIdentifier("Person+seat@example.com")).toEqual({
      normalizedEmail: "person+seat@example.com",
      normalizedPhone: null,
    });
  });

  it("normalizes a phone-only identifier", () => {
    expect(resolveMemberIdentifier("+1 202 555-0123")).toEqual({
      normalizedEmail: null,
      normalizedPhone: "+12025550123",
    });
  });

  it("rejects malformed email-like input instead of converting its digits to a phone", () => {
    expect(resolveMemberIdentifier("2025550123qq.com")).toEqual({
      normalizedEmail: null,
      normalizedPhone: null,
    });
    expect(resolveMemberIdentifier("2025550123@example")).toEqual({
      normalizedEmail: null,
      normalizedPhone: null,
    });
  });

  it("rejects arbitrary text that happens to contain a phone number", () => {
    expect(resolveMemberIdentifier("call 2025550123")).toEqual({
      normalizedEmail: null,
      normalizedPhone: null,
    });
  });
});
