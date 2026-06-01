import { beforeEach, describe, expect, it, vi } from "vitest";

const { createTransportMock, sendMailMock } = vi.hoisted(() => {
  const sendMail = vi.fn();
  return {
    createTransportMock: vi.fn(() => ({ sendMail })),
    sendMailMock: sendMail,
  };
});

vi.mock("nodemailer", () => ({
  default: {
    createTransport: createTransportMock,
  },
}));

import {
  getSystemMailSenderEmail,
  isSystemMailConfigured,
  sendSystemMailIfConfigured,
  SYSTEM_MAIL_PURPOSES,
} from "@/lib/notifications/system-mail";

const ORIGINAL_ENV = { ...process.env };

describe("system-mail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.ALIYUN_MAIL_SYSTEM_EMAIL;
    delete process.env.ALIYUN_MAIL_SYSTEM_PASSWORD;
    delete process.env.ALIYUN_MAIL_FOUNDER_EMAIL;
    delete process.env.ALIYUN_MAIL_FOUNDER_PASSWORD;
    process.env.ALIYUN_MAIL_SMTP_HOST = "smtp.qiye.aliyun.com";
    process.env.ALIYUN_MAIL_SMTP_PORT = "465";
    process.env.ALIYUN_MAIL_SMTP_SECURE = "1";
  });

  it("prefers explicit system sender email and falls back to neutral placeholder", () => {
    expect(getSystemMailSenderEmail()).toBe("system@example.com");

    process.env.ALIYUN_MAIL_FOUNDER_EMAIL = "founder@example.test";
    expect(getSystemMailSenderEmail()).toBe("founder@example.test");

    process.env.ALIYUN_MAIL_SYSTEM_EMAIL = "system@example.test";
    expect(getSystemMailSenderEmail()).toBe("system@example.test");
  });

  it("detects sender configuration with system or founder password", () => {
    expect(isSystemMailConfigured()).toBe(false);

    process.env.ALIYUN_MAIL_FOUNDER_PASSWORD = "founder-app-password";
    expect(isSystemMailConfigured()).toBe(true);

    delete process.env.ALIYUN_MAIL_FOUNDER_PASSWORD;
    process.env.ALIYUN_MAIL_SYSTEM_PASSWORD = "system-app-password";
    expect(isSystemMailConfigured()).toBe(true);
  });

  it("sends through Aliyun SMTP as helm system account", async () => {
    process.env.ALIYUN_MAIL_SYSTEM_EMAIL = "system@example.test";
    process.env.ALIYUN_MAIL_SYSTEM_PASSWORD = "system-app-password";
    sendMailMock.mockResolvedValue({ messageId: "msg-1" });

    const result = await sendSystemMailIfConfigured({
      purpose: SYSTEM_MAIL_PURPOSES.AUTH_CODE,
      to: "member@example.com",
      subject: "Test",
      text: "hello",
    });

    expect(result).toEqual(
      expect.objectContaining({
        sent: true,
        messageId: "msg-1",
        sender: "system@example.test",
      }),
    );

    expect(createTransportMock).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "smtp.qiye.aliyun.com",
        port: 465,
        secure: true,
        auth: {
          user: "system@example.test",
          pass: "system-app-password",
        },
      }),
    );
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "system@example.test",
        to: "member@example.com",
        subject: "Test",
        text: "hello",
      }),
    );
  });

  it("rejects unknown purposes", async () => {
    await expect(
      sendSystemMailIfConfigured({
        // @ts-expect-error intentionally invalid purpose for runtime check
        purpose: "marketing_blast",
        to: "member@example.com",
        subject: "Hi",
        text: "hello",
      }),
    ).rejects.toThrow(/Unknown system mail purpose/);
  });

  it("returns not_configured instead of throwing when using the safe helper", async () => {
    const result = await sendSystemMailIfConfigured({
      purpose: SYSTEM_MAIL_PURPOSES.ORG_INVITE,
      to: "member@example.com",
      subject: "Invite",
      text: "hello",
    });

    expect(result).toEqual({
      sent: false,
      reason: "not_configured",
      sender: "system@example.com",
    });
    expect(createTransportMock).not.toHaveBeenCalled();
  });
});
