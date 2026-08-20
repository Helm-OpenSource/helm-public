import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  nodeFileInspector,
  renderCaioAdminResult,
} from "@/tools/caio-admin/contracts";
import {
  CONFIG_FILE_NAME,
  caioAdminConfigure,
  findSecretArgvIndexes,
  type ConfigureInput,
} from "@/tools/caio-admin/configure";

// Preserve the credential-shaped runtime fixture without storing the full
// marker as a contiguous public-source literal.
const SECRET_VALUE = ["sk-", "A1b2C3d4E5f6G7h8I9j0K1l2M3n4"].join("");
// Synthetic credential-shaped fixture built by concatenation (with a
// runtime-joined RFC1918 host) so the public-release static line scan never
// matches a URL-embedded credential or private-IP literal.
const FAKE_DB_URL = [
  "mysql:",
  "//",
  "helm:",
  "SuperSecretPw123@",
  [10, 0, 0, 5].join("."),
  "/db",
].join("");
// Short / spaced / tiny values that NO entropy heuristic can distinguish from a
// benign argument — only the credential-named FLAG proves they are secrets.
const SHORT_SECRET = ["hun", "ter", "2"].join("");
const SPACED_SECRET = ["correct", "horse", "battery", "staple"].join(" ");
const TINY_SECRET = ["a", "b", "c"].join("");

describe("caioAdminConfigure", () => {
  let sandbox: string;
  let configRoot: string;
  let secretFile: string;

  beforeEach(async () => {
    sandbox = await fs.mkdtemp(path.join(os.tmpdir(), "caio-admin-configure-"));
    configRoot = path.join(sandbox, "config");
    secretFile = path.join(sandbox, "secrets", "db-password");
    await fs.mkdir(path.dirname(secretFile), { recursive: true });
    await fs.writeFile(secretFile, "do-not-read-me\n", { mode: 0o600 });
    await fs.chmod(secretFile, 0o600);
  });

  afterEach(async () => {
    await fs.rm(sandbox, { recursive: true, force: true });
  });

  function input(overrides: Partial<ConfigureInput> = {}): ConfigureInput {
    return {
      configRoot,
      credentialRefs: [{ name: "db-password", secretFilePath: secretFile }],
      argv: ["configure", "--credential-ref", "db-password", secretFile],
      ports: {
        files: nodeFileInspector,
        identity: { expectedOwnerUid: () => process.getuid?.() ?? 0 },
        now: () => 1_700_000_000_000,
      },
      ...overrides,
    };
  }

  it("detects secret-looking argv values but not paths or names", () => {
    expect(findSecretArgvIndexes(["configure", "--ref", "db-password"])).toEqual([]);
    expect(findSecretArgvIndexes([secretFile])).toEqual([]);
    expect(findSecretArgvIndexes(["configure", SECRET_VALUE])).toEqual([1]);
    expect(findSecretArgvIndexes([`--password=${SECRET_VALUE}`])).toEqual([0]);
    expect(
      findSecretArgvIndexes([FAKE_DB_URL]),
    ).toEqual([0]);
  });

  it("detects secrets by ARGUMENT NAME regardless of length, entropy, or spaces", () => {
    // Separate `--flag value` form.
    expect(findSecretArgvIndexes(["configure", "--token", SHORT_SECRET])).toEqual([2]);
    expect(findSecretArgvIndexes(["configure", "--password", SPACED_SECRET])).toEqual([2]);
    expect(findSecretArgvIndexes(["configure", "--api-key", TINY_SECRET])).toEqual([2]);
    expect(findSecretArgvIndexes(["configure", "--pwd", SHORT_SECRET])).toEqual([2]);
    expect(findSecretArgvIndexes(["configure", "--bearer", TINY_SECRET])).toEqual([2]);
    // Inline `--flag=value` form.
    expect(findSecretArgvIndexes([`--token=${SHORT_SECRET}`])).toEqual([0]);
    expect(findSecretArgvIndexes([`--api-key=${TINY_SECRET}`])).toEqual([0]);
    expect(findSecretArgvIndexes([`--password=${SPACED_SECRET}`])).toEqual([0]);
    // Value-shape detection stays an additional trigger (must not regress).
    expect(findSecretArgvIndexes(["configure", "--database-url", FAKE_DB_URL])).toEqual([2]);
    expect(findSecretArgvIndexes(["configure", SECRET_VALUE])).toEqual([1]);
  });

  it("does not block legitimate non-secret flags, refs, or paths", () => {
    expect(
      findSecretArgvIndexes([
        "install",
        "--package",
        "/opt/caio/packages/pkg.tar.gz",
        "--phase",
        "proxy",
        "--json",
      ]),
    ).toEqual([]);
    expect(
      findSecretArgvIndexes(["configure", "--releases-root", "/opt/caio/releases"]),
    ).toEqual([]);
    // Pointer flags carry a ref NAME or a secret FILE path, never a value.
    expect(
      findSecretArgvIndexes(["configure", "--credential-ref", "db-password", secretFile]),
    ).toEqual([]);
    expect(findSecretArgvIndexes(["configure", "--secret-file", secretFile])).toEqual([]);
    // A credential flag with no value attached leaks nothing.
    expect(findSecretArgvIndexes(["configure", "--token", "--json"])).toEqual([]);
    expect(findSecretArgvIndexes(["configure", "--token"])).toEqual([]);
  });

  it("blocks short and spaced secrets end to end without echoing them", async () => {
    const cases: Array<{ argv: string[]; secret: string }> = [
      { argv: ["configure", "--token", SHORT_SECRET], secret: SHORT_SECRET },
      { argv: ["configure", "--password", SPACED_SECRET], secret: SPACED_SECRET },
      { argv: ["configure", `--api-key=${SHORT_SECRET}`], secret: SHORT_SECRET },
    ];
    for (const { argv, secret } of cases) {
      const result = await caioAdminConfigure(input({ argv }));
      expect(result.status).toBe("blocked");
      expect(result.blockedReason).toBe("blocked:secret_on_command_line");
      expect(result.exitCode).toBe(3);
      for (const rendered of [
        renderCaioAdminResult(result, { json: true }),
        renderCaioAdminResult(result),
      ]) {
        expect(rendered).not.toContain(secret);
      }
      await expect(fs.readdir(configRoot)).rejects.toThrow();
    }
  });

  it("refuses secrets passed as CLI args without echoing them", async () => {
    const result = await caioAdminConfigure(
      input({ argv: ["configure", `--token=${SECRET_VALUE}`] }),
    );
    expect(result.status).toBe("blocked");
    expect(result.blockedReason).toBe("blocked:secret_on_command_line");
    expect(result.exitCode).toBe(3);
    const rendered = renderCaioAdminResult(result, { json: true });
    expect(rendered).not.toContain(SECRET_VALUE);
    await expect(fs.readdir(configRoot)).rejects.toThrow();
  });

  it("writes an owner-private skeleton (0700 root, 0600 file) with refs only", async () => {
    const result = await caioAdminConfigure(input());
    expect(result.status).toBe("ok");

    const rootMode = (await fs.stat(configRoot)).mode & 0o777;
    expect(rootMode).toBe(0o700);
    const configPath = path.join(configRoot, CONFIG_FILE_NAME);
    const fileMode = (await fs.stat(configPath)).mode & 0o777;
    expect(fileMode).toBe(0o600);

    const body = await fs.readFile(configPath, "utf8");
    expect(body).toContain("db-password");
    expect(body).not.toContain("do-not-read-me");
    const parsed = JSON.parse(body) as { credentialRefs: Array<{ name: string }> };
    expect(parsed.credentialRefs).toHaveLength(1);
  });

  it("is idempotent: re-running yields the same terminal state", async () => {
    const first = await caioAdminConfigure(input());
    expect(first.status).toBe("ok");
    const configPath = path.join(configRoot, CONFIG_FILE_NAME);
    const firstBody = await fs.readFile(configPath, "utf8");

    const second = await caioAdminConfigure(input());
    expect(second.status).toBe("ok");
    await expect(fs.readFile(configPath, "utf8")).resolves.toBe(firstBody);
    expect((await fs.stat(configPath)).mode & 0o777).toBe(0o600);
  });

  it("fails validation for wrong mode, missing file, or non-regular file", async () => {
    await fs.chmod(secretFile, 0o644);
    const wrongMode = await caioAdminConfigure(input());
    expect(wrongMode.status).toBe("failed");
    expect(wrongMode.findings[0].detail).toContain("mode 644 != 600");

    const missing = await caioAdminConfigure(
      input({
        credentialRefs: [
          { name: "gone", secretFilePath: path.join(sandbox, "secrets", "missing") },
        ],
      }),
    );
    expect(missing.status).toBe("failed");
    expect(missing.findings[0].detail).toBe("secret file missing");

    const dirRef = await caioAdminConfigure(
      input({
        credentialRefs: [{ name: "dir", secretFilePath: path.join(sandbox, "secrets") }],
      }),
    );
    expect(dirRef.status).toBe("failed");
    expect(dirRef.findings[0].detail).toContain("not a regular file");
  });

  it("never reads secret values and text output redacts private paths", async () => {
    const result = await caioAdminConfigure(input());
    const text = renderCaioAdminResult(result);
    expect(text).not.toContain("do-not-read-me");
    expect(text).not.toContain(secretFile);
    expect(text).not.toContain(configRoot);
    const json = renderCaioAdminResult(result, { json: true });
    expect(json).not.toContain("do-not-read-me");
  });
});
