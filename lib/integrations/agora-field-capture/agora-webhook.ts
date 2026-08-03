import { createHmac, timingSafeEqual } from "node:crypto";

export async function readBoundedAgoraWebhookBody(
  request: Request,
  maxBytes: number,
) {
  if (!Number.isInteger(maxBytes) || maxBytes < 1) {
    throw new Error("Agora webhook byte limit must be a positive integer");
  }
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new Error(`Agora webhook body exceeds ${maxBytes} bytes`);
  }
  if (!request.body) return Buffer.alloc(0);

  const reader = request.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error(`Agora webhook body exceeds ${maxBytes} bytes`);
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, total);
}

export function verifyAgoraWebhookSignature(input: {
  rawBody: Buffer;
  secret: string;
  signatureV2: string | null | undefined;
}) {
  if (!input.secret || !input.signatureV2 || !/^[a-fA-F0-9]{64}$/.test(input.signatureV2)) {
    return false;
  }

  const expected = createHmac("sha256", input.secret)
    .update(input.rawBody)
    .digest();
  const actual = Buffer.from(input.signatureV2, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
