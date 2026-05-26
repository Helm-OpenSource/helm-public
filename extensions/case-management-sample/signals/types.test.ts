import { describe, expect, it } from "vitest";

import { buildSignalIdentity } from "./types";

describe("case-management-sample signal identity", () => {
  it("pins the public sample tenant key", () => {
    expect(
      buildSignalIdentity({
        workspaceId: "workspace-sample",
        sourceWindowKey: "CASE-SAMPLE-001:2026-05-18",
        signalKey: "case-review:CASE-SAMPLE-001",
        severity: "warning",
      }),
    ).toEqual({
      workspaceId: "workspace-sample",
      tenantKey: "case-management-sample",
      sourceWindowKey: "CASE-SAMPLE-001:2026-05-18",
      signalKey: "case-review:CASE-SAMPLE-001",
      severity: "warning",
    });
  });

  it("rejects UUID-shaped source windows", () => {
    expect(() =>
      buildSignalIdentity({
        workspaceId: "workspace-sample",
        sourceWindowKey: "CASE-SAMPLE-001:550e8400-e29b-41d4-a716-446655440000",
        signalKey: "case-review:CASE-SAMPLE-001",
        severity: "warning",
      }),
    ).toThrow("sourceWindowKey must not contain UUID");
  });

  it("rejects millisecond-precision source windows", () => {
    expect(() =>
      buildSignalIdentity({
        workspaceId: "workspace-sample",
        sourceWindowKey: "CASE-SAMPLE-001:1779321600000",
        signalKey: "case-review:CASE-SAMPLE-001",
        severity: "warning",
      }),
    ).toThrow("sourceWindowKey must not contain ms-precision timestamp");
  });
});
