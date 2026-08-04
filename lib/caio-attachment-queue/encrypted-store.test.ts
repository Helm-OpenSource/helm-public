import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  CaioAttachmentStoreIntegrityError,
  CaioAttachmentStoreKeyUnavailableError,
} from "@/lib/caio-attachment-queue/attachment-contracts";
import { createEncryptedAttachmentStore } from "@/lib/caio-attachment-queue/encrypted-store";

const KEY = randomBytes(32);
const keyProvider = async () => KEY;

describe("encrypted attachment store", () => {
  let sandbox = "";
  let rootDir = "";

  beforeEach(async () => {
    sandbox = await fs.mkdtemp(path.join(os.tmpdir(), "caio-attach-store-"));
    rootDir = path.join(sandbox, "store");
  });

  afterEach(async () => {
    await fs.rm(sandbox, { recursive: true, force: true });
  });

  it("round-trips an encrypted payload with 0700 root and 0600 entries", async () => {
    const store = createEncryptedAttachmentStore({ rootDir, keyProvider });
    const payload = Buffer.from("attachment-plaintext-marker");
    await store.writeEntry("entry-0001", payload);

    expect((await fs.lstat(rootDir)).mode & 0o777).toBe(0o700);
    const entryStat = await fs.lstat(path.join(rootDir, "entry-0001"));
    expect(entryStat.mode & 0o777).toBe(0o600);

    const raw = await fs.readFile(path.join(rootDir, "entry-0001"));
    expect(raw.toString("utf8")).not.toContain("attachment-plaintext-marker");
    expect(await store.readEntry("entry-0001")).toEqual(payload);
  });

  it("deletes entries by unlink", async () => {
    const store = createEncryptedAttachmentStore({ rootDir, keyProvider });
    await store.writeEntry("entry-0001", Buffer.from("x"));
    expect(await store.hasEntry("entry-0001")).toBe(true);
    await store.deleteEntry("entry-0001");
    expect(await store.hasEntry("entry-0001")).toBe(false);
    await expect(store.readEntry("entry-0001")).rejects.toBeInstanceOf(
      CaioAttachmentStoreIntegrityError,
    );
  });

  it("rejects invalid ids and path escapes", async () => {
    const store = createEncryptedAttachmentStore({ rootDir, keyProvider });
    for (const entryId of ["../evil-entry", "short", "Entry-0001", "a/../b-entry"]) {
      await expect(
        store.writeEntry(entryId, Buffer.from("x")),
      ).rejects.toBeInstanceOf(CaioAttachmentStoreIntegrityError);
    }
  });

  it("refuses symlinked entries", async () => {
    const store = createEncryptedAttachmentStore({ rootDir, keyProvider });
    await store.writeEntry("entry-0001", Buffer.from("x"));
    const outside = path.join(sandbox, "outside.bin");
    await fs.writeFile(outside, "outside", { mode: 0o600 });
    await fs.symlink(outside, path.join(rootDir, "entry-symlinked"));

    await expect(store.readEntry("entry-symlinked")).rejects.toBeInstanceOf(
      CaioAttachmentStoreIntegrityError,
    );
  });

  it("refuses hardlinked entries", async () => {
    const store = createEncryptedAttachmentStore({ rootDir, keyProvider });
    await store.writeEntry("entry-0001", Buffer.from("x"));
    await fs.link(
      path.join(rootDir, "entry-0001"),
      path.join(sandbox, "hardlink-alias"),
    );

    await expect(store.readEntry("entry-0001")).rejects.toBeInstanceOf(
      CaioAttachmentStoreIntegrityError,
    );
  });

  it("refuses a ciphertext copied to a different entry id (AAD binding)", async () => {
    const store = createEncryptedAttachmentStore({ rootDir, keyProvider });
    await store.writeEntry("entry-0001", Buffer.from("x"));
    await fs.copyFile(
      path.join(rootDir, "entry-0001"),
      path.join(rootDir, "entry-0002"),
    );
    await fs.chmod(path.join(rootDir, "entry-0002"), 0o600);

    await expect(store.readEntry("entry-0002")).rejects.toBeInstanceOf(
      CaioAttachmentStoreIntegrityError,
    );
  });

  it("fails typed when the key provider is unavailable", async () => {
    const store = createEncryptedAttachmentStore({
      rootDir,
      keyProvider: async () => {
        throw new Error("kms offline");
      },
    });
    await expect(
      store.writeEntry("entry-0001", Buffer.from("x")),
    ).rejects.toBeInstanceOf(CaioAttachmentStoreKeyUnavailableError);
  });

  it("refuses a store root with loose permissions", async () => {
    await fs.mkdir(rootDir, { recursive: true, mode: 0o755 });
    await fs.chmod(rootDir, 0o755);
    const store = createEncryptedAttachmentStore({ rootDir, keyProvider });
    await expect(
      store.writeEntry("entry-0001", Buffer.from("x")),
    ).rejects.toBeInstanceOf(CaioAttachmentStoreIntegrityError);
  });

  it("refuses an entry whose file mode was loosened", async () => {
    const store = createEncryptedAttachmentStore({ rootDir, keyProvider });
    await store.writeEntry("entry-0001", Buffer.from("x"));
    await fs.chmod(path.join(rootDir, "entry-0001"), 0o644);
    await expect(store.readEntry("entry-0001")).rejects.toBeInstanceOf(
      CaioAttachmentStoreIntegrityError,
    );
  });
});
