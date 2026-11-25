import { describe, expect, it, vi } from "vitest";
import { revokeDeviceRowInTx, revokeSeatDevicesInTx } from "./store-tokens";

// A bundled Next.js server can hold two copies of Prisma's Sql class. When a
// Prisma.sql fragment crosses that boundary, `$executeRaw` binds it as a JSON
// string and MySQL rejects the UPDATE with 1292 (Prisma P2010). These tests
// mimic that binding behaviour so the fragment cannot come back unnoticed.
function makeTx(rows: Array<Record<string, unknown>>) {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const tx = {
    seatDeviceAuthorization: {
      findMany: vi.fn(async () => rows),
      findUnique: vi.fn(async () => rows[0] ?? null),
      findUniqueOrThrow: vi.fn(async () => rows[0]),
    },
    auditLog: { create: vi.fn(async (input: unknown) => input) },
    $executeRaw: (strings: TemplateStringsArray, ...values: unknown[]) => {
      for (const value of values) {
        if (value !== null && typeof value === "object" && !(value instanceof Date)) {
          throw Object.assign(new Error("Truncated incorrect INTEGER value: JSON fragment"), {
            code: "P2010",
          });
        }
      }
      calls.push({ sql: strings.join("?"), values });
      return Promise.resolve(1);
    },
  };
  return { tx: tx as never, calls };
}

describe("seat device revocation raw SQL", () => {
  const now = new Date("2026-11-25T00:00:00.000Z");
  const actor = { userId: "user-1", name: "tester" };

  it("revokes membership devices with parameterized states, no Sql fragment", async () => {
    const row = {
      id: "device-1",
      workspaceId: "workspace-1",
      userId: "user-1",
      clientType: "desktop",
      deviceLabel: "laptop",
      audiencePin: "pin-1",
    };
    const { tx, calls } = makeTx([row]);

    const revoked = await revokeSeatDevicesInTx(tx, {
      workspaceId: "workspace-1",
      membershipId: "membership-1",
      reason: "membership_inactive",
      actor,
      now,
    });

    expect(revoked).toBe(1);
    expect(calls).toHaveLength(1);
    expect(calls[0].sql).toContain("`status` IN ('approved', 'active')");
  });

  it("keeps the single-row CAS condition in bound parameters", async () => {
    const row = {
      id: "device-1",
      status: "approved",
      version: 7,
      workspaceId: "workspace-1",
      userId: "user-1",
      membershipId: "membership-1",
      clientType: "desktop",
      deviceLabel: "laptop",
      audiencePin: "pin-1",
    };
    const { tx, calls } = makeTx([]);

    const notice = await revokeDeviceRowInTx(tx, row as never, "admin", now, {}, actor);

    expect(notice?.deviceId).toBe("device-1");
    expect(calls).toHaveLength(1);
    expect(calls[0].sql).toContain("`status` = ?");
    expect(calls[0].sql).toContain("`version` = ?");
    expect(calls[0].values).toContain("approved");
    expect(calls[0].values).toContain(7);
  });
});
