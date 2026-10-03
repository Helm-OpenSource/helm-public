import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

function client(principal: string, read: () => Promise<unknown>): PrismaClient {
  return { $queryRaw: read, principal } as unknown as PrismaClient;
}

function composition(writer: PrismaClient, charge: PrismaClient, policyKey: string) {
  return { operationWriterClient: writer, chargeClient: charge, policyKey,
    gateway: vi.fn(), issueProjection: vi.fn() } as never;
}

describe("ordinary paid server composition", () => {
  it("starts without a production spend authority or writer identity", async () => {
    vi.resetModules();
    const compositionModule = await import("./ordinary-paid-composition.service");
    expect(compositionModule.reviewedOrdinaryPaidComposition()).toBeNull();
    expect(compositionModule.ordinaryPaidWriterClient()).toBeNull();
  });

  it("admits only one installer when distinct database reads resolve concurrently", async () => {
    vi.resetModules();
    const compositionModule = await import("./ordinary-paid-composition.service");
    const pending: Array<() => void> = [];
    const read = (principal: string) => () => new Promise((resolve) => {
      pending.push(() => resolve([{ databaseName: "synthetic_db", principal,
        serverUuid: "synthetic-server" }]));
    });
    const writer = client("writer@local", read("writer@local"));
    const charge = client("charge@local", read("charge@local"));
    const first = compositionModule.installReviewedOrdinaryPaidComposition(
      composition(writer, charge, "first"));
    const second = compositionModule.installReviewedOrdinaryPaidComposition(
      composition(writer, charge, "second"));
    while (pending.length) pending.shift()!();
    await Promise.resolve();
    while (pending.length) pending.shift()!();
    const results = await Promise.allSettled([first, second]);
    expect(results.map((result) => result.status).sort()).toEqual(["fulfilled", "rejected"]);
    expect(compositionModule.reviewedOrdinaryPaidComposition()?.policyKey).toBe("first");
  });

  it("leaves a failed realm check uninstalled so a later reviewed install can succeed", async () => {
    vi.resetModules();
    const compositionModule = await import("./ordinary-paid-composition.service");
    const writer = client("writer@local", async () => [{ databaseName: "one", principal: "writer@local",
      serverUuid: "synthetic-server" }]);
    const wrong = client("charge@local", async () => [{ databaseName: "two", principal: "charge@local",
      serverUuid: "synthetic-server" }]);
    await expect(compositionModule.installReviewedOrdinaryPaidComposition(
      composition(writer, wrong, "invalid"))).rejects.toThrow("ordinary_paid_composition_realm_invalid");
    expect(compositionModule.reviewedOrdinaryPaidComposition()).toBeNull();
    const charge = client("charge@local", async () => [{ databaseName: "one", principal: "charge@local",
      serverUuid: "synthetic-server" }]);
    await compositionModule.installReviewedOrdinaryPaidComposition(composition(writer, charge, "valid"));
    expect(compositionModule.reviewedOrdinaryPaidComposition()?.policyKey).toBe("valid");
  });

  it("rejects two servers that happen to use the same database name", async () => {
    vi.resetModules();
    const compositionModule = await import("./ordinary-paid-composition.service");
    const writer = client("writer@local", async () => [{ databaseName: "same_name",
      principal: "writer@local", serverUuid: "server-one" }]);
    const charge = client("charge@local", async () => [{ databaseName: "same_name",
      principal: "charge@local", serverUuid: "server-two" }]);
    await expect(compositionModule.installReviewedOrdinaryPaidComposition(
      composition(writer, charge, "same-name-only"))).rejects.toThrow("ordinary_paid_composition_realm_invalid");
    expect(compositionModule.reviewedOrdinaryPaidComposition()).toBeNull();
  });
});
