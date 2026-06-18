import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GET as getApiHealth } from "@/app/api/health/route";
import {
  buildPublicHealthReadout,
  collectPublicHealthVisibleText,
} from "@/lib/production-health/public-health";

describe("public production health readout", () => {
  it("serves a public-safe API health check for runtime attestation", async () => {
    const response = await getApiHealth();
    const payloadText = await response.text();
    const payload = JSON.parse(payloadText) as {
      success: boolean;
      data: {
        status: string;
        service: string;
        scope: string;
        checks: { http: string };
        boundaries: Record<string, boolean>;
      };
    };

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(payload).toMatchObject({
      success: true,
      data: {
        status: "ok",
        service: "helm",
        scope: "public-runtime-reachability",
        checks: { http: "ok" },
        boundaries: {
          authenticatedDetailsIncluded: false,
          businessDataIncluded: false,
          piiIncluded: false,
          rawLogsIncluded: false,
        },
      },
    });
    expect(payloadText).not.toMatch(
      /DATABASE_URL|OPENAI_API_KEY|LLM_BASE_URL|\$queryRaw|RDS|MySQL|SQL|workspace_[a-z0-9]+|tenant_[a-z0-9]+|caseId|debtor|phone|email|idCard|customerName/i,
    );
  });

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
