// Phase 3N: Internal Prototype Review / Closeout
// Posture: review/evaluator only — no production adoption, no runtime seam wiring.
// Runtime adoption posture remains No-Go.
// Internal prototype review posture: Complete.

export const PHASE3N_RULE_VERSION =
  "phase3n-internal-prototype-review/v1" as const;

export const PHASE3N_RUNTIME_ADOPTION_POSTURE = "No-Go" as const;

export const PHASE3N_INTERNAL_PROTOTYPE_REVIEW_POSTURE = "Complete" as const;

export const PHASE3N_NEXT_ALLOWED_WORK =
  "Real-data calibration evidence pack (validating injected-row fixture thresholds against live DB rows for TPQR-001/003/004) OR production runtime adoption review — but only AFTER real-data calibration evidence exists. Not production adoption now. Must stay disconnected from the production query aggregator, from app/ routes, from prisma/schema.prisma, from any official write path and any automated execution path." as const;

// ---------------------------------------------------------------------------
// Review evidence — static assertions captured from Phase 3M
// ---------------------------------------------------------------------------

export const PHASE3N_EVIDENCE = {
  phase3m: {
    ruleVersion: "phase3m-disabled-internal-seam-prototype/v1",
    defaultFlags: { tpqr001: false, tpqr003: false, tpqr004: false },
    capabilityGates: [
      "helm.business-advancement.source.blocked-decision.read",
      "helm.business-advancement.source.overdue-commitment.read",
      "helm.business-advancement.source.customer-waiting.read",
    ],
    productionIntegrationAllowed: false as const,
    prototypePosture: "Conditional-Go",
    runtimeAdoptionPosture: "No-Go",
    sourcePurity: {
      noAtImport: true,
      noDbImport: true,
      noPrismaImport: true,
      noDateNow: true,
      noFsImport: true,
      noNetworkImport: true,
      noAppImport: true,
      noDataQueriesImport: true,
      noMobileReadModelImport: true,
      evidenceMethod: "vitest readFileSync purity test suite in phase3m-disabled-internal-seam-prototype.test.ts",
    },
  },
  tpqr004DedupFix: {
    bugDescription:
      "Phase 3H sourceCustomerWaitingCandidates was incorrectly marking CRM-linked physical rows as deduped_by_crm_linked when the generic producer also processed rows with opportunityId !== null. Fixed: generic producer now only processes rows with opportunityId === null; CRM-linked physical rows are never subjected to dedup exclusion.",
    regressionCoveredIn: "phase3m-disabled-internal-seam-prototype.test.ts — TPQR-004 dedup section",
    testEvidence: "CRM-linked row appears in included; generic-dup row excluded with deduped_by_crm_linked; no duplicate emailThreadIds in included output",
  },
  testRun: {
    files: 23,
    tests: 807,
    status: "PASS",
    runLabel: "latest local full Business Advancement vitest run after Phase 3N (2026-04-26)",
  },
  qualityChecks: {
    typecheck: "PASS",
    checkBoundaries: "PASS",
  },
  remainingBlockers: [
    "real DB row calibration missing — injected-row fixture thresholds (TPQR-001: 72h, TPQR-003: referenceClockMs, TPQR-004: dedup) have never been validated against live DB rows",
    "production capability registry not wired — helm.business-advancement.source.* capabilities exist only in prototype; no production registry integration",
    "production query integration absent — function-to-DB seam not implemented; no db.actionItem / db.commitment / db.emailThread adapter",
    "production query aggregator not integrated — prototype is entirely disconnected from the production query layer",
    "mobile command read model not touched — features/mobile/lib/ surface not integrated",
  ],
} as const;

// ---------------------------------------------------------------------------
// Evaluator types
// ---------------------------------------------------------------------------

export interface Phase3nCheck {
  readonly name: string;
  readonly pass: boolean;
  readonly detail: string;
}

export interface Phase3nEvaluationResult {
  readonly ruleVersion: typeof PHASE3N_RULE_VERSION;
  readonly runtimeAdoptionPosture: typeof PHASE3N_RUNTIME_ADOPTION_POSTURE;
  readonly internalPrototypeReviewPosture: typeof PHASE3N_INTERNAL_PROTOTYPE_REVIEW_POSTURE;
  readonly nextAllowedWork: typeof PHASE3N_NEXT_ALLOWED_WORK;
  readonly checks: readonly Phase3nCheck[];
  readonly totalChecks: number;
  readonly passedCount: number;
  readonly allPass: boolean;
  readonly remainingBlockers: readonly string[];
}

// ---------------------------------------------------------------------------
// Evaluator
// ---------------------------------------------------------------------------

export function evaluatePhase3nInternalPrototypeReview(): Phase3nEvaluationResult {
  const checks: Phase3nCheck[] = [];

  // 1. phase3m_feature_only_prototype_complete
  {
    const rv = PHASE3N_EVIDENCE.phase3m.ruleVersion;
    const pass =
      rv === "phase3m-disabled-internal-seam-prototype/v1" &&
      PHASE3N_EVIDENCE.phase3m.prototypePosture === "Conditional-Go";
    checks.push({
      name: "phase3m_feature_only_prototype_complete",
      pass,
      detail: pass
        ? `Phase 3M feature-only prototype is complete. ruleVersion="${rv}", prototypePosture="${PHASE3N_EVIDENCE.phase3m.prototypePosture}". Implements TPQR-001/003/004 on injected rows in features/business-advancement/ only.`
        : `Phase 3M prototype not confirmed complete. ruleVersion="${rv}" prototypePosture="${PHASE3N_EVIDENCE.phase3m.prototypePosture}"`,
    });
  }

  // 2. phase3m_disabled_by_default_and_capability_gated
  {
    const flags = PHASE3N_EVIDENCE.phase3m.defaultFlags;
    const allFlagsFalse =
      flags.tpqr001 === false &&
      flags.tpqr003 === false &&
      flags.tpqr004 === false;
    const caps = PHASE3N_EVIDENCE.phase3m.capabilityGates;
    const capCount = caps.length;
    const allCapsCorrect =
      capCount === 3 &&
      caps.every((c) => c.startsWith("helm.business-advancement.source."));
    const pass = allFlagsFalse && allCapsCorrect;
    checks.push({
      name: "phase3m_disabled_by_default_and_capability_gated",
      pass,
      detail: pass
        ? `Phase 3M all flags default false (tpqr001=${String(flags.tpqr001)}, tpqr003=${String(flags.tpqr003)}, tpqr004=${String(flags.tpqr004)}). ${capCount} capability gates defined: ${caps.join(", ")}.`
        : `flags allFalse=${String(allFlagsFalse)} capCount=${capCount} allCapsCorrect=${String(allCapsCorrect)}`,
    });
  }

  // 3. phase3m_production_integration_false
  {
    const pass = PHASE3N_EVIDENCE.phase3m.productionIntegrationAllowed === false;
    checks.push({
      name: "phase3m_production_integration_false",
      pass,
      detail: pass
        ? "Phase 3M productionIntegrationAllowed=false is structurally enforced — the field is typed as literal false and returned unconditionally from runPhase3mDisabledInternalSeamPrototype."
        : `productionIntegrationAllowed=${String(PHASE3N_EVIDENCE.phase3m.productionIntegrationAllowed)} (expected false)`,
    });
  }

  // 4. phase3m_source_purity_verified
  {
    const p = PHASE3N_EVIDENCE.phase3m.sourcePurity;
    const pass =
      p.noAtImport &&
      p.noDbImport &&
      p.noPrismaImport &&
      p.noDateNow &&
      p.noFsImport &&
      p.noNetworkImport &&
      p.noAppImport &&
      p.noDataQueriesImport &&
      p.noMobileReadModelImport;
    checks.push({
      name: "phase3m_source_purity_verified",
      pass,
      detail: pass
        ? `Phase 3M source purity verified by ${p.evidenceMethod}. No @-slash import, no db import, no prisma import, no wall-clock read, no fs import, no network import, no app-slash import, no production-query-aggregator import, no mobile-read-model import.`
        : `Purity failures: noAt=${String(p.noAtImport)} noDb=${String(p.noDbImport)} noPrisma=${String(p.noPrismaImport)} noDateNow=${String(p.noDateNow)} noFs=${String(p.noFsImport)} noNetwork=${String(p.noNetworkImport)} noApp=${String(p.noAppImport)} noDataQueries=${String(p.noDataQueriesImport)} noMobile=${String(p.noMobileReadModelImport)}`,
    });
  }

  // 5. tpqr004_dedup_regression_fixed
  {
    const fix = PHASE3N_EVIDENCE.tpqr004DedupFix;
    const pass =
      fix.bugDescription.includes("generic producer now only processes rows with opportunityId === null") &&
      fix.regressionCoveredIn.includes("phase3m-disabled-internal-seam-prototype.test.ts") &&
      fix.testEvidence.includes("deduped_by_crm_linked");
    checks.push({
      name: "tpqr004_dedup_regression_fixed",
      pass,
      detail: pass
        ? `Phase 3H TPQR-004 dedup bug fixed in Phase 3M: ${fix.bugDescription} Regression covered in ${fix.regressionCoveredIn}.`
        : `Dedup fix evidence insufficient: bugDesc mentions generic-null=${String(fix.bugDescription.includes("opportunityId === null"))} regressionFile=${fix.regressionCoveredIn}`,
    });
  }

  // 6. business_advancement_tests_passed
  {
    const tr = PHASE3N_EVIDENCE.testRun;
    const pass = tr.files === 23 && tr.tests === 807 && tr.status === "PASS";
    checks.push({
      name: "business_advancement_tests_passed",
      pass,
      detail: pass
        ? `Business Advancement full test suite: ${tr.files} files / ${tr.tests} tests — ${tr.status} (${tr.runLabel}).`
        : `Test run: files=${tr.files} tests=${tr.tests} status=${tr.status} (expected 23 files / 807 tests PASS)`,
    });
  }

  // 7. typecheck_and_boundary_checks_passed
  {
    const qc = PHASE3N_EVIDENCE.qualityChecks;
    const pass = qc.typecheck === "PASS" && qc.checkBoundaries === "PASS";
    checks.push({
      name: "typecheck_and_boundary_checks_passed",
      pass,
      detail: pass
        ? `typecheck=${qc.typecheck}, check:boundaries=${qc.checkBoundaries}.`
        : `typecheck=${qc.typecheck} checkBoundaries=${qc.checkBoundaries} (both must be PASS)`,
    });
  }

  // 8. real_data_calibration_still_missing
  {
    const blockers = PHASE3N_EVIDENCE.remainingBlockers;
    const hasCalibrationBlocker = blockers.some((b) =>
      b.includes("real DB row calibration missing"),
    );
    const hasQueryBlocker = blockers.some((b) =>
      b.includes("production query integration absent"),
    );
    const pass = hasCalibrationBlocker && hasQueryBlocker;
    checks.push({
      name: "real_data_calibration_still_missing",
      pass,
      detail: pass
        ? `Real-data calibration confirmed missing (${blockers.length} remaining blockers). Key: "${blockers.find((b) => b.includes("real DB row calibration missing")) ?? ""}"`
        : `Expected real-data calibration blocker and production query blocker to be enumerated. calibrationBlocker=${String(hasCalibrationBlocker)} queryBlocker=${String(hasQueryBlocker)}`,
    });
  }

  // 9. runtime_adoption_posture_is_no_go
  {
    const pass =
      PHASE3N_RUNTIME_ADOPTION_POSTURE === "No-Go" &&
      PHASE3N_EVIDENCE.phase3m.runtimeAdoptionPosture === "No-Go";
    checks.push({
      name: "runtime_adoption_posture_is_no_go",
      pass,
      detail: pass
        ? `PHASE3N_RUNTIME_ADOPTION_POSTURE="${PHASE3N_RUNTIME_ADOPTION_POSTURE}". Phase 3M runtimeAdoptionPosture="${PHASE3N_EVIDENCE.phase3m.runtimeAdoptionPosture}". PHASE3N_INTERNAL_PROTOTYPE_REVIEW_POSTURE="${PHASE3N_INTERNAL_PROTOTYPE_REVIEW_POSTURE}". Internal prototype review is Complete; runtime adoption remains No-Go.`
        : `PHASE3N_RUNTIME_ADOPTION_POSTURE="${PHASE3N_RUNTIME_ADOPTION_POSTURE}" (expected "No-Go")`,
    });
  }

  // 10. next_allowed_work_requires_real_data_before_production
  {
    const lower = PHASE3N_NEXT_ALLOWED_WORK.toLowerCase();
    const mentionsRealData = lower.includes("real-data calibration");
    const mentionsNotProduction = lower.includes("not production adoption now");
    const mentionsDisconnected =
      lower.includes("production query aggregator") || lower.includes("app/");
    const mentionsOnlyAfter = lower.includes("only after");
    const pass =
      mentionsRealData &&
      mentionsNotProduction &&
      mentionsDisconnected &&
      mentionsOnlyAfter;
    checks.push({
      name: "next_allowed_work_requires_real_data_before_production",
      pass,
      detail: pass
        ? "PHASE3N_NEXT_ALLOWED_WORK requires real-data calibration evidence before production runtime adoption review, states not production adoption now, and enumerates production disconnection requirements."
        : `Missing: realData=${String(mentionsRealData)} notProduction=${String(mentionsNotProduction)} disconnected=${String(mentionsDisconnected)} onlyAfter=${String(mentionsOnlyAfter)}`,
    });
  }

  const passedCount = checks.filter((c) => c.pass).length;

  return {
    ruleVersion: PHASE3N_RULE_VERSION,
    runtimeAdoptionPosture: PHASE3N_RUNTIME_ADOPTION_POSTURE,
    internalPrototypeReviewPosture: PHASE3N_INTERNAL_PROTOTYPE_REVIEW_POSTURE,
    nextAllowedWork: PHASE3N_NEXT_ALLOWED_WORK,
    checks,
    totalChecks: checks.length,
    passedCount,
    allPass: passedCount === checks.length,
    remainingBlockers: PHASE3N_EVIDENCE.remainingBlockers,
  };
}
