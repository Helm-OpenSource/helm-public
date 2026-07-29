import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

import {
  CAIO_AUDIT_QUEUE_ENTRY_ID_PATTERN,
  CaioAuditQueueFullError,
  CaioAuditQueueIntegrityError,
  CaioAuditQueueKeyUnavailableError,
  caioMinimalAuditReceiptSchema,
  type CaioMinimalAuditReceipt,
} from "@/lib/caio-audit-state/audit-state-contracts";

/**
 * Encrypted file-based emergency fallback queue for minimal audit receipts.
 *
 * Directory contract (fail closed on any violation):
 * - queue root must be a non-symlink directory with mode 0700;
 * - entries are regular files with mode 0600, opened with O_NOFOLLOW and
 *   required to have nlink === 1 (no hardlink aliasing);
 * - entry ids must match ^[a-z0-9-]{8,64}$ so a name can never escape the
 *   queue root.
 *
 * Entries are encrypted with AES-256-GCM under a key supplied by an injected
 * keyProvider. The entry id is bound as GCM additional authenticated data, so
 * a ciphertext copied to a different entry name fails authentication. The
 * encrypted payload is the minimal receipt JSON only — never prompt bodies.
 */
export interface CaioEmergencyQueuePort {
  append(input: {
    entryId: string;
    receipt: CaioMinimalAuditReceipt;
  }): Promise<{ entryId: string; deduplicated: boolean }>;
  list(): Promise<
    Array<{ entryId: string; receipt: CaioMinimalAuditReceipt }>
  >;
  remove(entryId: string): Promise<void>;
  size(): Promise<number>;
}

const ENTRY_MAGIC = Buffer.from("HCAQ1\n", "utf8");
const GCM_IV_BYTES = 12;
const GCM_TAG_BYTES = 16;
const KEY_BYTES = 32;

function assertValidEntryId(entryId: string): void {
  if (!CAIO_AUDIT_QUEUE_ENTRY_ID_PATTERN.test(entryId)) {
    throw new CaioAuditQueueIntegrityError(
      `entry id does not match ${String(CAIO_AUDIT_QUEUE_ENTRY_ID_PATTERN)}`,
    );
  }
}

export function createCaioEmergencyQueue(options: {
  rootDir: string;
  keyProvider: () => Promise<Buffer>;
  maxEntries?: number;
}): CaioEmergencyQueuePort {
  const rootDir = path.resolve(options.rootDir);
  const maxEntries = options.maxEntries ?? 10_000;

  async function loadKey(): Promise<Buffer> {
    let key: Buffer;
    try {
      key = await options.keyProvider();
    } catch (error) {
      throw new CaioAuditQueueKeyUnavailableError(
        error instanceof Error ? error.message : "key provider failed",
      );
    }
    if (!Buffer.isBuffer(key) || key.length !== KEY_BYTES) {
      throw new CaioAuditQueueKeyUnavailableError(
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
      // mkdir mode is subject to umask; force the contract explicitly.
      await fs.chmod(rootDir, 0o700);
      stat = await fs.lstat(rootDir);
    }
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new CaioAuditQueueIntegrityError(
        "queue root must be a non-symlink directory",
      );
    }
    if ((stat.mode & 0o777) !== 0o700) {
      throw new CaioAuditQueueIntegrityError(
        "queue root must have mode 0700",
      );
    }
  }

  function entryPath(entryId: string): string {
    assertValidEntryId(entryId);
    const resolved = path.resolve(rootDir, entryId);
    if (path.dirname(resolved) !== rootDir) {
      throw new CaioAuditQueueIntegrityError("entry path escapes queue root");
    }
    return resolved;
  }

  async function readEntry(
    entryId: string,
    key: Buffer,
  ): Promise<CaioMinimalAuditReceipt> {
    const filePath = entryPath(entryId);
    let handle;
    try {
      handle = await fs.open(
        filePath,
        fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW,
      );
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ELOOP" || code === "EMFILE" || code === "ENXIO") {
        throw new CaioAuditQueueIntegrityError(
          `entry ${entryId} is a symlink or unreadable special file`,
        );
      }
      throw error;
    }
    try {
      const stat = await handle.stat();
      if (!stat.isFile()) {
        throw new CaioAuditQueueIntegrityError(
          `entry ${entryId} is not a regular file`,
        );
      }
      if (stat.nlink !== 1) {
        throw new CaioAuditQueueIntegrityError(
          `entry ${entryId} has nlink ${stat.nlink}; hardlinks are refused`,
        );
      }
      if ((stat.mode & 0o777) !== 0o600) {
        throw new CaioAuditQueueIntegrityError(
          `entry ${entryId} must have mode 0600`,
        );
      }
      const raw = await handle.readFile();
      return decryptEntry(entryId, raw, key);
    } finally {
      await handle.close();
    }
  }

  function decryptEntry(
    entryId: string,
    raw: Buffer,
    key: Buffer,
  ): CaioMinimalAuditReceipt {
    const minimum = ENTRY_MAGIC.length + GCM_IV_BYTES + GCM_TAG_BYTES;
    if (
      raw.length < minimum ||
      !raw.subarray(0, ENTRY_MAGIC.length).equals(ENTRY_MAGIC)
    ) {
      throw new CaioAuditQueueIntegrityError(
        `entry ${entryId} has an invalid envelope`,
      );
    }
    const iv = raw.subarray(
      ENTRY_MAGIC.length,
      ENTRY_MAGIC.length + GCM_IV_BYTES,
    );
    const tag = raw.subarray(
      ENTRY_MAGIC.length + GCM_IV_BYTES,
      ENTRY_MAGIC.length + GCM_IV_BYTES + GCM_TAG_BYTES,
    );
    const ciphertext = raw.subarray(minimum);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAAD(Buffer.from(entryId, "utf8"));
    decipher.setAuthTag(tag);
    let plaintext: Buffer;
    try {
      plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    } catch {
      throw new CaioAuditQueueIntegrityError(
        `entry ${entryId} failed authenticated decryption`,
      );
    }
    return caioMinimalAuditReceiptSchema.parse(
      JSON.parse(plaintext.toString("utf8")),
    );
  }

  function encryptEntry(
    entryId: string,
    receipt: CaioMinimalAuditReceipt,
    key: Buffer,
  ): Buffer {
    const iv = randomBytes(GCM_IV_BYTES);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    cipher.setAAD(Buffer.from(entryId, "utf8"));
    const plaintext = Buffer.from(JSON.stringify(receipt), "utf8");
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    return Buffer.concat([ENTRY_MAGIC, iv, cipher.getAuthTag(), ciphertext]);
  }

  async function listEntryStats(): Promise<
    Array<{ entryId: string; mtimeNs: bigint }>
  > {
    await ensureRoot();
    const names = await fs.readdir(rootDir);
    const entries: Array<{ entryId: string; mtimeNs: bigint }> = [];
    for (const name of names) {
      if (name.startsWith(".tmp-")) {
        continue;
      }
      if (!CAIO_AUDIT_QUEUE_ENTRY_ID_PATTERN.test(name)) {
        throw new CaioAuditQueueIntegrityError(
          `unexpected file "${name}" in queue root`,
        );
      }
      const stat = await fs.lstat(path.join(rootDir, name), { bigint: true });
      if (stat.isSymbolicLink() || !stat.isFile()) {
        throw new CaioAuditQueueIntegrityError(
          `entry ${name} is not a regular file`,
        );
      }
      entries.push({ entryId: name, mtimeNs: stat.mtimeNs });
    }
    entries.sort((a, b) => {
      if (a.mtimeNs !== b.mtimeNs) {
        return a.mtimeNs < b.mtimeNs ? -1 : 1;
      }
      return a.entryId < b.entryId ? -1 : 1;
    });
    return entries;
  }

  return {
    async append({ entryId, receipt }) {
      const parsed = caioMinimalAuditReceiptSchema.parse(receipt);
      const filePath = entryPath(entryId);
      const key = await loadKey();
      await ensureRoot();

      const existing = await listEntryStats();
      const duplicate = existing.some((entry) => entry.entryId === entryId);
      if (duplicate) {
        const stored = await readEntry(entryId, key);
        if (JSON.stringify(stored) !== JSON.stringify(parsed)) {
          throw new CaioAuditQueueIntegrityError(
            `entry ${entryId} already exists with different content`,
          );
        }
        return { entryId, deduplicated: true };
      }
      if (existing.length >= maxEntries) {
        throw new CaioAuditQueueFullError(
          `queue holds ${existing.length} entries (cap ${maxEntries})`,
        );
      }

      // Durable atomic write: exclusive tmp file, fsync, rename, dir fsync.
      const tmpPath = path.join(rootDir, `.tmp-${randomUUID()}`);
      const envelope = encryptEntry(entryId, parsed, key);
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
      const dirHandle = await fs.open(rootDir, fsConstants.O_RDONLY);
      try {
        await dirHandle.sync();
      } catch {
        // Directory fsync is not supported on every platform; the entry
        // file itself has already been fsynced.
      } finally {
        await dirHandle.close();
      }
      return { entryId, deduplicated: false };
    },

    async list() {
      const key = await loadKey();
      const stats = await listEntryStats();
      const entries: Array<{
        entryId: string;
        receipt: CaioMinimalAuditReceipt;
      }> = [];
      for (const { entryId } of stats) {
        entries.push({ entryId, receipt: await readEntry(entryId, key) });
      }
      return entries;
    },

    async remove(entryId) {
      const filePath = entryPath(entryId);
      await fs.rm(filePath, { force: true });
    },

    async size() {
      return (await listEntryStats()).length;
    },
  };
}
