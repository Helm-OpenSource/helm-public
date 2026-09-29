export type BoundedRequestBytesResult =
  | { ok: true; bytes: Uint8Array }
  | { ok: false; code: "invalid_limits" | "body_too_large" | "body_timeout" | "body_unavailable" };

export interface BoundedRequestBytesLimits {
  /** Integer from zero through 2^31 - 1. Choose a small endpoint-specific budget. */
  maxBytes: number;
  /** Total elapsed reading budget, an integer from one through 2^31 - 1 milliseconds. */
  timeoutMs: number;
}

/**
 * Reads actual bytes without decoding or trusting Content-Length. The deadline
 * covers the entire read, not each chunk. Like any JS timer, it cannot interrupt
 * a producer that synchronously blocks the event loop. No body contents or
 * upstream errors are returned. Cancellation is best effort and never awaited.
 */
export async function readBoundedRequestBytes(
  body: ReadableStream<Uint8Array> | null,
  limits: BoundedRequestBytesLimits,
): Promise<BoundedRequestBytesResult> {
  if (!limits || !Number.isInteger(limits.maxBytes) || limits.maxBytes < 0 || limits.maxBytes > 0x7fffffff ||
      !Number.isInteger(limits.timeoutMs) || limits.timeoutMs < 1 || limits.timeoutMs > 0x7fffffff) {
    return { ok: false, code: "invalid_limits" };
  }
  if (!body) return { ok: true, bytes: new Uint8Array() };
  const deadline = performance.now() + limits.timeoutMs;
  let reader: ReadableStreamDefaultReader<Uint8Array>;
  try { reader = body.getReader(); } catch { return { ok: false, code: "body_unavailable" }; }
  const timeout = Symbol("deadline");
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<typeof timeout>((resolve) => {
    timer = setTimeout(() => resolve(timeout), limits.timeoutMs);
  });
  const fail = (code: "body_too_large" | "body_timeout" | "body_unavailable"): BoundedRequestBytesResult => {
    try { void reader.cancel(code).catch(() => {}); } catch { /* Best effort only. */ }
    return { ok: false, code };
  };
  let stopped = false;
  const consume = async (): Promise<BoundedRequestBytesResult> => {
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      if (performance.now() >= deadline) return fail("body_timeout");
      const result = await reader.read();
      if (stopped) return { ok: false, code: "body_timeout" };
      if (performance.now() >= deadline) return fail("body_timeout");
      if (result.done) break;
      if (!(result.value instanceof Uint8Array)) return fail("body_unavailable");
      if (result.value.byteLength > limits.maxBytes - total) return fail("body_too_large");
      total += result.value.byteLength;
      // Copy now: producers may reuse buffers, and Buffer.slice returns a view.
      if (result.value.byteLength) chunks.push(new Uint8Array(result.value));
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    if (performance.now() >= deadline) return fail("body_timeout");
    return { ok: true, bytes };
  };
  try {
    // One race for the entire loop: empty/tiny chunks must not accumulate
    // reactions on a shared, unresolved deadline promise.
    const result = await Promise.race([consume(), expired]);
    if (result === timeout) { stopped = true; return fail("body_timeout"); }
    return result;
  } catch {
    return fail("body_unavailable");
  } finally {
    stopped = true;
    clearTimeout(timer);
    reader.releaseLock();
  }
}
