import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from "node:crypto";

const PLAIN_PREFIX = "plain:";
const ENCRYPTED_PREFIX = "enc:";
const ENCRYPTED_V2_PREFIX = "enc:v2:";
const MIN_PRODUCTION_SECRET_LENGTH = 32;
const DEFAULT_PRIMARY_SECRET_ID = "primary";
const DEFAULT_PREVIOUS_SECRET_ID = "previous";
const SECRET_ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

type ConnectorTokenSecret = {
  id: string;
  value: string;
};

function getSecret() {
  return process.env.CONNECTOR_TOKEN_SECRET?.trim() || null;
}

function getPrimarySecret(): ConnectorTokenSecret | null {
  const value = getSecret();
  if (!value) {
    return null;
  }
  return {
    id: normalizeSecretId(
      process.env.CONNECTOR_TOKEN_SECRET_ID,
      DEFAULT_PRIMARY_SECRET_ID,
    ),
    value,
  };
}

function getPreviousSecret(): ConnectorTokenSecret | null {
  const value = process.env.CONNECTOR_TOKEN_SECRET_PREVIOUS?.trim();
  if (!value) {
    return null;
  }
  return {
    id: normalizeSecretId(
      process.env.CONNECTOR_TOKEN_SECRET_PREVIOUS_ID,
      DEFAULT_PREVIOUS_SECRET_ID,
    ),
    value,
  };
}

function getConfiguredSecrets() {
  return [getPrimarySecret(), getPreviousSecret()].filter(
    (secret): secret is ConnectorTokenSecret => Boolean(secret),
  );
}

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function getLegacyKey(secret: string) {
  return createHash("sha256").update(secret).digest();
}

function deriveKey(secret: string, salt: Buffer) {
  return scryptSync(secret, salt, 32);
}

function normalizeSecretId(value: string | undefined, fallback: string) {
  const candidate = value?.trim() || fallback;
  if (!SECRET_ID_PATTERN.test(candidate)) {
    throw new Error(
      "CONNECTOR_TOKEN_SECRET_ID must contain only letters, numbers, dot, underscore, or dash",
    );
  }
  return candidate;
}

function assertProductionSecretStrength(secret: string) {
  if (isProduction() && secret.length < MIN_PRODUCTION_SECRET_LENGTH) {
    throw new Error("CONNECTOR_TOKEN_SECRET must be at least 32 characters in production");
  }
}

export function storeConnectorToken(token?: string | null) {
  if (!token) {
    return null;
  }

  const secret = getPrimarySecret();

  if (!secret) {
    if (isProduction()) {
      throw new Error("CONNECTOR_TOKEN_SECRET is required to store connector tokens in production");
    }

    return `${PLAIN_PREFIX}${Buffer.from(token, "utf8").toString("base64url")}`;
  }

  assertProductionSecretStrength(secret.value);

  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(secret.value, salt), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${ENCRYPTED_V2_PREFIX}${secret.id}:${salt.toString("base64url")}.${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function readConnectorToken(stored?: string | null) {
  if (!stored) {
    return null;
  }

  if (stored.startsWith(PLAIN_PREFIX)) {
    return Buffer.from(stored.slice(PLAIN_PREFIX.length), "base64url").toString("utf8");
  }

  if (!stored.startsWith(ENCRYPTED_PREFIX)) {
    console.warn(
      "[connector-token-store] unsupported connector token storage format; refusing unprefixed token",
    );
    return null;
  }

  if (stored.startsWith(ENCRYPTED_V2_PREFIX)) {
    return readEncryptedV2Token(stored);
  }

  return readLegacyEncryptedToken(stored);
}

function readEncryptedV2Token(stored: string) {
  const payload = stored.slice(ENCRYPTED_V2_PREFIX.length);
  const separator = payload.indexOf(":");
  if (separator <= 0) {
    return null;
  }
  const secretId = payload.slice(0, separator);
  const [saltString, ivString, tagString, encryptedString] = payload
    .slice(separator + 1)
    .split(".");

  if (!saltString || !ivString || !tagString || !encryptedString) {
    return null;
  }

  const secret = getConfiguredSecrets().find((item) => item.id === secretId);

  if (!secret) {
    console.warn(
      `[connector-token-store] connector token secret version is not configured: ${secretId}`,
    );
    return null;
  }

  return decryptWithKey({
    key: deriveKey(secret.value, Buffer.from(saltString, "base64url")),
    ivString,
    tagString,
    encryptedString,
  });
}

function readLegacyEncryptedToken(stored: string) {
  const [ivString, tagString, encryptedString] = stored
    .slice(ENCRYPTED_PREFIX.length)
    .split(".");

  if (!ivString || !tagString || !encryptedString) {
    return null;
  }

  for (const secret of getConfiguredSecrets()) {
    const decrypted = decryptWithKey({
      key: getLegacyKey(secret.value),
      ivString,
      tagString,
      encryptedString,
    });
    if (decrypted !== null) {
      return decrypted;
    }
  }

  console.warn("[connector-token-store] connector token could not be decrypted with configured secrets");
  return null;
}

function decryptWithKey(input: {
  key: Buffer;
  ivString: string;
  tagString: string;
  encryptedString: string;
}) {
  try {
    const { key, ivString, tagString, encryptedString } = input;
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(ivString, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagString, "base64url"));

    return Buffer.concat([
      decipher.update(Buffer.from(encryptedString, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

export function isSecureConnectorTokenStorageEnabled() {
  return Boolean(getSecret());
}
