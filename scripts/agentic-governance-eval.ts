#!/usr/bin/env tsx
/**
 * Helm Agentic Governance — Offline Eval
 *
 * Verifies the accepted P0 requirements for external agent outcomes, action
 * traces, admin-visible connector permission summaries, and P1 messaging /
 * back-office guards. It is fully offline: no DB, network, provider
 * credential, runtime adapter, API, or UI.
 */

import { runBackOfficeGovernanceEval } from "../features/agentic-governance/back-office-governance-signal";
import { runConnectorPermissionSummaryEval } from "../features/agentic-governance/connector-permission-summary";
import {
  buildMessagingCopyCandidatesFromDocuments,
  MESSAGING_REWRITE_GUARD_FIXTURES,
  runMessagingRewriteGuardEval,
  type MessagingCopyDocument,
} from "../features/agentic-governance/messaging-rewrite-guard";
import { runMarketSignalProviderClassEval } from "../features/agentic-governance/market-signal-provider-class";
import { runExternalAgentIntakeEval } from "../features/external-agent-intake/intake-decision";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export const AGENTIC_GOVERNANCE_MESSAGING_DOCUMENT_SCAN_TARGETS: readonly Omit<
  MessagingCopyDocument,
  "content"
>[] = [
  {
    id: "readme",
    path: "README.md",
    surface: "customer_facing",
  },
  {
    id: "docs-index",
    path: "docs/README.md",
    surface: "boundary_doc",
  },
  {
    id: "governance",
    path: "GOVERNANCE.md",
    surface: "boundary_doc",
  },
  {
    id: "security",
    path: "SECURITY.md",
    surface: "boundary_doc",
  },
  {
    id: "public-trial-runbook",
    path: "docs/pilot/PUBLIC_TRIAL_RUNBOOK.md",
    surface: "customer_facing",
  },
  {
    id: "public-trial-data-policy",
    path: "docs/legal/HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md",
    surface: "customer_facing",
  },
  {
    id: "release-readiness-receipt-checklist",
    path: "docs/operations/RELEASE_READINESS_RECEIPT_CHECKLIST.md",
    surface: "boundary_doc",
  },
  {
    id: "agentic-governance-requirements",
    path: "docs/product/HELM_AGENTIC_GOVERNANCE_REQUIREMENTS.md",
    surface: "requirements",
  },
  {
    id: "external-agent-intake-prd",
    path: "docs/product/HELM_EXTERNAL_AGENT_INTAKE_PRD.md",
    surface: "requirements",
  },
];

export type AgenticGovernanceMessagingDocumentLoadError = {
  readonly targetPath: string;
  readonly absolutePath: string;
  readonly message: string;
};

export type AgenticGovernanceMessagingDocumentLoadResult = {
  readonly documents: readonly MessagingCopyDocument[];
  readonly errors: readonly AgenticGovernanceMessagingDocumentLoadError[];
};

export type AgenticGovernanceEvalOptions = {
  readonly repoRoot?: string;
  readonly messagingDocumentScanTargets?: readonly Omit<MessagingCopyDocument, "content">[];
  readonly fileExists?: (path: string) => boolean;
  readonly readFile?: (path: string) => string;
  readonly runExternalAgentIntakeEval?: typeof runExternalAgentIntakeEval;
  readonly runConnectorPermissionSummaryEval?: typeof runConnectorPermissionSummaryEval;
  readonly runMessagingRewriteGuardEval?: typeof runMessagingRewriteGuardEval;
  readonly runMarketSignalProviderClassEval?: typeof runMarketSignalProviderClassEval;
  readonly runBackOfficeGovernanceEval?: typeof runBackOfficeGovernanceEval;
};

export type AgenticGovernanceEvalResult = {
  readonly intake: ReturnType<typeof runExternalAgentIntakeEval>;
  readonly connectors: ReturnType<typeof runConnectorPermissionSummaryEval>;
  readonly messaging: ReturnType<typeof runMessagingRewriteGuardEval>;
  readonly marketSignals: ReturnType<typeof runMarketSignalProviderClassEval>;
  readonly backOffice: ReturnType<typeof runBackOfficeGovernanceEval>;
  readonly messagingDocuments: readonly MessagingCopyDocument[];
  readonly messagingDocumentLoadErrors: readonly AgenticGovernanceMessagingDocumentLoadError[];
  readonly passed: boolean;
};

export function runAgenticGovernanceEval(
  options: AgenticGovernanceEvalOptions = {},
): AgenticGovernanceEvalResult {
  const intake = (options.runExternalAgentIntakeEval ?? runExternalAgentIntakeEval)();
  const connectors =
    (options.runConnectorPermissionSummaryEval ?? runConnectorPermissionSummaryEval)();
  const messagingDocumentLoad = loadMessagingScanDocuments(options);
  const messagingDocumentCandidates = buildMessagingCopyCandidatesFromDocuments(
    messagingDocumentLoad.documents,
  );
  const messaging = (options.runMessagingRewriteGuardEval ?? runMessagingRewriteGuardEval)([
    ...MESSAGING_REWRITE_GUARD_FIXTURES,
    ...messagingDocumentCandidates,
  ]);
  const marketSignals =
    (options.runMarketSignalProviderClassEval ?? runMarketSignalProviderClassEval)();
  const backOffice = (options.runBackOfficeGovernanceEval ?? runBackOfficeGovernanceEval)();
  const passed =
    intake.overallPassed &&
    connectors.overallPassed &&
    messaging.overallPassed &&
    marketSignals.overallPassed &&
    backOffice.overallPassed &&
    messagingDocumentLoad.errors.length === 0;

  return {
    intake,
    connectors,
    messaging,
    marketSignals,
    backOffice,
    messagingDocuments: messagingDocumentLoad.documents,
    messagingDocumentLoadErrors: messagingDocumentLoad.errors,
    passed,
  };
}

export function loadMessagingScanDocuments(
  options: Pick<
    AgenticGovernanceEvalOptions,
    "fileExists" | "messagingDocumentScanTargets" | "readFile" | "repoRoot"
  > = {},
): AgenticGovernanceMessagingDocumentLoadResult {
  const repoRoot = options.repoRoot ?? process.cwd();
  const fileExists = options.fileExists ?? existsSync;
  const readFile = options.readFile ?? ((path: string) => readFileSync(path, "utf8"));
  const targets =
    options.messagingDocumentScanTargets ??
    AGENTIC_GOVERNANCE_MESSAGING_DOCUMENT_SCAN_TARGETS;
  const documents: MessagingCopyDocument[] = [];
  const errors: AgenticGovernanceMessagingDocumentLoadError[] = [];

  for (const target of targets) {
    const absolutePath = resolve(repoRoot, target.path);
    if (!fileExists(absolutePath)) {
      errors.push({
        targetPath: target.path,
        absolutePath,
        message: `Agentic governance messaging scan target missing: ${target.path}`,
      });
      continue;
    }

    documents.push({
      ...target,
      content: readFile(absolutePath),
    });
  }

  return { documents, errors };
}

export function printAgenticGovernanceEvalReport(
  result: AgenticGovernanceEvalResult,
  output: Pick<typeof console, "error" | "log"> = console,
): void {
  const { backOffice, connectors, intake, marketSignals, messaging, messagingDocuments } =
    result;

  output.log("\nHelm Agentic Governance — Offline Eval");
  output.log("======================================");
  output.log("\nExternal Agent Outcome / Trace Gate:");
  output.log(`  Fixtures:                    ${intake.passedFixtures}/${intake.totalFixtures}`);
  output.log(`  Direct Must Push:            ${intake.directMustPushCreated}`);
  output.log(`  Direct memory writes:        ${intake.directMemoryCandidateCreated}`);
  output.log(`  Ranking influenced:          ${intake.finalRankingInfluencedByExternalAgent}`);
  output.log(`  Accepted w/o boundary:       ${intake.acceptedWithoutBoundaryNote}`);
  output.log(`  Accepted w/ unsupported PII: ${intake.acceptedWithUnsupportedPII}`);
  output.log(`  Accepted w/o gov trace:      ${intake.acceptedWithoutGovernanceTrace}`);
  output.log(`  Trace conflict accepted:     ${intake.traceConflictAccepted}`);
  output.log(`  Connector permission bypass: ${intake.connectorPermissionBypassed}`);
  output.log(`  Refusal promoted:            ${intake.refusedRetriedOrPromoted}`);

  output.log("\nConnector Permission Summary Gate:");
  output.log(`  Summaries:                   ${connectors.totalSummaries}`);
  output.log(`  Issues:                      ${connectors.issueCount}`);
  output.log(`  Auto-send allowed:           ${connectors.directSendAutoAllowed}`);
  output.log(`  CRM auto-write allowed:      ${connectors.crmWriteAutoAllowed}`);
  output.log(`  Payment auto-action allowed: ${connectors.paymentAutoAllowed}`);
  output.log(`  Three-lane coverage:         ${connectors.allSummariesHaveThreeLanes}`);
  output.log(`  Review customer-visible:     ${connectors.allCustomerVisibleActionsRequireReview}`);

  output.log("\nMessaging Rewrite Guard:");
  output.log(`  Fixtures:                    ${messaging.expectedMatches}/${messaging.totalCandidates}`);
  output.log(`  Accepted forbidden wording:  ${messaging.acceptedForbiddenPositioning}`);
  output.log(`  Accepted sensitive w/o note: ${messaging.acceptedCustomerFacingSensitiveWithoutBoundary}`);
  output.log(`  Runtime rewrite attempted:   ${messaging.runtimeRewriteAttempted}`);
  output.log(`  Rewrite required:            ${messaging.rewriteRequired}`);
  output.log(`  Rejected:                    ${messaging.rejected}`);
  output.log(`  Docs scanned:                 ${messagingDocuments.length}`);
  output.log(`  Doc candidates:               ${messaging.documentCandidatesScanned}`);
  output.log(`  Doc rewrite required:         ${messaging.documentRewriteRequired}`);
  output.log(`  Doc rejected:                 ${messaging.documentRejected}`);

  output.log("\nMarket-signal Provider Class Gate:");
  output.log(`  Fixtures:                    ${marketSignals.passedFixtures}/${marketSignals.totalSignals}`);
  output.log(`  Runtime eval allowed:        ${marketSignals.runtimeEvaluationAllowed}`);
  output.log(`  Provider runtime created:    ${marketSignals.providerRuntimeCreated}`);
  output.log(`  Direct Must Push allowed:    ${marketSignals.directMustPushAllowed}`);
  output.log(`  Memory write allowed:        ${marketSignals.memoryWriteAllowed}`);
  output.log(`  Ranking influence allowed:   ${marketSignals.finalRankingInfluenceAllowed}`);
  output.log(`  Workflow builder allowed:    ${marketSignals.workflowBuilderAllowed}`);
  output.log(`  Missing proof accepted:      ${marketSignals.missingTrustProofAccepted}`);

  output.log("\nBack-office Evidence / Gap / Reminder Guard:");
  output.log(`  Fixtures:                    ${backOffice.expectedMatches}/${backOffice.totalSignals}`);
  output.log(`  Accepted w/o owner:          ${backOffice.acceptedWithoutOwner}`);
  output.log(`  Accepted w/o evidence:       ${backOffice.acceptedWithoutEvidence}`);
  output.log(`  Accepted w/o boundary:       ${backOffice.acceptedWithoutBoundaryNote}`);
  output.log(`  Official write allowed:      ${backOffice.officialWriteAllowed}`);
  output.log(`  Auto approval allowed:       ${backOffice.autoApprovalAllowed}`);
  output.log(`  Auto settlement allowed:     ${backOffice.autoSettlementAllowed}`);
  output.log(`  Silent CRM write allowed:    ${backOffice.silentCrmWriteAllowed}`);
  output.log(`  Readout items:               ${backOffice.readoutItemCount}`);
  output.log(`  Readout w/o owner:           ${backOffice.readoutItemsWithoutOwner}`);
  output.log(`  Readout w/o evidence:        ${backOffice.readoutItemsWithoutEvidence}`);
  output.log(`  Readout authority leaks:     ${backOffice.readoutExecutionAuthorityLeak}`);
  output.log(`  Readout decision mismatch:   ${backOffice.readoutAcceptedDecisionMismatch}`);

  if (connectors.issues.length > 0) {
    output.log("\nConnector Issues:");
    for (const issue of connectors.issues) {
      output.log(`  FAIL ${issue.providerId} ${issue.code}: ${issue.detail}`);
    }
  }

  if (result.messagingDocumentLoadErrors.length > 0) {
    output.log("\nMessaging Document Scan Errors:");
    for (const error of result.messagingDocumentLoadErrors) {
      output.log(`  FAIL ${error.message}`);
    }
  }

  if (!result.passed) {
    output.error("\nAgentic governance eval FAILED\n");
    return;
  }

  output.log("\nAgentic governance eval PASSED\n");
}

function main(): number {
  const result = runAgenticGovernanceEval();
  printAgenticGovernanceEvalReport(result);
  return result.passed ? 0 : 1;
}

if (require.main === module) {
  process.exitCode = main();
}
