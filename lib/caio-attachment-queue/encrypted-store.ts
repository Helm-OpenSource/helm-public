import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

import {
  CAIO_ATTACHMENT_ENTRY_ID_PATTERN,
  CaioAttachmentStoreIntegrityError,
  CaioAttachmentStoreKeyUnavailableError,
} from "@/lib/caio-attachment-queue/attachment-contracts";

/**
 * Application-layer encrypted attachment payload store.
 *
 * Contract (fail closed on any violation):
 * - store root: non-symlink directory, mode 0700;
 * - entries: regular files, mode 0600, opened O_NOFOLLOW, nlink === 1;
 * - entry ids match ^[a-z0-9-]{8,64}$ (no path escape);
 * - TOCTOU guard: after open we re-fstat and compare dev+ino against the
 *   pre-open lstat, so a swapped path between check and use is rejected;
 * - writes are tmp + fsync + rename (atomic, durable);
 * - AES-256-GCM under an injected keyProvider, entry id bound as AAD.
 *
 * deleteEntry shreds by unlink only. This is an availability control, NOT a
 * secure-erase claim: journaling filesystems and SSD wear leveling may keep
 * ciphertext blocks around. Confidentiality relies on the encryption key,
 * not on physical erasure.
 */
export interface CaioAttachmentPayloadStore {
  writeEntry(entryId: string, payload: Buffer): Promise<void>;
  readEntry(entryId: string): Promise<Buffer>;
  deleteEntry(entryId: string): Promise<void>;
  hasEntry(entryId: string): Promise<boolean>;
}

const ENTRY_MAGIC = Buffer.from("HCAT1\n", "utf8");
const GCM_IV_BYTES = 12;
const GCM_TAG_BYTES = 16;
const KEY_BYTES = 32;

export function createEncryptedAttachmentStore(options: {
  rootDir: string;
  keyProvider: () => Promise<Buffer>;
}): CaioAttachmentPayloadStore {
  const rootDir = path.resolve(options.rootDir);

  async function loadKey(): Promise<Buffer> {
    let key: Buffer;
    try {
      key = await options.keyProvider();
    } catch (error) {
      throw new CaioAttachmentStoreKeyUnavailableError(
        error instanceof Error ? error.message : "key provider failed",
      );
    }
    if (!Buffer.isBuffer(key) || key.length !== KEY_BYTES) {
      throw new CaioAttachmentStoreKeyUnavailableError(
        "key provider must return a 32-byte Buffer",
      );
    }
    return key;
  }

  async function ensureRoot(): Promise<void> {
    let stat;
    try {
      stat = await fs.lstat(rootDir);
    } catch {
      await fs.mkdir(rootDir, { recursive: true, mode: 0o700 });
      await fs.chmod(rootDir, 0o700);
      stat = await fs.lstat(rootDir);
    }
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new CaioAttachmentStoreIntegrityError(
        "store root must be a non-symlink directory",
      );
    }
    if ((stat.mode & 0o777) !== 0o700) {
      throw new CaioAttachmentStoreIntegrityError(
        "store root must have mode 0700",
      );
    }
  }

  function entryPath(entryId: string): string {
    if (!CAIO_ATTACHMENT_ENTRY_ID_PATTERN.test(entryId)) {
      throw new CaioAttachmentStoreIntegrityError(
        `entry id does not match ${String(CAIO_ATTACHMENT_ENTRY_ID_PATTERN)}`,
      );
    }
    const resolved = path.resolve(rootDir, entryId);
    if (path.dirname(resolved) !== rootDir) {
      throw new CaioAttachmentStoreIntegrityError(
        "entry path escapes store root",
      );
    }
    return resolved;
  }

  return {
    async writeEntry(entryId, payload) {
      const filePath = entryPath(entryId);
      const key = await loadKey();
      await ensureRoot();

      const iv = randomBytes(GCM_IV_BYTES);
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      cipher.setAAD(Buffer.from(entryId, "utf8"));
      const ciphertext = Buffer.concat([cipher.update(payload), cipher.final()]);
      const envelope = Buffer.concat([
        ENTRY_MAGIC,
        iv,
        cipher.getAuthTag(),
        ciphertext,
      ]);

      const tmpPath = path.join(rootDir, `.tmp-${randomUUID()}`);
      const handle = await fs.open(
        tmpPath,
        fsConstants.O_WRONLY |
          fsConstants.O_CREAT |
          fsConstants.O_EXCL |
          fsConstants.O_NOFOLLOW,
        0o600,
      );
      try {
        await handle.writeFile(envelope);
        await handle.sync();
      } finally {
        await handle.close();
      }
      try {
        await fs.rename(tmpPath, filePath);
      } catch (error) {
        await fs.rm(tmpPath, { force: true });
        throw error;
      }
    },

    async readEntry(entryId) {
      const filePath = entryPath(entryId);
      await ensureRoot();

      // Pre-open identity check…
      let before;
      try {
        before = await fs.lstat(filePath, { bigint: true });
      } catch {
        throw new CaioAttachmentStoreIntegrityError(
          `entry ${entryId} does not exist`,
        );
      }
      if (before.isSymbolicLink() || !before.isFile()) {
        throw new CaioAttachmentStoreIntegrityError(
          `entry ${entryId} is not a regular file`,
        );
      }

      let handle;
      try {
        handle = await fs.open(
          filePath,
          fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW,
        );
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === "ELOOP") {
          throw new CaioAttachmentStoreIntegrityError(
            `entry ${entryId} became a symlink`,
          );
        }
        throw error;
      }
      try {
        // …then re-fstat AFTER open and compare dev+ino (TOCTOU guard).
        const after = await handle.stat({ bigint: true });
        if (after.dev !== before.dev || after.ino !== before.ino) {
          throw new CaioAttachmentStoreIntegrityError(
            `entry ${entryId} was swapped between check and open`,
          );
        }
        if (!after.isFile()) {
          throw new CaioAttachmentStoreIntegrityError(
            `entry ${entryId} is not a regular file`,
          );
        }
        if (after.nlink !== BigInt(1)) {
          throw new CaioAttachmentStoreIntegrityError(
            `entry ${entryId} has nlink ${after.nlink}; hardlinks are refused`,
          );
        }
        if ((Number(after.mode) & 0o777) !== 0o600) {
          throw new CaioAttachmentStoreIntegrityError(
            `entry ${entryId} must have mode 0600`,
          );
        }
        const raw = await handle.readFile();
        const key = await loadKey();
        const minimum = ENTRY_MAGIC.length + GCM_IV_BYTES + GCM_TAG_BYTES;
        if (
          raw.length < minimum ||
          !raw.subarray(0, ENTRY_MAGIC.length).equals(ENTRY_MAGIC)
        ) {
          throw new CaioAttachmentStoreIntegrityError(
            `entry ${entryId} has an invalid envelope`,
          );
        }
        const iv = raw.subarray(
          ENTRY_MAGIC.length,
          ENTRY_MAGIC.length + GCM_IV_BYTES,
        );
        const tag = raw.subarray(
          ENTRY_MAGIC.length + GCM_IV_BYTES,
          minimum,
        );
        const decipher = createDecipheriv("aes-256-gcm", key, iv);
        decipher.setAAD(Buffer.from(entryId, "utf8"));
        decipher.setAuthTag(tag);
        try {
          return Buffer.concat([
            decipher.update(raw.subarray(minimum)),
            decipher.final(),
          ]);
        } catch {
          throw new CaioAttachmentStoreIntegrityError(
            `entry ${entryId} failed authenticated decryption`,
          );
        }
      } finally {
        await handle.close();
      }
    },

    async deleteEntry(entryId) {
      // Unlink only — see the module doc comment: no secure-erase claim.
      await fs.rm(entryPath(entryId), { force: true });
    },

    async hasEntry(entryId) {
      try {
        const stat = await fs.lstat(entryPath(entryId));
        return stat.isFile();
      } catch {
        return false;
      }
    },
  };
}
