// CAIO model proxy — credentialRef → secret file loader with safe rotation.
//
// Credentials live as one file per credentialRef inside a single fixed
// directory owned by the gateway process uid. The loader is fail-closed:
// strict ref grammar (no path escape), O_NOFOLLOW open (symlink attack),
// fstat on the open fd (no TOCTOU) checking regular file, owner uid, exact
// 0600 mode, nlink === 1 (hardlink attack), and an 8 KiB size cap. Content is
// returned trimmed, held in memory only, and never logged.

import { constants as fsConstants } from "node:fs";
import { open, rename, rm, type FileHandle } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";

/**
 * Honest security boundary statement for per-credential files.
 *
 * Splitting credentials into one 0600 file per credentialRef gives the
 * gateway rotation granularity (rotate one upstream key without touching the
 * others), audit granularity (each ref has its own load/rotate history), and
 * fault-domain separation (a corrupted or revoked ref fails only its own
 * routes). It does NOT provide OS-level key isolation: every process running
 * under the same uid as the gateway can technically read all of these files.
 * Treat the uid (and the host) as the real isolation boundary.
 */
export const SAME_UID_ISOLATION_DISCLAIMER =
  "Per-credential files provide rotation, audit, and fault-domain separation only; " +
  "any process under the same uid can technically read all of them. " +
  "This is NOT OS-level key isolation.";

export const CAIO_CREDENTIAL_REF_PATTERN = /^[a-z0-9][a-z0-9-]{1,64}$/;
export const CAIO_CREDENTIAL_MAX_BYTES = 8 * 1024;

export const CAIO_CREDENTIAL_ERROR_CODES = [
  "credential_not_found",
  "credential_unsafe_mode",
  "credential_symlink_rejected",
  "credential_hardlink_rejected",
  "credential_ref_invalid",
] as const;

export type CaioCredentialErrorCode =
  (typeof CAIO_CREDENTIAL_ERROR_CODES)[number];

export class CaioCredentialError extends Error {
  readonly code: CaioCredentialErrorCode;
  readonly detail: string;

  // Message carries only the code + a static detail keyword — never file
  // content, never the resolved path (which could leak layout into logs).
  constructor(code: CaioCredentialErrorCode, detail: string) {
    super(`${code}:${detail}`);
    this.name = "CaioCredentialError";
    this.code = code;
    this.detail = detail;
  }
}

function assertValidRef(credentialRef: string): void {
  if (!CAIO_CREDENTIAL_REF_PATTERN.test(credentialRef)) {
    throw new CaioCredentialError("credential_ref_invalid", "ref_grammar");
  }
}

function assertValidAllowedDir(allowedDir: string): void {
  if (!path.isAbsolute(allowedDir)) {
    throw new CaioCredentialError(
      "credential_ref_invalid",
      "allowed_dir_not_absolute",
    );
  }
}

function errnoCode(error: unknown): string | null {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
  ) {
    return (error as { code: string }).code;
  }
  return null;
}

// Shared safe read used both for regular loads and for validating freshly
// written rotation temp files. All checks run against the OPEN fd.
async function readCredentialFileSafely(filePath: string): Promise<string> {
  let handle: FileHandle;
  try {
    handle = await open(
      filePath,
      fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW,
    );
  } catch (error) {
    const code = errnoCode(error);
    if (code === "ENOENT") {
      throw new CaioCredentialError("credential_not_found", "missing");
    }
    if (code === "ELOOP" || code === "EMLINK") {
      throw new CaioCredentialError(
        "credential_symlink_rejected",
        "symlink",
      );
    }
    throw new CaioCredentialError("credential_unsafe_mode", "open_failed");
  }
  try {
    const stat = await handle.stat();
    if (!stat.isFile()) {
      throw new CaioCredentialError(
        "credential_unsafe_mode",
        "not_regular_file",
      );
    }
    if (stat.nlink !== 1) {
      throw new CaioCredentialError(
        "credential_hardlink_rejected",
        "hardlink",
      );
    }
    if (
      typeof process.getuid === "function" &&
      stat.uid !== process.getuid()
    ) {
      throw new CaioCredentialError("credential_unsafe_mode", "uid_mismatch");
    }
    if ((stat.mode & 0o777) !== 0o600) {
      throw new CaioCredentialError("credential_unsafe_mode", "mode_bits");
    }
    if (stat.size > CAIO_CREDENTIAL_MAX_BYTES) {
      throw new CaioCredentialError("credential_unsafe_mode", "oversize");
    }
    const content = (await handle.readFile()).toString("utf8").trim();
    if (content.length === 0) {
      throw new CaioCredentialError("credential_unsafe_mode", "empty");
    }
    return content;
  } finally {
    await handle.close();
  }
}

export async function loadCredential(input: {
  allowedDir: string;
  credentialRef: string;
}): Promise<string> {
  assertValidAllowedDir(input.allowedDir);
  assertValidRef(input.credentialRef);
  // Ref grammar forbids dots and slashes, so join cannot escape allowedDir.
  const filePath = path.join(input.allowedDir, input.credentialRef);
  return readCredentialFileSafely(filePath);
}

async function writeSecretFile(
  filePath: string,
  content: string,
): Promise<void> {
  const handle = await open(
    filePath,
    fsConstants.O_WRONLY |
      fsConstants.O_CREAT |
      fsConstants.O_EXCL |
      fsConstants.O_NOFOLLOW,
    0o600,
  );
  try {
    await handle.writeFile(content, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function fsyncDirBestEffort(dirPath: string): Promise<void> {
  try {
    const dirHandle = await open(dirPath, fsConstants.O_RDONLY);
    try {
      await dirHandle.sync();
    } finally {
      await dirHandle.close();
    }
  } catch {
    // Directory fsync is a durability optimization; not all platforms allow
    // it. Rename atomicity does not depend on it.
  }
}

export type CaioCredentialRotationResult = {
  rotated: true;
  rollbackRetained: boolean;
};

/**
 * Atomically replace a credential file.
 *
 * Writes `${ref}.next.<random>` (0600, fsynced) in the SAME directory,
 * validates the temp file by re-reading it through the same safe loader
 * checks, optionally preserves the previous content as `${ref}.rollback`
 * (0600) when the caller opens a rollback window with `retainRollback`, then
 * renames the temp file over the target. `completeRotation` closes the
 * rollback window by deleting the rollback file.
 */
export async function rotateCredentialFile(input: {
  allowedDir: string;
  credentialRef: string;
  newContent: string;
  retainRollback: boolean;
}): Promise<CaioCredentialRotationResult> {
  assertValidAllowedDir(input.allowedDir);
  assertValidRef(input.credentialRef);
  const trimmed = input.newContent.trim();
  if (trimmed.length === 0) {
    throw new CaioCredentialError(
      "credential_unsafe_mode",
      "rotation_content_empty",
    );
  }
  if (Buffer.byteLength(trimmed, "utf8") > CAIO_CREDENTIAL_MAX_BYTES) {
    throw new CaioCredentialError(
      "credential_unsafe_mode",
      "rotation_content_oversize",
    );
  }

  const targetPath = path.join(input.allowedDir, input.credentialRef);
  const tmpName = `${input.credentialRef}.next.${randomBytes(8).toString("hex")}`;
  const tmpPath = path.join(input.allowedDir, tmpName);

  await writeSecretFile(tmpPath, trimmed);
  try {
    // Validate through the exact same fail-closed loader checks.
    const validated = await readCredentialFileSafely(tmpPath);
    if (validated !== trimmed) {
      throw new CaioCredentialError(
        "credential_unsafe_mode",
        "rotation_validation_mismatch",
      );
    }

    // Capture previous content for the rollback window (only when the caller
    // opened one; skipping the read when retainRollback is false also lets a
    // rotation repair a target whose previous file failed safety checks).
    let previousContent: string | null = null;
    if (input.retainRollback) {
      try {
        previousContent = await readCredentialFileSafely(targetPath);
      } catch (error) {
        if (
          !(error instanceof CaioCredentialError) ||
          error.code !== "credential_not_found"
        ) {
          throw error;
        }
      }
    }

    let rollbackRetained = false;
    if (input.retainRollback && previousContent !== null) {
      const rollbackPath = path.join(
        input.allowedDir,
        `${input.credentialRef}.rollback`,
      );
      await rm(rollbackPath, { force: true });
      await writeSecretFile(rollbackPath, previousContent);
      rollbackRetained = true;
    }

    await rename(tmpPath, targetPath);
    await fsyncDirBestEffort(input.allowedDir);
    return { rotated: true, rollbackRetained };
  } catch (error) {
    await rm(tmpPath, { force: true });
    throw error;
  }
}

export type CaioCredentialRotationCompletion = {
  rollbackDeleted: boolean;
};

// Closes the rollback window opened by rotateCredentialFile.
export async function completeRotation(input: {
  allowedDir: string;
  credentialRef: string;
}): Promise<CaioCredentialRotationCompletion> {
  assertValidAllowedDir(input.allowedDir);
  assertValidRef(input.credentialRef);
  const rollbackPath = path.join(
    input.allowedDir,
    `${input.credentialRef}.rollback`,
  );
  try {
    await rm(rollbackPath);
    return { rollbackDeleted: true };
  } catch (error) {
    if (errnoCode(error) === "ENOENT") {
      return { rollbackDeleted: false };
    }
    throw new CaioCredentialError(
      "credential_unsafe_mode",
      "rollback_delete_failed",
    );
  }
}
