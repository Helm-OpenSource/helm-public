import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const CAPTURE_AGENT_TOKEN_PREFIX = "helm_capture";
const TOKEN_PREFIX_BYTES = 12;
const TOKEN_SECRET_BYTES = 32;
const CAPTURE_AGENT_TOKEN_PATTERN =
  /^helm_capture_([A-Za-z0-9_-]{16})_([A-Za-z0-9_-]{43})$/;

type RandomBytesSource = (size: number) => Buffer;

export function hashCaptureAgentToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
export function issueCaptureAgentToken(
  randomBytesSource: RandomBytesSource = randomBytes,
) {
  const tokenPrefix = randomBytesSource(TOKEN_PREFIX_BYTES).toString("base64url");
  const secret = randomBytesSource(TOKEN_SECRET_BYTES).toString("base64url");
  const token = `${CAPTURE_AGENT_TOKEN_PREFIX}_${tokenPrefix}_${secret}`;

  return {
    token,
    tokenPrefix,
    tokenHash: hashCaptureAgentToken(token),
  };
}

export function parseCaptureAgentToken(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const match = CAPTURE_AGENT_TOKEN_PATTERN.exec(value.trim());
  if (!match) {
    return null;
  }

  return {
    tokenPrefix: match[1],
    token: value.trim(),
  };
}

export function verifyCaptureAgentToken(
  token: string,
  expectedHash: string,
) {
  if (!/^[a-f0-9]{64}$/.test(expectedHash)) {
    return false;
  }

  const actual = Buffer.from(hashCaptureAgentToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
