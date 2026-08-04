#!/usr/bin/env tsx
// check-caio-pro-v1 — aggregate static gate for the CAIO Pro V1 synthetic
// reference loop (P2). Deterministic and database-free. Six jobs, all
// fail-closed:
//
//   1. CPV1-DOCS     — the four CAIO Pro public docs exist, are allowlisted
//                      in the public docs manifest, are indexed in the docs
//                      README, and docs/STATUS.md carries the CAIO Pro rows
//                      including the P2 synthetic-loop row.
//   2. CPV1-EXPORTS  — the governance modules export their gate functions.
//   3. CPV1-FROZEN   — frozen fail-closed literals hold by DIRECT invocation
//                      on synthetic inputs: a 9- or 11-candidate portfolio is
//                      refused (never padded), a 4-question CEO selection is
//                      refused, the G0 acceptance-receipt creator refuses a
//                      caller-supplied accepted state without a ready
//                      assessment, plan artifacts carry authorityEffect and
//                      workPacketEffect exactly "none", the context-agent
//                      consent validator requires performanceInputProhibited
//                      to be exactly true, a completion assessment with ANY
//                      missing P4-P8 item can never be ready, completion
//                      acceptance against a not-ready assessment throws,
//                      every completion-gate receipt carries
//                      fullFunctionOperation exactly
//                      "not_authorized_by_this_receipt", and value receipts
//                      refuse forbidden value bases (token counts are never
//                      business value).
//   4. CPV1-FIREWALL — the mandate-not-an-authorization firewall stays wired.
//                      The import-graph sweep itself lives in
//                      scripts/check-caio-terminology.ts (authority firewall:
//                      lib/auth, lib/policies, lib/llm, app/api must never
//                      reach lib/caio-governance); this gate REFERENCES that
//                      guard instead of duplicating it and fails if the guard
//                      or its boundary-chain wiring disappears.
//   5. CPV1-HYGIENE  — the synthetic loop suite and the operating-question
//                      fixtures contain no phone/email/endpoint/secret-shaped
//                      strings (synthetic identifiers only).
//   6. CPV1-BOUNDARY / CPV1-WIRING / CPV1-CI — Public owns no reverse Overlay
//                      pin or composition suite, package.json carries the
//                      frozen loop-suite and gate commands inside the boundary
//                      chain, and CI carries a non-skippable isolated MySQL job.
//
// Passing this gate is a statement that the SYNTHETIC reference loop is
// formed on the public path. It is NOT customer initialization, NOT
// production evidence, and NOT value evidence; it changes no permission,
// route, API, database, or execution state machine.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  createContextAgentConsentReceipt,
  validateContextAgentConsentReceipt,
  validateContextAgentCollectionReceipt,
  validateContextAgentDeletionReceipt,
  validateContextAgentRevocationReceipt,
  validateContextAgentScope,
} from "../lib/context-agent/context-agent-contracts";
import { compareFallbackRouteSafety } from "../lib/llm/model-route-contracts";
import { computeCaioInitializationAssessment } from "../lib/stage1-owner-loop/caio-initialization-gate";
import { createCaioInitializationAcceptanceReceipt } from "../lib/stage1-owner-loop/caio-initialization-gate-receipt";
import { evaluateCaioOperatingQuestionGeneration } from "../lib/stage1-owner-loop/caio-operating-question";
import { createCaioOperatingQuestionImplementationPlan } from "../lib/stage1-owner-loop/caio-operating-question-implementation-plan";
import {
  syntheticOperatingQuestionCandidate,
  syntheticOperatingQuestionG0Input,
  syntheticOperatingQuestionGenerationInput,
} from "../lib/stage1-owner-loop/caio-operating-question.test-fixtures";
import {
  computeCaioProV1CompletionAssessment,
  createCaioProV1CompletionAcceptanceReceipt,
  createCaioQuestionValueReceipt,
  validateCaioProV1CompletionGateReceipt,
  type CaioProV1CompletionGateReceipt,
} from "../lib/stage1-owner-loop/caio-pro-completion";
import {
  syntheticCaioProV1CompletionInput,
  syntheticCaioQuestionValueReceiptInput,
} from "../lib/stage1-owner-loop/caio-pro-completion.test-fixtures";
import { createCaioQuestionSelectionReceipt } from "../lib/stage1-owner-loop/caio-question-selection";

export type CaioProV1Violation = {
  rule: string;
  file: string;
  detail: string;
};

const REQUIRED_DOCS = [
  "docs/product/HELM_CAIO_PRO_IMPLEMENTATION_REQUIREMENTS.md",
  "docs/_planning/HELM_CAIO_PRO_IMPLEMENTATION_PLAN.md",
  "docs/product/HELM_CAIO_MODEL_ADMISSION_AND_EGRESS.md",
  "docs/operations/HELM_CAIO_MODEL_EGRESS_RUNBOOK.md",
] as const;

const STATUS_FILE = "docs/STATUS.md";
const DOCS_README = "docs/README.md";
const MANIFEST_FILE = "docs/public-docs-manifest.json";
const TERMINOLOGY_GUARD = "scripts/check-caio-terminology.ts";
const PACKAGE_FILE = "package.json";
const CI_WORKFLOW = ".github/workflows/ci.yml";
const WORKFLOW_DIRECTORY = ".github/workflows";
const FORBIDDEN_PUBLIC_OVERLAY_COMPOSITION_FILES = [
  "tools/caio-access-gateway/overlay-composition-contract.test.ts",
  "tools/caio-access-gateway/overlay-composition-pin.json",
  "tools/caio-access-gateway/overlay-composition-types.ts",
  "vitest.overlay-contract.config.ts",
] as const;

const REQUIRED_STATUS_TOKENS = [
  "Helm CAIO Pro V1",
  "Helm CAIO Pro P1C",
  "Helm CAIO Pro P2",
  "Helm CAIO Pro V1 现场部署完成门",
  "npm run check:caio-pro-v1",
  "npm run test:caio-pro-v1:mysql",
] as const;

// Referenced (not duplicated) firewall guard: these tokens pin the existing
// authority-firewall sweep in check-caio-terminology.ts. If that guard is
// weakened or unwired, this gate fails.
const REQUIRED_FIREWALL_TOKENS = [
  'const FIREWALL_TARGET_PREFIX = "lib/caio-governance"',
  '"lib/auth/"',
  '"lib/policies/"',
  '"lib/llm/"',
  '"app/api/"',
  "findAuthorityFirewallViolations",
] as const;

export const SYNTHETIC_LOOP_SUITE =
  "lib/stage1-owner-loop/caio-pro-v1-synthetic-loop.mysql.test.ts";
export const COMPLETION_STORE_SUITE =
  "lib/stage1-owner-loop/caio-pro-completion-store.mysql.test.ts";
const HYGIENE_FILES = [
  SYNTHETIC_LOOP_SUITE,
  COMPLETION_STORE_SUITE,
  "lib/stage1-owner-loop/caio-operating-question.test-fixtures.ts",
  "lib/stage1-owner-loop/caio-pro-completion.test-fixtures.ts",
] as const;

// Synthetic fixture hygiene: nothing phone-, email-, endpoint-, IP- or
// secret-shaped may appear in the loop suite or the shared fixtures. The
// allow patterns keep clearly-synthetic forms (RFC 2606 example domains,
// loopback) from tripping the scan.
type HygieneRule = {
  name: string;
  pattern: RegExp;
  allow?: RegExp;
};

export const HYGIENE_RULES: readonly HygieneRule[] = [
  {
    name: "phone_shaped",
    // 11+ consecutive digits or an international +digits run.
    pattern: /(?<![\dA-Za-z_.])(?:\+\d{8,15}|1[3-9]\d{9})(?![\d_])/gu,
  },
  {
    name: "email_shaped",
    pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/gu,
    allow: /@example\.(?:test|com|org)$/u,
  },
  {
    name: "endpoint_shaped",
    pattern: /https?:\/\/[^\s"'`)]+/gu,
    allow: /^https?:\/\/(?:localhost|127\.0\.0\.1|example\.)/u,
  },
  {
    name: "ip_shaped",
    pattern: /(?<![\d.])\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?![\d.])/gu,
    allow: /^(?:127\.0\.0\.1|0\.0\.0\.0)$/u,
  },
  {
    name: "secret_shaped",
    pattern:
      /(?:sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]+|-----BEGIN [A-Z ]*PRIVATE KEY-----)/gu,
  },
] as const;

const EXPECTED_LOOP_SUITE_COMMAND =
  "vitest run lib/stage1-owner-loop/caio-pro-v1-synthetic-loop.mysql.test.ts lib/stage1-owner-loop/caio-pro-completion-store.mysql.test.ts --config vitest.public.config.ts --fileParallelism=false";

const EXPECTED_GATE_COMMAND =
  "node --import tsx scripts/check-caio-pro-v1.ts && vitest run scripts/check-caio-pro-v1.test.ts --config vitest.public.config.ts";

const REQUIRED_CI_TOKENS = [
  "caio-pro-v1-mysql:",
  "MYSQL_DATABASE: helm_caio_pro_v1_ci",
  // The connection string is minted at runtime and injected through
  // $GITHUB_ENV, so the gate pins the injection point, not a literal
  // credential. Committing a credentialed URL is separately rejected by
  // COMMITTED_CREDENTIAL_URL below.
  "CAIO_PRO_V1_DATABASE_URL=",
  "CAIO_PRO_V1_TEST_DATABASE_NAME: helm_caio_pro_v1_ci",
  "npx tsx prisma/setup-db.ts prepare",
  "npm run test:caio-pro-v1:mysql",
] as const;

const FORBIDDEN_PRIVATE_OVERLAY_CI_TOKENS = [
  ["caio", "-overlay-composition-contract:"].join(""),
  ["helm", "-overlays"].join(""),
  "HELM_OVERLAYS",
] as const;

// A committed `scheme://user:password@host` literal. Runtime-composed URLs use
// shell expansion (`${...}`) in the user or password position and never match.
const COMMITTED_CREDENTIAL_URL =
  /\b(?:mysql|mariadb|postgres|postgresql):\/\/[A-Za-z0-9_.-]+:[^@\s"'$]+@/u;

function read(repoRoot: string, file: string): string | null {
  const absolutePath = path.join(repoRoot, file);
  return existsSync(absolutePath) ? readFileSync(absolutePath, "utf8") : null;
}

function listWorkflowFiles(repoRoot: string): string[] {
  const workflowRoot = path.join(repoRoot, WORKFLOW_DIRECTORY);
  if (!existsSync(workflowRoot)) return [];

  return readdirSync(workflowRoot, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        (entry.name.endsWith(".yml") || entry.name.endsWith(".yaml")),
    )
    .map((entry) => path.posix.join(WORKFLOW_DIRECTORY, entry.name));
}

function findHygieneViolations(
  file: string,
  content: string,
): CaioProV1Violation[] {
  const violations: CaioProV1Violation[] = [];
  for (const rule of HYGIENE_RULES) {
    rule.pattern.lastIndex = 0;
    const matches = content.match(rule.pattern) ?? [];
    const disallowed = matches.filter(
      (match) => !(rule.allow?.test(match) ?? false),
    );
    if (disallowed.length > 0) {
      // Never echo the matched content: report the shape and count only.
      violations.push({
        rule: "CPV1-HYGIENE",
        file,
        detail: `${disallowed.length} ${rule.name} string(s) found; synthetic fixtures must not contain real-looking contact, endpoint, or credential data`,
      });
    }
  }
  return violations;
}

function selectionItem(questionId: string, priority: number) {
  return {
    questionId,
    questionOverride: null,
    goal: `Synthetic selection goal ${priority}`,
    successMetrics: [
      {
        metricKey: `metric-${priority}`,
        target: `Synthetic governed target ${priority}`,
      },
    ],
    priority,
    implementationScopeRefs: ["scope:review-only"],
    ownerRef: null,
    reviewerRef: null,
    startsAt: null,
    endsAt: null,
    prohibitedActions: ["external_side_effect"],
  };
}

function syntheticConsentReceipt() {
  return createContextAgentConsentReceipt({
    workspaceRef: "workspace:synthetic-caio",
    invitationRef: "context-agent-invitation:synthetic-1",
    memberUserRef: "user:synthetic-member",
    actorUserRef: "user:synthetic-member",
    consentVersion: 1,
    previousConsentRef: null,
    scope: {
      deviceRefs: ["device:synthetic-workstation"],
      directoryRefs: ["dir:projects"],
      enterpriseAppRefs: ["app:synthetic-crm"],
      purposes: ["company_memory_candidates"],
    },
    evidenceRefs: ["evidence:synthetic-consent"],
    idempotencyKey: "consent:synthetic:v1",
    recordedAt: "2026-07-23T09:00:00.000Z",
  });
}

// ---------------------------------------------------------------------------
// Module export surface (CPV1-EXPORTS).
// ---------------------------------------------------------------------------

export function checkCaioProV1Exports(): CaioProV1Violation[] {
  const violations: CaioProV1Violation[] = [];
  const requiredExports: ReadonlyArray<{
    name: string;
    value: unknown;
    file: string;
  }> = [
    {
      name: "computeCaioInitializationAssessment",
      value: computeCaioInitializationAssessment,
      file: "lib/stage1-owner-loop/caio-initialization-gate.ts",
    },
    {
      name: "evaluateCaioOperatingQuestionGeneration",
      value: evaluateCaioOperatingQuestionGeneration,
      file: "lib/stage1-owner-loop/caio-operating-question.ts",
    },
    {
      name: "createCaioQuestionSelectionReceipt",
      value: createCaioQuestionSelectionReceipt,
      file: "lib/stage1-owner-loop/caio-question-selection.ts",
    },
    {
      name: "createCaioInitializationAcceptanceReceipt",
      value: createCaioInitializationAcceptanceReceipt,
      file: "lib/stage1-owner-loop/caio-initialization-gate-receipt.ts",
    },
    {
      name: "createCaioOperatingQuestionImplementationPlan",
      value: createCaioOperatingQuestionImplementationPlan,
      file: "lib/stage1-owner-loop/caio-operating-question-implementation-plan.ts",
    },
    {
      name: "computeCaioProV1CompletionAssessment",
      value: computeCaioProV1CompletionAssessment,
      file: "lib/stage1-owner-loop/caio-pro-completion.ts",
    },
    {
      name: "createCaioProV1CompletionAcceptanceReceipt",
      value: createCaioProV1CompletionAcceptanceReceipt,
      file: "lib/stage1-owner-loop/caio-pro-completion.ts",
    },
    {
      name: "createCaioQuestionValueReceipt",
      value: createCaioQuestionValueReceipt,
      file: "lib/stage1-owner-loop/caio-pro-completion.ts",
    },
    {
      name: "validateCaioProV1CompletionGateReceipt",
      value: validateCaioProV1CompletionGateReceipt,
      file: "lib/stage1-owner-loop/caio-pro-completion.ts",
    },
    {
      name: "compareFallbackRouteSafety",
      value: compareFallbackRouteSafety,
      file: "lib/llm/model-route-contracts.ts",
    },
    {
      name: "validateContextAgentScope",
      value: validateContextAgentScope,
      file: "lib/context-agent/context-agent-contracts.ts",
    },
    {
      name: "validateContextAgentConsentReceipt",
      value: validateContextAgentConsentReceipt,
      file: "lib/context-agent/context-agent-contracts.ts",
    },
    {
      name: "validateContextAgentCollectionReceipt",
      value: validateContextAgentCollectionReceipt,
      file: "lib/context-agent/context-agent-contracts.ts",
    },
    {
      name: "validateContextAgentRevocationReceipt",
      value: validateContextAgentRevocationReceipt,
      file: "lib/context-agent/context-agent-contracts.ts",
    },
    {
      name: "validateContextAgentDeletionReceipt",
      value: validateContextAgentDeletionReceipt,
      file: "lib/context-agent/context-agent-contracts.ts",
    },
  ];
  for (const required of requiredExports) {
    if (typeof required.value !== "function") {
      violations.push({
        rule: "CPV1-EXPORTS",
        file: required.file,
        detail: `required gate export is not a function: ${required.name}`,
      });
    }
  }
  return violations;
}

// ---------------------------------------------------------------------------
// Frozen fail-closed literals by direct invocation (CPV1-FROZEN).
// ---------------------------------------------------------------------------

export function checkCaioProV1FrozenLiterals(): CaioProV1Violation[] {
  const violations: CaioProV1Violation[] = [];
  const frozen = (file: string, detail: string) => {
    violations.push({ rule: "CPV1-FROZEN", file, detail });
  };

  // 9 or 11 candidates -> insufficient_evidence, never a padded portfolio.
  for (const count of [9, 11]) {
    try {
      const evaluation = evaluateCaioOperatingQuestionGeneration(
        syntheticOperatingQuestionGenerationInput(
          Array.from({ length: count }, (_, index) =>
            syntheticOperatingQuestionCandidate(index),
          ),
        ),
      );
      if (
        evaluation.status !== "insufficient_evidence" ||
        evaluation.portfolio !== null ||
        !evaluation.gapCodes.includes("candidate_count_not_ten")
      ) {
        frozen(
          "lib/stage1-owner-loop/caio-operating-question.ts",
          `a ${count}-candidate generation must be refused as insufficient_evidence with candidate_count_not_ten and no portfolio`,
        );
      }
    } catch {
      frozen(
        "lib/stage1-owner-loop/caio-operating-question.ts",
        `evaluating a ${count}-candidate generation threw instead of returning a gap receipt`,
      );
    }
  }

  // A valid exactly-ten portfolio is the substrate for the selection and
  // plan literals below.
  const evaluation = evaluateCaioOperatingQuestionGeneration(
    syntheticOperatingQuestionGenerationInput(),
  );
  const portfolio = evaluation.portfolio;
  if (evaluation.status !== "generated" || !portfolio) {
    frozen(
      "lib/stage1-owner-loop/caio-operating-question.ts",
      "the synthetic ten-candidate generation input no longer produces a portfolio",
    );
    return violations;
  }

  // A CEO selection of 4 questions must be refused.
  let fourRefused = false;
  try {
    createCaioQuestionSelectionReceipt({
      portfolio,
      workspaceRef: portfolio.workspaceRef,
      ceoPrincipalBindingRef: "binding:ceo:synthetic-caio",
      ceoPrincipalRef: "principal:ceo:synthetic-caio",
      actorUserRef: "user:ceo:synthetic-caio",
      idempotencyKey: "selection:synthetic-caio:four",
      previousReceipt: null,
      selections: portfolio.candidates
        .slice(0, 4)
        .map((candidate, index) =>
          selectionItem(candidate.questionId, index + 1),
        ),
      reasonCodes: ["ceo_selected_operating_focus"],
      evidenceRefs: ["evidence:operating:1"],
      selectedAt: "2026-07-23T10:00:00.000Z",
    });
  } catch (error) {
    fourRefused =
      error instanceof Error &&
      error.message.includes("caio_question_selection_limit_exceeded");
  }
  if (!fourRefused) {
    frozen(
      "lib/stage1-owner-loop/caio-question-selection.ts",
      "a four-question CEO selection must be refused with caio_question_selection_limit_exceeded",
    );
  }

  // The G0 acceptance-receipt creator must refuse a caller-supplied
  // accepted state when the assessment is not ready — both when the
  // caller tampers a ready assessment's decision (integrity refusal) and
  // when the assessment is genuinely not ready (readiness refusal).
  const readyAssessment = computeCaioInitializationAssessment(
    syntheticOperatingQuestionG0Input(),
  );
  const notReadyAssessment = computeCaioInitializationAssessment({
    ...syntheticOperatingQuestionG0Input(),
    // A registered write path is a hard failure, so this input computes a
    // consistent assessment whose decision is not_ready.
    registeredWritePathCount: 1,
  });
  const acceptanceAttempt = (
    assessment: typeof readyAssessment,
    key: string,
  ) =>
    createCaioInitializationAcceptanceReceipt({
      workspaceRef: assessment.workspaceRef,
      assessment,
      mandateRef: assessment.mandateRef,
      ceoPrincipalBindingRef: "binding:ceo:synthetic-caio",
      ceoPrincipalRef: "principal:ceo:synthetic-caio",
      actorUserRef: "user:ceo:synthetic-caio",
      idempotencyKey: `accept:synthetic-caio:${key}`,
      evidenceRefs: ["evidence:ceo-reviewed-g0"],
      previousReceipt: null,
      recordedAt: "2026-07-23T08:00:00.000Z",
      inventoryConfirmationRef: "confirmation:inventory:synthetic-caio",
      customerAcceptanceRef: "acceptance:ceo:synthetic-caio",
      acceptedExceptionRefs: [...assessment.exceptionRefs],
      reasonCodes: ["owner_scope_confirmed"],
    });
  const refusalCases: ReadonlyArray<{
    assessment: typeof readyAssessment;
    key: string;
    expectedError: string;
  }> = [
    {
      assessment: { ...readyAssessment, decision: "not_ready" },
      key: "tampered-decision",
      expectedError: "caio_initialization_assessment_invalid",
    },
    {
      assessment: notReadyAssessment,
      key: "genuinely-not-ready",
      expectedError: "caio_initialization_assessment_not_ready",
    },
  ];
  for (const refusalCase of refusalCases) {
    let refused = false;
    try {
      acceptanceAttempt(refusalCase.assessment, refusalCase.key);
    } catch (error) {
      refused =
        error instanceof Error &&
        error.message.includes(refusalCase.expectedError);
    }
    if (!refused) {
      frozen(
        "lib/stage1-owner-loop/caio-initialization-gate-receipt.ts",
        `the acceptance-receipt creator must refuse a ${refusalCase.key} assessment with ${refusalCase.expectedError}`,
      );
    }
  }

  // Plan artifacts must carry authorityEffect and workPacketEffect "none".
  try {
    const selectionReceipt = createCaioQuestionSelectionReceipt({
      portfolio,
      workspaceRef: portfolio.workspaceRef,
      ceoPrincipalBindingRef: "binding:ceo:synthetic-caio",
      ceoPrincipalRef: "principal:ceo:synthetic-caio",
      actorUserRef: "user:ceo:synthetic-caio",
      idempotencyKey: "selection:synthetic-caio:one",
      previousReceipt: null,
      selections: [selectionItem(portfolio.candidates[0].questionId, 1)],
      reasonCodes: ["ceo_selected_operating_focus"],
      evidenceRefs: ["evidence:operating:1"],
      selectedAt: "2026-07-23T10:00:00.000Z",
    });
    const plan = createCaioOperatingQuestionImplementationPlan({
      portfolio,
      selectionReceipt,
      questionId: portfolio.candidates[0].questionId,
      decisionRecordRef: "decision-record:synthetic-1",
    });
    if (
      selectionReceipt.authorityEffect !== "none" ||
      selectionReceipt.workPacketEffect !== "none" ||
      plan.authorityEffect !== "none" ||
      plan.workPacketEffect !== "none"
    ) {
      frozen(
        "lib/stage1-owner-loop/caio-operating-question-implementation-plan.ts",
        'selection and plan artifacts must carry authorityEffect and workPacketEffect exactly "none"',
      );
    }
  } catch {
    frozen(
      "lib/stage1-owner-loop/caio-operating-question-implementation-plan.ts",
      "creating the synthetic selection receipt or implementation plan threw",
    );
  }

  // Completion gate: an assessment with ANY missing P4-P8 item can never be
  // ready, acceptance against a not-ready assessment throws, the
  // fullFunctionOperation literal is validated exactly, and value receipts
  // refuse forbidden value bases (token counts are never business value).
  const completionFile = "lib/stage1-owner-loop/caio-pro-completion.ts";
  try {
    const completeInput = syntheticCaioProV1CompletionInput();
    const readyAssessmentCompletion =
      computeCaioProV1CompletionAssessment(completeInput);
    if (
      readyAssessmentCompletion.decision !== "ready_for_owner_acceptance" ||
      readyAssessmentCompletion.missingItemKeys.length !== 0
    ) {
      frozen(
        completionFile,
        "the fully-satisfied synthetic completion input no longer evaluates ready",
      );
    }
    const missingOneInput = syntheticCaioProV1CompletionInput();
    missingOneInput.attestations = missingOneInput.attestations.filter(
      (attestation) => attestation.itemKey !== "p8_incident_posture_clear",
    );
    const notReadyCompletion =
      computeCaioProV1CompletionAssessment(missingOneInput);
    if (
      notReadyCompletion.decision !== "not_ready" ||
      !notReadyCompletion.missingItemKeys.includes(
        "p8_incident_posture_clear",
      )
    ) {
      frozen(
        completionFile,
        "a completion assessment with a missing checklist item must be not_ready with the missing item listed",
      );
    }
    const completionAcceptanceInput = (
      assessment: typeof readyAssessmentCompletion,
      key: string,
    ) => ({
      workspaceRef: assessment.workspaceRef,
      assessment,
      ceoPrincipalBindingRef: "binding:ceo:synthetic-completion",
      ceoPrincipalRef: "principal:ceo:synthetic-completion",
      actorUserRef: "user:ceo:synthetic-completion",
      idempotencyKey: `completion-accept:${key}`,
      reasonCodes: ["site_deployment_reviewed"],
      evidenceRefs: ["evidence:completion-acceptance"],
      previousReceipt: null,
      recordedAt: "2026-07-26T08:00:00.000Z",
    });
    let notReadyRefused = false;
    try {
      createCaioProV1CompletionAcceptanceReceipt(
        completionAcceptanceInput(notReadyCompletion, "not-ready"),
      );
    } catch (error) {
      notReadyRefused =
        error instanceof Error &&
        error.message.includes("caio_pro_v1_completion_assessment_not_ready");
    }
    if (!notReadyRefused) {
      frozen(
        completionFile,
        "completion acceptance against a not-ready assessment must throw caio_pro_v1_completion_assessment_not_ready",
      );
    }
    const acceptedReceipt = createCaioProV1CompletionAcceptanceReceipt(
      completionAcceptanceInput(readyAssessmentCompletion, "ready"),
    );
    if (
      acceptedReceipt.fullFunctionOperation !==
        "not_authorized_by_this_receipt" ||
      acceptedReceipt.authorityEffect !== "none"
    ) {
      frozen(
        completionFile,
        'every completion-gate receipt must carry fullFunctionOperation exactly "not_authorized_by_this_receipt" and authorityEffect "none"',
      );
    }
    const tamperedValidation = validateCaioProV1CompletionGateReceipt({
      ...acceptedReceipt,
      fullFunctionOperation:
        "activated" as unknown as CaioProV1CompletionGateReceipt["fullFunctionOperation"],
    });
    if (
      tamperedValidation.valid ||
      !tamperedValidation.errors.includes(
        "completion_gate_receipt_governance_boundary_invalid",
      )
    ) {
      frozen(
        completionFile,
        "a tampered fullFunctionOperation literal must fail completion-gate receipt validation",
      );
    }
  } catch {
    frozen(
      completionFile,
      "evaluating the synthetic completion gate threw instead of judging fail-closed",
    );
  }

  let tokenMetricRefused = false;
  try {
    const forbiddenInput = syntheticCaioQuestionValueReceiptInput();
    forbiddenInput.metricDefinitions = [
      {
        metricKey: "token-usage-total",
        definition: "tokens consumed per operating window",
        dataSourceRefs: ["evidence:synthetic-tokens"],
      },
    ];
    createCaioQuestionValueReceipt(forbiddenInput);
  } catch (error) {
    tokenMetricRefused =
      error instanceof Error &&
      error.message.includes(
        "value_receipt_forbidden_value_basis:token_usage",
      );
  }
  if (!tokenMetricRefused) {
    frozen(
      completionFile,
      "a token-count value metric must be refused with value_receipt_forbidden_value_basis:token_usage",
    );
  }

  // performanceInputProhibited must be exactly true — any other value,
  // including a truthy non-boolean, must fail validation.
  try {
    const consent = syntheticConsentReceipt();
    if (consent.performanceInputProhibited !== true) {
      frozen(
        "lib/context-agent/context-agent-contracts.ts",
        "a created consent receipt must carry performanceInputProhibited === true",
      );
    }
    if (!validateContextAgentConsentReceipt(consent).valid) {
      frozen(
        "lib/context-agent/context-agent-contracts.ts",
        "the synthetic consent receipt must validate cleanly",
      );
    }
    for (const tampered of [false, 1, "true", undefined] as const) {
      const validation = validateContextAgentConsentReceipt({
        ...consent,
        performanceInputProhibited: tampered as unknown as true,
      });
      if (
        validation.valid ||
        !validation.errors.includes(
          "context_agent_performance_input_boundary_invalid",
        )
      ) {
        frozen(
          "lib/context-agent/context-agent-contracts.ts",
          "performanceInputProhibited must be exactly true; other values must fail validation",
        );
        break;
      }
    }
  } catch {
    frozen(
      "lib/context-agent/context-agent-contracts.ts",
      "creating or validating the synthetic consent receipt threw",
    );
  }

  return violations;
}

// ---------------------------------------------------------------------------
// Repository-relative static checks (CPV1-DOCS / FIREWALL / HYGIENE /
// BOUNDARY / WIRING / CI). Fixture-testable via repoRoot.
// ---------------------------------------------------------------------------

export function checkCaioProV1Static(
  repoRoot = process.cwd(),
): CaioProV1Violation[] {
  const violations: CaioProV1Violation[] = [];

  for (const file of FORBIDDEN_PUBLIC_OVERLAY_COMPOSITION_FILES) {
    if (existsSync(path.join(repoRoot, file))) {
      violations.push({
        rule: "CPV1-BOUNDARY",
        file,
        detail:
          "Public Core must not own an Overlay pin or reverse-composition suite; the downstream Overlay gate owns cross-repository composition",
      });
    }
  }

  for (const doc of REQUIRED_DOCS) {
    if (!existsSync(path.join(repoRoot, doc))) {
      violations.push({
        rule: "CPV1-DOCS",
        file: doc,
        detail: "required CAIO Pro public document is missing",
      });
    }
  }
  const manifestContent = read(repoRoot, MANIFEST_FILE);
  if (manifestContent === null) {
    violations.push({
      rule: "CPV1-DOCS",
      file: MANIFEST_FILE,
      detail: "public docs manifest is missing",
    });
  } else {
    try {
      const manifest = JSON.parse(manifestContent) as {
        allowedDocs?: unknown;
      };
      const allowedDocs = Array.isArray(manifest.allowedDocs)
        ? manifest.allowedDocs
        : [];
      for (const doc of REQUIRED_DOCS) {
        if (!allowedDocs.includes(doc)) {
          violations.push({
            rule: "CPV1-DOCS",
            file: MANIFEST_FILE,
            detail: `CAIO Pro document is not allowlisted: ${doc}`,
          });
        }
      }
    } catch {
      violations.push({
        rule: "CPV1-DOCS",
        file: MANIFEST_FILE,
        detail: "public docs manifest is not valid JSON",
      });
    }
  }
  const readmeContent = read(repoRoot, DOCS_README);
  if (readmeContent === null) {
    violations.push({
      rule: "CPV1-DOCS",
      file: DOCS_README,
      detail: "docs README index is missing",
    });
  } else {
    for (const doc of REQUIRED_DOCS) {
      const relative = doc.replace(/^docs\//u, "");
      if (!readmeContent.includes(relative)) {
        violations.push({
          rule: "CPV1-DOCS",
          file: DOCS_README,
          detail: `CAIO Pro document is not indexed: ${relative}`,
        });
      }
    }
  }
  const statusContent = read(repoRoot, STATUS_FILE);
  if (statusContent === null) {
    violations.push({
      rule: "CPV1-DOCS",
      file: STATUS_FILE,
      detail: "docs/STATUS.md is missing",
    });
  } else {
    for (const token of REQUIRED_STATUS_TOKENS) {
      if (!statusContent.includes(token)) {
        violations.push({
          rule: "CPV1-DOCS",
          file: STATUS_FILE,
          detail: `required CAIO Pro status token is missing: ${token}`,
        });
      }
    }
  }

  const guardContent = read(repoRoot, TERMINOLOGY_GUARD);
  if (guardContent === null) {
    violations.push({
      rule: "CPV1-FIREWALL",
      file: TERMINOLOGY_GUARD,
      detail:
        "the authority-firewall guard (mandate is not an authorization token) is missing",
    });
  } else {
    for (const token of REQUIRED_FIREWALL_TOKENS) {
      if (!guardContent.includes(token)) {
        violations.push({
          rule: "CPV1-FIREWALL",
          file: TERMINOLOGY_GUARD,
          detail: `authority-firewall token is missing: ${token}`,
        });
      }
    }
  }

  for (const file of HYGIENE_FILES) {
    const content = read(repoRoot, file);
    if (content === null) {
      violations.push({
        rule: "CPV1-HYGIENE",
        file,
        detail: "required synthetic fixture file is missing",
      });
      continue;
    }
    violations.push(...findHygieneViolations(file, content));
  }

  const packageContent = read(repoRoot, PACKAGE_FILE);
  if (packageContent === null) {
    violations.push({
      rule: "CPV1-WIRING",
      file: PACKAGE_FILE,
      detail: "package.json is missing",
    });
  } else {
    try {
      const packageJson = JSON.parse(packageContent) as {
        scripts?: Record<string, string>;
      };
      const scripts = packageJson.scripts ?? {};
      if (scripts["test:caio-pro-v1:mysql"] !== EXPECTED_LOOP_SUITE_COMMAND) {
        violations.push({
          rule: "CPV1-WIRING",
          file: PACKAGE_FILE,
          detail:
            "test:caio-pro-v1:mysql does not match the frozen isolated-MySQL loop command",
        });
      }
      if (scripts["check:caio-pro-v1"] !== EXPECTED_GATE_COMMAND) {
        violations.push({
          rule: "CPV1-WIRING",
          file: PACKAGE_FILE,
          detail: "check:caio-pro-v1 does not match the frozen gate command",
        });
      }
      const boundaries = scripts["check:boundaries"] ?? "";
      if (!boundaries.includes("npm run check:caio-pro-v1")) {
        violations.push({
          rule: "CPV1-WIRING",
          file: PACKAGE_FILE,
          detail: "check:boundaries does not include check:caio-pro-v1",
        });
      }
      if (!boundaries.includes("npm run check:caio-terminology")) {
        violations.push({
          rule: "CPV1-FIREWALL",
          file: PACKAGE_FILE,
          detail:
            "check:boundaries no longer runs the referenced authority-firewall guard (check:caio-terminology)",
        });
      }
    } catch {
      violations.push({
        rule: "CPV1-WIRING",
        file: PACKAGE_FILE,
        detail: "package.json is not valid JSON",
      });
    }
  }

  const workflowContent = read(repoRoot, CI_WORKFLOW);
  if (workflowContent === null) {
    violations.push({
      rule: "CPV1-CI",
      file: CI_WORKFLOW,
      detail: "CI workflow is missing",
    });
  } else {
    for (const token of REQUIRED_CI_TOKENS) {
      if (!workflowContent.includes(token)) {
        violations.push({
          rule: "CPV1-CI",
          file: CI_WORKFLOW,
          detail: `required CI token is missing: ${token}`,
        });
      }
    }
    if (COMMITTED_CREDENTIAL_URL.test(workflowContent)) {
      violations.push({
        rule: "CPV1-CI",
        file: CI_WORKFLOW,
        detail:
          "CI workflow must not commit a database connection string that carries credentials",
      });
    }
    const jobStart = workflowContent.indexOf("caio-pro-v1-mysql:");
    if (jobStart >= 0) {
      const rest = workflowContent.slice(jobStart);
      const nextJob = rest.slice(1).search(/\n {2}[a-z][a-z0-9-]*:\n/u);
      const jobBlock = nextJob >= 0 ? rest.slice(0, nextJob + 1) : rest;
      if (jobBlock.includes("continue-on-error")) {
        violations.push({
          rule: "CPV1-CI",
          file: CI_WORKFLOW,
          detail: "caio-pro-v1-mysql job must not be skippable",
        });
      }
    }
  }

  for (const workflowFile of listWorkflowFiles(repoRoot)) {
    const content = read(repoRoot, workflowFile);
    if (
      content !== null &&
      FORBIDDEN_PRIVATE_OVERLAY_CI_TOKENS.some((token) =>
        content.includes(token),
      )
    ) {
      violations.push({
        rule: "CPV1-CI",
        file: workflowFile,
        detail:
          "Public CI must not read a private Overlay repository or accept credentials for one; cross-repository composition is owned by the downstream Overlay gate",
      });
    }
  }

  return violations;
}

export function checkCaioProV1(
  repoRoot = process.cwd(),
): CaioProV1Violation[] {
  return [
    ...checkCaioProV1Exports(),
    ...checkCaioProV1FrozenLiterals(),
    ...checkCaioProV1Static(repoRoot),
  ];
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const violations = checkCaioProV1();
  if (violations.length > 0) {
    console.error(`caio-pro-v1: FAIL - ${violations.length} violation(s)`);
    for (const violation of violations) {
      console.error(
        `- [${violation.rule}] ${violation.file}: ${violation.detail}`,
      );
    }
    process.exitCode = 1;
  } else {
    console.log(
      "caio-pro-v1: PASS - synthetic reference loop and P4-P8 site-deployment completion gate formed on the public path (isolated-MySQL E2E + CI wiring); completion acceptance never authorizes full-function operation; NOT customer or production evidence, no external side effects",
    );
  }
}
