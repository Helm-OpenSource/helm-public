import { describe, expect, it } from "vitest";

import {
  CAIO_DEFAULT_SOURCE_IP_LIMIT_PER_MINUTE,
  createInMemoryCaioSourceIpRateLimiter,
} from "@/lib/caio-access-gateway/source-ip-rate-limiter";

const IP_A = [192, 168, 1, 10].join(".");
const IP_B = [10, 0, 0, 5].join(".");

describe("in-memory source-ip rate limiter", () => {
  it("admits up to the limit inside one fixed window then refuses", async () => {
    const limiter = createInMemoryCaioSourceIpRateLimiter({
      limitPerMinute: 3,
    });
    const at = new Date("2026-07-29T10:00:00.000Z");
    for (let index = 0; index < 3; index += 1) {
      const slot = await limiter.claimSourceIpSlot({ sourceIp: IP_A, now: at });
      expect(slot.allowed).toBe(true);
    }
    const refused = await limiter.claimSourceIpSlot({
      sourceIp: IP_A,
      now: at,
    });
    expect(refused.allowed).toBe(false);
    expect(
      refused.allowed ? 0 : refused.retryAfterSeconds,
    ).toBeGreaterThanOrEqual(1);
  });

  it("keeps windows independent per source ip", async () => {
    const limiter = createInMemoryCaioSourceIpRateLimiter({
      limitPerMinute: 1,
    });
    const at = new Date("2026-07-29T10:00:00.000Z");
    expect(
      (await limiter.claimSourceIpSlot({ sourceIp: IP_A, now: at })).allowed,
    ).toBe(true);
    expect(
      (await limiter.claimSourceIpSlot({ sourceIp: IP_A, now: at })).allowed,
    ).toBe(false);
    expect(
      (await limiter.claimSourceIpSlot({ sourceIp: IP_B, now: at })).allowed,
    ).toBe(true);
  });

  it("starts a new fixed window once the previous one elapsed", async () => {
    const limiter = createInMemoryCaioSourceIpRateLimiter({
      limitPerMinute: 1,
    });
    const at = new Date("2026-07-29T10:00:00.000Z");
    await limiter.claimSourceIpSlot({ sourceIp: IP_A, now: at });
    expect(
      (await limiter.claimSourceIpSlot({ sourceIp: IP_A, now: at })).allowed,
    ).toBe(false);
    const later = new Date(at.getTime() + 60_000);
    expect(
      (await limiter.claimSourceIpSlot({ sourceIp: IP_A, now: later })).allowed,
    ).toBe(true);
  });

  it("fails closed when the tracking table is full of live windows", async () => {
    const limiter = createInMemoryCaioSourceIpRateLimiter({
      limitPerMinute: 10,
      maxTrackedSources: 2,
    });
    const at = new Date("2026-07-29T10:00:00.000Z");
    await limiter.claimSourceIpSlot({ sourceIp: IP_A, now: at });
    await limiter.claimSourceIpSlot({ sourceIp: IP_B, now: at });
    const third = await limiter.claimSourceIpSlot({
      sourceIp: [172, 16, 0, 9].join("."),
      now: at,
    });
    expect(third.allowed).toBe(false);
  });

  it("evicts elapsed windows so tracking capacity is reclaimed", async () => {
    const limiter = createInMemoryCaioSourceIpRateLimiter({
      limitPerMinute: 10,
      maxTrackedSources: 1,
    });
    const at = new Date("2026-07-29T10:00:00.000Z");
    await limiter.claimSourceIpSlot({ sourceIp: IP_A, now: at });
    const later = new Date(at.getTime() + 60_000);
    expect(
      (await limiter.claimSourceIpSlot({ sourceIp: IP_B, now: later })).allowed,
    ).toBe(true);
  });

  it("refuses an empty source ip rather than sharing one bucket", async () => {
    const limiter = createInMemoryCaioSourceIpRateLimiter({
      limitPerMinute: 10,
    });
    const slot = await limiter.claimSourceIpSlot({
      sourceIp: "  ",
      now: new Date(),
    });
    expect(slot.allowed).toBe(false);
  });

  it("exposes a positive default limit", () => {
    expect(CAIO_DEFAULT_SOURCE_IP_LIMIT_PER_MINUTE).toBeGreaterThan(0);
  });
});
