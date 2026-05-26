import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const PLAIN_PREFIX = "plain:";
const ENCRYPTED_PREFIX = "enc:";

function getSecret() {
  return process.env.CONNECTOR_TOKEN_SECRET?.trim() || null;
}

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function getKey(secret: string) {
  return createHash("sha256").update(secret).digest();
}

export function storeConnectorToken(token?: string | null) {
  if (!token) {
    return null;
  }

  const secret = getSecret();

  if (!secret) {
    if (isProduction()) {
      throw new Error("CONNECTOR_TOKEN_SECRET is required to store connector tokens in production");
    }

    return `${PLAIN_PREFIX}${Buffer.from(token, "utf8").toString("base64url")}`;
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${ENCRYPTED_PREFIX}${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function readConnectorToken(stored?: string | null) {
  if (!stored) {
    return null;
  }

  if (stored.startsWith(PLAIN_PREFIX)) {
    return Buffer.from(stored.slice(PLAIN_PREFIX.length), "base64url").toString("utf8");
  }

  if (!stored.startsWith(ENCRYPTED_PREFIX)) {
    return stored;
  }

  const secret = getSecret();

  if (!secret) {
    return null;
  }

  const [ivString, tagString, encryptedString] = stored.slice(ENCRYPTED_PREFIX.length).split(".");

  if (!ivString || !tagString || !encryptedString) {
    return null;
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getKey(secret),
    Buffer.from(ivString, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagString, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedString, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function isSecureConnectorTokenStorageEnabled() {
  return Boolean(getSecret());
}
