import { describe, expect, it } from "vitest";

import {
  deepRedact,
  isCredentialFlagName,
  isCredentialKeyName,
  looksLikeSecretValue,
  redactArgv,
  redactEnv,
  redactText,
} from "@/tools/caio-admin/redaction";

// Synthetic credential-shaped fixtures assembled at runtime by concatenation so
// the public-release static line scan never sees an assignment-form or
// URL-embedded credential literal. These are deliberately SHORT / SPACED /
// LOW-ENTROPY: the point of these tests is that name-first detection catches
// values that no entropy heuristic can catch.
const SHORT_VALUE = ["hun", "ter", "2"].join("");
const SPACED_VALUE = ["correct", "horse", "battery", "staple"].join(" ");
const TINY_VALUE = ["a", "b", "c"].join("");
const HIGH_ENTROPY_VALUE = ["sk-", "A1b2C3d4", "E5f6G7h8", "I9j0K1l2", "M3n4"].join(
  "",
);
const URL_WITH_CREDENTIALS = [
  "mysql:",
  "//",
  "helm:",
  "SuperSecretPw123@",
  "db.example.invalid",
  ":3306/caio",
].join("");
const PEM_HEADER = ["-----BEGIN", " ", "RSA PRIVATE KEY", "-----"].join("");

describe("credential NAME detection (structural, name-first)", () => {
  it("treats credential-ish flag names as secret-bearing regardless of value", () => {
    for (const name of [
      "--token",
      "--password",
      "--passwd",
      "--pwd",
      "--pass",
      "--secret",
      "--credential",
      "--api-key",
      "--api_key",
      "--apiKey",
      "--private-key",
      "--bearer",
      "--auth",
      "--authorization",
      "--dsn",
      "--conn",
      "--database-url",
      "--session",
      "--session-token",
      "-password",
    ]) {
      expect(isCredentialFlagName(name), name).toBe(true);
    }
  });

  it("does not treat ordinary operational flags as credential-named", () => {
    for (const name of [
      "--package",
      "--phase",
      "--json",
      "--releases-root",
      "--release-dir",
      "--label",
      "--author",
      "--config",
      "--connected",
      "--upwards",
    ]) {
      expect(isCredentialFlagName(name), name).toBe(false);
    }
  });

  it("exempts POINTER flags that carry a ref/file/path instead of a value", () => {
    for (const name of [
      "--credential-ref",
      "--secret-file",
      "--token-path",
      "--password-file",
      "--api-key-file",
      "--ref",
    ]) {
      expect(isCredentialFlagName(name), name).toBe(false);
    }
  });

  it("keeps env/object KEY detection wide (no pointer exemption there)", () => {
    for (const key of [
      "CAIO_TOKEN",
      "DB_PASSWORD",
      "DATABASE_URL",
      "SECRET_FILE",
      "apiToken",
      "apiKey",
      "AUTH",
      "DB_DSN",
      "MYSQL_PWD",
    ]) {
      expect(isCredentialKeyName(key), key).toBe(true);
    }
    for (const key of ["HOME", "PATH", "TMPDIR", "LANG", "RELEASE_DIR", "AUTHOR"]) {
      expect(isCredentialKeyName(key), key).toBe(false);
    }
  });
});

describe("value-shape detection (additional trigger, never a permission)", () => {
  it("still flags URL credentials, PEM headers, and long high-entropy blobs", () => {
    expect(looksLikeSecretValue(URL_WITH_CREDENTIALS)).toBe(true);
    expect(looksLikeSecretValue(HIGH_ENTROPY_VALUE)).toBe(true);
    expect(looksLikeSecretValue("0123456789abcdef0123456789abcdef")).toBe(true);
    // PEM headers contain whitespace: the whitespace exemption must not apply.
    expect(looksLikeSecretValue(PEM_HEADER)).toBe(true);
    expect(looksLikeSecretValue(`${PEM_HEADER}\nabc\n`)).toBe(true);
  });

  it("stays conservative for bare values with no name context", () => {
    expect(looksLikeSecretValue("preflight")).toBe(false);
    expect(looksLikeSecretValue("/opt/caio/releases/pkg-abc123def456")).toBe(false);
    expect(looksLikeSecretValue("short")).toBe(false);
    expect(looksLikeSecretValue(SHORT_VALUE)).toBe(false);
    expect(looksLikeSecretValue("")).toBe(false);
  });
});

describe("redactEnv", () => {
  it("redacts SHORT and SPACED values under credential-named keys", () => {
    const scrubbed = redactEnv({
      CAIO_TOKEN: SHORT_VALUE,
      DB_PASSWORD: SPACED_VALUE,
      CAIO_API_KEY: TINY_VALUE,
      HOME: "/Users/operator",
      RELEASE_DIR: "/opt/caio/releases/current",
    });
    expect(scrubbed.CAIO_TOKEN).toBe("<redacted>");
    expect(scrubbed.DB_PASSWORD).toBe("<redacted>");
    expect(scrubbed.CAIO_API_KEY).toBe("<redacted>");
    expect(scrubbed.HOME).toBe("/Users/operator");
    expect(scrubbed.RELEASE_DIR).toBe("/opt/caio/releases/current");
    expect(Object.values(scrubbed).join(" ")).not.toContain(SHORT_VALUE);
    expect(Object.values(scrubbed).join(" ")).not.toContain("battery");
  });

  it("keeps redacting by value shape and preserves undefined entries", () => {
    const scrubbed = redactEnv({
      RANDOM_BLOB: HIGH_ENTROPY_VALUE,
      MISSING: undefined,
    });
    expect(scrubbed.RANDOM_BLOB).toBe("<redacted>");
    expect(scrubbed.MISSING).toBeUndefined();
  });
});

describe("deepRedact", () => {
  it("redacts short and spaced values under credential-named keys", () => {
    const value = deepRedact({
      token: SHORT_VALUE,
      apiKey: ["x", "y", "z"].join(" "),
      auth: SPACED_VALUE,
      nested: { dbPassword: TINY_VALUE, note: "activation ok" },
      list: [{ bearer: SHORT_VALUE }],
    });
    const serialized = JSON.stringify(value);
    expect(serialized).not.toContain(SHORT_VALUE);
    expect(serialized).not.toContain("battery");
    expect(serialized).not.toContain("x y z");
    expect(serialized).not.toContain(TINY_VALUE);
    expect(value.token).toBe("<redacted>");
    expect(value.apiKey).toBe("<redacted>");
    expect(value.auth).toBe("<redacted>");
    expect((value.nested as { note: string }).note).toBe("activation ok");
  });
});

describe("redactArgv", () => {
  it("redacts inline and standalone secret material", () => {
    const scrubbed = redactArgv([
      "install",
      `--api-token=${HIGH_ENTROPY_VALUE}`,
      `--token=${SHORT_VALUE}`,
      URL_WITH_CREDENTIALS,
      "--json",
    ]);
    const joined = scrubbed.join(" ");
    expect(joined).not.toContain(HIGH_ENTROPY_VALUE);
    expect(joined).not.toContain("SuperSecretPw123");
    expect(scrubbed).toContain("--token=<redacted>");
    expect(scrubbed).toContain("install");
    expect(scrubbed).toContain("--json");
  });

  it("leaves benign operational flags and paths intact", () => {
    const argv = [
      "install",
      "--package",
      "/opt/caio/packages/pkg.tar.gz",
      "--phase",
      "proxy",
      "--releases-root",
      "/opt/caio/releases",
      "--json",
    ];
    expect(redactArgv(argv)).toEqual(argv);
  });
});

describe("redactText", () => {
  it("keeps redacting assignment forms and quoted spaced secrets", () => {
    const line = `connecting DATABASE_URL=${URL_WITH_CREDENTIALS} token ${HIGH_ENTROPY_VALUE}`;
    const scrubbed = redactText(line);
    expect(scrubbed).not.toContain("SuperSecretPw123");
    expect(scrubbed).not.toContain(HIGH_ENTROPY_VALUE);
    expect(scrubbed).toContain("DATABASE_URL=<redacted>");

    const quoted = redactText(`env DB_PASSWORD="${SPACED_VALUE}" applied`);
    expect(quoted).not.toContain("battery");
    expect(quoted).toContain('DB_PASSWORD="<redacted>"');
    expect(quoted).toContain("applied");
  });
});
