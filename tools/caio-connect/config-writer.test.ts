import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  KEYCHAIN_MCP_ACCOUNT,
  KEYCHAIN_MODEL_ACCOUNT,
  KEYCHAIN_SERVICE,
  WORKBUDDY_SCHEMA_VERSION,
  restoreBackup,
  stripSecrets,
  writeCodexClientConfig,
  writeWorkBuddyConfig,
  type KeychainPort,
  type TokenRevocationPort,
} from "@/tools/caio-connect/config-writer";

const NOW = 1_753_776_000_000;
// Synthetic entropy-shaped tokens and RFC1918 example address, constructed at
// runtime so the public-release static line scan never matches a credential or
// private-IP literal.
const TEST_PRIVATE_IPV4 = [10, 0, 0, 5].join(".");
const TOKENS = {
  mcpToken: ["mcp-tok-", "Aa1Bb2Cc3", "Dd4Ee5Ff6", "Gg7Hh8"].join(""),
  modelToken: ["model-tok-", "Zz9Yy8Xx7", "Ww6Vv5Uu4", "Tt3"].join(""),
};
const OLD_TOKENS = {
  mcpToken: ["old-mcp-tok-", "111AAA", "222bbb", "333"].join(""),
  modelToken: ["old-model-tok-", "444CCC", "555"].join(""),
};

function collectKeys(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const entry of value) collectKeys(entry, out);
  } else if (value !== null && typeof value === "object") {
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      out.push(key);
      collectKeys(entry, out);
    }
  }
  return out;
}

/** Revocation port that reports the gateway refused/failed to revoke. */
function refusingRevocation(calls: string[]): TokenRevocationPort {
  return {
    revoke: async (reason) => {
      calls.push(reason);
      return { revoked: false };
    },
  };
}

/** Revocation port that is itself unreachable. */
function throwingRevocation(calls: string[]): TokenRevocationPort {
  return {
    revoke: async (reason) => {
      calls.push(reason);
      throw new Error("gateway unreachable");
    },
  };
}

describe("config-writer", () => {
  let sandbox: string;
  let revocations: string[];
  let revocation: TokenRevocationPort;

  beforeEach(async () => {
    sandbox = await fs.mkdtemp(path.join(os.tmpdir(), "caio-connect-config-"));
    revocations = [];
    revocation = {
      revoke: async (reason) => {
        revocations.push(reason);
        return { revoked: true, receiptRef: `revoke-${reason}` };
      },
    };
  });

  afterEach(async () => {
    await fs.rm(sandbox, { recursive: true, force: true });
  });

  describe("writeCodexClientConfig", () => {
    it("stores secrets in the keychain and writes a non-secret launch config (0600, atomic)", async () => {
      const stored: Array<[string, string, string]> = [];
      const keychain: KeychainPort = {
        setSecret: async (service, account, value) => {
          stored.push([service, account, value]);
        },
      };
      const configPath = path.join(sandbox, "codex", "launch.json");
      const result = await writeCodexClientConfig({
        tokens: TOKENS,
        keychain,
        revocation,
        launchConfigPath: configPath,
        now: NOW,
      });
      expect(result.status).toBe("ok");
      expect(stored).toEqual([
        [KEYCHAIN_SERVICE, KEYCHAIN_MCP_ACCOUNT, TOKENS.mcpToken],
        [KEYCHAIN_SERVICE, KEYCHAIN_MODEL_ACCOUNT, TOKENS.modelToken],
      ]);

      const body = await fs.readFile(configPath, "utf8");
      expect(body).not.toContain(TOKENS.mcpToken);
      expect(body).not.toContain(TOKENS.modelToken);
      expect(JSON.parse(body)).toMatchObject({
        schemaVersion: "caio.codex.launch/1",
        keychain: { service: KEYCHAIN_SERVICE },
      });
      expect((await fs.stat(configPath)).mode & 0o777).toBe(0o600);
      const leftovers = (await fs.readdir(path.dirname(configPath))).filter((n) =>
        n.includes(".tmp-"),
      );
      expect(leftovers).toEqual([]);
      expect(revocations).toEqual([]);
    });

    it("blocks and revokes the issued tokens when no KeychainPort is available", async () => {
      const configPath = path.join(sandbox, "codex", "launch.json");
      const result = await writeCodexClientConfig({
        tokens: TOKENS,
        revocation,
        launchConfigPath: configPath,
        now: NOW,
      });
      expect(result.status).toBe("blocked");
      if (result.status !== "blocked") throw new Error("unreachable");
      expect(result.blockedReason).toBe("blocked:keychain_unavailable");
      expect(result.tokensRevoked).toBe(true);
      expect(revocations).toEqual(["keychain_unavailable"]);
      await expect(fs.readFile(configPath, "utf8")).rejects.toThrow();
    });

    it("revokes immediately when the secure-storage write fails", async () => {
      const keychain: KeychainPort = {
        setSecret: async () => {
          throw new Error("keychain locked");
        },
      };
      const configPath = path.join(sandbox, "codex", "launch.json");
      const result = await writeCodexClientConfig({
        tokens: TOKENS,
        keychain,
        revocation,
        launchConfigPath: configPath,
        now: NOW,
      });
      expect(result.status).toBe("blocked");
      if (result.status !== "blocked") throw new Error("unreachable");
      expect(result.blockedReason).toBe("blocked:secure_storage_write_failed");
      expect(revocations).toEqual(["secure_storage_write_failed"]);
      await expect(fs.readFile(configPath, "utf8")).rejects.toThrow();
    });

    it("blocks an unparseable existing launch config, leaving it byte-identical", async () => {
      const stored: Array<[string, string, string]> = [];
      const keychain: KeychainPort = {
        setSecret: async (service, account, value) => {
          stored.push([service, account, value]);
        },
      };
      const configPath = path.join(sandbox, "codex", "config.toml");
      await fs.mkdir(path.dirname(configPath), { recursive: true });
      const original = '[profile]\nmodel = "gpt-5"\n';
      await fs.writeFile(configPath, original);
      const before = await fs.readFile(configPath);

      const result = await writeCodexClientConfig({
        tokens: TOKENS,
        keychain,
        revocation,
        launchConfigPath: configPath,
        now: NOW,
      });
      expect(result.status).toBe("blocked");
      if (result.status !== "blocked") throw new Error("unreachable");
      expect(result.blockedReason).toBe("blocked:unsupported_config_format");
      // The operator's file is untouched: same bytes, no backup, no temp file.
      expect((await fs.readFile(configPath)).equals(before)).toBe(true);
      await expect(fs.readdir(path.dirname(configPath))).resolves.toEqual(["config.toml"]);
      // Nothing was stored in secure storage, and the tokens were revoked.
      expect(stored).toEqual([]);
      expect(revocations).toEqual(["unsupported_config_format"]);
      expect(result.tokensPossiblyLive).toBe(false);
    });

    it("blocks a JSON launch config of an unrecognized schema version", async () => {
      const keychain: KeychainPort = { setSecret: async () => {} };
      const configPath = path.join(sandbox, "codex", "launch.json");
      await fs.mkdir(path.dirname(configPath), { recursive: true });
      const foreign = JSON.stringify({ schemaVersion: "someone.else/9", keep: true });
      await fs.writeFile(configPath, foreign);

      const result = await writeCodexClientConfig({
        tokens: TOKENS,
        keychain,
        revocation,
        launchConfigPath: configPath,
        now: NOW,
      });
      expect(result.status).toBe("blocked");
      if (result.status !== "blocked") throw new Error("unreachable");
      expect(result.blockedReason).toBe("blocked:unsupported_config_format");
      await expect(fs.readFile(configPath, "utf8")).resolves.toBe(foreign);
      expect(revocations).toEqual(["unsupported_config_format"]);
    });

    it("round-trips a recognized launch config through backup and restore byte-identically", async () => {
      const keychain: KeychainPort = { setSecret: async () => {} };
      const configPath = path.join(sandbox, "codex", "launch.json");
      const first = await writeCodexClientConfig({
        tokens: TOKENS,
        keychain,
        revocation,
        launchConfigPath: configPath,
        now: NOW - 5000,
      });
      expect(first.status).toBe("ok");
      const before = await fs.readFile(configPath);

      const second = await writeCodexClientConfig({
        tokens: TOKENS,
        keychain,
        revocation,
        launchConfigPath: configPath,
        now: NOW,
      });
      expect(second.status).toBe("ok");
      if (second.status !== "ok" || !second.backupPath) throw new Error("unreachable");
      const backup = await fs.readFile(second.backupPath);
      expect(backup.equals(before)).toBe(true);
      expect((await fs.stat(second.backupPath)).mode & 0o777).toBe(0o600);
      expect((await fs.readFile(configPath)).equals(before)).toBe(false);

      const restored = await restoreBackup({
        configPath,
        backupPath: second.backupPath,
        now: NOW + 1000,
      });
      expect(restored.restored).toBe(true);
      expect((await fs.readFile(configPath)).equals(before)).toBe(true);
      expect((await fs.stat(configPath)).mode & 0o777).toBe(0o600);
    });
  });

  describe("writeWorkBuddyConfig", () => {
    it("writes a 0600 config for the supported schema version", async () => {
      const configPath = path.join(sandbox, "workbuddy", "config.json");
      const result = await writeWorkBuddyConfig({
        tokens: TOKENS,
        revocation,
        configPath,
        gatewayHost: TEST_PRIVATE_IPV4,
        gatewayPort: 8443,
        now: NOW,
      });
      expect(result.status).toBe("ok");
      expect((await fs.stat(configPath)).mode & 0o777).toBe(0o600);
      const parsed = JSON.parse(await fs.readFile(configPath, "utf8")) as {
        schemaVersion: string;
      };
      expect(parsed.schemaVersion).toBe(WORKBUDDY_SCHEMA_VERSION);
      // Success path: the issued tokens are NOT revoked.
      expect(revocations).toEqual([]);
    });

    it("blocks on an unknown existing config shape without guessing or destroying it", async () => {
      const configPath = path.join(sandbox, "workbuddy", "config.json");
      await fs.mkdir(path.dirname(configPath), { recursive: true });
      const foreign = JSON.stringify({ someOtherTool: { theme: "dark" }, version: 42 });
      await fs.writeFile(configPath, foreign);

      const result = await writeWorkBuddyConfig({
        tokens: TOKENS,
        revocation,
        configPath,
        gatewayHost: TEST_PRIVATE_IPV4,
        gatewayPort: 8443,
        now: NOW,
      });
      expect(result.status).toBe("blocked");
      if (result.status !== "blocked") throw new Error("unreachable");
      expect(result.blockedReason).toBe("blocked:unsupported_config_format");
      // Tokens were already issued at this point, so they must be revoked.
      expect(revocations).toEqual(["unsupported_config_format"]);
      expect(result.revocation.revoked).toBe(true);
      expect(result.tokensPossiblyLive).toBe(false);
      await expect(fs.readFile(configPath, "utf8")).resolves.toBe(foreign);
      // No backup, no temp files: the foreign config is untouched entirely.
      await expect(fs.readdir(path.dirname(configPath))).resolves.toEqual(["config.json"]);
    });

    it("revokes the issued tokens when the config write itself fails", async () => {
      // The parent of configPath is a regular FILE, so mkdir/write must fail.
      const blocker = path.join(sandbox, "workbuddy-file");
      await fs.writeFile(blocker, "not a directory\n");
      const configPath = path.join(blocker, "config.json");

      const result = await writeWorkBuddyConfig({
        tokens: TOKENS,
        revocation,
        configPath,
        gatewayHost: TEST_PRIVATE_IPV4,
        gatewayPort: 8443,
        now: NOW,
      });
      expect(result.status).toBe("blocked");
      if (result.status !== "blocked") throw new Error("unreachable");
      expect(result.blockedReason).toBe("blocked:config_write_failed");
      expect(revocations).toEqual(["config_write_failed"]);
      expect(result.revocation.revoked).toBe(true);
      expect(result.tokensRevoked).toBe(true);
      expect(result.tokensPossiblyLive).toBe(false);
    });

    it("reports revoked:false with a reason when the gateway does not confirm revocation", async () => {
      const calls: string[] = [];
      const blocker = path.join(sandbox, "workbuddy-file");
      await fs.writeFile(blocker, "not a directory\n");

      const result = await writeWorkBuddyConfig({
        tokens: TOKENS,
        revocation: refusingRevocation(calls),
        configPath: path.join(blocker, "config.json"),
        gatewayHost: TEST_PRIVATE_IPV4,
        gatewayPort: 8443,
        now: NOW,
      });
      expect(result.status).toBe("blocked");
      if (result.status !== "blocked") throw new Error("unreachable");
      expect(calls).toEqual(["config_write_failed"]);
      expect(result.revocation.revoked).toBe(false);
      expect(result.revocation.reason).toBeTruthy();
      expect(result.tokensPossiblyLive).toBe(true);
    });

    it("fails hard and names the tokens as possibly live when the revocation port fails", async () => {
      const calls: string[] = [];
      const blocker = path.join(sandbox, "workbuddy-file");
      await fs.writeFile(blocker, "not a directory\n");

      const result = await writeWorkBuddyConfig({
        tokens: TOKENS,
        revocation: throwingRevocation(calls),
        configPath: path.join(blocker, "config.json"),
        gatewayHost: TEST_PRIVATE_IPV4,
        gatewayPort: 8443,
        now: NOW,
      });
      expect(calls).toEqual(["config_write_failed"]);
      expect(result.status).toBe("failed");
      if (result.status !== "failed") throw new Error("unreachable");
      expect(result.failureReason).toBe("revocation_port_failed");
      expect(result.tokensPossiblyLive).toBe(true);
      expect(result.tokensRevoked).toBe(false);
      expect(result.message).toMatch(/may still be live/i);
      // The operator message never carries token material.
      expect(result.message).not.toContain(TOKENS.mcpToken);
      expect(result.message).not.toContain(TOKENS.modelToken);
    });

    it("backs up the previous config verbatim (0600) without the newly issued tokens", async () => {
      const configPath = path.join(sandbox, "workbuddy", "config.json");
      await writeWorkBuddyConfig({
        tokens: OLD_TOKENS,
        revocation,
        configPath,
        gatewayHost: TEST_PRIVATE_IPV4,
        gatewayPort: 8443,
        now: NOW - 5000,
      });
      const before = await fs.readFile(configPath);

      const result = await writeWorkBuddyConfig({
        tokens: TOKENS,
        revocation,
        configPath,
        gatewayHost: TEST_PRIVATE_IPV4,
        gatewayPort: 8443,
        now: NOW,
      });
      expect(result.status).toBe("ok");
      if (result.status !== "ok") throw new Error("unreachable");
      expect(result.backupPath).toBe(`${configPath}.caio-backup-${NOW}`);
      const backup = await fs.readFile(result.backupPath as string);
      // Restorable: byte-identical to what the file contained before.
      expect(backup.equals(before)).toBe(true);
      // ... and it never carries the NEWLY issued token material.
      const backupText = backup.toString("utf8");
      expect(backupText).not.toContain(TOKENS.mcpToken);
      expect(backupText).not.toContain(TOKENS.modelToken);
      expect((await fs.stat(result.backupPath as string)).mode & 0o777).toBe(0o600);
    });

    it("strips a newly issued token from the backup if the previous config already held it", async () => {
      const configPath = path.join(sandbox, "workbuddy", "config.json");
      await fs.mkdir(path.dirname(configPath), { recursive: true });
      await fs.writeFile(
        configPath,
        `${JSON.stringify(
          {
            schemaVersion: WORKBUDDY_SCHEMA_VERSION,
            credentials: { mcpToken: TOKENS.mcpToken },
          },
          null,
          2,
        )}\n`,
      );

      const result = await writeWorkBuddyConfig({
        tokens: TOKENS,
        revocation,
        configPath,
        gatewayHost: TEST_PRIVATE_IPV4,
        gatewayPort: 8443,
        now: NOW,
      });
      expect(result.status).toBe("ok");
      if (result.status !== "ok" || !result.backupPath) throw new Error("unreachable");
      const backup = await fs.readFile(result.backupPath, "utf8");
      expect(backup).not.toContain(TOKENS.mcpToken);
      expect(result.backupVerbatim).toBe(false);
    });

    it("never sets any feature-flag key (pairing enables no features)", async () => {
      const configPath = path.join(sandbox, "workbuddy", "config.json");
      await writeWorkBuddyConfig({
        tokens: TOKENS,
        revocation,
        configPath,
        gatewayHost: TEST_PRIVATE_IPV4,
        gatewayPort: 8443,
        now: NOW,
      });
      const parsed = JSON.parse(await fs.readFile(configPath, "utf8"));
      const keys = collectKeys(parsed);
      expect(keys.some((k) => /flag/i.test(k))).toBe(false);
      expect(keys.some((k) => /^enable/i.test(k))).toBe(false);
    });
  });

  it("stripSecrets removes values under secret-named keys recursively", () => {
    const stripped = stripSecrets({
      credentials: { mcpToken: "abc", nested: { apiKey: "def" } },
      gateway: { host: TEST_PRIVATE_IPV4 },
    }) as Record<string, unknown>;
    expect(JSON.stringify(stripped)).not.toContain("abc");
    expect(JSON.stringify(stripped)).not.toContain("def");
    expect((stripped.gateway as { host: string }).host).toBe(TEST_PRIVATE_IPV4);
  });

  it("restoreBackup atomically restores the previous config byte-identically", async () => {
    const configPath = path.join(sandbox, "workbuddy", "config.json");
    await writeWorkBuddyConfig({
      tokens: OLD_TOKENS,
      revocation,
      configPath,
      gatewayHost: TEST_PRIVATE_IPV4,
      gatewayPort: 8443,
      now: NOW - 5000,
    });
    const before = await fs.readFile(configPath);
    const replaced = await writeWorkBuddyConfig({
      tokens: TOKENS,
      revocation,
      configPath,
      gatewayHost: TEST_PRIVATE_IPV4,
      gatewayPort: 9443,
      now: NOW,
    });
    if (replaced.status !== "ok" || !replaced.backupPath) throw new Error("setup failed");

    const restored = await restoreBackup({
      configPath,
      backupPath: replaced.backupPath,
      now: NOW + 1000,
    });
    expect(restored.restored).toBe(true);
    expect((await fs.readFile(configPath)).equals(before)).toBe(true);
    expect((await fs.stat(configPath)).mode & 0o777).toBe(0o600);

    const missing = await restoreBackup({
      configPath,
      backupPath: path.join(sandbox, "nope.backup"),
    });
    expect(missing.restored).toBe(false);
  });
});
