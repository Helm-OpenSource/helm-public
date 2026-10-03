import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const oldMigrationPath = path.join(root, "prisma/migrations/20260917200000_llm_spend_ledger_candidate/migration.sql");
const migrationPath = path.join(root, "prisma/migrations/20261003120000_llm_spend_charge_contract_v2/migration.sql");
const schemaPath = path.join(root, "prisma/schema.prisma");

describe("LLM spend charge contract v2 migration", () => {
  it("keeps the historical candidate migration byte-identical", () => {
    const digest = createHash("sha256").update(readFileSync(oldMigrationPath)).digest("hex");
    expect(digest).toBe("ff905616199e797eba3bed781e8811b666621c9c04551513baadd77de9555f4e");
  });

  it("adds an upgrade migration that marks old rows and counters as legacy unknown", () => {
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toContain("`contractVersion` INTEGER NULL DEFAULT 1");
    expect(sql).toContain("`provenanceState` VARCHAR(32) NULL DEFAULT 'legacy_unknown'");
    expect(sql).toContain("`admissionState` VARCHAR(32) NOT NULL DEFAULT 'legacy_unknown'");
    expect(sql).toContain("MODIFY COLUMN `contractVersion` INTEGER NOT NULL DEFAULT 1");
    expect(sql).toContain("MODIFY COLUMN `provenanceState` VARCHAR(32) NOT NULL DEFAULT 'legacy_unknown'");
    expect(sql).toContain("UPDATE `LLMSpendLedgerEntry`");
    expect(sql).toContain("`provenanceState` = 'legacy_unknown'");
    expect(sql).toContain("UPDATE `LLMSpendPeriodCounter`");
    expect(sql).toContain("`admissionState` = 'legacy_unknown'");
    expect(sql).toContain("`contractVersion` = 1");
    expect(sql).toContain("CREATE TABLE `LLMSpendPeriodCompatibility`");
    expect(sql).toContain("same unicode_ci collation as the existing ledger/counter");
    expect(sql).toContain("CREATE TRIGGER `LLMSpendLedgerEntry_quarantine_legacy_period_after_insert`");
    expect(sql).toContain("ON DUPLICATE KEY UPDATE");
  });

  it("persists maximum-charge provenance and an indexed blocking state", () => {
    const schema = readFileSync(schemaPath, "utf8");
    for (const field of [
      "maximumChargeMicros", "budgetCurrency", "providerCurrency", "budgetConfigVersion",
      "budgetMode", "budgetLimitMicros",
      "operationRef", "quoteRef", "quoteHash", "priceBookRef", "priceBookVersion",
      "priceBookHash", "fxSnapshotRef", "fxSnapshotHash", "policyApprovalRef",
      "provenanceState", "observedActualMicros", "invariantBreachBoundMicros",
      "invariantBreachCalls", "admissionState",
      "LLMSpendPeriodCompatibility",
    ]) expect(schema).toContain(field);
    expect(schema).toContain("@@index([workspaceId, periodKey, admissionState], map: \"LLMSpendPeriodCounter_workspace_period_admission_idx\")");
  });
});
