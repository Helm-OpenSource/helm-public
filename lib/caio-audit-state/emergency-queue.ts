import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

import {
  CAIO_AUDIT_QUEUE_ENTRY_ID_PATTERN,
  CaioAuditQueueAppendInProgressError,
  CaioAuditQueueContentConflictError,
  CaioAuditQueueFullError,
  CaioAuditQueueIntegrityError,
  CaioAuditQueueKeyUnavailableError,
  caioMinimalAuditReceiptSchema,
  caioReceiptDigest,
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
 *
 * Append is EXCLUSIVE and CONTENT-BOUND (both required for "no allowed dispatch
 * without a durable receipt"):
 * - the final path is created with O_CREAT|O_EXCL, so an append can never
 *   overwrite an existing entry (the previous tmp-file + rename sequence
 *   silently destroyed a concurrently written receipt);
 * - the reservation is created with mode 0o000 and chmod'ed to 0600 only after
 *   the ciphertext is fsynced. A file still at mode 0o000 is therefore an
 *   append that has not completed: it is never reported as a durable entry, so
 *   neither a crash nor a concurrent reader can observe a half-written receipt;
 * - on an entry-id collision the stored receipt's content digest is compared
 *   with the candidate's: identical content is an idempotent success, different
 *   content is a typed conflict (CaioAuditQueueContentConflictError) that the
 *   gate must refuse rather than allow.
 *
 * Known limitation: a hard process crash between reservation and seal leaves a
 * mode-0o000 reservation that blocks that ONE entry id (fail closed: claims for
 * it are refused, never allowed) until an operator or `remove(entryId)` clears
 * it. It is deliberately not auto-reclaimed, because a still-running append
 * holding the descriptor would then write into an unlinked inode and report a
 * durable receipt that no longer exists.
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
/** Sealed, durable entry. */
const ENTRY_MODE = 0o600;
/** Exclusive reservation held by an append that has not sealed its entry. */
const RESERVATION_MODE = 0o000;

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
      if (code === "EACCES") {
        // A mode-0o000 reservation is not readable even by its owner: the
        // append that holds it has not sealed a durable entry yet.
        throw new CaioAuditQueueAppendInProgressError(
          `entry ${entryId} is an unsealed append reservation`,
        );
      }
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
      if ((stat.mode & 0o777) === RESERVATION_MODE) {
        throw new CaioAuditQueueAppendInProgressError(
          `entry ${entryId} is an unsealed append reservation`,
        );
      }
      if ((stat.mode & 0o777) !== ENTRY_MODE) {
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

  type EntryStat = {
    entryId: string;
    mtimeNs: bigint;
    /** "reserved" = an append holds the id but has not sealed a receipt yet. */
    state: "durable" | "reserved";
  };

  async function listEntryStats(): Promise<EntryStat[]> {
    await ensureRoot();
    const names = await fs.readdir(rootDir);
    const entries: EntryStat[] = [];
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
      // Mirror readEntry's hardlink refusal here so size()/list() can never
      // count an entry that a read would reject.
      if (Number(stat.nlink) !== 1) {
        throw new CaioAuditQueueIntegrityError(
          `entry ${name} has nlink ${String(stat.nlink)}; hardlinks are refused`,
        );
      }
      entries.push({
        entryId: name,
        mtimeNs: stat.mtimeNs,
        state:
          (Number(stat.mode) & 0o777) === RESERVATION_MODE
            ? "reserved"
            : "durable",
      });
    }
    entries.sort((a, b) => {
      if (a.mtimeNs !== b.mtimeNs) {
        return a.mtimeNs < b.mtimeNs ? -1 : 1;
      }
      return a.entryId < b.entryId ? -1 : 1;
    });
    return entries;
  }

  /**
   * Idempotency/conflict decision for an entry id that already exists.
   * Never overwrites: the stored receipt wins, and a divergent candidate is
   * refused with a typed conflict the gate maps to 409.
   */
  async function reconcileExistingEntry(input: {
    entryId: string;
    stat: EntryStat;
    receipt: CaioMinimalAuditReceipt;
    key: Buffer;
  }): Promise<{ entryId: string; deduplicated: true }> {
    if (input.stat.state === "reserved") {
      throw new CaioAuditQueueAppendInProgressError(
        `entry ${input.entryId} is an unsealed append reservation`,
      );
    }
    const stored = await readEntry(input.entryId, input.key);
    if (caioReceiptDigest(stored) !== caioReceiptDigest(input.receipt)) {
      throw new CaioAuditQueueContentConflictError(
        `entry ${input.entryId} already holds a receipt with different content`,
      );
    }
    return { entryId: input.entryId, deduplicated: true };
  }

  return {
    async append({ entryId, receipt }) {
      const parsed = caioMinimalAuditReceiptSchema.parse(receipt);
      const filePath = entryPath(entryId);
      const key = await loadKey();
      await ensureRoot();

      // Exclusive creation of the FINAL path. O_EXCL is the whole duplicate
      // detection: there is no check-then-write window an interleaved append
      // can slip through, and no code path that overwrites an existing entry.
      let handle;
      try {
        handle = await fs.open(
          filePath,
          fsConstants.O_WRONLY |
            fsConstants.O_CREAT |
            fsConstants.O_EXCL |
            fsConstants.O_NOFOLLOW,
          RESERVATION_MODE,
        );
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
          throw error;
        }
        const existing = (await listEntryStats()).find(
          (entry) => entry.entryId === entryId,
        );
        if (!existing) {
          // Vanished between EEXIST and the stat: refuse rather than guess.
          throw new CaioAuditQueueAppendInProgressError(
            `entry ${entryId} changed while appending`,
          );
        }
        return await reconcileExistingEntry({
          entryId,
          stat: existing,
          receipt: parsed,
          key,
        });
      }

      // From here the reservation exists; every failure path must remove it so
      // no unsealed entry id is left behind by an in-process error.
      try {
        // Capacity is enforced with this reservation counted, so concurrent
        // appends cannot both slip past the cap. Two appends racing for the last
        // slot may both be refused rather than one being admitted — refusing is
        // the safe direction (the caller is told to stop dispatching).
        const held = await listEntryStats();
        if (held.length > maxEntries) {
          throw new CaioAuditQueueFullError(
            `queue holds ${held.length - 1} entries (cap ${maxEntries})`,
          );
        }
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
        await handle.writeFile(encryptEntry(entryId, parsed, key));
        await handle.sync();
        // Seal: the mode transition publishes an entry whose ciphertext is
        // already durable, so a reader never observes a partial receipt.
        await handle.chmod(ENTRY_MODE);
        await handle.sync();
      } catch (error) {
        await handle.close();
        await fs.rm(filePath, { force: true });
        throw error;
      }
      await handle.close();

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
      for (const { entryId, state } of stats) {
        // Unsealed reservations are not durable receipts: they are never
        // replayed and never counted.
        if (state === "reserved") continue;
        entries.push({ entryId, receipt: await readEntry(entryId, key) });
      }
      return entries;
    },

    async remove(entryId) {
      const filePath = entryPath(entryId);
      await fs.rm(filePath, { force: true });
    },

    async size() {
      return (await listEntryStats()).filter(
        (entry) => entry.state === "durable",
      ).length;
    },
  };
}
