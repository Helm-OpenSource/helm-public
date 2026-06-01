import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { buildSelfCheckConsolidationAudit } from "../scripts/self-check-consolidation-audit";
import {
  entryAndWorkspaceSupportRoutes,
  mainChainRoutes,
  objectDetailRoutes,
  operatingSystemLayerFiles,
  shellEntryFiles,
  supportingRoutes,
} from "../scripts/self-check/config";

const refactoredSelfCheckSource = readFileSync(
  "scripts/helm-self-check-refactored.ts",
  "utf8",
);

const configSource = readFileSync("scripts/self-check/config.ts", "utf8");

const migratedRouteTopologyGuardNames = [
  "operating_system_layer_files",
  "main_chain_route_presence",
  "supporting_route_presence",
  "object_detail_route_presence",
  "shell_entry_presence",
  "entry_and_workspace_support_route_presence",
] as const;

describe("route topology self-check consolidation", () => {
  it("keeps the six migrated legacy file-existence guards in the refactored default", () => {
    for (const guardName of migratedRouteTopologyGuardNames) {
      expect(refactoredSelfCheckSource).toContain(`runCheck("${guardName}"`);
    }
  });

  it("exports the legacy-equivalent route topology path arrays from config", () => {
    expect(configSource).toContain("operatingSystemLayerFiles");
    expect(configSource).toContain("mainChainRoutes");
    expect(configSource).toContain("supportingRoutes");
    expect(configSource).toContain("objectDetailRoutes");
    expect(configSource).toContain("shellEntryFiles");
    expect(configSource).toContain("entryAndWorkspaceSupportRoutes");

    expect(operatingSystemLayerFiles).toEqual([
      "lib/operating-system/types.ts",
      "lib/operating-system/skill-catalog.ts",
      "lib/operating-system/object-state.ts",
      "lib/operating-system/event-signals.ts",
      "lib/operating-system/recommendation-context.ts",
      "lib/operating-system/approval-boundary.ts",
      "lib/operating-system/audit-reason-chain.ts",
      "lib/operating-system/readiness.ts",
      "lib/operating-system/dashboard-arbitration.ts",
      "lib/operating-system/cognitive-object-contract.ts",
      "lib/operating-system/operating-gap.ts",
      "lib/operating-system/truth-reconciliation.ts",
      "lib/operating-system/index.ts",
      "lib/operating-system/index.test.ts",
      "lib/operating-system/cognitive-object-contract.test.ts",
      "lib/operating-system/operating-gap.test.ts",
      "lib/operating-system/truth-reconciliation.test.ts",
    ]);
    expect(mainChainRoutes).toEqual([
      "app/(workspace)/dashboard/page.tsx",
      "app/(workspace)/opportunities/page.tsx",
      "app/(workspace)/meetings/page.tsx",
      "app/(workspace)/meetings/[id]/page.tsx",
      "app/(workspace)/approvals/page.tsx",
      "app/(workspace)/memory/page.tsx",
    ]);
    expect(supportingRoutes).toEqual([
      "app/(workspace)/imports/page.tsx",
      "app/(workspace)/imports/crm/page.tsx",
      "app/(workspace)/search/page.tsx",
      "app/(workspace)/settings/page.tsx",
      "app/(workspace)/inbox/page.tsx",
      "app/(workspace)/inbox/[id]/page.tsx",
    ]);
    expect(objectDetailRoutes).toEqual([
      "app/(workspace)/contacts/[id]/page.tsx",
      "app/(workspace)/companies/[id]/page.tsx",
    ]);
    expect(shellEntryFiles).toEqual([
      "app/layout.tsx",
      "app/loading.tsx",
      "app/error.tsx",
      "app/(workspace)/layout.tsx",
      "app/(workspace)/loading.tsx",
      "app/(workspace)/not-found.tsx",
    ]);
    expect(entryAndWorkspaceSupportRoutes).toEqual([
      "app/page.tsx",
      "app/setup/page.tsx",
      "app/(auth)/login/page.tsx",
      "app/(workspace)/page.tsx",
      "app/(workspace)/analytics/page.tsx",
      "app/(workspace)/capture/page.tsx",
      "app/(workspace)/reports/page.tsx",
    ]);
  });

  it("increases refactored coverage while keeping the consolidation audit as a blocker", () => {
    const audit = buildSelfCheckConsolidationAudit();

    expect(audit.refactored.runCheckCount).toBeGreaterThanOrEqual(43);
    expect(audit.coverageGap.legacyMinusRefactoredRunCheckCount).toBeLessThan(177);
    expect(audit.ok).toBe(false);
    expect(audit.mechanicalIntegrityOk).toBe(true);
    expect(audit.blockerRules).toContain("refactored_self_check_coverage_below_default_switch_floor");
    expect(audit.blockerRules).toContain("legacy_refactored_coverage_gap_must_be_migrated");
  });
});
