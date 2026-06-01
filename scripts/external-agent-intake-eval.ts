#!/usr/bin/env tsx
/**
 * Helm External Agent Intake — Phase 1 Offline Eval
 *
 * Runs only local fixtures and pure functions. No database, no network, no
 * provider credential, no runtime adapter, no write authority.
 *
 * Modes:
 *   - default                          → run the fixture gate (Phase 1 + governance expansion).
 *   - --input-file <path>              → evaluate a manual-import JSON file
 *                                        (fixture-like, see
 *                                        evals/external-agent-intake/manual-import-demo.json).
 *   - --workspace-id <id>              → override the expected workspace id;
 *                                        precedence: CLI flag > file metadata >
 *                                        Phase 1 fixture workspace.
 */

import {
  EXTERNAL_AGENT_INTAKE_REFERENCE_TIME,
  EXTERNAL_AGENT_INTAKE_WORKSPACE_ID,
} from "../features/external-agent-intake/provider-fixtures";
import {
  evaluateExternalAgentArtifact,
  runExternalAgentIntakeEval,
  type ExternalAgentIntakeDecision,
} from "../features/external-agent-intake/intake-decision";
import {
  loadManualImportFile,
  type ManualImportLoadedArtifact,
} from "../features/external-agent-intake/manual-import";

interface CliOptions {
  readonly inputFile?: string;
  readonly workspaceId?: string;
}

function parseCliArgs(argv: readonly string[]): CliOptions | { readonly error: string } {
  const options: { -readonly [K in keyof CliOptions]: CliOptions[K] } = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--input-file") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        return { error: "Missing value for --input-file." };
      }
      options.inputFile = value;
      index += 1;
      continue;
    }
    if (token === "--workspace-id") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        return { error: "Missing value for --workspace-id." };
      }
      options.workspaceId = value;
      index += 1;
      continue;
    }
    if (token === "--help" || token === "-h") {
      printUsage();
      process.exit(0);
    }
    return { error: `Unknown argument: ${token}` };
  }
  return options;
}

function printUsage(): void {
  console.log(
    [
      "Usage:",
      "  npm run eval:external-agent-intake",
      "  npm run eval:external-agent-intake -- --input-file <path>",
      "  npm run eval:external-agent-intake -- --input-file <path> --workspace-id <id>",
      "",
      "Default mode runs the Phase 1 + governance expansion fixture gate.",
      "Manual-import mode evaluates a local JSON file describing ExternalAgentArtifact records.",
      "Both modes run fully offline: no DB, no network, no provider credential.",
    ].join("\n"),
  );
}

function runManualImport(options: CliOptions): number {
  const inputFile = options.inputFile!;
  const load = loadManualImportFile(inputFile);

  if (!load.ok) {
    console.error("\nHelm External Agent Intake — Manual Import Eval");
    console.error("===============================================");
    console.error(`File: ${load.filePath}`);
    console.error("\nLoad / validation errors:");
    for (const error of load.errors) {
      console.error(`  - ${error}`);
    }
    console.error("\nManual import eval FAILED (parse / load).\n");
    return 1;
  }

  const expectedWorkspaceId =
    options.workspaceId ??
    load.metadata.workspaceId ??
    EXTERNAL_AGENT_INTAKE_WORKSPACE_ID;

  const referenceTimeIso =
    load.metadata.referenceTimeIso ?? EXTERNAL_AGENT_INTAKE_REFERENCE_TIME;

  console.log("\nHelm External Agent Intake — Manual Import Eval");
  console.log("===============================================");
  console.log(`File:                  ${load.filePath}`);
  console.log(`Expected workspaceId:  ${expectedWorkspaceId}`);
  console.log(`Reference time:        ${referenceTimeIso}`);
  if (load.metadata.description) {
    console.log(`Description:           ${load.metadata.description}`);
  }
  console.log(`Artifacts loaded:      ${load.artifacts.length}`);

  let mismatchedExpectations = 0;
  let acceptedWithoutBoundaryNote = 0;
  let acceptedWithUnsupportedPII = 0;
  let acceptedWithoutGovernanceTrace = 0;
  let traceConflictAccepted = 0;
  let connectorPermissionBypassed = 0;
  let directMustPushCreated = 0;
  let directMemoryCandidateCreated = 0;

  console.log("\nArtifact Decisions:");
  for (const loaded of load.artifacts) {
    const decision = evaluateExternalAgentArtifact(loaded.artifact, {
      expectedWorkspaceId,
      referenceTimeIso,
    });
    printDecision(loaded, decision);

    if (decision.mayCreateMustPushCandidate !== false) directMustPushCreated += 1;
    if (decision.mayCreateMemoryCandidate !== false) directMemoryCandidateCreated += 1;

    if (
      ["accept_as_evidence_candidate", "accept_as_draft_candidate", "review_required"].includes(
        decision.disposition,
      ) &&
      decision.boundaryNote.trim() === ""
    ) {
      acceptedWithoutBoundaryNote += 1;
    }
    if (
      ["accept_as_evidence_candidate", "accept_as_draft_candidate"].includes(
        decision.disposition,
      ) &&
      decision.reasonCodes.includes("contains_pii")
    ) {
      acceptedWithUnsupportedPII += 1;
    }
    if (
      ["accept_as_evidence_candidate", "accept_as_draft_candidate"].includes(
        decision.disposition,
      ) &&
      decision.reasonCodes.includes("trace_missing")
    ) {
      acceptedWithoutGovernanceTrace += 1;
    }
    if (
      ["accept_as_evidence_candidate", "accept_as_draft_candidate"].includes(
        decision.disposition,
      ) &&
      (decision.reasonCodes.includes("trace_outcome_conflict") ||
        decision.reasonCodes.includes("trace_boundary_conflict"))
    ) {
      traceConflictAccepted += 1;
    }
    if (
      ["accept_as_evidence_candidate", "accept_as_draft_candidate"].includes(
        decision.disposition,
      ) &&
      (decision.reasonCodes.includes("connector_permission_review_required") ||
        decision.reasonCodes.includes("connector_permission_never_allowed"))
    ) {
      connectorPermissionBypassed += 1;
    }

    if (
      loaded.expectedDisposition !== undefined &&
      loaded.expectedDisposition !== decision.disposition
    ) {
      mismatchedExpectations += 1;
    }
  }

  const gatePassed =
    mismatchedExpectations === 0 &&
    acceptedWithoutBoundaryNote === 0 &&
    acceptedWithUnsupportedPII === 0 &&
    acceptedWithoutGovernanceTrace === 0 &&
    traceConflictAccepted === 0 &&
    connectorPermissionBypassed === 0 &&
    directMustPushCreated === 0 &&
    directMemoryCandidateCreated === 0;

  console.log("\nGate Summary:");
  console.log(`  Mismatched expectations:    ${mismatchedExpectations}`);
  console.log(`  Accepted w/o boundary note: ${acceptedWithoutBoundaryNote}`);
  console.log(`  Accepted w/ unsupported PII:${acceptedWithUnsupportedPII}`);
  console.log(`  Accepted w/o gov trace:     ${acceptedWithoutGovernanceTrace}`);
  console.log(`  Trace conflict accepted:    ${traceConflictAccepted}`);
  console.log(`  Connector permission bypass:${connectorPermissionBypassed}`);
  console.log(`  Direct Must Push created:   ${directMustPushCreated}`);
  console.log(`  Direct memory created:      ${directMemoryCandidateCreated}`);

  if (!gatePassed) {
    console.error("\nManual import eval FAILED (gate).\n");
    return 1;
  }

  console.log("\nManual import eval PASSED.\n");
  return 0;
}

function printDecision(
  loaded: ManualImportLoadedArtifact,
  decision: ExternalAgentIntakeDecision,
): void {
  const expected = loaded.expectedDisposition;
  const verdict =
    expected === undefined ? "" : expected === decision.disposition ? "  PASS" : "  FAIL";
  console.log(
    `  ${decision.artifactId.padEnd(10)} ${decision.providerId.padEnd(16)} ${decision.disposition.padEnd(28)} containment=${decision.containment.padEnd(12)} mayAttach=${String(decision.mayAttachToSignal).padEnd(5)} review=${String(decision.mustRequireReview)}${verdict}`,
  );
  console.log(`             reasons=${decision.reasonCodes.join(",")}`);
  console.log(`             boundary=${decision.boundaryNote}`);
  if (loaded.demoNotes) {
    console.log(`             notes=${loaded.demoNotes}`);
  }
}

function runDefaultEval(): number {
  const summary = runExternalAgentIntakeEval();

  console.log("\nHelm External Agent Intake — Phase 1 Offline Eval");
  console.log("==================================================");
  console.log(`Fixtures:              ${summary.passedFixtures}/${summary.totalFixtures}`);
  console.log(`Direct Must Push:      ${summary.directMustPushCreated}`);
  console.log(`Direct memory writes:  ${summary.directMemoryCandidateCreated}`);
  console.log(`Ranking influenced:    ${summary.finalRankingInfluencedByExternalAgent}`);
  console.log(`Missing boundaries:    ${summary.acceptedWithoutBoundaryNote}`);
  console.log(`Unsupported PII:       ${summary.acceptedWithUnsupportedPII}`);
  console.log(`Missing gov trace:     ${summary.acceptedWithoutGovernanceTrace}`);
  console.log(`Trace conflict accepted:${summary.traceConflictAccepted}`);
  console.log(`Connector bypass:      ${summary.connectorPermissionBypassed}`);
  console.log(`Refusal promoted:      ${summary.refusedRetriedOrPromoted}`);

  console.log("\nFixture Results:");
  for (const result of summary.results) {
    console.log(
      `  ${result.passed ? "PASS" : "FAIL"} ${result.fixtureId.padEnd(6)} ${result.expectedDisposition.padEnd(28)} ${result.actualDisposition}`,
    );
    if (!result.passed) {
      console.log(`    reasons=${result.reasonCodes.join(",")}`);
    }
  }

  console.log("\nGate Metrics:");
  for (const metric of summary.metrics) {
    console.log(`  ${metric.passed ? "PASS" : "FAIL"} ${metric.name}`);
    if (!metric.passed) {
      console.log(`    ${metric.detail}`);
    }
  }

  if (!summary.overallPassed) {
    console.error("\nExternal Agent Intake eval FAILED\n");
    return 1;
  }

  console.log("\nExternal Agent Intake eval PASSED\n");
  return 0;
}

const parsed = parseCliArgs(process.argv.slice(2));
if ("error" in parsed) {
  console.error(parsed.error);
  printUsage();
  process.exit(2);
}

const exitCode = parsed.inputFile ? runManualImport(parsed) : runDefaultEval();
process.exit(exitCode);
