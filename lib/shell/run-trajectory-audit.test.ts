import { describe, expect, it } from "vitest";

import {
  buildCoreDefaultRunTrajectoryAudit,
  validateAgentRunAuditEntries,
  type AgentRunAuditEntry,
} from "./run-trajectory-audit";

function entry(overrides: Partial<AgentRunAuditEntry> = {}): AgentRunAuditEntry {
  return {
    runId: "run-1",
    actor: "operator-role",
    mode: "shadow",
    intentSummary: "催收过程信号复核",
    asOf: "2026-07-13T00:00:00.000Z",
    verdict: "pass",
    trajectoryFailureClasses: [],
    boundaryDecisionCount: 2,
    blockedActionCount: 0,
    quarantined: false,
    href: "/diagnostics",
    basisRef: "provider:run-1",
    ...overrides,
  };
}

const has = (list: AgentRunAuditEntry[], issue: string) =>
  validateAgentRunAuditEntries(list).some((i) => i.issue === issue);

describe("validateAgentRunAuditEntries", () => {
  it("passes a well-formed, de-identified audit entry", () => {
    expect(validateAgentRunAuditEntries([entry()])).toEqual([]);
  });

  it("passes each verdict in the vocabulary", () => {
    for (const verdict of ["pass", "advisory", "blocked", "escalate", "quarantined", "pending"] as const) {
      expect(validateAgentRunAuditEntries([entry({ verdict })])).toEqual([]);
    }
  });

  it("rejects a callback field (read-only, no control semantics)", () => {
    expect(has([{ ...entry(), onApprove: () => {} } as never], "callback_field:onApprove")).toBe(true);
  });

  it("rejects unknown verdict and non-ISO asOf", () => {
    expect(has([entry({ verdict: "stop" as never })], "unknown_verdict")).toBe(true);
    expect(has([entry({ asOf: "yesterday" })], "asOf_not_iso8601")).toBe(true);
  });

  it("fails closed on suspected PII / SECRET in actor or intentSummary", () => {
    expect(has([entry({ intentSummary: "联系 13800138000" })], "intent_summary_looks_like_pii")).toBe(true);
    expect(has([entry({ actor: "user zhang.san@example.com" })], "actor_looks_like_pii")).toBe(true);
    const skKey = `sk-${"ABCDEF0123456789abcdef"}`;
    expect(has([entry({ intentSummary: `deploy ${skKey}` })], "intent_summary_looks_like_secret")).toBe(true);
  });

  it("rejects invalid counts, non-boolean quarantined, off-site href", () => {
    expect(has([entry({ boundaryDecisionCount: -1 })], "invalid_boundary_decision_count")).toBe(true);
    expect(has([entry({ blockedActionCount: 1.5 })], "invalid_blocked_action_count")).toBe(true);
    expect(has([entry({ quarantined: "yes" as never })], "quarantined_not_boolean")).toBe(true);
    expect(has([entry({ href: "https://evil.example" })], "href_not_in_site")).toBe(true);
  });

  it("rejects empty required strings, dup runId, empty failure class, non-array failure classes", () => {
    expect(has([entry({ runId: "" })], "empty_run_id")).toBe(true);
    expect(has([entry({ actor: " " })], "empty_actor")).toBe(true);
    expect(has([entry({ mode: "" })], "empty_mode")).toBe(true);
    expect(has([entry({ intentSummary: "" })], "empty_intent_summary")).toBe(true);
    expect(has([entry({ basisRef: "" })], "empty_basis_ref")).toBe(true);
    expect(has([entry({ runId: "d" }), entry({ runId: "d" })], "duplicate_run_id")).toBe(true);
    expect(has([entry({ trajectoryFailureClasses: ["ok", " "] })], "empty_failure_class")).toBe(true);
    expect(has([entry({ trajectoryFailureClasses: "x" as never })], "failure_classes_not_array")).toBe(true);
  });

  it("allows a null href (entry with no detail page)", () => {
    expect(validateAgentRunAuditEntries([entry({ href: null })])).toEqual([]);
  });
});

describe("buildCoreDefaultRunTrajectoryAudit", () => {
  it("is an honest empty set (Core projects no agent runs; provided by overlays)", () => {
    expect(buildCoreDefaultRunTrajectoryAudit()).toEqual([]);
  });
});
