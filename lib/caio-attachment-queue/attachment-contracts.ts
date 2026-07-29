import { z } from "zod";

/** Attachment kinds accepted by the multimodal intake. */
export const CAIO_ATTACHMENT_KINDS = [
  "image",
  "audio",
  "video",
  "document",
  "archive",
] as const;
export const caioAttachmentKindSchema = z.enum(CAIO_ATTACHMENT_KINDS);
export type CaioAttachmentKind = z.infer<typeof caioAttachmentKindSchema>;

/**
 * Per-kind intake limits. allowedMimeTypes are matched against the
 * TRUE (magic-byte sniffed) type, never the declared extension/mime alone.
 */
export const caioAttachmentKindLimitsSchema = z
  .object({
    maxBytes: z.number().int().positive(),
    maxPages: z.number().int().positive().optional(),
    maxDurationSeconds: z.number().int().positive().optional(),
    maxDecompressedBytes: z.number().int().positive().optional(),
    allowedMimeTypes: z.array(z.string().min(1)).min(1),
  })
  .strict();
export type CaioAttachmentKindLimits = z.infer<
  typeof caioAttachmentKindLimitsSchema
>;

export const CAIO_DEFAULT_ATTACHMENT_LIMITS: Record<
  CaioAttachmentKind,
  CaioAttachmentKindLimits
> = {
  image: {
    maxBytes: 20 * 1024 * 1024,
    allowedMimeTypes: ["image/png", "image/jpeg"],
  },
  audio: {
    maxBytes: 200 * 1024 * 1024,
    maxDurationSeconds: 4 * 60 * 60,
    allowedMimeTypes: ["audio/wav", "audio/mpeg"],
  },
  video: {
    maxBytes: 1024 * 1024 * 1024,
    maxDurationSeconds: 4 * 60 * 60,
    allowedMimeTypes: ["video/mp4"],
  },
  document: {
    maxBytes: 100 * 1024 * 1024,
    maxPages: 1000,
    allowedMimeTypes: ["application/pdf"],
  },
  archive: {
    maxBytes: 200 * 1024 * 1024,
    maxDecompressedBytes: 1024 * 1024 * 1024,
    allowedMimeTypes: ["application/zip"],
  },
};

/**
 * Retry policy: a failed extraction may retry with backoff, but only inside
 * a 7-day window measured from firstQueuedAt. After the window the entry is
 * failed_terminal. TTL semantics: the encrypted payload itself also expires
 * 7 days after firstQueuedAt (expireSweep); expired/terminal entries keep
 * ONLY the contentHash plus a secret-free error receipt — the payload is
 * deleted.
 */
export const CAIO_ATTACHMENT_MAX_RETRY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export const CAIO_ATTACHMENT_PAYLOAD_TTL_MS = CAIO_ATTACHMENT_MAX_RETRY_WINDOW_MS;
/** Backoff schedule in seconds, indexed by (attempt - 1); clamps to last. */
export const CAIO_ATTACHMENT_RETRY_BACKOFF_SECONDS = [
  60, 300, 1_800, 7_200, 21_600, 86_400,
] as const;

/**
 * Status machine:
 *   queued -> processing -> parsed_deleted            (payload deleted at once)
 *   processing -> failed_retryable -> queued          (inside 7d window)
 *   processing -> failed_terminal                     (window exhausted)
 *   queued|failed_retryable -> expired                (TTL sweep)
 *   any non-terminal -> user_deleted                  (user delete wins; never re-queued)
 */
export const CAIO_ATTACHMENT_STATUSES = [
  "queued",
  "processing",
  "parsed_deleted",
  "failed_retryable",
  "failed_terminal",
  "expired",
  "user_deleted",
] as const;
export const caioAttachmentStatusSchema = z.enum(CAIO_ATTACHMENT_STATUSES);
export type CaioAttachmentStatus = z.infer<typeof caioAttachmentStatusSchema>;

export const CAIO_ATTACHMENT_TERMINAL_STATUSES: readonly CaioAttachmentStatus[] =
  ["parsed_deleted", "failed_terminal", "expired", "user_deleted"];

const TRANSITIONS: Record<CaioAttachmentStatus, readonly CaioAttachmentStatus[]> =
  {
    queued: ["processing", "expired", "user_deleted"],
    processing: [
      "parsed_deleted",
      "failed_retryable",
      "failed_terminal",
      "user_deleted",
    ],
    failed_retryable: ["queued", "expired", "failed_terminal", "user_deleted"],
    parsed_deleted: [],
    failed_terminal: [],
    expired: [],
    user_deleted: [],
  };

export function canTransitionAttachmentStatus(
  from: CaioAttachmentStatus,
  to: CaioAttachmentStatus,
): boolean {
  return TRANSITIONS[from].includes(to);
}

/**
 * Secret-free receipts kept after the payload is gone. `.strict()` keeps
 * raw extraction text, provider errors, tokens, or credentials out.
 */
export const caioAttachmentErrorReceiptSchema = z
  .object({
    contentHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    errorCode: z.string().regex(/^[a-z0-9_]{1,80}$/),
    attempts: z.number().int().nonnegative(),
    firstQueuedAt: z.string().datetime({ offset: true }),
    closedAt: z.string().datetime({ offset: true }),
    finalStatus: z.enum(["failed_terminal", "expired", "user_deleted"]),
  })
  .strict();
export type CaioAttachmentErrorReceipt = z.infer<
  typeof caioAttachmentErrorReceiptSchema
>;

export const caioAttachmentResultReceiptSchema = z
  .object({
    contentHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    kind: caioAttachmentKindSchema,
    parsedAt: z.string().datetime({ offset: true }),
    resultRef: z.string().min(1).max(200),
  })
  .strict();
export type CaioAttachmentResultReceipt = z.infer<
  typeof caioAttachmentResultReceiptSchema
>;

/** Entry ids: flat, lowercase, cannot traverse paths. */
export const CAIO_ATTACHMENT_ENTRY_ID_PATTERN = /^[a-z0-9-]{8,64}$/;

export class CaioAttachmentStoreKeyUnavailableError extends Error {
  readonly code = "caio_attachment_key_unavailable";

  constructor(detail: string) {
    super(`caio_attachment_key_unavailable: ${detail}`);
    this.name = "CaioAttachmentStoreKeyUnavailableError";
  }
}

export class CaioAttachmentStoreIntegrityError extends Error {
  readonly code = "caio_attachment_store_integrity_violation";

  constructor(detail: string) {
    super(`caio_attachment_store_integrity_violation: ${detail}`);
    this.name = "CaioAttachmentStoreIntegrityError";
  }
}
