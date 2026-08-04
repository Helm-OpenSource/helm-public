/**
 * caio-connect config writer — persists pairing results into client configs.
 *
 * Both client paths share one invariant: the tokens are ALREADY ISSUED when
 * these functions are entered, so every failure after entry — unavailable
 * Keychain, secure-storage write failure, unsupported existing config shape,
 * backup failure, atomic-write/rename failure — MUST revoke them through the
 * required revocation port, and the returned result must state whether that
 * revocation succeeded. If the revocation port itself fails, the result is a
 * hard failure that names the tokens as possibly-live; never a quiet success.
 *
 * - Codex target: secrets go into the macOS Keychain via an injected
 *   KeychainPort; the on-disk launch config carries NON-SECRET parts only.
 * - WorkBuddy target: 0600 config file.
 * - BOTH targets gate on the existing file's shape: unparseable, or a
 *   schemaVersion outside the supported set, is `unsupported_config_format`
 *   and leaves the file byte-identical (never guess, never destroy).
 * - Every replace goes: verbatim 0600 backup (`.caio-backup-<ts>`, restorable
 *   through restoreBackup) then atomic tmp+rename. The backup preserves the
 *   ORIGINAL bytes and never receives newly issued token material. Pairing
 *   never enables feature flags.
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

/** Minimal recognized-config shape: a schemaVersion we know how to replace. */
const configShape = z.object({ schemaVersion: z.string() });

export interface KeychainPort {
  setSecret(service: string, account: string, value: string): Promise<void>;
}

export interface TokenRevocationPort {
  /** Immediately revokes the just-issued pairing tokens on the gateway. */
  revoke(reason: string): Promise<{ revoked: boolean; receiptRef?: string }>;
}

export type ConfigWriteBlockedReason =
  | "blocked:keychain_unavailable"
  | "blocked:secure_storage_write_failed"
  | "blocked:unsupported_config_format"
  | "blocked:config_write_failed";

/** Outcome of the mandatory revocation attempt after a post-issue failure. */
export interface RevocationOutcome {
  revoked: boolean;
  receiptRef?: string;
  /** Present when `revoked === false`: why the tokens may still be live. */
  reason?: string;
}

export type ConfigWriteResult =
  | {
      status: "ok";
      configPath: string;
      backupPath?: string;
      /**
       * False when the backup had to strip newly issued token material out of
       * the original bytes (pathological: the prior file already held it).
       */
      backupVerbatim?: boolean;
    }
  | {
      status: "blocked";
      blockedReason: ConfigWriteBlockedReason;
      revocation: RevocationOutcome;
      /** Mirror of `revocation.revoked` for rendering/receipts. */
      tokensRevoked: boolean;
      revocationReceiptRef?: string;
      /** True when the issued tokens may still be live on the gateway. */
      tokensPossiblyLive: boolean;
    }
  | {
      status: "failed";
      /** The revocation port itself could not be reached or errored. */
      failureReason: "revocation_port_failed";
      /** The post-issue failure that triggered the revocation attempt. */
      blockedReason: ConfigWriteBlockedReason;
      revocation: RevocationOutcome;
      tokensRevoked: false;
      tokensPossiblyLive: true;
      /** Operator-facing message; names the risk, never a token value. */
      message: string;
    };

async function readFileBytesOrNull(p: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(p);
  } catch {
    return null;
  }
}

/**
 * Mandatory revocation for any failure that happens AFTER the tokens exist.
 * Never throws: a failing revocation port becomes a hard `failed` result that
 * names the tokens as possibly-live. Carries no fs error text (paths) and no
 * token material into the result.
 */
async function revokeIssuedTokens(
  revocation: TokenRevocationPort,
  blockedReason: ConfigWriteBlockedReason,
  reason: string,
): Promise<ConfigWriteResult> {
  try {
    const outcome = await revocation.revoke(reason);
    if (outcome.revoked) {
      return {
        status: "blocked",
        blockedReason,
        revocation: { revoked: true, receiptRef: outcome.receiptRef },
        tokensRevoked: true,
        revocationReceiptRef: outcome.receiptRef,
        tokensPossiblyLive: false,
      };
    }
    return {
      status: "blocked",
      blockedReason,
      revocation: {
        revoked: false,
        receiptRef: outcome.receiptRef,
        reason: `gateway did not confirm revocation after ${reason}; the issued tokens may still be live`,
      },
      tokensRevoked: false,
      revocationReceiptRef: outcome.receiptRef,
      tokensPossiblyLive: true,
    };
  } catch {
    return {
      status: "failed",
      failureReason: "revocation_port_failed",
      blockedReason,
      revocation: { revoked: false, reason: "revocation port failed" },
      tokensRevoked: false,
      tokensPossiblyLive: true,
      message: `pairing tokens were issued but neither stored (${reason}) nor revoked: they may still be live on the gateway and must be revoked manually`,
    };
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

/** Marker written in place of newly issued token material, if ever present. */
export const BACKUP_STRIPPED_MARKER = "<stripped>";

/**
 * Write a RESTORABLE backup of the original bytes at 0600. The original file's
 * own content is what must be recoverable, so it is preserved verbatim — its
 * secrets (if any) stay behind a 0600 mode and are never logged. The single
 * exception: newly issued token material is never copied into a backup, so any
 * occurrence of it (only possible if the prior file already held that exact
 * value) is replaced and the backup is reported as non-verbatim.
 */
async function writeConfigBackup(
  configPath: string,
  originalBytes: Buffer | null,
  now: number,
  issuedTokens: readonly string[],
): Promise<{ backupPath: string; verbatim: boolean } | undefined> {
  if (originalBytes === null) return undefined;
  const backupPath = `${configPath}.caio-backup-${now}`;
  let body: Buffer = originalBytes;
  let verbatim = true;
  let text = originalBytes.toString("utf8");
  for (const token of issuedTokens) {
    if (token.length > 0 && text.includes(token)) {
      text = text.split(token).join(BACKUP_STRIPPED_MARKER);
      verbatim = false;
    }
  }
  if (!verbatim) body = Buffer.from(text, "utf8");
  // `wx`: a backup never overwrites another backup.
  await fs.writeFile(backupPath, body, { mode: CONFIG_FILE_MODE, flag: "wx" });
  await fs.chmod(backupPath, CONFIG_FILE_MODE);
  return { backupPath, verbatim };
}

async function atomicWrite(
  configPath: string,
  body: string | Buffer,
  now: number,
): Promise<void> {
  const dir = path.dirname(configPath);
  await fs.mkdir(dir, { recursive: true });
  const tmpPath = path.join(dir, `.${path.basename(configPath)}.tmp-${process.pid}-${now}`);
  await fs.writeFile(tmpPath, body, { mode: CONFIG_FILE_MODE });
  await fs.chmod(tmpPath, CONFIG_FILE_MODE);
  await fs.rename(tmpPath, configPath);
}

/**
 * Shared supported-shape gate for both client paths: parseable JSON whose
 * schemaVersion is on the caller's supported list. Anything else is an
 * unrecognized config that must be left alone.
 */
function isSupportedConfigShape(
  bytes: Buffer,
  supportedSchemaVersions: readonly string[],
): boolean {
  try {
    const parsed = configShape.safeParse(JSON.parse(bytes.toString("utf8")));
    return parsed.success && supportedSchemaVersions.includes(parsed.data.schemaVersion);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Codex target
// ---------------------------------------------------------------------------

export const CODEX_LAUNCH_SCHEMA_VERSION = "caio.codex.launch/1";
export const SUPPORTED_CODEX_LAUNCH_SCHEMA_VERSIONS: readonly string[] = [
  CODEX_LAUNCH_SCHEMA_VERSION,
];

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
  const issued = [input.tokens.mcpToken, input.tokens.modelToken];

  // Supported schema versions only: an unparseable or unrecognized existing
  // launch config is untouchable. Checked FIRST so a foreign file is never
  // destroyed and nothing is put into secure storage that we then revoke.
  const existing = await readFileBytesOrNull(input.launchConfigPath);
  if (
    existing !== null &&
    !isSupportedConfigShape(existing, SUPPORTED_CODEX_LAUNCH_SCHEMA_VERSIONS)
  ) {
    return revokeIssuedTokens(
      input.revocation,
      "blocked:unsupported_config_format",
      "unsupported_config_format",
    );
  }

  if (!input.keychain) {
    return revokeIssuedTokens(
      input.revocation,
      "blocked:keychain_unavailable",
      "keychain_unavailable",
    );
  }

  try {
    await input.keychain.setSecret(KEYCHAIN_SERVICE, KEYCHAIN_MCP_ACCOUNT, input.tokens.mcpToken);
    await input.keychain.setSecret(
      KEYCHAIN_SERVICE,
      KEYCHAIN_MODEL_ACCOUNT,
      input.tokens.modelToken,
    );
  } catch {
    // Secure-storage write failure → immediate revocation, no config written.
    return revokeIssuedTokens(
      input.revocation,
      "blocked:secure_storage_write_failed",
      "secure_storage_write_failed",
    );
  }

  // Launch config: NON-SECRET parts only — keychain coordinates, not values.
  const launchConfig = {
    schemaVersion: CODEX_LAUNCH_SCHEMA_VERSION,
    keychain: {
      service: KEYCHAIN_SERVICE,
      accounts: {
        mcpToken: KEYCHAIN_MCP_ACCOUNT,
        modelToken: KEYCHAIN_MODEL_ACCOUNT,
      },
    },
    pairedAt: new Date(now).toISOString(),
  };
  let backup: { backupPath: string; verbatim: boolean } | undefined;
  try {
    backup = await writeConfigBackup(input.launchConfigPath, existing, now, issued);
    await atomicWrite(
      input.launchConfigPath,
      `${JSON.stringify(launchConfig, null, 2)}\n`,
      now,
    );
  } catch {
    // Backup / atomic-rename failure after the tokens exist → revoke. The fs
    // error text (which carries absolute paths) is deliberately not surfaced.
    return revokeIssuedTokens(
      input.revocation,
      "blocked:config_write_failed",
      "config_write_failed",
    );
  }
  return {
    status: "ok",
    configPath: input.launchConfigPath,
    backupPath: backup?.backupPath,
    ...(backup ? { backupVerbatim: backup.verbatim } : {}),
  };
}

// ---------------------------------------------------------------------------
// WorkBuddy target
// ---------------------------------------------------------------------------

export const WORKBUDDY_SCHEMA_VERSION = "caio.workbuddy/1";
export const SUPPORTED_WORKBUDDY_SCHEMA_VERSIONS: readonly string[] = [
  WORKBUDDY_SCHEMA_VERSION,
];

export interface WriteWorkBuddyConfigInput {
  tokens: PairedTokens;
  /**
   * Required: the tokens are already issued, so any failure on this path must
   * revoke them (same contract as the Codex path).
   */
  revocation: TokenRevocationPort;
  configPath: string;
  gatewayHost: string;
  gatewayPort: number;
  now?: number;
}

export async function writeWorkBuddyConfig(
  input: WriteWorkBuddyConfigInput,
): Promise<ConfigWriteResult> {
  const now = input.now ?? Date.now();
  const issued = [input.tokens.mcpToken, input.tokens.modelToken];

  // Supported schema versions only: unknown existing shapes are untouchable.
  const existing = await readFileBytesOrNull(input.configPath);
  if (
    existing !== null &&
    !isSupportedConfigShape(existing, SUPPORTED_WORKBUDDY_SCHEMA_VERSIONS)
  ) {
    return revokeIssuedTokens(
      input.revocation,
      "blocked:unsupported_config_format",
      "unsupported_config_format",
    );
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
  let backup: { backupPath: string; verbatim: boolean } | undefined;
  try {
    backup = await writeConfigBackup(input.configPath, existing, now, issued);
    await atomicWrite(input.configPath, `${JSON.stringify(config, null, 2)}\n`, now);
  } catch {
    // Backup / atomic-rename failure after the tokens exist → revoke. The fs
    // error text (which carries absolute paths) is deliberately not surfaced.
    return revokeIssuedTokens(
      input.revocation,
      "blocked:config_write_failed",
      "config_write_failed",
    );
  }
  return {
    status: "ok",
    configPath: input.configPath,
    backupPath: backup?.backupPath,
    ...(backup ? { backupVerbatim: backup.verbatim } : {}),
  };
}

// ---------------------------------------------------------------------------
// Backup restore
// ---------------------------------------------------------------------------

/**
 * Restore a previous backup over the current config (atomic, 0600). Backups
 * hold the ORIGINAL bytes, so this is a byte-identical recovery of whatever
 * the file contained before the replace.
 */
export async function restoreBackup(input: {
  configPath: string;
  backupPath: string;
  now?: number;
}): Promise<{ restored: boolean }> {
  const body = await readFileBytesOrNull(input.backupPath);
  if (body === null) return { restored: false };
  await atomicWrite(input.configPath, body, input.now ?? Date.now());
  return { restored: true };
}
