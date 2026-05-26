import { describe, expect, it } from "vitest";
import {
  ensureManualSendAllowed,
  getAliyunFounderDefaultCredentials,
  getAliyunMailServerConfig,
  isAliyunMailConfigured,
  parseAliyunConnectorMetadata,
} from "@/lib/connectors/google";

describe("aliyun mail connector config", () => {
  it("uses official aliyun defaults when env is missing", () => {
    delete process.env.ALIYUN_MAIL_IMAP_HOST;
    delete process.env.ALIYUN_MAIL_IMAP_PORT;
    delete process.env.ALIYUN_MAIL_SMTP_HOST;
    delete process.env.ALIYUN_MAIL_SMTP_PORT;

    const config = getAliyunMailServerConfig();

    expect(config.imapHost).toBe("imap.qiye.aliyun.com");
    expect(config.imapPort).toBe(993);
    expect(config.smtpHost).toBe("smtp.qiye.aliyun.com");
    expect(config.smtpPort).toBe(465);
    expect(isAliyunMailConfigured()).toBe(true);
  });

  it("reads founder default credentials from env", () => {
    process.env.ALIYUN_MAIL_FOUNDER_EMAIL = "founder@example.test";
    process.env.ALIYUN_MAIL_FOUNDER_PASSWORD = "client-password";

    expect(getAliyunFounderDefaultCredentials()).toEqual({
      email: "founder@example.test",
      password: "client-password",
    });
  });

  it("parses connector metadata safely", () => {
    expect(parseAliyunConnectorMetadata("{\"mode\":\"aliyun-live\"}")).toEqual({ mode: "aliyun-live" });
    expect(parseAliyunConnectorMetadata("not-json")).toEqual({});
    expect(parseAliyunConnectorMetadata(null)).toEqual({});
  });

  it("rejects non-explicit sends", () => {
    expect(() => ensureManualSendAllowed({ explicitUserTrigger: false })).toThrow(
      /explicit user trigger/i,
    );
  });
});
