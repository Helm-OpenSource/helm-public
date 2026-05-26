import { describe, expect, it } from "vitest";

import {
  buildPhase3pEvidencePackFromRows,
  hashOpaqueId,
  resolvePhase3pCollectorOptions,
  resolvePhase3pSnapshotSampleKind,
} from "../../scripts/business-advancement-phase3p-redacted-snapshot-collector";

const referenceClockMs = 1777161600000;

describe("Phase 3P redacted snapshot collector helpers", () => {
  it("hashes opaque ids with namespace prefix", () => {
    expect(hashOpaqueId("actionItem", "raw-id")).toMatch(
      /^actionItem-[a-f0-9]{16}$/,
    );
  });

  it("uses stable hashing", () => {
    expect(hashOpaqueId("workspace", "ws-1")).toBe(
      hashOpaqueId("workspace", "ws-1"),
    );
  });

  it("keeps namespaces isolated", () => {
    expect(hashOpaqueId("workspace", "same")).not.toBe(
      hashOpaqueId("actionItem", "same"),
    );
  });

  it("throws when DATABASE_URL is missing", () => {
    expect(() =>
      resolvePhase3pCollectorOptions(["--workspace-id", "ws-1"], {}),
    ).toThrow(/DATABASE_URL is required/);
  });

  it("throws when workspace id is missing", () => {
    expect(() =>
      resolvePhase3pCollectorOptions(["--reference-clock-ms", "1"], {
        DATABASE_URL: "mysql://example/helm",
      }),
    ).toThrow(/WORKSPACE_ID is required/);
  });

  it("throws when reference clock is missing", () => {
    expect(() =>
      resolvePhase3pCollectorOptions(["--workspace-id", "ws-1"], {
        DATABASE_URL: "mysql://example/helm",
      }),
    ).toThrow(/REFERENCE_CLOCK_MS or REFERENCE_CLOCK_ISO is required/);
  });

  it("parses CLI options", () => {
    const options = resolvePhase3pCollectorOptions(
      [
        "--workspace-id",
        "ws-1",
        "--reference-clock-ms",
        String(referenceClockMs),
        "--take",
        "20",
        "--print-json",
      ],
      { DATABASE_URL: "mysql://example/helm" },
    );
    expect(options.workspaceId).toBe("ws-1");
    expect(options.referenceClockMs).toBe(referenceClockMs);
    expect(options.take).toBe(20);
    expect(options.printJson).toBe(true);
    expect(options.sampleKind).toBe("redacted_live_db_snapshot");
  });

  it("detects local development snapshot kind for local MySQL", () => {
    expect(
      resolvePhase3pSnapshotSampleKind(
        ["mysql://", "root", ":", "root", "@127.0.0.1:3306/helm"].join(""),
      ),
    ).toBe("local_development_snapshot");
  });

  it("detects local development snapshot kind for IPv6 localhost MySQL", () => {
    expect(
      resolvePhase3pSnapshotSampleKind(
        ["mysql://", "root", ":", "root", "@[::1]:3306/helm"].join(""),
      ),
    ).toBe("local_development_snapshot");
  });

  it("detects live DB snapshot kind for non-local MySQL", () => {
    expect(resolvePhase3pSnapshotSampleKind("mysql://example/helm")).toBe(
      "redacted_live_db_snapshot",
    );
  });

  it("parses ISO reference clock", () => {
    const options = resolvePhase3pCollectorOptions(
      [
        "--workspace-id",
        "ws-1",
        "--reference-clock-iso",
        "2026-04-26T00:00:00.000Z",
      ],
      { DATABASE_URL: "mysql://example/helm" },
    );
    expect(options.referenceClockMs).toBe(referenceClockMs);
  });

  it("rejects oversized take", () => {
    expect(() =>
      resolvePhase3pCollectorOptions(
        [
          "--workspace-id",
          "ws-1",
          "--reference-clock-ms",
          String(referenceClockMs),
          "--take",
          "999",
        ],
        { DATABASE_URL: "mysql://example/helm" },
      ),
    ).toThrow(/--take must be an integer/);
  });

  it("builds a redacted Phase 3O evidence pack", () => {
    const pack = buildPhase3pEvidencePackFromRows({
      workspaceId: "ws-raw",
      referenceClockMs,
      includeDedupProbeRows: true,
      rows: sampleRows(),
    });
    expect(pack.sampleKind).toBe("redacted_live_db_snapshot");
    expect(pack.workspaceId).toMatch(/^workspace-[a-f0-9]{16}$/);
    expect(pack.rows.tpqr001).toHaveLength(2);
    expect(pack.rows.tpqr003).toHaveLength(2);
    expect(pack.rows.tpqr004).toHaveLength(3);
  });

  it("can mark a local development evidence pack", () => {
    const pack = buildPhase3pEvidencePackFromRows({
      workspaceId: "ws-raw",
      referenceClockMs,
      includeDedupProbeRows: true,
      sampleKind: "local_development_snapshot",
      rows: sampleRows(),
    });
    expect(pack.sampleKind).toBe("local_development_snapshot");
  });

  it("does not expose raw ids in redacted rows", () => {
    const pack = buildPhase3pEvidencePackFromRows({
      workspaceId: "ws-raw",
      referenceClockMs,
      includeDedupProbeRows: true,
      rows: sampleRows(),
    });
    expect(JSON.stringify(pack)).not.toContain("raw");
    expect(JSON.stringify(pack)).not.toContain("opp-1");
  });

  it("creates a generic dedup probe from CRM-linked waiting thread", () => {
    const pack = buildPhase3pEvidencePackFromRows({
      workspaceId: "ws-raw",
      referenceClockMs,
      includeDedupProbeRows: true,
      rows: sampleRows(),
    });
    const sharedIds = pack.rows.tpqr004.map((row) => row.emailThreadId);
    expect(new Set(sharedIds).size).toBeLessThan(sharedIds.length);
  });

  it("can disable generic dedup probe rows", () => {
    const pack = buildPhase3pEvidencePackFromRows({
      workspaceId: "ws-raw",
      referenceClockMs,
      includeDedupProbeRows: false,
      rows: sampleRows(),
    });
    expect(pack.rows.tpqr004).toHaveLength(2);
  });
});

function sampleRows() {
  return {
    actionItems: [
      {
        id: "ai-raw-1",
        workspaceId: "ws-raw",
        updatedAt: new Date(referenceClockMs - 4 * 86400000),
        approvalTask: null,
      },
      {
        id: "ai-raw-2",
        workspaceId: "ws-raw",
        updatedAt: new Date(referenceClockMs - 1 * 86400000),
        approvalTask: { id: "approval-raw-1" },
      },
    ],
    commitments: [
      {
        id: "commitment-raw-1",
        workspaceId: "ws-raw",
        dueDate: new Date(referenceClockMs - 2 * 86400000),
        status: "OPEN",
        overdueFlag: false,
      },
      {
        id: "commitment-raw-2",
        workspaceId: "ws-raw",
        dueDate: new Date(referenceClockMs + 1 * 86400000),
        status: "OPEN",
        overdueFlag: true,
      },
    ],
    emailThreads: [
      {
        id: "thread-raw-1",
        workspaceId: "ws-raw",
        status: "WAITING_US",
        opportunityId: "opp-1",
      },
      {
        id: "thread-raw-2",
        workspaceId: "ws-raw",
        status: "WAITING_US",
        opportunityId: null,
      },
    ],
  };
}
