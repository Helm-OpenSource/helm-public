import { createHash } from "node:crypto";

import {
  CAIO_DEFAULT_ATTACHMENT_LIMITS,
  type CaioAttachmentKind,
  type CaioAttachmentKindLimits,
} from "@/lib/caio-attachment-queue/attachment-contracts";

/**
 * Synchronous intake validation for attachment payloads.
 *
 * True-type detection is magic-byte sniffing, never the declared
 * extension/mime. A declared/sniffed mismatch is rejected. Zip archives are
 * additionally bounded by the decompressed size their central directory
 * DECLARES — computed without decompressing anything (zip-bomb guard).
 */
export type CaioAttachmentIntakeResult =
  | { ok: true; sniffedMime: string; contentHash: string; sizeBytes: number }
  | { ok: false; reasonCodes: string[] };

function readUInt32LE(buffer: Buffer, offset: number): number {
  return buffer.readUInt32LE(offset);
}

/** Minimal magic-byte sniffer for the supported intake types. */
export function sniffAttachmentMime(buffer: Buffer): string | null {
  if (buffer.length >= 8) {
    if (
      buffer
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    ) {
      return "image/png";
    }
  }
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "image/jpeg";
  }
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString("latin1") === "%PDF-") {
    return "application/pdf";
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("latin1") === "RIFF" &&
    buffer.subarray(8, 12).toString("latin1") === "WAVE"
  ) {
    return "audio/wav";
  }
  if (buffer.length >= 3 && buffer.subarray(0, 3).toString("latin1") === "ID3") {
    return "audio/mpeg";
  }
  if (
    buffer.length >= 2 &&
    buffer[0] === 0xff &&
    (buffer[1]! & 0xe0) === 0xe0
  ) {
    // MPEG audio frame sync without an ID3 header.
    return "audio/mpeg";
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(4, 8).toString("latin1") === "ftyp"
  ) {
    return "video/mp4";
  }
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    ((buffer[2] === 0x03 && buffer[3] === 0x04) ||
      (buffer[2] === 0x05 && buffer[3] === 0x06))
  ) {
    return "application/zip";
  }
  return null;
}

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_HEADER_SIGNATURE = 0x02014b50;
const ZIP64_MARKER = 0xffffffff;

/**
 * Sum of the uncompressed sizes DECLARED by the zip central directory.
 * Returns null when the structure cannot be parsed (fail closed upstream).
 * Never decompresses payload bytes.
 */
export function estimateZipDeclaredDecompressedBytes(
  buffer: Buffer,
): number | null {
  const searchStart = Math.max(0, buffer.length - 65_557);
  let eocdOffset = -1;
  for (let index = buffer.length - 22; index >= searchStart; index -= 1) {
    if (readUInt32LE(buffer, index) === EOCD_SIGNATURE) {
      eocdOffset = index;
      break;
    }
  }
  if (eocdOffset < 0) {
    return null;
  }
  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectoryOffset = readUInt32LE(buffer, eocdOffset + 16);
  if (centralDirectoryOffset === ZIP64_MARKER) {
    return null;
  }

  let cursor = centralDirectoryOffset;
  let declaredTotal = 0;
  for (let entry = 0; entry < entryCount; entry += 1) {
    if (cursor + 46 > buffer.length) {
      return null;
    }
    if (readUInt32LE(buffer, cursor) !== CENTRAL_HEADER_SIGNATURE) {
      return null;
    }
    const uncompressedSize = readUInt32LE(buffer, cursor + 24);
    if (uncompressedSize === ZIP64_MARKER) {
      return null;
    }
    declaredTotal += uncompressedSize;
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return declaredTotal;
}

export function validateAttachmentIntake(
  buffer: Buffer,
  declaredMime: string,
  kind: CaioAttachmentKind,
  limitsByKind: Record<CaioAttachmentKind, CaioAttachmentKindLimits> =
    CAIO_DEFAULT_ATTACHMENT_LIMITS,
): CaioAttachmentIntakeResult {
  const limits = limitsByKind[kind];
  const reasonCodes: string[] = [];

  if (buffer.length === 0) {
    reasonCodes.push("attachment_empty");
  }
  if (buffer.length > limits.maxBytes) {
    reasonCodes.push("attachment_exceeds_max_bytes");
  }

  const sniffedMime = sniffAttachmentMime(buffer);
  if (!sniffedMime) {
    reasonCodes.push("attachment_type_unrecognized");
  } else {
    if (sniffedMime !== declaredMime.toLowerCase()) {
      reasonCodes.push("attachment_declared_mime_mismatch");
    }
    if (!limits.allowedMimeTypes.includes(sniffedMime)) {
      reasonCodes.push("attachment_type_not_allowed_for_kind");
    }
  }

  if (sniffedMime === "application/zip") {
    const cap = limits.maxDecompressedBytes;
    if (cap === undefined) {
      reasonCodes.push("attachment_archive_not_allowed_for_kind");
    } else {
      const declaredBytes = estimateZipDeclaredDecompressedBytes(buffer);
      if (declaredBytes === null) {
        reasonCodes.push("attachment_zip_structure_unparseable");
      } else if (declaredBytes > cap) {
        reasonCodes.push("attachment_zip_declared_size_exceeds_cap");
      }
    }
  }

  if (reasonCodes.length > 0) {
    return { ok: false, reasonCodes };
  }
  return {
    ok: true,
    sniffedMime: sniffedMime!,
    contentHash: `sha256:${createHash("sha256").update(buffer).digest("hex")}`,
    sizeBytes: buffer.length,
  };
}
