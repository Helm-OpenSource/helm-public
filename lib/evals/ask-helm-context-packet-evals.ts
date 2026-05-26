import askHelmContextPacketFixturePack from "@/evals/ask-helm/context-packet-cases.json";
import {
  auditAskHelmContextPacket,
  buildAskHelmContextPacket,
  type AskHelmContextPacketAuditFailure,
  type AskHelmContextPacketAuditSummary,
  type AskHelmContextPacketBuilderInput,
} from "@/features/search/ask-helm-context-packet";
import { toRate } from "@/lib/evals/shared";

export type AskHelmContextPacketEvalCase = {
  id: string;
  description: string;
  expectedPassed: boolean;
  expectedFailures: AskHelmContextPacketAuditFailure[];
  input: AskHelmContextPacketBuilderInput;
};

export type AskHelmContextPacketFixturePack = {
  version: string;
  status: "offline_evaluation_fixture";
  redactionPosture: "synthetic_redacted";
  boundary: string;
  targets: {
    minimumRedactionCoveragePercent: number;
    minimumContextCoveragePercent: number;
  };
  cases: AskHelmContextPacketEvalCase[];
};

export type AskHelmContextPacketEvalCaseResult = {
  id: string;
  description: string;
  expectedPassed: boolean;
  actualPassed: boolean;
  passed: boolean;
  audit: AskHelmContextPacketAuditSummary;
  missingExpectedFailures: AskHelmContextPacketAuditFailure[];
  unexpectedFailures: AskHelmContextPacketAuditFailure[];
};

export type AskHelmContextPacketEvalFailure = {
  caseId: string;
  reason: string;
};

export type AskHelmContextPacketEvalSummary = {
  passed: boolean;
  version: string;
  totalCases: number;
  passedCases: number;
  expectedPositiveCases: number;
  expectedNegativeCases: number;
  failureCount: number;
  warningCount: number;
  authorityLeakCount: number;
  rawLeakCount: number;
  memoryPolicyViolationCount: number;
  redactionCoveragePercent: number;
  contextCoveragePercent: number;
  caseResults: AskHelmContextPacketEvalCaseResult[];
  failures: AskHelmContextPacketEvalFailure[];
};

export function runAskHelmContextPacketEval(
  fixturePack: AskHelmContextPacketFixturePack = askHelmContextPacketFixturePack as AskHelmContextPacketFixturePack,
): AskHelmContextPacketEvalSummary {
  const caseResults = fixturePack.cases.map((item) => evaluateCase(item));
  const passedCases = caseResults.filter((item) => item.passed).length;
  const failures = caseResults.flatMap((item) => {
    if (item.passed) return [];
    return [
      ...item.audit.failures.map((reason) => ({
        caseId: item.id,
        reason,
      })),
      ...item.missingExpectedFailures.map((reason) => ({
        caseId: item.id,
        reason: `missing_expected_failure:${reason}`,
      })),
      ...item.unexpectedFailures.map((reason) => ({
        caseId: item.id,
        reason: `unexpected_failure:${reason}`,
      })),
      ...(item.actualPassed !== item.expectedPassed
        ? [
            {
              caseId: item.id,
              reason: `pass_expectation_mismatch:expected_${item.expectedPassed}_actual_${item.actualPassed}`,
            },
          ]
        : []),
    ];
  });
  const redactionCoveragePercent = minimumPercent(caseResults.map((item) => item.audit.redactionCoveragePercent));
  const contextCoveragePercent = minimumPercent(caseResults.map((item) => item.audit.contextCoveragePercent));
  const thresholdFailures = [
    ...(redactionCoveragePercent < fixturePack.targets.minimumRedactionCoveragePercent
      ? [
          {
            caseId: "summary",
            reason: `redaction_coverage_below_target:${redactionCoveragePercent}/${fixturePack.targets.minimumRedactionCoveragePercent}`,
          },
        ]
      : []),
    ...(contextCoveragePercent < fixturePack.targets.minimumContextCoveragePercent
      ? [
          {
            caseId: "summary",
            reason: `context_coverage_below_target:${contextCoveragePercent}/${fixturePack.targets.minimumContextCoveragePercent}`,
          },
        ]
      : []),
  ];

  return {
    passed: passedCases === caseResults.length && thresholdFailures.length === 0,
    version: fixturePack.version,
    totalCases: caseResults.length,
    passedCases,
    expectedPositiveCases: caseResults.filter((item) => item.expectedPassed).length,
    expectedNegativeCases: caseResults.filter((item) => !item.expectedPassed).length,
    failureCount: sum(caseResults.map((item) => item.audit.failureCount)),
    warningCount: sum(caseResults.map((item) => item.audit.warningCount)),
    authorityLeakCount: sum(caseResults.map((item) => item.audit.authorityLeakCount)),
    rawLeakCount: sum(caseResults.map((item) => item.audit.rawLeakCount)),
    memoryPolicyViolationCount: sum(caseResults.map((item) => item.audit.memoryPolicyViolationCount)),
    redactionCoveragePercent,
    contextCoveragePercent,
    caseResults,
    failures: [...failures, ...thresholdFailures],
  };
}

function evaluateCase(item: AskHelmContextPacketEvalCase): AskHelmContextPacketEvalCaseResult {
  const packet = buildAskHelmContextPacket(item.input);
  const audit = auditAskHelmContextPacket(packet);
  const missingExpectedFailures = item.expectedFailures.filter((failure) => !audit.failures.includes(failure));
  const unexpectedFailures = item.expectedPassed
    ? audit.failures
    : audit.failures.filter((failure) => !item.expectedFailures.includes(failure));
  const actualPassed = audit.passed;
  const passed =
    actualPassed === item.expectedPassed &&
    missingExpectedFailures.length === 0 &&
    (item.expectedPassed ? unexpectedFailures.length === 0 : true);

  return {
    id: item.id,
    description: item.description,
    expectedPassed: item.expectedPassed,
    actualPassed,
    passed,
    audit,
    missingExpectedFailures,
    unexpectedFailures,
  };
}

function sum(numbers: number[]) {
  return numbers.reduce((total, value) => total + value, 0);
}

function minimumPercent(numbers: number[]) {
  if (!numbers.length) return 0;
  return Math.min(...numbers.map((value) => toRate(value, 100)));
}
