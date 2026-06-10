import { MembershipStatus, WorkspaceRole } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  registerExtensionApiRoutes,
  resolveExtensionApiRoute,
  __resetExtensionApiRoutesForTest,
} from "@/lib/extensions/api-route-registry";
import {
  buildSyntheticCaseReadApiRoute,
  buildSyntheticExecuteWritebackApiRoute,
  buildSyntheticPrepareWritebackApiRoute,
  resolveSyntheticReadSubjectFromRequest,
} from "@/lib/extensions/permission-api-proof";
import { buildPermissionPolicyFromManifest } from "@/lib/extensions/permission-manifest";
import manifest from "@/extensions/case-management-sample/permission.manifest.json";

const policy = buildPermissionPolicyFromManifest(manifest);
const subject = {
  actorType: "user" as const,
  workspaceId: "workspace-1",
  userId: "user-1",
  membershipId: "membership-1",
  membershipStatus: MembershipStatus.ACTIVE,
  workspaceRole: WorkspaceRole.MEMBER,
  policyVersion: "permission-policy/v1",
  auditSource: "session" as const,
};

describe("synthetic extension API permission proof", () => {
  it("requires every registered extension API route to declare an authorization gate", () => {
    expect(() =>
      registerExtensionApiRoutes("sample", [
        {
          method: "GET",
          pattern: "sample/cases",
          handler: () => Response.json({ ok: true }),
        },
      ]),
    ).toThrow(/authorization/i);
  });

  it("filters rows and redacts sensitive fields in the read API serialization layer", async () => {
    __resetExtensionApiRoutesForTest();
    try {
      registerExtensionApiRoutes("sample", [
        buildSyntheticCaseReadApiRoute({
          pattern: "sample/cases",
          policy,
          resolveSubject: async () => subject,
          allowedQueues: ["north"],
        }),
      ]);

      const route = resolveExtensionApiRoute("GET", ["sample", "cases"]);
      const response = await route!.handler(
        new Request("http://localhost/api/extensions/sample/cases", {
          headers: { "x-helm-trace-id": "trace-read-api" },
        }),
        { params: route!.params },
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.decision).toMatchObject({
        effect: "allow",
        traceId: "trace-read-api",
      });
      expect(body.rows).toHaveLength(1);
      expect(body.rows[0]).toMatchObject({
        caseId: "CASE-SAMPLE-001",
        queue: "north",
        contact: { redaction: "alias_only" },
        balance: { redaction: "raw_private_rejected" },
      });
      expect(JSON.stringify(body.rows)).not.toContain("raw-contact-token");
      expect(JSON.stringify(body.rows)).not.toContain("1234500");
    } finally {
      __resetExtensionApiRoutesForTest();
    }
  });

  it("emits a full synthetic read-path audit receipt from session to redacted rows", async () => {
    __resetExtensionApiRoutesForTest();
    try {
      registerExtensionApiRoutes("sample", [
        buildSyntheticCaseReadApiRoute({
          pattern: "sample/cases",
          policy,
          resolveSubject: resolveSyntheticReadSubjectFromRequest,
          allowedQueues: ["north"],
        }),
      ]);

      const route = resolveExtensionApiRoute("GET", ["sample", "cases"]);
      const response = await route!.handler(
        new Request("http://localhost/api/extensions/sample/cases", {
          headers: {
            "x-helm-trace-id": "trace-runtime-read",
            "x-helm-synthetic-session-id": "session-runtime-read",
            "x-helm-workspace-id": "workspace-1",
          },
        }),
        { params: route!.params },
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.auditReceipt).toMatchObject({
        receiptKind: "helm.synthetic-permission-read.receipt/v1",
        traceId: "trace-runtime-read",
        policyVersion: "permission-policy/v1",
        dataMode: "public_safe_synthetic",
        session: {
          source: "session",
          sessionId: "session-runtime-read",
          actorType: "user",
        },
        workspace: {
          workspaceId: "workspace-1",
        },
        permissionDecision: {
          effect: "allow",
          actionName: "case.read",
        },
        rowFilter: {
          workspaceId: "workspace-1",
          allowedQueues: ["north"],
          returnedRowIds: ["CASE-SAMPLE-001"],
          filteredOutRowCount: 2,
        },
      });
      expect(body.auditReceipt.steps.map((step: { name: string }) => step.name)).toEqual([
        "session",
        "workspace",
        "permission_decision",
        "row_filter",
        "field_redaction",
        "audit_receipt",
      ]);
      expect(body.auditReceipt.fieldRedactions).toEqual([
        { field: "contact", redaction: "alias_only" },
        { field: "balance", redaction: "raw_private_rejected" },
        { field: "legalNotes", redaction: "raw_private_rejected" },
      ]);
      expect(JSON.stringify(body)).not.toContain("raw-contact-token");
      expect(JSON.stringify(body)).not.toContain("synthetic legal-sensitive note");
    } finally {
      __resetExtensionApiRoutesForTest();
    }
  });

  it("returns a typed permission denial before the read API handler can expose rows", async () => {
    const route = buildSyntheticCaseReadApiRoute({
      pattern: "sample/cases",
      policy,
      resolveSubject: async () => ({
        ...subject,
        workspaceId: "workspace-2",
      }),
      allowedQueues: ["north"],
    });

    const response = await route.handler(
      new Request("http://localhost/api/extensions/sample/cases"),
      { params: {} },
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("cross_workspace");
    expect(body.rows).toBeUndefined();
  });

  it("prepares writeback review packets without executing side effects", async () => {
    const execute = vi.fn();
    const route = buildSyntheticPrepareWritebackApiRoute({
      pattern: "sample/cases/prepare-writeback",
      policy,
      resolveSubject: async () => subject,
      execute,
    });

    const response = await route.handler(
      new Request("http://localhost/api/extensions/sample/cases/prepare-writeback", {
        method: "POST",
        headers: { "x-helm-trace-id": "trace-prepare-writeback" },
      }),
      { params: {} },
    );
    const body = await response.json();

    expect(response.status).toBe(202);
    expect(execute).not.toHaveBeenCalled();
    expect(body.decision).toMatchObject({
      effect: "allow",
      action: { effectMode: "review_required" },
      traceId: "trace-prepare-writeback",
    });
    expect(body.reviewPacket).toMatchObject({
      status: "review_required",
      executed: false,
    });
  });

  it("blocks writeback execution even when a route exists", async () => {
    const execute = vi.fn();
    const route = buildSyntheticExecuteWritebackApiRoute({
      pattern: "sample/cases/execute-writeback",
      policy,
      resolveSubject: async () => subject,
      execute,
    });

    const response = await route.handler(
      new Request("http://localhost/api/extensions/sample/cases/execute-writeback", {
        method: "POST",
      }),
      { params: {} },
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(execute).not.toHaveBeenCalled();
    expect(body.error.code).toBe("blocked_side_effect");
  });
});
