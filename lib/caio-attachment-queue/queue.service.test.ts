import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  CAIO_ATTACHMENT_MAX_RETRY_WINDOW_MS,
  type CaioAttachmentErrorReceipt,
  type CaioAttachmentResultReceipt,
} from "@/lib/caio-attachment-queue/attachment-contracts";
import { createEncryptedAttachmentStore } from "@/lib/caio-attachment-queue/encrypted-store";
import {
  createAttachmentQueueService,
  createInMemoryAttachmentQueueState,
  type CaioAttachmentReceiptPort,
} from "@/lib/caio-attachment-queue/queue.service";

const KEY = randomBytes(32);
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from("png-payload-secret"),
]);

function createRecordingReceiptPort() {
  const parsed: Array<{
    receipt: CaioAttachmentResultReceipt;
    extraction: unknown;
  }> = [];
  const errors: CaioAttachmentErrorReceipt[] = [];
  const port: CaioAttachmentReceiptPort = {
    async deliverParsed(input) {
      parsed.push(input);
    },
    async recordError(receipt) {
      errors.push(receipt);
    },
  };
  return { port, parsed, errors };
}

describe("attachment queue service", () => {
  let sandbox = "";
  let clock = new Date("2026-07-29T00:00:00.000Z");

  beforeEach(async () => {
    sandbox = await fs.mkdtemp(path.join(os.tmpdir(), "caio-attach-queue-"));
    clock = new Date("2026-07-29T00:00:00.000Z");
  });

  afterEach(async () => {
    await fs.rm(sandbox, { recursive: true, force: true });
  });

  function build() {
    const payloadStore = createEncryptedAttachmentStore({
      rootDir: path.join(sandbox, "payloads"),
      keyProvider: async () => KEY,
    });
    const statePort = createInMemoryAttachmentQueueState();
    const receipts = createRecordingReceiptPort();
    const service = createAttachmentQueueService({
      payloadStore,
      statePort,
      receiptPort: receipts.port,
      now: () => clock,
    });
    return { service, payloadStore, statePort, receipts };
  }

  it("requires the post-sync-policy flag from the caller", async () => {
    const { service } = build();
    await expect(
      service.enqueue({
        entryId: "entry-gate-check-1",
        payload: PNG,
        declaredMime: "image/png",
        kind: "image",
        passedSyncPolicy: false as unknown as true,
      }),
    ).rejects.toThrow("attachment_sync_policy_gate_required");
  });

  it("rejects malicious intake at enqueue and stores nothing", async () => {
    const { service, payloadStore } = build();
    const result = await service.enqueue({
      entryId: "entry-mismatch-1",
      payload: PNG,
      declaredMime: "application/pdf",
      kind: "document",
      passedSyncPolicy: true,
    });
    expect(result.accepted).toBe(false);
    expect(await payloadStore.hasEntry("entry-mismatch-1")).toBe(false);
  });

  it("parses happy path: claim, markParsed deletes payload immediately, result goes to the caller port", async () => {
    const { service, payloadStore, receipts } = build();
    const enqueued = await service.enqueue({
      entryId: "entry-parse-1",
      payload: PNG,
      declaredMime: "image/png",
      kind: "image",
      passedSyncPolicy: true,
    });
    expect(enqueued.accepted).toBe(true);

    const claimed = await service.claimNext();
    expect(claimed?.entryId).toBe("entry-parse-1");
    expect(claimed?.payload.equals(PNG)).toBe(true);
    expect(await service.getStatus("entry-parse-1")).toBe("processing");

    const outcome = await service.markParsed("entry-parse-1", {
      resultRef: "extraction:entry-parse-1",
      extraction: { text: "hello world" },
    });
    expect(outcome).toEqual({ delivered: true, status: "parsed_deleted" });
    expect(await payloadStore.hasEntry("entry-parse-1")).toBe(false);
    expect(receipts.parsed).toHaveLength(1);
    expect(receipts.parsed[0]!.extraction).toEqual({ text: "hello world" });
    expect(receipts.parsed[0]!.receipt.resultRef).toBe(
      "extraction:entry-parse-1",
    );
    // The receipt itself is secret-free: no extraction text inside.
    expect(JSON.stringify(receipts.parsed[0]!.receipt)).not.toContain(
      "hello world",
    );
  });

  it("retries with backoff inside the 7-day window, then goes terminal keeping only hash + receipt", async () => {
    const { service, payloadStore, receipts } = build();
    await service.enqueue({
      entryId: "entry-retry-1",
      payload: PNG,
      declaredMime: "image/png",
      kind: "image",
      passedSyncPolicy: true,
    });

    const first = await service.claimNext();
    expect(first?.entryId).toBe("entry-retry-1");
    const retried = await service.markFailed("entry-retry-1", {
      errorCode: "ocr_engine_crash",
    });
    expect(retried.status).toBe("failed_retryable");
    // Not yet due: claimNext returns nothing.
    expect(await service.claimNext()).toBeNull();
    // After the backoff delay it becomes claimable again.
    clock = new Date(clock.getTime() + 61_000);
    const second = await service.claimNext();
    expect(second?.entryId).toBe("entry-retry-1");

    // Beyond the 7-day retry window the failure is terminal.
    clock = new Date(clock.getTime() + CAIO_ATTACHMENT_MAX_RETRY_WINDOW_MS);
    const terminal = await service.markFailed("entry-retry-1", {
      errorCode: "ocr_engine_crash",
    });
    expect(terminal.status).toBe("failed_terminal");
    expect(await payloadStore.hasEntry("entry-retry-1")).toBe(false);
    expect(receipts.errors).toHaveLength(1);
    expect(receipts.errors[0]).toMatchObject({
      errorCode: "ocr_engine_crash",
      finalStatus: "failed_terminal",
      attempts: 2,
    });
    expect(receipts.errors[0]!.contentHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    // Terminal entries are never claimable again.
    expect(await service.claimNext()).toBeNull();
  });

  it("expires queued entries past TTL, deleting payloads and keeping receipts", async () => {
    const { service, payloadStore, receipts } = build();
    await service.enqueue({
      entryId: "entry-expire-1",
      payload: PNG,
      declaredMime: "image/png",
      kind: "image",
      passedSyncPolicy: true,
    });
    clock = new Date(clock.getTime() + CAIO_ATTACHMENT_MAX_RETRY_WINDOW_MS + 1);
    const swept = await service.expireSweep();
    expect(swept.expired).toBe(1);
    expect(await service.getStatus("entry-expire-1")).toBe("expired");
    expect(await payloadStore.hasEntry("entry-expire-1")).toBe(false);
    expect(receipts.errors[0]).toMatchObject({
      finalStatus: "expired",
      errorCode: "attachment_ttl_expired",
    });
  });

  it("user delete wins over retry: a user_deleted entry is never re-queued", async () => {
    const { service, payloadStore, receipts } = build();
    await service.enqueue({
      entryId: "entry-userdel-1",
      payload: PNG,
      declaredMime: "image/png",
      kind: "image",
      passedSyncPolicy: true,
    });
    const claimed = await service.claimNext();
    expect(claimed?.entryId).toBe("entry-userdel-1");

    // User deletes while the worker still processes.
    const deleted = await service.userDelete("entry-userdel-1");
    expect(deleted.status).toBe("user_deleted");
    expect(await payloadStore.hasEntry("entry-userdel-1")).toBe(false);

    // The worker later reports failure: no requeue, status stays user_deleted.
    const afterFailure = await service.markFailed("entry-userdel-1", {
      errorCode: "ocr_engine_crash",
    });
    expect(afterFailure.status).toBe("user_deleted");
    expect(await service.claimNext()).toBeNull();

    // The worker later reports success: extraction is dropped, not delivered.
    const afterParse = await service.markParsed("entry-userdel-1", {
      resultRef: "extraction:late",
      extraction: { text: "late result" },
    });
    expect(afterParse).toEqual({ delivered: false, status: "user_deleted" });
    expect(receipts.parsed).toHaveLength(0);
    expect(
      receipts.errors.filter((receipt) => receipt.finalStatus === "user_deleted"),
    ).toHaveLength(1);
  });

  it("exposes no enterprise-memory-store dependency: results only reach the injected caller port", async () => {
    // Compile-time: the deps object below is the COMPLETE dependency set —
    // there is no memory-store port to inject, so queue processing cannot
    // write extractions into enterprise memory as a side effect.
    const payloadStore = createEncryptedAttachmentStore({
      rootDir: path.join(sandbox, "payloads-isolated"),
      keyProvider: async () => KEY,
    });
    const receipts = createRecordingReceiptPort();
    const service = createAttachmentQueueService({
      payloadStore,
      statePort: createInMemoryAttachmentQueueState(),
      receiptPort: receipts.port,
      now: () => clock,
    });
    const serviceSurface = Object.keys(service).sort();
    expect(serviceSurface).toEqual(
      [
        "enqueue",
        "claimNext",
        "markParsed",
        "markFailed",
        "expireSweep",
        "userDelete",
        "getStatus",
      ].sort(),
    );
    expect(
      serviceSurface.filter((name) => name.toLowerCase().includes("memory")),
    ).toEqual([]);

    await service.enqueue({
      entryId: "entry-isolated-1",
      payload: PNG,
      declaredMime: "image/png",
      kind: "image",
      passedSyncPolicy: true,
    });
    await service.claimNext();
    await service.markParsed("entry-isolated-1", {
      resultRef: "extraction:isolated",
      extraction: { text: "isolated" },
    });
    expect(receipts.parsed).toHaveLength(1);
  });

  it("is idempotent for a duplicate enqueue of identical content and conflicts otherwise", async () => {
    const { service } = build();
    const first = await service.enqueue({
      entryId: "entry-dup-1",
      payload: PNG,
      declaredMime: "image/png",
      kind: "image",
      passedSyncPolicy: true,
    });
    const replay = await service.enqueue({
      entryId: "entry-dup-1",
      payload: PNG,
      declaredMime: "image/png",
      kind: "image",
      passedSyncPolicy: true,
    });
    expect(first).toEqual(replay);

    const other = await service.enqueue({
      entryId: "entry-dup-1",
      payload: Buffer.concat([PNG, Buffer.from("different")]),
      declaredMime: "image/png",
      kind: "image",
      passedSyncPolicy: true,
    });
    expect(other.accepted).toBe(false);
  });
});
