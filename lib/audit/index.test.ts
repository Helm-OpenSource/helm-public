import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getAuditWriteFailureSummary,
  recordAuditWriteFailure,
  redactAuditWriteFailureMessage,
  resetAuditWriteFailureSummaryForTesting,
} from "@/lib/audit";
import { ActorType } from "@prisma/client";

vi.mock("@/lib/db", () => ({
  db: {
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/audit/trace-context", () => ({
  getCurrentAuditTraceContext: vi.fn(() => null),
}));

describe("audit write failure observability", () => {
  afterEach(() => {
    resetAuditWriteFailureSummaryForTesting();
  });

  it("redacts secrets before exposing audit write failure messages", () => {
    const message =
      "Prisma failed for mysql://root:secret@db.example:3306/helm with access_token=tokensecret123456 and Authorization: Bearer bearersecret123456";

    const redacted = redactAuditWriteFailureMessage(message);

    expect(redacted).not.toContain("root:secret");
    expect(redacted).not.toContain("tokensecret123456");
    expect(redacted).not.toContain("bearersecret123456");
    expect(redacted).toContain("mysql://[redacted]@");
    expect(redacted).toContain("[redacted]");
  });

  it("stores redacted records in the health-facing failure summary", () => {
    const stderrWrite = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    try {
      recordAuditWriteFailure({
        attempted: {
          workspaceId: "workspace-1",
          userId: "user-1",
          actor: "user@example.com",
          actorType: ActorType.USER,
          actionType: "AUTH_SESSION_CREATED",
          targetType: "AuthSession",
          targetId: "session-1",
          summary: "Created auth session",
        },
        error: new Error("write failed with password=secret-value"),
      });
    } finally {
      stderrWrite.mockRestore();
    }

    const summary = getAuditWriteFailureSummary();

    expect(summary.totalCount).toBe(1);
    expect(summary.recent[0]).toMatchObject({
      workspaceId: "workspace-1",
      userId: "user-1",
      actionType: "AUTH_SESSION_CREATED",
      targetType: "AuthSession",
      targetId: "session-1",
      errorName: "Error",
    });
    expect(summary.recent[0]?.errorMessage).not.toContain("secret-value");
    expect(summary.recent[0]?.errorMessage).toContain("[redacted]");
  });
});
