import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildPublicHealthReadout,
  collectPublicHealthVisibleText,
} from "@/lib/production-health/public-health";

describe("public production health readout", () => {
  it("renders a public-safe healthy posture without private runtime detail", () => {
    const readout = buildPublicHealthReadout({
      english: true,
      auditWriteFailureSummary: { totalCount: 0 },
    });
    const visibleText = collectPublicHealthVisibleText(readout);

    expect(readout.overallState).toBe("healthy");
    expect(visibleText).toContain("No hidden adoption claim");
    expect(visibleText).toContain("Workspace-first boundary");
    expect(visibleText).not.toMatch(
      /DATABASE_URL|OPENAI_API_KEY|LLM_BASE_URL|\$queryRaw|RDS|MySQL|SQL|actionType|workspace_[a-z0-9]+|tenant_[a-z0-9]+/i,
    );
  });

  it("degrades on audit drops without exposing counts, action types, workspace IDs or raw errors", () => {
    const readout = buildPublicHealthReadout({
      english: true,
      auditWriteFailureSummary: { totalCount: 17 },
    });
    const visibleText = collectPublicHealthVisibleText(readout);

    expect(readout.overallState).toBe("degraded");
    expect(visibleText).toContain("internal write drop");
    expect(visibleText).not.toContain("17");
    expect(visibleText).not.toMatch(
      /CASE_ASSIGNMENT|ACTION_CREATED|workspace-123|tenant-123|PrismaClient|ECONNREFUSED|ER_LOCK_WAIT_TIMEOUT/i,
    );
  });

  it("keeps the page source free of public health leakage patterns", () => {
    const healthPage = readFileSync(
      join(process.cwd(), "app/health/page.tsx"),
      "utf8",
    );

    expect(healthPage).toContain("getAuditWriteFailureSummary");
    expect(healthPage).not.toMatch(
      /process\.env|db\.|\$queryRaw|DATABASE_URL|OPENAI_API_KEY|LLM_BASE_URL|RDS|MySQL|auditFailure\.recent|actionType|targetId|workspaceId/,
    );
  });
});
