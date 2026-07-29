import {
  CAIO_ATTACHMENT_MAX_RETRY_WINDOW_MS,
  CAIO_ATTACHMENT_PAYLOAD_TTL_MS,
  CAIO_ATTACHMENT_RETRY_BACKOFF_SECONDS,
  CAIO_DEFAULT_ATTACHMENT_LIMITS,
  caioAttachmentErrorReceiptSchema,
  caioAttachmentResultReceiptSchema,
  type CaioAttachmentErrorReceipt,
  type CaioAttachmentKind,
  type CaioAttachmentKindLimits,
  type CaioAttachmentResultReceipt,
  type CaioAttachmentStatus,
} from "@/lib/caio-attachment-queue/attachment-contracts";
import type { CaioAttachmentPayloadStore } from "@/lib/caio-attachment-queue/encrypted-store";
import { validateAttachmentIntake } from "@/lib/caio-attachment-queue/intake-validation";

/** Mutable queue-state row tracked per attachment entry. */
export interface CaioAttachmentQueueStateEntry {
  entryId: string;
  kind: CaioAttachmentKind;
  status: CaioAttachmentStatus;
  contentHash: string;
  sniffedMime: string;
  sizeBytes: number;
  firstQueuedAt: Date;
  attempts: number;
  nextAttemptAt: Date;
  lastErrorCode: string | null;
}

/** Injectable metadata state port (in-memory in unit tests). */
export interface CaioAttachmentQueueStatePort {
  get(entryId: string): Promise<CaioAttachmentQueueStateEntry | null>;
  put(entry: CaioAttachmentQueueStateEntry): Promise<void>;
  list(): Promise<CaioAttachmentQueueStateEntry[]>;
}

/**
 * Caller-owned receipt/result port. Parsed extraction results are handed to
 * THIS port and nowhere else — the queue service deliberately has NO
 * enterprise-memory-store dependency, so an OCR/ASR result can never be
 * written into enterprise memory as a side effect of queue processing. What
 * the caller does with a delivered result is a separate, governed decision.
 */
export interface CaioAttachmentReceiptPort {
  deliverParsed(input: {
    receipt: CaioAttachmentResultReceipt;
    /** Raw extraction result; secret-free receipts never include it. */
    extraction: unknown;
  }): Promise<void>;
  recordError(receipt: CaioAttachmentErrorReceipt): Promise<void>;
}

export interface CaioAttachmentQueueService {
  enqueue(input: {
    entryId: string;
    payload: Buffer;
    declaredMime: string;
    kind: CaioAttachmentKind;
    /**
     * The caller MUST assert the attachment already passed synchronous
     * policy checks. OCR/ASR extraction failures never block requests that
     * already passed sync policy — extraction is async by construction.
     */
    passedSyncPolicy: true;
  }): Promise<
    | { accepted: true; contentHash: string }
    | { accepted: false; reasonCodes: string[] }
  >;
  claimNext(): Promise<{
    entryId: string;
    kind: CaioAttachmentKind;
    contentHash: string;
    payload: Buffer;
  } | null>;
  markParsed(
    entryId: string,
    input: { resultRef: string; extraction: unknown },
  ): Promise<{ delivered: boolean; status: CaioAttachmentStatus }>;
  markFailed(
    entryId: string,
    input: { errorCode: string },
  ): Promise<{ status: CaioAttachmentStatus }>;
  expireSweep(): Promise<{ expired: number }>;
  userDelete(entryId: string): Promise<{ status: CaioAttachmentStatus }>;
  getStatus(entryId: string): Promise<CaioAttachmentStatus | null>;
}

export function createInMemoryAttachmentQueueState(): CaioAttachmentQueueStatePort {
  const entries = new Map<string, CaioAttachmentQueueStateEntry>();
  return {
    async get(entryId) {
      const entry = entries.get(entryId);
      return entry ? { ...entry } : null;
    },
    async put(entry) {
      entries.set(entry.entryId, { ...entry });
    },
    async list() {
      return [...entries.values()].map((entry) => ({ ...entry }));
    },
  };
}

export function createAttachmentQueueService(deps: {
  payloadStore: CaioAttachmentPayloadStore;
  statePort: CaioAttachmentQueueStatePort;
  receiptPort: CaioAttachmentReceiptPort;
  now?: () => Date;
  retryBackoffSeconds?: readonly number[];
  limits?: Record<CaioAttachmentKind, CaioAttachmentKindLimits>;
}): CaioAttachmentQueueService {
  const now = deps.now ?? (() => new Date());
  const backoff = deps.retryBackoffSeconds ?? CAIO_ATTACHMENT_RETRY_BACKOFF_SECONDS;
  const limits = deps.limits ?? CAIO_DEFAULT_ATTACHMENT_LIMITS;

  async function closeWithErrorReceipt(
    entry: CaioAttachmentQueueStateEntry,
    finalStatus: "failed_terminal" | "expired" | "user_deleted",
    errorCode: string,
  ): Promise<void> {
    // Delete the payload first, keep ONLY contentHash + secret-free receipt.
    await deps.payloadStore.deleteEntry(entry.entryId);
    entry.status = finalStatus;
    entry.lastErrorCode = errorCode;
    await deps.statePort.put(entry);
    await deps.receiptPort.recordError(
      caioAttachmentErrorReceiptSchema.parse({
        contentHash: entry.contentHash,
        errorCode,
        attempts: entry.attempts,
        firstQueuedAt: entry.firstQueuedAt.toISOString(),
        closedAt: now().toISOString(),
        finalStatus,
      }),
    );
  }

  return {
    async enqueue({ entryId, payload, declaredMime, kind, passedSyncPolicy }) {
      if (passedSyncPolicy !== true) {
        throw new Error(
          "attachment_sync_policy_gate_required: enqueue is post-sync-policy only",
        );
      }
      const intake = validateAttachmentIntake(payload, declaredMime, kind, limits);
      if (!intake.ok) {
        return { accepted: false, reasonCodes: intake.reasonCodes };
      }
      const existing = await deps.statePort.get(entryId);
      if (existing) {
        if (existing.contentHash === intake.contentHash) {
          return { accepted: true, contentHash: intake.contentHash };
        }
        return { accepted: false, reasonCodes: ["attachment_entry_id_conflict"] };
      }
      await deps.payloadStore.writeEntry(entryId, payload);
      const enqueuedAt = now();
      await deps.statePort.put({
        entryId,
        kind,
        status: "queued",
        contentHash: intake.contentHash,
        sniffedMime: intake.sniffedMime,
        sizeBytes: intake.sizeBytes,
        firstQueuedAt: enqueuedAt,
        attempts: 0,
        nextAttemptAt: enqueuedAt,
        lastErrorCode: null,
      });
      return { accepted: true, contentHash: intake.contentHash };
    },

    async claimNext() {
      const currentTime = now();
      const due = (await deps.statePort.list())
        .filter(
          (entry) =>
            (entry.status === "queued" || entry.status === "failed_retryable") &&
            entry.nextAttemptAt.getTime() <= currentTime.getTime(),
        )
        .sort(
          (a, b) => a.nextAttemptAt.getTime() - b.nextAttemptAt.getTime(),
        );
      const entry = due[0];
      if (!entry) {
        return null;
      }
      if (entry.status === "failed_retryable") {
        entry.status = "queued";
      }
      entry.status = "processing";
      await deps.statePort.put(entry);
      const payload = await deps.payloadStore.readEntry(entry.entryId);
      return {
        entryId: entry.entryId,
        kind: entry.kind,
        contentHash: entry.contentHash,
        payload,
      };
    },

    async markParsed(entryId, { resultRef, extraction }) {
      const entry = await deps.statePort.get(entryId);
      if (!entry) {
        throw new Error(`attachment_entry_not_found: ${entryId}`);
      }
      if (entry.status === "user_deleted") {
        // User delete wins: drop the extraction, never resurrect the entry.
        return { delivered: false, status: "user_deleted" };
      }
      if (entry.status !== "processing") {
        throw new Error(
          `attachment_invalid_transition: ${entry.status} -> parsed_deleted`,
        );
      }
      // parsed -> immediate deletion of the payload, before result delivery.
      await deps.payloadStore.deleteEntry(entryId);
      entry.status = "parsed_deleted";
      await deps.statePort.put(entry);
      await deps.receiptPort.deliverParsed({
        receipt: caioAttachmentResultReceiptSchema.parse({
          contentHash: entry.contentHash,
          kind: entry.kind,
          parsedAt: now().toISOString(),
          resultRef,
        }),
        extraction,
      });
      return { delivered: true, status: "parsed_deleted" };
    },

    async markFailed(entryId, { errorCode }) {
      const entry = await deps.statePort.get(entryId);
      if (!entry) {
        throw new Error(`attachment_entry_not_found: ${entryId}`);
      }
      if (entry.status === "user_deleted") {
        // User delete wins over retry: never re-queued.
        return { status: "user_deleted" };
      }
      if (entry.status !== "processing") {
        throw new Error(
          `attachment_invalid_transition: ${entry.status} -> failed_*`,
        );
      }
      entry.attempts += 1;
      entry.lastErrorCode = errorCode;
      const elapsedMs = now().getTime() - entry.firstQueuedAt.getTime();
      if (elapsedMs >= CAIO_ATTACHMENT_MAX_RETRY_WINDOW_MS) {
        await closeWithErrorReceipt(entry, "failed_terminal", errorCode);
        return { status: "failed_terminal" };
      }
      const delaySeconds =
        backoff[Math.min(entry.attempts - 1, backoff.length - 1)] ?? 60;
      entry.status = "failed_retryable";
      entry.nextAttemptAt = new Date(now().getTime() + delaySeconds * 1000);
      await deps.statePort.put(entry);
      return { status: "failed_retryable" };
    },

    async expireSweep() {
      const currentTime = now().getTime();
      let expired = 0;
      for (const entry of await deps.statePort.list()) {
        if (entry.status !== "queued" && entry.status !== "failed_retryable") {
          continue;
        }
        if (
          currentTime - entry.firstQueuedAt.getTime() >=
          CAIO_ATTACHMENT_PAYLOAD_TTL_MS
        ) {
          await closeWithErrorReceipt(entry, "expired", "attachment_ttl_expired");
          expired += 1;
        }
      }
      return { expired };
    },

    async userDelete(entryId) {
      const entry = await deps.statePort.get(entryId);
      if (!entry) {
        throw new Error(`attachment_entry_not_found: ${entryId}`);
      }
      if (
        entry.status === "user_deleted" ||
        entry.status === "parsed_deleted" ||
        entry.status === "failed_terminal" ||
        entry.status === "expired"
      ) {
        // Payload is already gone in every closed status; user_deleted still
        // records the strongest tombstone when re-invoked on itself.
        return { status: entry.status };
      }
      await closeWithErrorReceipt(entry, "user_deleted", "user_deleted");
      return { status: "user_deleted" };
    },

    async getStatus(entryId) {
      const entry = await deps.statePort.get(entryId);
      return entry ? entry.status : null;
    },
  };
}
