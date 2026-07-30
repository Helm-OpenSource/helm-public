import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  CaioAuditQueueContentConflictError,
  CaioAuditQueueFullError,
  CaioAuditQueueIntegrityError,
  CaioAuditQueueKeyUnavailableError,
  type CaioMinimalAuditReceipt,
} from "@/lib/caio-audit-state/audit-state-contracts";
import { createCaioEmergencyQueue } from "@/lib/caio-audit-state/emergency-queue";

const KEY = randomBytes(32);
const keyProvider = async () => KEY;

function receipt(requestId: string): CaioMinimalAuditReceipt {
  return {
    requestId,
    client: "workbuddy",
    workspace: "ws-emergency-queue",
    modelAlias: "caio-default",
    inputHash: `sha256:${"b".repeat(64)}`,
    policyVersion: "policy-v3",
    posture: "self_service",
  };
}

describe("caio emergency queue", () => {
  let sandbox = "";
  let rootDir = "";

  beforeEach(async () => {
    sandbox = await fs.mkdtemp(path.join(os.tmpdir(), "caio-emergency-"));
    rootDir = path.join(sandbox, "queue");
  });

  afterEach(async () => {
    await fs.rm(sandbox, { recursive: true, force: true });
  });

  it("creates a 0700 root and writes 0600 encrypted entries", async () => {
    const queue = createCaioEmergencyQueue({ rootDir, keyProvider });
    await queue.append({ entryId: "entry-0001", receipt: receipt("req-1") });

    const rootStat = await fs.lstat(rootDir);
    expect(rootStat.mode & 0o777).toBe(0o700);
    const entryStat = await fs.lstat(path.join(rootDir, "entry-0001"));
    expect(entryStat.mode & 0o777).toBe(0o600);

    const raw = await fs.readFile(path.join(rootDir, "entry-0001"));
    expect(raw.toString("utf8")).not.toContain("req-1");
    expect(raw.toString("utf8")).not.toContain("ws-emergency-queue");
  });

  it("lists entries ordered by enqueue time and removes by id", async () => {
    const queue = createCaioEmergencyQueue({ rootDir, keyProvider });
    await queue.append({ entryId: "entry-0002", receipt: receipt("req-b") });
    await queue.append({ entryId: "entry-0001", receipt: receipt("req-a") });
    await queue.append({ entryId: "entry-0003", receipt: receipt("req-c") });

    const listed = await queue.list();
    expect(listed.map((entry) => entry.receipt.requestId)).toEqual([
      "req-b",
      "req-a",
      "req-c",
    ]);

    await queue.remove("entry-0001");
    expect(await queue.size()).toBe(2);
  });

  it("survives process restart: entries written by one instance are read by a new instance", async () => {
    const writer = createCaioEmergencyQueue({ rootDir, keyProvider });
    await writer.append({ entryId: "entry-restart", receipt: receipt("req-r") });

    const reader = createCaioEmergencyQueue({ rootDir, keyProvider });
    const listed = await reader.list();
    expect(listed).toEqual([
      { entryId: "entry-restart", receipt: receipt("req-r") },
    ]);
  });

  it("fails with a typed error when the key provider is unavailable or returns a bad key", async () => {
    const noKey = createCaioEmergencyQueue({
      rootDir,
      keyProvider: async () => {
        throw new Error("kms offline");
      },
    });
    await expect(
      noKey.append({ entryId: "entry-0001", receipt: receipt("req-1") }),
    ).rejects.toBeInstanceOf(CaioAuditQueueKeyUnavailableError);

    const shortKey = createCaioEmergencyQueue({
      rootDir,
      keyProvider: async () => randomBytes(16),
    });
    await expect(shortKey.list()).rejects.toBeInstanceOf(
      CaioAuditQueueKeyUnavailableError,
    );
  });

  it("rejects invalid entry ids and path escape attempts", async () => {
    const queue = createCaioEmergencyQueue({ rootDir, keyProvider });
    for (const entryId of ["../escape-entry", "short", "UPPER-CASE-ID", "a/b-0001-entry"]) {
      await expect(
        queue.append({ entryId, receipt: receipt("req-x") }),
      ).rejects.toBeInstanceOf(CaioAuditQueueIntegrityError);
    }
  });

  it("refuses symlink entries", async () => {
    const queue = createCaioEmergencyQueue({ rootDir, keyProvider });
    await queue.append({ entryId: "entry-0001", receipt: receipt("req-1") });
    const outside = path.join(sandbox, "outside.txt");
    await fs.writeFile(outside, "secret", { mode: 0o600 });
    await fs.symlink(outside, path.join(rootDir, "entry-symlinked"));

    await expect(queue.list()).rejects.toBeInstanceOf(
      CaioAuditQueueIntegrityError,
    );
  });

  it("refuses hardlinked entries", async () => {
    const queue = createCaioEmergencyQueue({ rootDir, keyProvider });
    await queue.append({ entryId: "entry-0001", receipt: receipt("req-1") });
    await fs.link(
      path.join(rootDir, "entry-0001"),
      path.join(sandbox, "hardlink-alias"),
    );

    await expect(queue.list()).rejects.toBeInstanceOf(
      CaioAuditQueueIntegrityError,
    );
  });

  it("refuses a ciphertext copied to a different entry id", async () => {
    const queue = createCaioEmergencyQueue({ rootDir, keyProvider });
    await queue.append({ entryId: "entry-0001", receipt: receipt("req-1") });
    await fs.copyFile(
      path.join(rootDir, "entry-0001"),
      path.join(rootDir, "entry-0002"),
    );
    await fs.chmod(path.join(rootDir, "entry-0002"), 0o600);

    await expect(queue.list()).rejects.toBeInstanceOf(
      CaioAuditQueueIntegrityError,
    );
  });

  it("refuses a queue root with loose permissions", async () => {
    await fs.mkdir(rootDir, { recursive: true, mode: 0o755 });
    await fs.chmod(rootDir, 0o755);
    const queue = createCaioEmergencyQueue({ rootDir, keyProvider });
    await expect(
      queue.append({ entryId: "entry-0001", receipt: receipt("req-1") }),
    ).rejects.toBeInstanceOf(CaioAuditQueueIntegrityError);
  });

  it("enforces the maxEntries cap and deduplicates identical re-appends", async () => {
    const queue = createCaioEmergencyQueue({
      rootDir,
      keyProvider,
      maxEntries: 2,
    });
    await queue.append({ entryId: "entry-0001", receipt: receipt("req-1") });
    await queue.append({ entryId: "entry-0002", receipt: receipt("req-2") });
    await expect(
      queue.append({ entryId: "entry-0003", receipt: receipt("req-3") }),
    ).rejects.toBeInstanceOf(CaioAuditQueueFullError);

    const deduplicated = await queue.append({
      entryId: "entry-0001",
      receipt: receipt("req-1"),
    });
    expect(deduplicated.deduplicated).toBe(true);
    await expect(
      queue.append({ entryId: "entry-0001", receipt: receipt("req-other") }),
    ).rejects.toBeInstanceOf(CaioAuditQueueIntegrityError);
  });

  // F1 regression: append() used to duplicate-check with listEntryStats() and
  // then fs.rename() over the final path, which silently overwrites. Two
  // concurrent appends sharing an entry id both passed the check and the second
  // rename destroyed the first receipt.
  it("F1: refuses a same-id append with different content instead of overwriting the stored receipt", async () => {
    const queue = createCaioEmergencyQueue({ rootDir, keyProvider });
    await queue.append({ entryId: "entry-0001", receipt: receipt("req-1") });

    await expect(
      queue.append({ entryId: "entry-0001", receipt: receipt("req-other") }),
    ).rejects.toBeInstanceOf(CaioAuditQueueContentConflictError);

    const listed = await queue.list();
    expect(listed).toHaveLength(1);
    expect(listed[0]!.receipt.requestId).toBe("req-1");
  });

  it("F1: two concurrent appends with the same id and different content yield exactly one success and one conflict", async () => {
    const queue = createCaioEmergencyQueue({ rootDir, keyProvider });
    const settled = await Promise.allSettled([
      queue.append({ entryId: "entry-race01", receipt: receipt("req-a") }),
      queue.append({ entryId: "entry-race01", receipt: receipt("req-b") }),
    ]);

    const fulfilled = settled.filter((r) => r.status === "fulfilled");
    const rejected = settled.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    // The loser is refused, never silently overwritten: either the winner had
    // already sealed a divergent entry (content conflict) or the winner still
    // held the exclusive reservation (append in progress). Both fail closed.
    const reason = (rejected[0] as PromiseRejectedResult).reason;
    expect(reason).toBeInstanceOf(CaioAuditQueueIntegrityError);

    // Durable receipts must never be fewer than successful appends.
    const listed = await queue.list();
    expect(listed).toHaveLength(fulfilled.length);
    expect(await queue.size()).toBe(1);
  });

  it("F1: an identical concurrent re-append is idempotent and keeps exactly one durable receipt", async () => {
    const queue = createCaioEmergencyQueue({ rootDir, keyProvider });
    await queue.append({ entryId: "entry-idem01", receipt: receipt("req-1") });
    const settled = await Promise.allSettled([
      queue.append({ entryId: "entry-idem01", receipt: receipt("req-1") }),
      queue.append({ entryId: "entry-idem01", receipt: receipt("req-1") }),
    ]);
    for (const result of settled) {
      expect(result.status).toBe("fulfilled");
      if (result.status === "fulfilled") {
        expect(result.value.deduplicated).toBe(true);
      }
    }
    expect(await queue.size()).toBe(1);
  });

  it("F1: an aborted append rolls back its exclusive reservation and leaves no half-written entry", async () => {
    const queue = createCaioEmergencyQueue({
      rootDir,
      keyProvider,
      maxEntries: 1,
    });
    await queue.append({ entryId: "entry-0001", receipt: receipt("req-1") });
    await expect(
      queue.append({ entryId: "entry-0002", receipt: receipt("req-2") }),
    ).rejects.toBeInstanceOf(CaioAuditQueueFullError);

    // No reservation file survives a refused append, so the entry id stays
    // usable and list()/size() never trip over a partial entry.
    expect(await fs.readdir(rootDir)).toEqual(["entry-0001"]);
    expect(await queue.size()).toBe(1);
    await queue.remove("entry-0001");
    const later = await queue.append({
      entryId: "entry-0002",
      receipt: receipt("req-2"),
    });
    expect(later.deduplicated).toBe(false);
    expect((await queue.list())[0]!.receipt.requestId).toBe("req-2");
  });

  it("stores only the minimal receipt payload and refuses extra keys", async () => {
    const queue = createCaioEmergencyQueue({ rootDir, keyProvider });
    await expect(
      queue.append({
        entryId: "entry-0001",
        receipt: {
          ...receipt("req-1"),
          prompt: "leak",
        } as unknown as CaioMinimalAuditReceipt,
      }),
    ).rejects.toThrow();
    expect(await queue.size()).toBe(0);
  });
});
