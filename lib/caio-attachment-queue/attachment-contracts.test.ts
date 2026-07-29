import { describe, expect, it } from "vitest";

import {
  CAIO_ATTACHMENT_KINDS,
  CAIO_ATTACHMENT_MAX_RETRY_WINDOW_MS,
  CAIO_ATTACHMENT_PAYLOAD_TTL_MS,
  CAIO_ATTACHMENT_STATUSES,
  CAIO_DEFAULT_ATTACHMENT_LIMITS,
  caioAttachmentErrorReceiptSchema,
  caioAttachmentKindLimitsSchema,
  canTransitionAttachmentStatus,
} from "@/lib/caio-attachment-queue/attachment-contracts";

describe("caio attachment contracts", () => {
  it("declares the attachment kinds with per-kind limits", () => {
    expect([...CAIO_ATTACHMENT_KINDS]).toEqual([
      "image",
      "audio",
      "video",
      "document",
      "archive",
    ]);
    for (const kind of CAIO_ATTACHMENT_KINDS) {
      const limits = CAIO_DEFAULT_ATTACHMENT_LIMITS[kind];
      expect(() => caioAttachmentKindLimitsSchema.parse(limits)).not.toThrow();
      expect(limits.maxBytes).toBeGreaterThan(0);
      expect(limits.allowedMimeTypes.length).toBeGreaterThan(0);
    }
    expect(
      CAIO_DEFAULT_ATTACHMENT_LIMITS.archive.maxDecompressedBytes,
    ).toBeGreaterThan(0);
    expect(CAIO_DEFAULT_ATTACHMENT_LIMITS.document.maxPages).toBeGreaterThan(0);
    expect(
      CAIO_DEFAULT_ATTACHMENT_LIMITS.audio.maxDurationSeconds,
    ).toBeGreaterThan(0);
  });

  it("pins the 7-day retry window and payload TTL", () => {
    expect(CAIO_ATTACHMENT_MAX_RETRY_WINDOW_MS).toBe(7 * 24 * 60 * 60 * 1000);
    expect(CAIO_ATTACHMENT_PAYLOAD_TTL_MS).toBe(
      CAIO_ATTACHMENT_MAX_RETRY_WINDOW_MS,
    );
  });

  it("encodes the status machine transitions", () => {
    expect([...CAIO_ATTACHMENT_STATUSES]).toContain("parsed_deleted");
    expect(canTransitionAttachmentStatus("queued", "processing")).toBe(true);
    expect(canTransitionAttachmentStatus("processing", "parsed_deleted")).toBe(
      true,
    );
    expect(
      canTransitionAttachmentStatus("processing", "failed_retryable"),
    ).toBe(true);
    expect(canTransitionAttachmentStatus("failed_retryable", "queued")).toBe(
      true,
    );
    expect(canTransitionAttachmentStatus("processing", "failed_terminal")).toBe(
      true,
    );
    expect(canTransitionAttachmentStatus("queued", "expired")).toBe(true);
    expect(canTransitionAttachmentStatus("queued", "user_deleted")).toBe(true);
    // Closed statuses are dead ends: user_deleted is never re-queued.
    expect(canTransitionAttachmentStatus("user_deleted", "queued")).toBe(false);
    expect(canTransitionAttachmentStatus("parsed_deleted", "queued")).toBe(
      false,
    );
    expect(canTransitionAttachmentStatus("failed_terminal", "queued")).toBe(
      false,
    );
    expect(canTransitionAttachmentStatus("expired", "queued")).toBe(false);
  });

  it("keeps error receipts secret-free via a strict closed shape", () => {
    const receipt = {
      contentHash: `sha256:${"a".repeat(64)}`,
      errorCode: "ocr_engine_crash",
      attempts: 3,
      firstQueuedAt: "2026-07-29T00:00:00.000+00:00",
      closedAt: "2026-07-29T01:00:00.000+00:00",
      finalStatus: "failed_terminal" as const,
    };
    expect(() => caioAttachmentErrorReceiptSchema.parse(receipt)).not.toThrow();
    expect(() =>
      caioAttachmentErrorReceiptSchema.parse({
        ...receipt,
        stderr: "Bearer sk-secret-token",
      }),
    ).toThrow();
    expect(() =>
      caioAttachmentErrorReceiptSchema.parse({
        ...receipt,
        errorCode: "boom: Bearer sk-secret-token",
      }),
    ).toThrow();
  });
});
