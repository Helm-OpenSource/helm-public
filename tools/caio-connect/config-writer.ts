/**
 * caio-connect config writer — persists pairing results into client configs.
 *
 * - Codex target: secrets go into the macOS Keychain via an injected
 *   KeychainPort; the on-disk launch config carries NON-SECRET parts only.
 *   If secure storage is unavailable or fails, the just-issued tokens are
 *   revoked immediately via the revocation port and the write is blocked.
 * - WorkBuddy target: 0600 config file, supported schema versions only; an
 *   unknown existing config shape blocks the write (never guess, never
 *   destroy the user's config).
 * - Every replace goes: secret-free backup copy (0600, .caio-backup-<ts>)
 *   then atomic tmp+rename. Pairing never enables feature flags.
 *
 * Real Keychain access is a platform adapter concern (out of scope here).
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";

import { type PairedTokens } from "@/tools/caio-connect/pairing-protocol";

export const CONFIG_FILE_MODE = 0o600;
export const KEYCHAIN_SERVICE = "caio-connect";
export const KEYCHAIN_MCP_ACCOUNT = "codex-mcp-token";
export const KEYCHAIN_MODEL_ACCOUNT = "codex-model-token";

const SECRET_KEY_PATTERN =
  /(secret|token|passwd|password|credential|api[-_]?key|private[-_]?key)/i;

export interface KeychainPort {
  setSecret(service: string, account: string, value: string): Promise<void>;
}

export interface TokenRevocationPort {
  /** Immediately revokes the just-issued pairing tokens on the gateway. */
  revoke(reason: string): Promise<{ revoked: boolean; receiptRef?: string }>;
}

export type ConfigWriteResult =
  | {
      status: "ok";
      configPath: string;
      backupPath?: string;
    }
  | {
      status: "blocked";
      blockedReason:
        | "blocked:keychain_unavailable"
        | "blocked:secure_storage_write_failed"
        | "blocked:unsupported_config_format";
      tokensRevoked?: boolean;
      revocationReceiptRef?: string;
    };

async function readFileOrNull(p: string): Promise<string | null> {
  try {
    return await fs.readFile(p, "utf8");
  } catch {
    return null;
  }
}

/** Deep-copy a JSON value with every secret-named key's value stripped. */
export function stripSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((entry) => stripSecrets(entry));
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SECRET_KEY_PATTERN.test(key) ? "<stripped>" : stripSecrets(entry);
    }
    return out;
  }
  return value;
}

async function writeSecretFreeBackup(
  configPath: string,
  now: number,
): Promise<string | undefined> {
  const existing = await readFileOrNull(configPath);
  if (existing === null) return undefined;
  const backupPath = `${configPath}.caio-backup-${now}`;
  let backupBody: string;
  try {
    backupBody = `${JSON.stringify(stripSecrets(JSON.parse(existing)), null, 2)}\n`;
  } catch {
    // Non-JSON prior content is preserved structurally but not verbatim to
    // avoid copying opaque secret blobs into the backup.
    backupBody = JSON.stringify({ note: "previous config was not JSON; content withheld from backup" });
  }
  await fs.writeFile(backupPath, backupBody, { mode: CONFIG_FILE_MODE });
  await fs.chmod(backupPath, CONFIG_FILE_MODE);
  return backupPath;
}

async function atomicWrite(configPath: string, body: string, now: number): Promise<void> {
  const dir = path.dirname(configPath);
  await fs.mkdir(dir, { recursive: true });
  const tmpPath = path.join(dir, `.${path.basename(configPath)}.tmp-${process.pid}-${now}`);
  await fs.writeFile(tmpPath, body, { mode: CONFIG_FILE_MODE });
  await fs.chmod(tmpPath, CONFIG_FILE_MODE);
  await fs.rename(tmpPath, configPath);
}

// ---------------------------------------------------------------------------
// Codex target
// ---------------------------------------------------------------------------

export interface WriteCodexConfigInput {
  tokens: PairedTokens;
  /** Absent on hosts without Keychain access → blocked + token revocation. */
  keychain?: KeychainPort;
  revocation: TokenRevocationPort;
  launchConfigPath: string;
  now?: number;
}

export async function writeCodexClientConfig(
  input: WriteCodexConfigInput,
): Promise<ConfigWriteResult> {
  const now = input.now ?? Date.now();

  if (!input.keychain) {
    const revocation = await input.revocation.revoke("keychain_unavailable");
    return {
      status: "blocked",
      blockedReason: "blocked:keychain_unavailable",
      tokensRevoked: revocation.revoked,
      revocationReceiptRef: revocation.receiptRef,
    };
  }

  try {
    await input.keychain.setSecret(KEYCHAIN_SERVICE, KEYCHAIN_MCP_ACCOUNT, input.tokens.mcpToken);
    await input.keychain.setSecret(
      KEYCHAIN_SERVICE,
      KEYCHAIN_MODEL_ACCOUNT,
      input.tokens.modelToken,
    );
  } catch {
    // Secure-storage write failure → immediate revocation, nothing persisted.
    const revocation = await input.revocation.revoke("secure_storage_write_failed");
    return {
      status: "blocked",
      blockedReason: "blocked:secure_storage_write_failed",
      tokensRevoked: revocation.revoked,
      revocationReceiptRef: revocation.receiptRef,
    };
  }

  // Launch config: NON-SECRET parts only — keychain coordinates, not values.
  const launchConfig = {
    schemaVersion: "caio.codex.launch/1",
    keychain: {
      service: KEYCHAIN_SERVICE,
      accounts: {
        mcpToken: KEYCHAIN_MCP_ACCOUNT,
        modelToken: KEYCHAIN_MODEL_ACCOUNT,
      },
    },
    pairedAt: new Date(now).toISOString(),
  };
  const backupPath = await writeSecretFreeBackup(input.launchConfigPath, now);
  await atomicWrite(
    input.launchConfigPath,
    `${JSON.stringify(launchConfig, null, 2)}\n`,
    now,
  );
  return { status: "ok", configPath: input.launchConfigPath, backupPath };
}

// ---------------------------------------------------------------------------
// WorkBuddy target
// ---------------------------------------------------------------------------

export const WORKBUDDY_SCHEMA_VERSION = "caio.workbuddy/1";
export const SUPPORTED_WORKBUDDY_SCHEMA_VERSIONS: readonly string[] = [
  WORKBUDDY_SCHEMA_VERSION,
];

const workBuddyConfigShape = z.object({
  schemaVersion: z.string(),
});

export interface WriteWorkBuddyConfigInput {
  tokens: PairedTokens;
  configPath: string;
  gatewayHost: string;
  gatewayPort: number;
  now?: number;
}

export async function writeWorkBuddyConfig(
  input: WriteWorkBuddyConfigInput,
): Promise<ConfigWriteResult> {
  const now = input.now ?? Date.now();

  // Supported schema versions only: unknown existing shapes are untouchable.
  const existing = await readFileOrNull(input.configPath);
  if (existing !== null) {
    let recognized = false;
    try {
      const parsed = workBuddyConfigShape.safeParse(JSON.parse(existing));
      recognized =
        parsed.success &&
        SUPPORTED_WORKBUDDY_SCHEMA_VERSIONS.includes(parsed.data.schemaVersion);
    } catch {
      recognized = false;
    }
    if (!recognized) {
      return { status: "blocked", blockedReason: "blocked:unsupported_config_format" };
    }
  }

  const config = {
    schemaVersion: WORKBUDDY_SCHEMA_VERSION,
    gateway: { host: input.gatewayHost, port: input.gatewayPort },
    credentials: {
      mcpToken: input.tokens.mcpToken,
      modelToken: input.tokens.modelToken,
    },
    pairedAt: new Date(now).toISOString(),
    // Deliberately NO feature-flag keys: pairing never enables features.
  };
  const backupPath = await writeSecretFreeBackup(input.configPath, now);
  await atomicWrite(input.configPath, `${JSON.stringify(config, null, 2)}\n`, now);
  return { status: "ok", configPath: input.configPath, backupPath };
}

// ---------------------------------------------------------------------------
// Backup restore
// ---------------------------------------------------------------------------

/**
 * Restore a previous backup over the current config (atomic). Note backups
 * are secret-free, so a restored config requires re-pairing for credentials.
 */
export async function restoreBackup(input: {
  configPath: string;
  backupPath: string;
  now?: number;
}): Promise<{ restored: boolean }> {
  const body = await readFileOrNull(input.backupPath);
  if (body === null) return { restored: false };
  await atomicWrite(input.configPath, body, input.now ?? Date.now());
  return { restored: true };
}
