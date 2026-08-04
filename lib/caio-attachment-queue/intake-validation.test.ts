import { describe, expect, it } from "vitest";

import {
  estimateZipDeclaredDecompressedBytes,
  sniffAttachmentMime,
  validateAttachmentIntake,
} from "@/lib/caio-attachment-queue/intake-validation";

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from("fake-png-body"),
]);
const JPEG = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  Buffer.from("fake-jpeg-body"),
]);
const PDF = Buffer.from("%PDF-1.7\nfake pdf body");
const WAV = Buffer.concat([
  Buffer.from("RIFF"),
  Buffer.from([0x24, 0x00, 0x00, 0x00]),
  Buffer.from("WAVEfmt fake"),
]);
const MP3 = Buffer.concat([Buffer.from("ID3"), Buffer.from([0x03, 0x00, 0x00])]);
const MP4 = Buffer.concat([
  Buffer.from([0x00, 0x00, 0x00, 0x18]),
  Buffer.from("ftypisom-and-fake-body"),
]);

/**
 * Builds a syntactically valid zip whose CENTRAL DIRECTORY declares the given
 * uncompressed sizes without carrying any real compressed data — the
 * classic zip-bomb declaration shape.
 */
function buildZipDeclaring(uncompressedSizes: number[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let localOffset = 0;
  uncompressedSizes.forEach((size, index) => {
    const name = Buffer.from(`entry-${index}.bin`);
    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(size >>> 0, 22);
    local.writeUInt16LE(name.length, 26);
    name.copy(local, 30);
    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(0, 20); // compressed size: nothing stored
    central.writeUInt32LE(size >>> 0, 24); // declared uncompressed size
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(localOffset, 42);
    name.copy(central, 46);
    localParts.push(local);
    centralParts.push(central);
    localOffset += local.length;
  });
  const centralDirectory = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(uncompressedSizes.length, 8);
  eocd.writeUInt16LE(uncompressedSizes.length, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(localOffset, 16);
  return Buffer.concat([...localParts, centralDirectory, eocd]);
}

describe("attachment intake validation", () => {
  it("sniffs true types from magic bytes", () => {
    expect(sniffAttachmentMime(PNG)).toBe("image/png");
    expect(sniffAttachmentMime(JPEG)).toBe("image/jpeg");
    expect(sniffAttachmentMime(PDF)).toBe("application/pdf");
    expect(sniffAttachmentMime(WAV)).toBe("audio/wav");
    expect(sniffAttachmentMime(MP3)).toBe("audio/mpeg");
    expect(sniffAttachmentMime(MP4)).toBe("video/mp4");
    expect(sniffAttachmentMime(buildZipDeclaring([10]))).toBe("application/zip");
    expect(sniffAttachmentMime(Buffer.from("plain text"))).toBeNull();
  });

  it("accepts a well-declared attachment and returns its content hash", () => {
    const result = validateAttachmentIntake(PNG, "image/png", "image");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.sniffedMime).toBe("image/png");
      expect(result.contentHash).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(result.sizeBytes).toBe(PNG.length);
    }
  });

  it("rejects a fake extension: PNG bytes declared as application/pdf", () => {
    const result = validateAttachmentIntake(PNG, "application/pdf", "document");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasonCodes).toContain("attachment_declared_mime_mismatch");
      expect(result.reasonCodes).toContain(
        "attachment_type_not_allowed_for_kind",
      );
    }
  });

  it("rejects an executable-like unrecognized payload regardless of declaration", () => {
    const fake = Buffer.from("MZ\x90\x00 pretending to be image.png");
    const result = validateAttachmentIntake(fake, "image/png", "image");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasonCodes).toContain("attachment_type_unrecognized");
    }
  });

  it("rejects payloads above the per-kind size cap", () => {
    const result = validateAttachmentIntake(PDF, "application/pdf", "document", {
      image: { maxBytes: 10, allowedMimeTypes: ["image/png"] },
      audio: { maxBytes: 10, allowedMimeTypes: ["audio/wav"] },
      video: { maxBytes: 10, allowedMimeTypes: ["video/mp4"] },
      document: { maxBytes: 4, allowedMimeTypes: ["application/pdf"] },
      archive: {
        maxBytes: 10,
        maxDecompressedBytes: 10,
        allowedMimeTypes: ["application/zip"],
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasonCodes).toContain("attachment_exceeds_max_bytes");
    }
  });

  it("rejects a zip whose central directory declares more than the decompression cap", () => {
    // A ~200 byte file declaring ~4GB of decompressed content.
    const bomb = buildZipDeclaring([0xfffffffe / 2, 0xfffffffe / 2]);
    expect(bomb.length).toBeLessThan(1024);
    const declared = estimateZipDeclaredDecompressedBytes(bomb);
    expect(declared).toBeGreaterThan(4_000_000_000);

    const result = validateAttachmentIntake(bomb, "application/zip", "archive");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasonCodes).toContain(
        "attachment_zip_declared_size_exceeds_cap",
      );
    }
  });

  it("accepts a zip whose declared decompressed size is inside the cap", () => {
    const smallZip = buildZipDeclaring([1024, 2048]);
    expect(estimateZipDeclaredDecompressedBytes(smallZip)).toBe(3072);
    const result = validateAttachmentIntake(smallZip, "application/zip", "archive");
    expect(result.ok).toBe(true);
  });

  it("fails closed on an unparseable zip structure", () => {
    const truncated = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      Buffer.from("garbage-without-central-directory"),
    ]);
    const result = validateAttachmentIntake(
      truncated,
      "application/zip",
      "archive",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasonCodes).toContain(
        "attachment_zip_structure_unparseable",
      );
    }
  });

  it("rejects empty payloads", () => {
    const result = validateAttachmentIntake(
      Buffer.alloc(0),
      "image/png",
      "image",
    );
    expect(result.ok).toBe(false);
  });
});
