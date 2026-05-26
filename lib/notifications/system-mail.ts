import nodemailer from "nodemailer";
import { getAliyunMailServerConfig } from "@/lib/connectors/google";

// Neutral placeholder shown only when neither ALIYUN_MAIL_SYSTEM_EMAIL nor
// ALIYUN_MAIL_FOUNDER_EMAIL is configured. Production deployments must set
// one of those env vars; the placeholder is intentionally generic to avoid
// embedding a tenant-specific anchor in shared layer source.
const SYSTEM_MAIL_SENDER_FALLBACK = "system@example.com";

// Whitelist of allowed system-mail purposes. Adding a new purpose is a
// deliberate review step — system mail is operational only, never a
// customer-facing communication channel and never automated marketing.
export const SYSTEM_MAIL_PURPOSES = {
  AUTH_CODE: "auth_code",
  ORG_INVITE: "org_invite",
  TRIAL_APPLICATION_NOTIFY: "trial_application_notify",
  TENANT_RUNTIME_ALERT: "tenant_runtime_alert",
} as const;

export type SystemMailPurpose =
  (typeof SYSTEM_MAIL_PURPOSES)[keyof typeof SYSTEM_MAIL_PURPOSES];

const ALLOWED_PURPOSES = new Set<string>(Object.values(SYSTEM_MAIL_PURPOSES));

function assertSystemMailPurpose(purpose: SystemMailPurpose) {
  if (!ALLOWED_PURPOSES.has(purpose)) {
    throw new Error(
      `Unknown system mail purpose: ${purpose}. Add it to SYSTEM_MAIL_PURPOSES with explicit review.`,
    );
  }
}

export function getSystemMailSenderEmail() {
  return (
    process.env.ALIYUN_MAIL_SYSTEM_EMAIL?.trim() ||
    process.env.ALIYUN_MAIL_FOUNDER_EMAIL?.trim() ||
    SYSTEM_MAIL_SENDER_FALLBACK
  );
}

function getSystemMailSenderPassword() {
  return (
    process.env.ALIYUN_MAIL_SYSTEM_PASSWORD?.trim() ||
    process.env.ALIYUN_MAIL_FOUNDER_PASSWORD?.trim() ||
    null
  );
}

export function isSystemMailConfigured() {
  const config = getAliyunMailServerConfig();
  return Boolean(config.smtpHost && config.smtpPort > 0 && getSystemMailSenderPassword());
}

type SystemMailInput = {
  purpose: SystemMailPurpose;
  to: string;
  subject: string;
  text: string;
  html?: string;
};

async function sendSystemMail(input: SystemMailInput) {
  assertSystemMailPurpose(input.purpose);

  const password = getSystemMailSenderPassword();
  if (!password) {
    throw new Error("System mail sender password is not configured.");
  }

  const sender = getSystemMailSenderEmail();
  const config = getAliyunMailServerConfig();
  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth: {
      user: sender,
      pass: password,
    },
  });

  const info = await transporter.sendMail({
    from: sender,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });

  return {
    messageId: info.messageId,
    sender,
  };
}

export async function sendSystemMailIfConfigured(input: SystemMailInput) {
  assertSystemMailPurpose(input.purpose);

  if (!isSystemMailConfigured()) {
    return {
      sent: false as const,
      reason: "not_configured" as const,
      sender: getSystemMailSenderEmail(),
    };
  }

  const result = await sendSystemMail(input);
  return {
    sent: true as const,
    sender: result.sender,
    messageId: result.messageId,
  };
}
