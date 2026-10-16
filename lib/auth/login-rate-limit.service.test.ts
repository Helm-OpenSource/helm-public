import { beforeEach, describe, expect, it, vi } from "vitest";

const { failedLoginAttemptMock } = vi.hoisted(() => ({
  failedLoginAttemptMock: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  db: { failedLoginAttempt: failedLoginAttemptMock },
}));

import { hashLoginIdentifier } from "@/lib/auth/login-rate-limit";
import { clearFailedLogins, recordFailedLogin } from "@/lib/auth/login-rate-limit.service";

describe("login rate limit persistence", () => {
  beforeEach(() => vi.clearAllMocks());

  it("resets a matching lockout row in place without table-wide delete permission", async () => {
    await clearFailedLogins("owner@example.test");

    expect(failedLoginAttemptMock.updateMany).toHaveBeenCalledWith({
      where: { identifierHash: hashLoginIdentifier("owner@example.test") },
      data: {
        attemptCount: 0,
        windowStartedAt: expect.any(Date),
        lockedUntil: null,
      },
    });
    expect(failedLoginAttemptMock.deleteMany).not.toHaveBeenCalled();
  });

  it("continues to treat lockout persistence failures as best effort", async () => {
    failedLoginAttemptMock.updateMany.mockRejectedValue(new Error("database unavailable"));

    await expect(clearFailedLogins("owner@example.test")).resolves.toBeUndefined();
  });

  it("upserts only the hashed identifier and bounded lockout state", async () => {
    failedLoginAttemptMock.findUnique.mockResolvedValue(null);
    failedLoginAttemptMock.upsert.mockResolvedValue(undefined);

    await recordFailedLogin("owner@example.test");

    expect(failedLoginAttemptMock.findUnique).toHaveBeenCalledWith({
      where: { identifierHash: hashLoginIdentifier("owner@example.test") },
      select: { attemptCount: true, windowStartedAt: true, lockedUntil: true },
    });
    expect(failedLoginAttemptMock.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { identifierHash: hashLoginIdentifier("owner@example.test") },
      create: expect.objectContaining({ identifierHash: hashLoginIdentifier("owner@example.test") }),
      update: expect.objectContaining({ attemptCount: 1 }),
    }));
  });
});
