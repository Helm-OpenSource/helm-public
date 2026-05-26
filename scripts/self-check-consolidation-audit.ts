#!/usr/bin/env tsx

import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

const LEGACY_MINIMUM_RUN_CHECK_COUNT = 200;
const REFACTORED_MINIMUM_RUN_CHECK_COUNT_FOR_DEFAULT_SWITCH = 200;

const REFACTORED_MODERN_GUARD_MARKERS = [
  "no runtime/API/UI/schema/connector",
  "Tenant Resource Integration Governance",
  "Intelligence Growth P0 offline gate",
  "safeWriteAuditLog",
  "Bundle manifest read-only validator passes",
] as const;

type SelfCheckScriptAudit = {
  path: string;
  runCheckCount: number;
};

export type SelfCheckConsolidationAuditInput = {
  packageJson: string;
  legacySource: string;
  refactoredSource: string;
};

export type SelfCheckConsolidationAudit = {
  ok: boolean;
  mechanicalIntegrityOk: boolean;
  defaultCommand: string | undefined;
  defaultUsesRefactored: boolean;
  legacy: SelfCheckScriptAudit & {
    isWide: boolean;
    isWrapper: boolean;
  };
  refactored: SelfCheckScriptAudit & {
    hasModernGuardMarkers: boolean;
    missingModernGuardMarkers: string[];
  };
  coverageGap: {
    legacyMinusRefactoredRunCheckCount: number;
    refactoredIsNarrowerThanLegacy: boolean;
  };
  migrationDecision: "migrate_legacy_guards_before_default_switch";
  blockerRules: string[];
  failedRules: string[];
};

function readRepoFile(root: string, relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function countRunCheckCalls(source: string): number {
  const sourceFile = ts.createSourceFile(
    "self-check.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  let count = 0;

  function visit(node: ts.Node) {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "runCheck"
    ) {
      count += 1;
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return count;
}

function looksLikeLegacyWrapper(source: string): boolean {
  return /helm-self-check-refactored|helmSelfCheckRefactored|child_process|execFile|spawn\(/.test(source);
}

function parsePackageScripts(packageJson: string): Record<string, string> {
  const parsed = JSON.parse(packageJson) as {
    scripts?: Record<string, string>;
  };
  return parsed.scripts ?? {};
}

function buildSelfCheckConsolidationAuditFromInput(
  input: SelfCheckConsolidationAuditInput,
): SelfCheckConsolidationAudit {
  const packageScripts = parsePackageScripts(input.packageJson);
  const legacyPath = "scripts/helm-self-check.ts";
  const refactoredPath = "scripts/helm-self-check-refactored.ts";
  const legacySource = input.legacySource;
  const refactoredSource = input.refactoredSource;

  const defaultCommand = packageScripts["self-check"];
  const defaultUsesRefactored = defaultCommand?.includes(refactoredPath) ?? false;
  const legacyRunCheckCount = countRunCheckCalls(legacySource);
  const refactoredRunCheckCount = countRunCheckCalls(refactoredSource);
  const legacyIsWrapper = looksLikeLegacyWrapper(legacySource);
  const missingModernGuardMarkers = REFACTORED_MODERN_GUARD_MARKERS.filter(
    (marker) => !refactoredSource.includes(marker),
  );
  const coverageGap = legacyRunCheckCount - refactoredRunCheckCount;

  const mechanicalFailedRules = [
    !defaultUsesRefactored ? "default_self_check_must_use_refactored" : undefined,
    legacyRunCheckCount < LEGACY_MINIMUM_RUN_CHECK_COUNT ? "legacy_self_check_must_remain_wide" : undefined,
    legacyIsWrapper ? "legacy_self_check_must_not_be_wrapperized" : undefined,
    missingModernGuardMarkers.length > 0 ? "refactored_self_check_missing_modern_guard_markers" : undefined,
  ].filter((rule): rule is string => Boolean(rule));
  const blockerRules = [
    refactoredRunCheckCount < REFACTORED_MINIMUM_RUN_CHECK_COUNT_FOR_DEFAULT_SWITCH
      ? "refactored_self_check_coverage_below_default_switch_floor"
      : undefined,
    coverageGap > 0 ? "legacy_refactored_coverage_gap_must_be_migrated" : undefined,
  ].filter((rule): rule is string => Boolean(rule));
  const failedRules = [...mechanicalFailedRules, ...blockerRules];

  return {
    ok: failedRules.length === 0,
    mechanicalIntegrityOk: mechanicalFailedRules.length === 0,
    defaultCommand,
    defaultUsesRefactored,
    legacy: {
      path: legacyPath,
      runCheckCount: legacyRunCheckCount,
      isWide: legacyRunCheckCount >= LEGACY_MINIMUM_RUN_CHECK_COUNT,
      isWrapper: legacyIsWrapper,
    },
    refactored: {
      path: refactoredPath,
      runCheckCount: refactoredRunCheckCount,
      hasModernGuardMarkers: missingModernGuardMarkers.length === 0,
      missingModernGuardMarkers,
    },
    coverageGap: {
      legacyMinusRefactoredRunCheckCount: coverageGap,
      refactoredIsNarrowerThanLegacy: refactoredRunCheckCount < legacyRunCheckCount,
    },
    migrationDecision: "migrate_legacy_guards_before_default_switch",
    blockerRules,
    failedRules,
  };
}

export function buildSelfCheckConsolidationAudit(root = process.cwd()): SelfCheckConsolidationAudit {
  return buildSelfCheckConsolidationAuditFromInput({
    packageJson: readRepoFile(root, "package.json"),
    legacySource: readRepoFile(root, "scripts/helm-self-check.ts"),
    refactoredSource: readRepoFile(root, "scripts/helm-self-check-refactored.ts"),
  });
}

export const testOnly = {
  buildSelfCheckConsolidationAuditFromInput,
};

export function formatSelfCheckConsolidationAudit(audit: SelfCheckConsolidationAudit): string {
  return [
    "Helm self-check consolidation audit",
    `status: ${audit.ok ? "PASS" : "FAIL"}`,
    `mechanical integrity: ${audit.mechanicalIntegrityOk ? "PASS" : "FAIL"}`,
    `default command: ${audit.defaultCommand ?? "(missing)"}`,
    `default uses refactored: ${audit.defaultUsesRefactored}`,
    `legacy runCheck count: ${audit.legacy.runCheckCount}`,
    `legacy is wide: ${audit.legacy.isWide}`,
    `legacy is wrapper: ${audit.legacy.isWrapper}`,
    `refactored runCheck count: ${audit.refactored.runCheckCount}`,
    `refactored has modern guard markers: ${audit.refactored.hasModernGuardMarkers}`,
    `missing modern guard markers: ${audit.refactored.missingModernGuardMarkers.join(", ") || "(none)"}`,
    `coverage gap legacy-refactored: ${audit.coverageGap.legacyMinusRefactoredRunCheckCount}`,
    `migration decision: ${audit.migrationDecision}`,
    `blocker rules: ${audit.blockerRules.join(", ") || "(none)"}`,
    `failed rules: ${audit.failedRules.join(", ") || "(none)"}`,
  ].join("\n");
}

if (require.main === module) {
  const audit = buildSelfCheckConsolidationAudit();
  console.log(formatSelfCheckConsolidationAudit(audit));
  process.exitCode = audit.ok ? 0 : 1;
}
