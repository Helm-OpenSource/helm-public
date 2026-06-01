import { describe, expect, it } from "vitest";
import {
  buildVerificationPreview,
  canExposeVerificationCodePreview,
  generateVerificationCode,
  hashPassword,
  hashVerificationCode,
  normalizeEmailAddress,
  normalizePhoneNumber,
  shouldForceVerificationCodePreview,
  verifyHashedVerificationCode,
  verifyPassword,
} from "@/lib/auth/formal-auth";

describe("formal auth helpers", () => {
  it("normalizes email and phone consistently", () => {
    expect(normalizeEmailAddress("  Alice@Example.com ")).toBe("alice@example.com");
    expect(normalizePhoneNumber("138 0013 8000")).toBe("+8613800138000");
    expect(normalizePhoneNumber("+1 (415) 555-1234")).toBe("+14155551234");
    expect(normalizePhoneNumber("123")).toBeNull();
  });

  it("hashes and verifies passwords", () => {
    const hash = hashPassword("P@ssword123");
    expect(verifyPassword("P@ssword123", hash)).toBe(true);
    expect(verifyPassword("wrong-password", hash)).toBe(false);
  });

  it("hashes and verifies auth codes", () => {
    const code = generateVerificationCode();
    expect(code).toHaveLength(6);

    const hash = hashVerificationCode({
      purpose: "SIGNUP_EMAIL",
      target: "alice@example.com",
      code,
    });

    expect(
      verifyHashedVerificationCode({
        purpose: "SIGNUP_EMAIL",
        target: "alice@example.com",
        code,
        expectedHash: hash,
      }),
    ).toBe(true);
    expect(
      verifyHashedVerificationCode({
        purpose: "SIGNUP_EMAIL",
        target: "alice@example.com",
        code: "000000",
        expectedHash: hash,
      }),
    ).toBe(false);
  });

  it("builds in-product verification preview payloads", () => {
    expect(
      buildVerificationPreview({
        email: "alice@example.com",
        emailCode: "111222",
        phone: "+8613800138000",
        phoneCode: "333444",
      }),
    ).toEqual({
      deliveryMode: "IN_APP_PREVIEW",
      email: "alice@example.com",
      emailCode: "111222",
      phone: "+8613800138000",
      phoneCode: "333444",
    });
  });

  it("forces verification preview when playwright env is present", () => {
    expect(
      shouldForceVerificationCodePreview({
        PLAYWRIGHT_BASE_URL: "http://127.0.0.1:61053",
      }),
    ).toBe(true);
    expect(
      shouldForceVerificationCodePreview({
        HELM_FORCE_VERIFICATION_CODE_PREVIEW: "1",
      }),
    ).toBe(true);
    expect(shouldForceVerificationCodePreview({})).toBe(false);
  });

  it("does not expose verification previews in production unless explicitly allowed", () => {
    expect(
      canExposeVerificationCodePreview({
        NODE_ENV: "production",
        PLAYWRIGHT_BASE_URL: "http://127.0.0.1:61053",
      }),
    ).toBe(false);
    expect(
      canExposeVerificationCodePreview({
        NODE_ENV: "production",
        HELM_FORCE_VERIFICATION_CODE_PREVIEW: "1",
      }),
    ).toBe(false);
    expect(
      canExposeVerificationCodePreview({
        NODE_ENV: "production",
        HELM_ALLOW_VERIFICATION_CODE_PREVIEW: "1",
      }),
    ).toBe(false);
    expect(
      canExposeVerificationCodePreview({
        NODE_ENV: "production",
        HELM_ALLOW_VERIFICATION_CODE_PREVIEW: "1",
        PLAYWRIGHT_BASE_URL: "http://127.0.0.1:61053",
      }),
    ).toBe(true);
    expect(
      canExposeVerificationCodePreview({
        NODE_ENV: "development",
      }),
    ).toBe(true);
  });
});
