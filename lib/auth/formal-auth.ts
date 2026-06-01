import { createHash, randomInt, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";

const PASSWORD_KEY_LENGTH = 64;
const AUTH_CODE_LENGTH = 6;
export const SIGNUP_ENROLLMENT_TTL_MINUTES = 30;
export const AUTH_CODE_TTL_MINUTES = 10;

export function normalizeEmailAddress(value: string) {
  return value.trim().toLowerCase();
}

export function normalizePhoneNumber(value: string) {
  const raw = value.trim();
  if (!raw) {
    return null;
  }

  if (raw.startsWith("+")) {
    const digits = raw.slice(1).replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 15) {
      return null;
    }
    return `+${digits}`;
  }

  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+86${digits}`;
  }

  if (digits.length >= 8 && digits.length <= 15) {
    return `+${digits}`;
  }

  return null;
}

export function generateVerificationCode() {
  return `${randomInt(0, 10 ** AUTH_CODE_LENGTH)}`.padStart(AUTH_CODE_LENGTH, "0");
}

function createPasswordSalt() {
  return randomUUID().replace(/-/g, "");
}

export function hashPassword(password: string) {
  const salt = createPasswordSalt();
  const hash = scryptSync(password, salt, PASSWORD_KEY_LENGTH).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string | null | undefined) {
  if (!storedHash) {
    return false;
  }

  const [algorithm, salt, hash] = storedHash.split(":");
  if (algorithm !== "scrypt" || !salt || !hash) {
    return false;
  }

  const incoming = scryptSync(password, salt, PASSWORD_KEY_LENGTH);
  const original = Buffer.from(hash, "hex");

  if (incoming.length !== original.length) {
    return false;
  }

  return timingSafeEqual(incoming, original);
}

export function hashVerificationCode(input: {
  purpose: string;
  target: string;
  code: string;
}) {
  return createHash("sha256")
    .update(`${input.purpose}:${normalizeEmailAddress(input.target)}:${input.code}`)
    .digest("hex");
}

export function verifyHashedVerificationCode(input: {
  purpose: string;
  target: string;
  code: string;
  expectedHash: string;
}) {
  const actual = hashVerificationCode(input);
  return timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(input.expectedHash, "hex"));
}

export function buildVerificationPreview(input: {
  email: string;
  emailCode?: string;
  phone: string;
  phoneCode?: string;
}) {
  return {
    deliveryMode: "IN_APP_PREVIEW" as const,
    email: input.email,
    phone: input.phone,
    emailCode: input.emailCode ?? null,
    phoneCode: input.phoneCode ?? null,
  };
}

export function shouldForceVerificationCodePreview(
  env: Record<string, string | undefined> = process.env,
) {
  return (
    env.HELM_FORCE_VERIFICATION_CODE_PREVIEW === "1" ||
    Boolean(env.PLAYWRIGHT_BASE_URL)
  );
}

export function canExposeVerificationCodePreview(
  env: Record<string, string | undefined> = process.env,
) {
  if (env.NODE_ENV !== "production") {
    return true;
  }
  return env.HELM_ALLOW_VERIFICATION_CODE_PREVIEW === "1" && shouldForceVerificationCodePreview(env);
}

export function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}
