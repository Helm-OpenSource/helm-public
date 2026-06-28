import { afterEach, describe, expect, it, vi } from "vitest";
import { ObjectType } from "@prisma/client";

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    contact: { findFirst: vi.fn() },
    company: { findFirst: vi.fn() },
    opportunity: { findFirst: vi.fn() },
    meeting: { findFirst: vi.fn() },
    approvalTask: { findFirst: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));

import {
  assertWorkspaceObjectOwnership,
  assertWorkspaceOwnership,
  assertWorkspaceRelatedObjectOwnership,
  isWorkspaceOwnershipError,
} from "@/lib/auth/tenant-ownership";

afterEach(() => vi.clearAllMocks());

describe("assertWorkspaceOwnership (Tier 3.9 / tenant isolation)", () => {
  it("resolves when the workspaces match", async () => {
    await expect(assertWorkspaceOwnership("w1", "w1")).resolves.toBeUndefined();
  });

  it("throws a tagged ownership error when the workspaces differ (fail-closed)", async () => {
    await expect(assertWorkspaceOwnership("w1", "w2")).rejects.toMatchObject({
      code: "WORKSPACE_OWNERSHIP_MISMATCH",
    });
  });
});

describe("isWorkspaceOwnershipError", () => {
  it("recognizes the tagged error and rejects anything else", () => {
    const tagged = Object.assign(new Error("x"), { code: "WORKSPACE_OWNERSHIP_MISMATCH" });
    expect(isWorkspaceOwnershipError(tagged)).toBe(true);
    expect(isWorkspaceOwnershipError(new Error("plain"))).toBe(false);
    expect(isWorkspaceOwnershipError({ code: "OTHER" })).toBe(false);
    expect(isWorkspaceOwnershipError(null)).toBe(false);
  });
});

describe("assertWorkspaceObjectOwnership", () => {
  it("scopes the lookup by workspaceId and resolves when the object is owned", async () => {
    dbMock.contact.findFirst.mockResolvedValueOnce({ id: "c1" });
    await expect(
      assertWorkspaceObjectOwnership({ workspaceId: "w1", objectType: ObjectType.CONTACT, objectId: "c1" }),
    ).resolves.toBeUndefined();
    // The tenant-isolation invariant: the query MUST be constrained to the caller's workspace.
    expect(dbMock.contact.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "c1", workspaceId: "w1" } }),
    );
  });

  it("denies cross-tenant access: a foreign-workspace object reads back null and throws", async () => {
    dbMock.contact.findFirst.mockResolvedValueOnce(null); // object belongs to another workspace
    await expect(
      assertWorkspaceObjectOwnership({ workspaceId: "w1", objectType: ObjectType.CONTACT, objectId: "c-foreign" }),
    ).rejects.toMatchObject({ code: "WORKSPACE_OWNERSHIP_MISMATCH" });
  });

  it("routes governance object types (APPROVAL_TASK) through the same workspace-scoped check", async () => {
    dbMock.approvalTask.findFirst.mockResolvedValueOnce(null);
    await expect(
      assertWorkspaceObjectOwnership({ workspaceId: "w1", objectType: ObjectType.APPROVAL_TASK, objectId: "a1" }),
    ).rejects.toMatchObject({ code: "WORKSPACE_OWNERSHIP_MISMATCH" });
    expect(dbMock.approvalTask.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "a1", workspaceId: "w1" } }),
    );
  });
});

describe("assertWorkspaceRelatedObjectOwnership", () => {
  it("only checks the ids that are provided and skips null/undefined", async () => {
    dbMock.contact.findFirst.mockResolvedValueOnce({ id: "c1" });
    dbMock.company.findFirst.mockResolvedValueOnce({ id: "co1" });
    await assertWorkspaceRelatedObjectOwnership({
      workspaceId: "w1",
      contactId: "c1",
      companyId: "co1",
      opportunityId: null,
      meetingId: undefined,
    });
    expect(dbMock.contact.findFirst).toHaveBeenCalledTimes(1);
    expect(dbMock.company.findFirst).toHaveBeenCalledTimes(1);
    expect(dbMock.opportunity.findFirst).not.toHaveBeenCalled();
    expect(dbMock.meeting.findFirst).not.toHaveBeenCalled();
  });

  it("propagates a denial when a related object is not owned", async () => {
    dbMock.contact.findFirst.mockResolvedValueOnce(null);
    await expect(
      assertWorkspaceRelatedObjectOwnership({ workspaceId: "w1", contactId: "c-foreign" }),
    ).rejects.toMatchObject({ code: "WORKSPACE_OWNERSHIP_MISMATCH" });
  });
});
