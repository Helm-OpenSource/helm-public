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

const SECRET_VALUE = "sk-A1b2C3d4E5f6G7h8I9j0K1l2M3n4";
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
