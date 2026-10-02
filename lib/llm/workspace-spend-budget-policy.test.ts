import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { workspace: { findUnique } } }));

import { parseWorkspaceSpendBudgetPolicy, type WorkspaceSpendBudgetPolicyRow } from "./workspace-spend-budget-policy";
import { createWorkspaceSpendBudgetPolicyReader, readWorkspaceSpendBudgetPolicy } from "./workspace-spend-budget-policy-reader";

const VERSION = "synthetic-period-v1";
const BASE: WorkspaceSpendBudgetPolicyRow = {
  llmBudgetMode: "limited",
  llmMonthlyBudgetMicros: 0n,
  llmBudgetEnforcementMode: "shadow",
  llmBudgetPeriodPolicyVersion: VERSION,
  llmBudgetConfigVersion: 1,
  llmBudgetApprovalRef: "synthetic-approval",
  llmBudgetUpdatedBy: "synthetic-operator",
  llmBudgetUpdatedAt: new Date("2026-10-01T00:00:00.000Z"),
};
const parse = (overrides: Partial<WorkspaceSpendBudgetPolicyRow> = {}, expectedPeriodPolicyVersion = VERSION) =>
  parseWorkspaceSpendBudgetPolicy({ row: { ...BASE, ...overrides }, expectedPeriodPolicyVersion });

describe("read-only Workspace LLM spend budget candidate", () => {
  it("keeps a zero limited budget as an explicit declaration in shadow mode", () => {
    expect(parse()).toMatchObject({ status: "shadow", providerAuthorized: false,
      declaration: { mode: "limited", budgetMicros: 0n, periodPolicyVersion: VERSION, configVersion: 1 } });
  });

  it("preserves explicit unlimited separately from missing policy", () => {
    expect(parse({ llmBudgetMode: "unlimited", llmMonthlyBudgetMicros: null })).toMatchObject({
      status: "shadow", providerAuthorized: false, declaration: { mode: "unlimited", budgetMicros: null },
    });
    expect(parse({ llmBudgetMode: null, llmMonthlyBudgetMicros: null, llmBudgetEnforcementMode: null,
      llmBudgetPeriodPolicyVersion: null, llmBudgetApprovalRef: null, llmBudgetUpdatedBy: null,
      llmBudgetUpdatedAt: null, llmBudgetConfigVersion: 0 })).toMatchObject({
      status: "unconfigured", providerAuthorized: false,
    });
  });

  it("accepts explicit unconfigured with audit metadata but no amount or enforcement", () => {
    expect(parse({ llmBudgetMode: "unconfigured", llmMonthlyBudgetMicros: null,
      llmBudgetEnforcementMode: null })).toMatchObject({
      status: "unconfigured", reason: "budget_not_declared", providerAuthorized: false,
      declaration: null,
    });
    expect(parse({ llmBudgetMode: "unconfigured", llmMonthlyBudgetMicros: null,
      llmBudgetEnforcementMode: "enforce" })).toMatchObject({
      status: "invalid", reason: "unconfigured_metadata_conflict", providerAuthorized: false,
    });
  });

  it("does not interpret null enforcement as a new off mode or an admission", () => {
    expect(parse({ llmBudgetEnforcementMode: null })).toMatchObject({
      status: "unconfigured", reason: "enforcement_not_configured", providerAuthorized: false,
      declaration: { mode: "limited", budgetMicros: 0n },
    });
  });

  it("blocks even a complete enforce declaration until currency and price are verified", () => {
    expect(parse({ llmBudgetEnforcementMode: "enforce" })).toMatchObject({
      status: "enforce_blocked", reason: "currency_and_price_unverified", providerAuthorized: false,
      declaration: { mode: "limited", budgetMicros: 0n, approvalRef: "synthetic-approval",
        approvalVerified: false },
    });
  });

  it.each([
    [{ llmBudgetMode: "off" }, "budget_mode_invalid"],
    [{ llmBudgetMode: "limited", llmMonthlyBudgetMicros: null }, "limited_amount_invalid"],
    [{ llmBudgetMode: "limited", llmMonthlyBudgetMicros: -1n }, "limited_amount_invalid"],
    [{ llmBudgetMode: "limited", llmMonthlyBudgetMicros: 9223372036854775808n }, "limited_amount_invalid"],
    [{ llmBudgetMode: "unlimited", llmMonthlyBudgetMicros: 1n }, "unlimited_amount_conflict"],
    [{ llmBudgetEnforcementMode: "off" }, "enforcement_mode_invalid"],
    [{ llmBudgetConfigVersion: 0 }, "config_version_invalid"],
    [{ llmBudgetConfigVersion: 2147483648 }, "config_version_invalid"],
    [{ llmBudgetApprovalRef: " " }, "approval_ref_missing"],
    [{ llmBudgetUpdatedBy: null }, "updated_by_missing"],
    [{ llmBudgetUpdatedAt: "2026-10-01" }, "updated_at_invalid"],
    [{ llmBudgetPeriodPolicyVersion: "another-version" }, "period_policy_version_mismatch"],
  ] as const)("fails closed for malformed metadata %#", (override, reason) => {
    expect(parse(override)).toMatchObject({ status: "invalid", reason, providerAuthorized: false });
  });

  it("rejects missing caller-supplied expected period version", () => {
    expect(parse({}, "")).toMatchObject({ status: "invalid", reason: "expected_period_policy_version_missing", providerAuthorized: false });
  });
});

describe("Workspace budget policy reader", () => {
  beforeEach(() => findUnique.mockReset());

  it("selects only candidate policy metadata and never writes or dispatches", async () => {
    findUnique.mockResolvedValue(BASE);
    const value = await readWorkspaceSpendBudgetPolicy({ workspaceId: "synthetic-workspace", expectedPeriodPolicyVersion: VERSION });
    expect(value).toMatchObject({ status: "shadow", providerAuthorized: false });
    expect(findUnique).toHaveBeenCalledTimes(1);
    expect(findUnique).toHaveBeenCalledWith({ where: { id: "synthetic-workspace" }, select: {
      llmBudgetMode: true, llmMonthlyBudgetMicros: true, llmBudgetEnforcementMode: true,
      llmBudgetPeriodPolicyVersion: true, llmBudgetConfigVersion: true, llmBudgetApprovalRef: true,
      llmBudgetUpdatedBy: true, llmBudgetUpdatedAt: true,
    } });
  });

  it("fails closed for a missing workspace", async () => {
    findUnique.mockResolvedValue(null);
    await expect(readWorkspaceSpendBudgetPolicy({ workspaceId: "missing", expectedPeriodPolicyVersion: VERSION }))
      .resolves.toMatchObject({ status: "invalid", reason: "workspace_not_found", providerAuthorized: false });
  });

  it("propagates database failure rather than defaulting to unlimited", async () => {
    const reader = createWorkspaceSpendBudgetPolicyReader(async () => {
      throw new Error("synthetic_db_failure");
    });
    await expect(reader({ workspaceId: "synthetic-workspace", expectedPeriodPolicyVersion: VERSION }))
      .rejects.toThrow("synthetic_db_failure");
  });
});
