import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUDIT_COUNT_CAP,
  formatCappedAuditCount,
  toCappedAuditCount,
} from "@/lib/audit/capped-count";
import { countAuditLogCapped } from "@/lib/audit/capped-count-query";

const { count } = vi.hoisted(() => ({ count: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { auditLog: { count } } }));

describe("capped audit counts", () => {
  beforeEach(() => count.mockReset());

  it("keeps counts up to the cap exact", () => {
    expect(toCappedAuditCount(0)).toEqual({ value: 0, capped: false });
    expect(toCappedAuditCount(AUDIT_COUNT_CAP)).toEqual({ value: AUDIT_COUNT_CAP, capped: false });
  });

  it("marks counts above the cap", () => {
    expect(toCappedAuditCount(AUDIT_COUNT_CAP + 1)).toEqual({ value: AUDIT_COUNT_CAP, capped: true });
  });

  it("formats capped counts in both locales", () => {
    expect(formatCappedAuditCount(37, false, true)).toBe("37");
    expect(formatCappedAuditCount(37, undefined, false)).toBe("37");
    expect(formatCappedAuditCount(AUDIT_COUNT_CAP, true, true)).toBe("10,000+");
    expect(formatCappedAuditCount(AUDIT_COUNT_CAP, true, false)).toBe("1 万+");
  });

  it("asks the database for at most cap + 1 rows, newest first", async () => {
    count.mockResolvedValue(AUDIT_COUNT_CAP + 1);
    const since = new Date("2026-01-01T00:00:00Z");

    await expect(countAuditLogCapped({ workspaceId: "workspace-1", createdAt: { gte: since } })).resolves.toEqual({
      value: AUDIT_COUNT_CAP,
      capped: true,
    });
    expect(count).toHaveBeenCalledWith({
      where: { workspaceId: "workspace-1", createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: AUDIT_COUNT_CAP + 1,
    });
  });
});
