import { describe, expect, it, vi } from "vitest";
import {
  isWriteConflictError,
  runWithWriteConflictRetry,
} from "@/lib/db/conflict-aware-write";

describe("conflict-aware write retry", () => {
  it("detects Prisma and MySQL write conflict shapes", () => {
    expect(isWriteConflictError({ code: "P2034" })).toBe(true);
    expect(isWriteConflictError({ code: 1020 })).toBe(true);
    expect(isWriteConflictError(new Error("Record has changed since last read"))).toBe(true);
    expect(isWriteConflictError(new Error("deadlock found when trying to get lock"))).toBe(true);
    expect(isWriteConflictError(new Error("plain validation error"))).toBe(false);
  });

  it("retries conflict errors and returns the successful value", async () => {
    const thunk = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce({ code: "P2034" })
      .mockResolvedValueOnce("ok");

    await expect(
      runWithWriteConflictRetry(thunk, { retryDelayMs: 0 }),
    ).resolves.toBe("ok");
    expect(thunk).toHaveBeenCalledTimes(2);
  });

  it("does not retry non-conflict errors", async () => {
    const error = new Error("validation failed");
    const thunk = vi.fn<() => Promise<string>>().mockRejectedValue(error);

    await expect(
      runWithWriteConflictRetry(thunk, { retryDelayMs: 0 }),
    ).rejects.toBe(error);
    expect(thunk).toHaveBeenCalledTimes(1);
  });

  it("throws the original final conflict error after max attempts", async () => {
    const first = new Error("P2034 first");
    const final = new Error("P2034 final");
    const thunk = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(first)
      .mockRejectedValueOnce(final);

    await expect(
      runWithWriteConflictRetry(thunk, {
        maxAttempts: 2,
        retryDelayMs: 0,
      }),
    ).rejects.toBe(final);
    expect(thunk).toHaveBeenCalledTimes(2);
  });
});
