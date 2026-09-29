import { afterEach, describe, expect, it, vi } from "vitest";
import { readBoundedRequestBytes } from "./bounded-request-bytes";

const limits = { maxBytes: 4, timeoutMs: 100 };
function stream(chunks: Uint8Array[]) {
  return new ReadableStream<Uint8Array>({ start(controller) {
    for (const chunk of chunks) controller.enqueue(chunk);
    controller.close();
  } });
}
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
describe("readBoundedRequestBytes", () => {
  it("returns empty bytes for no body", async () => {
    expect(await readBoundedRequestBytes(null, limits)).toEqual({ ok: true, bytes: new Uint8Array() });
  });
  it.each([undefined, "0", "99999"])("counts bytes independently of content length %s", async (length) => {
    const request = new Request("https://example.invalid", { method: "POST", body: "abcde", headers: length ? { "content-length": length } : {} });
    expect(await readBoundedRequestBytes(request.body, limits)).toEqual({ ok: false, code: "body_too_large" });
  });
  it("preserves BOM, invalid UTF8 and subarray boundaries", async () => {
    const bytes = new Uint8Array([9, 239, 187, 191, 255, 9]);
    expect(await readBoundedRequestBytes(stream([bytes.subarray(1, 5)]), limits)).toEqual({ ok: true, bytes: new Uint8Array([239, 187, 191, 255]) });
  });
  it("copies reused producer buffers", async () => {
    const bytes = Buffer.from([1, 2]); let count = 0;
    const body = new ReadableStream<Uint8Array>({ pull(controller) {
      if (count++ === 0) controller.enqueue(bytes);
      else { bytes.fill(3); controller.enqueue(bytes); controller.close(); }
    } }, { highWaterMark: 0 });
    expect(await readBoundedRequestBytes(body, limits)).toEqual({ ok: true, bytes: new Uint8Array([1, 2, 3, 3]) });
  });
  it.each(["reject", "hang"])("does not await %s cancellation after chunked overflow", async (mode) => {
    const cancel = vi.fn(() => mode === "reject" ? Promise.reject(new Error("private")) : new Promise<void>(() => {}));
    const body = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new Uint8Array(3)); c.enqueue(new Uint8Array(2)); }, cancel });
    expect(await readBoundedRequestBytes(body, limits)).toEqual({ ok: false, code: "body_too_large" });
    expect(cancel).toHaveBeenCalledOnce(); expect(body.locked).toBe(false);
  });
  it("times out a stalled read even when cancellation hangs", async () => {
    const cancel = vi.fn(() => new Promise<void>(() => {}));
    const body = new ReadableStream<Uint8Array>({ cancel });
    expect(await readBoundedRequestBytes(body, { ...limits, timeoutMs: 10 })).toEqual({ ok: false, code: "body_timeout" });
    expect(cancel).toHaveBeenCalledOnce(); expect(body.locked).toBe(false);
  });
  it("enforces elapsed time even when immediate chunks starve timers", async () => {
    let reads = 0;
    vi.spyOn(performance, "now").mockImplementation(() => reads++ * 10);
    const body = new ReadableStream<Uint8Array>({ pull(c) { c.enqueue(new Uint8Array()); } });
    expect(await readBoundedRequestBytes(body, { ...limits, timeoutMs: 25 })).toEqual({ ok: false, code: "body_timeout" });
    expect(body.locked).toBe(false);
  });
  it("hides rejected cancellation on timeout", async () => {
    const body = new ReadableStream<Uint8Array>({ cancel() { return Promise.reject(new Error("private")); } });
    expect(await readBoundedRequestBytes(body, { ...limits, timeoutMs: 5 })).toEqual({ ok: false, code: "body_timeout" });
    expect(body.locked).toBe(false);
  });
  it("handles many tiny chunks within the byte budget", async () => {
    let remaining = 20000;
    const body = new ReadableStream<Uint8Array>({ pull(c) {
      if (remaining-- > 0) c.enqueue(new Uint8Array([7])); else c.close();
    } }, { highWaterMark: 0 });
    const result = await readBoundedRequestBytes(body, { maxBytes: 20000, timeoutMs: 2000 });
    expect(result.ok).toBe(true);
    if (result.ok) { expect(result.bytes.length).toBe(20000); expect(result.bytes.every(b => b === 7)).toBe(true); }
    expect(body.locked).toBe(false);
  });
  it("terminates an unlimited stream of empty chunks at its deadline", async () => {
    let reads = 0;
    const body = new ReadableStream<Uint8Array>({ pull(c) { reads++; c.enqueue(new Uint8Array()); } });
    expect(await readBoundedRequestBytes(body, { maxBytes: 0, timeoutMs: 20 })).toEqual({ ok: false, code: "body_timeout" });
    expect(reads).toBeGreaterThan(1); expect(body.locked).toBe(false);
  });
  it("uses a total deadline rather than a fresh timeout per chunk", async () => {
    vi.useFakeTimers();
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({ start(c) { controller = c; } });
    const result = readBoundedRequestBytes(body, { maxBytes: 100, timeoutMs: 30 });
    await vi.advanceTimersByTimeAsync(20); controller.enqueue(new Uint8Array([1]));
    await vi.advanceTimersByTimeAsync(11);
    expect(await result).toEqual({ ok: false, code: "body_timeout" });
    expect(vi.getTimerCount()).toBe(0); expect(body.locked).toBe(false);
  });
  it("cleans the timer on success and hides stream failures", async () => {
    vi.useFakeTimers();
    expect((await readBoundedRequestBytes(stream([]), limits)).ok).toBe(true);
    const body = new ReadableStream<Uint8Array>({ pull() { throw new Error("private body"); } });
    expect(await readBoundedRequestBytes(body, limits)).toEqual({ ok: false, code: "body_unavailable" });
    expect(vi.getTimerCount()).toBe(0); expect(body.locked).toBe(false);
  });
  it("does not release a reader owned by another caller", async () => {
    const body = stream([]); const reader = body.getReader();
    expect(await readBoundedRequestBytes(body, limits)).toEqual({ ok: false, code: "body_unavailable" });
    expect(body.locked).toBe(true); reader.releaseLock();
  });
  it.each([-1, 1.5, NaN, Infinity, 2147483648])("rejects invalid maxBytes %s before reading", async (maxBytes) => {
    expect(await readBoundedRequestBytes(null, { ...limits, maxBytes })).toEqual({ ok: false, code: "invalid_limits" });
  });
  it.each([0, -1, 1.5, NaN, Infinity, 2147483648])("rejects invalid timeoutMs %s", async (timeoutMs) => {
    expect(await readBoundedRequestBytes(null, { ...limits, timeoutMs })).toEqual({ ok: false, code: "invalid_limits" });
  });
  it("permits an empty stream with a zero-byte budget", async () => {
    expect(await readBoundedRequestBytes(stream([]), { ...limits, maxBytes: 0 })).toEqual({ ok: true, bytes: new Uint8Array() });
  });
});
