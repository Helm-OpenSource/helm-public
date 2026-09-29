import { afterEach, describe, expect, it, vi } from "vitest";
import { isEmailEntryEnabled, isSessionProviderAllowed } from "./email-entry-policy";

afterEach(() => vi.unstubAllEnvs());
describe("email entry policy", () => {
  it("preserves omitted legacy configuration", () => expect(isEmailEntryEnabled({})).toBe(true));
  it.each(["false", "", "yes", "1", "invalid"])("fails closed for %s", value => {
    expect(isEmailEntryEnabled({ HELM_AUTH_EMAIL_ENTRY_ENABLED: value })).toBe(false);
  });
  it("accepts explicit true", () => expect(isEmailEntryEnabled({ HELM_AUTH_EMAIL_ENTRY_ENABLED: " true " })).toBe(true));
  it("retains verified providers while rejecting unverified or unknown sessions", () => {
    vi.stubEnv("HELM_AUTH_EMAIL_ENTRY_ENABLED", "false");
    for (const provider of ["PASSWORD", "PHONE_CODE", "VERIFIED_SIGNUP", "PARTICIPANT_PORTAL", "DINGTALK_OAUTH", "WECOM_OAUTH", "FEISHU_OAUTH"]) expect(isSessionProviderAllowed(provider)).toBe(true);
    for (const provider of ["EMAIL_ENTRY", "unknown", "", null, undefined]) expect(isSessionProviderAllowed(provider)).toBe(false);
  });
});
