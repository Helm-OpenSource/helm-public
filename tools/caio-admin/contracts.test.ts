import { describe, expect, it } from "vitest";

import {
  EXIT_BLOCKED,
  EXIT_FAILED,
  EXIT_OK,
  blockedReasonOf,
  blockedResult,
  failedResult,
  okResult,
  renderCaioAdminResult,
} from "@/tools/caio-admin/contracts";
import {
  createRedactingLogger,
  deepRedact,
  looksLikeSecretValue,
  redactArgv,
  redactEnv,
  redactPrivatePaths,
  redactText,
} from "@/tools/caio-admin/redaction";

// Synthetic credential-shaped fixtures built by concatenation so the
// public-release static line scan never matches an assignment-form or
// URL-embedded credential; the runtime values stay entropy-shaped so the
// production redaction logic still fires on them.
const SECRET_TOKEN = ["sk-", "A1b2C3d4", "E5f6G7h8", "I9j0K1l2", "M3n4"].join(
  "",
);
const SECRET_URL = [
  "mysql:",
  "//",
  "helm:",
  "SuperSecretPw123@",
  "127.0.0.1",
  ":3306/caio",
].join("");

describe("redaction", () => {
  it("flags high-entropy values and URL credentials as secrets", () => {
    expect(looksLikeSecretValue(SECRET_TOKEN)).toBe(true);
    expect(looksLikeSecretValue(SECRET_URL)).toBe(true);
    expect(looksLikeSecretValue("0123456789abcdef0123456789abcdef")).toBe(true);
  });

  it("does not flag ordinary words or filesystem paths", () => {
    expect(looksLikeSecretValue("preflight")).toBe(false);
    expect(looksLikeSecretValue("/opt/caio/releases/pkg-abc123def456")).toBe(false);
    expect(looksLikeSecretValue("./relative/path/to/some-config.json")).toBe(false);
    expect(looksLikeSecretValue("short")).toBe(false);
  });

  it("scrubs URL credentials, secret env assignments, and tokens from text", () => {
    const text = `connecting DATABASE_URL=${SECRET_URL} with token ${SECRET_TOKEN}`;
    const scrubbed = redactText(text);
    expect(scrubbed).not.toContain("SuperSecretPw123");
    expect(scrubbed).not.toContain(SECRET_TOKEN);
    expect(scrubbed).toContain("DATABASE_URL=<redacted>");
  });

  it("scrubs argv copies including --flag=value forms", () => {
    const argv = ["install", `--api-token=${SECRET_TOKEN}`, SECRET_URL, "--json"];
    const scrubbed = redactArgv(argv);
    expect(scrubbed.join(" ")).not.toContain(SECRET_TOKEN);
    expect(scrubbed.join(" ")).not.toContain("SuperSecretPw123");
    expect(scrubbed).toContain("install");
    expect(scrubbed).toContain("--json");
  });

  it("scrubs env maps by key name and by value shape", () => {
    const scrubbed = redactEnv({
      DATABASE_URL: SECRET_URL,
      HOME: "/Users/operator",
      RANDOM_BLOB: SECRET_TOKEN,
    });
    expect(scrubbed.DATABASE_URL).toBe("<redacted>");
    expect(scrubbed.HOME).toBe("/Users/operator");
    expect(scrubbed.RANDOM_BLOB).toBe("<redacted>");
  });

  it("deep-redacts nested structures and secret-named keys", () => {
    const value = deepRedact({
      nested: { apiToken: "shortval", note: `uses ${SECRET_TOKEN}` },
      list: [SECRET_URL],
    });
    expect(JSON.stringify(value)).not.toContain(SECRET_TOKEN);
    expect(JSON.stringify(value)).not.toContain("SuperSecretPw123");
    expect((value.nested as { apiToken: string }).apiToken).toBe("<redacted>");
  });

  it("redacts private paths and logger output", () => {
    expect(redactPrivatePaths("wrote /private/cfg/x", ["/private/cfg/x"])).toBe(
      "wrote <redacted-path>",
    );
    const lines: string[] = [];
    const logger = createRedactingLogger((l) => lines.push(l), ["/private/cfg"]);
    logger.log(`saw ${SECRET_TOKEN} under /private/cfg/file`);
    expect(lines[0]).not.toContain(SECRET_TOKEN);
    expect(lines[0]).not.toContain("/private/cfg");
  });
});

describe("caio-admin result contract", () => {
  it("maps statuses to exit codes 0/2/3", () => {
    expect(okResult("preflight").exitCode).toBe(EXIT_OK);
    expect(failedResult("preflight").exitCode).toBe(EXIT_FAILED);
    expect(blockedResult("install", "package_digest_mismatch").exitCode).toBe(EXIT_BLOCKED);
  });

  it("enforces the blocked:<reason> format", () => {
    expect(blockedReasonOf("phase_order")).toBe("blocked:phase_order");
    expect(() => blockedReasonOf("Bad Reason!")).toThrow();
    expect(blockedResult("x", "backup_failed").blockedReason).toBe("blocked:backup_failed");
  });

  it("renders the same structure in --json mode with no secret values", () => {
    const result = okResult("configure", {
      findings: [{ checkKey: "cred", status: "ok", detail: `checked ${SECRET_TOKEN}` }],
      detail: { url: SECRET_URL },
    });
    const json = renderCaioAdminResult(result, { json: true });
    const parsed = JSON.parse(json) as { command: string; findings: unknown[] };
    expect(parsed.command).toBe("configure");
    expect(parsed.findings).toHaveLength(1);
    expect(json).not.toContain(SECRET_TOKEN);
    expect(json).not.toContain("SuperSecretPw123");
  });

  it("text mode additionally redacts private input paths by default", () => {
    const result = okResult("configure", {
      detail: { configPath: "/owner/private/cfg/caio-admin.json" },
      privateInputPaths: ["/owner/private/cfg"],
    });
    const text = renderCaioAdminResult(result);
    expect(text).not.toContain("/owner/private/cfg");
    expect(text).toContain("<redacted-path>");
  });
});
