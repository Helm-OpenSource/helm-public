import fs from "node:fs";
import path from "node:path";

export interface LlmCandidateBoundaryViolation {
  file: string;
  rule: string;
  detail: string;
}

export interface LlmCandidateBoundaryCheckResult {
  ok: boolean;
  violations: LlmCandidateBoundaryViolation[];
}

const REPO_ROOT = process.cwd();
const TARGET_ROOTS = ["lib/llm", "lib/llm-workflows", "lib/recommendations"];
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);
const TEST_FILE_PATTERN = /\.(test|spec)\.tsx?$/;
const BYPASS_TOKEN = "@bypass-llm-candidate-boundary";

const CANDIDATE_AWARE_PATTERN =
  /\b(JudgementCandidate|LLMCriticResult|judgementCandidate|llmCriticResult|reviewJudgementBoundaryWithLLM|CounterfactualReviewerOutput|reviewCounterfactualWithLLM|SelectedContextStub|LLMContextSelectionReceipt|RuntimePermissionProfile|resolveRuntimePermissionForCapability|SkillRevisionCandidate|ModelCapabilityProfile|RichLocalContextBundle|ContextProjectionReceipt|JudgementProposalBundle|SourceToSignalProposalBundle|LLMTaskTrajectoryReceipt|PrivateContextAdapterManifest|PrivateContextBuildReceipt|ContextEgressDecisionReceipt|RuntimeIsolationProfile|CapabilityGrant|GovernedJudgementCandidate|materializeGovernedJudgementCandidate)\b/;
const UNSAFE_REVIEW_STATE_PATTERN =
  /reviewState\s*:\s*["'](?:approved|committed|executed|auto_promote|production_ready)["']/i;
const UNSAFE_STATE_ENUM_DEFINITION_PATTERN =
  /\b(?:JUDGEMENT_REVIEW_STATES|judgementReviewStateSchema|COUNTERFACTUAL_REVIEW_STATES|counterfactualReviewStateSchema|V3_REVIEW_STATES|v3ReviewStateSchema)\b[\s\S]{0,500}["'](?:approved|committed|executed|auto_promote|production_ready)["']/i;

// v2 terms-to-avoid: banned public-contract / UI identifiers. Use the approved
// alternatives (capabilityRequested, capabilityRef, missingSignalNote,
// memoryPromotionCandidate, workflowDraftReference, ...). Checked on
// candidate-aware modules only, as exact camelCase identifiers.
const BANNED_TERM_PATTERNS: ReadonlyArray<{ pattern: RegExp; term: string }> = [
  { pattern: /\bagentActivation\b/, term: "agentActivation" },
  { pattern: /\bactivateAgent\b/, term: "activateAgent" },
  { pattern: /\bcontextExpansion\b/, term: "contextExpansion" },
  { pattern: /\bconnectorHandle\b/, term: "connectorHandle" },
  { pattern: /\bupgradeToCommitment\b/, term: "upgradeToCommitment" },
  { pattern: /\bcommitmentBasis\b/, term: "commitmentBasis" },
  { pattern: /\bmemoryWrite\b/, term: "memoryWrite" },
  { pattern: /\brunbookExecution\b/, term: "runbookExecution" },
  { pattern: /\bworkflowTrigger\b/, term: "workflowTrigger" },
];

// v2 rule D: a `skipped` prompt-injection status may live only in synthetic
// fixtures (lib/evals/**, *.test.ts). It must never be hard-coded as a real
// receipt literal inside the source modules under TARGET_ROOTS.
const SKIPPED_STATUS_PATTERN = /status\s*:\s*["']skipped["']/;

// v2 rule E: the audit-only selection receipt must not be serialized, prompt-
// built, or dispatched. Flag any candidate-aware module that references the
// receipt alongside a prompt/serialize/dispatch sink. Only the defining
// contract (which exports projectSelectedContextStub) may reference it. This is
// broader than a single `userPrompt:` literal so cross-file helpers, renamed
// variables, and JSON.stringify/executeLLMTask paths are caught too.
const SELECTOR_RECEIPT_PATTERN = /\b(LLMContextSelectionReceipt|selectorReceipt|selectionReceipt)\b/;
const SELECTOR_RECEIPT_SINK_PATTERN =
  /\buserPrompt\s*:|JSON\.stringify|executeLLMTask|build\w*ReviewPrompt/;
const SELECTOR_RECEIPT_DEFINING_FILE = "lib/llm/intelligence-contracts-v2.ts";

// v3 rule F: rich local context and trajectory receipts are local/private or
// audit/eval input surfaces. Prompt builders must consume only a projected
// SelectedContextStub or candidate summary, never those receipts directly.
const RICH_CONTEXT_PATTERN =
  /\b(RichLocalContextBundle|richLocalContextBundle|richContextBundle|LLMTaskTrajectoryReceipt|trajectoryReceipt)\b/;
const RICH_CONTEXT_SINK_PATTERN =
  /\buserPrompt\s*:|JSON\.stringify|executeLLMTask|build\w*(?:Prompt|ReviewPrompt)/;
const CONTEXT_PROJECTION_RECEIPT_PATTERN = /\bContextProjectionReceipt\b/;
const CONTEXT_PROJECTION_RECEIPT_SINK_PATTERN =
  /JSON\.stringify\(\s*(?:contextProjectionReceipt|projectionReceipt|receipt)\b|\buserPrompt\s*:\s*(?:contextProjectionReceipt|projectionReceipt|receipt)\b/i;

// v4 rule H: private adapter build and egress receipts are audit/conformance
// records. A prompt may consume only the already validated SelectedContextStub,
// never these receipts or their local/private summaries.
const PRIVATE_CONTEXT_RECEIPT_PATTERN =
  /\b(PrivateContextBuildReceipt|ContextEgressDecisionReceipt|privateContextBuildReceipt|contextEgressDecisionReceipt)\b/;
const PRIVATE_CONTEXT_RECEIPT_SINK_PATTERN =
  /\b(?:userPrompt|systemPrompt)\s*:|executeLLMTask|(?:build|render|create|compose)\w*(?:Prompt|ReviewPrompt)/;

const V3_MULTI_PASS_WORKFLOW_PATTERN = /\bexecuteMultiPassReview\b/;
const V3_MULTI_PASS_REQUIRED_MARKERS = [
  'taskType: "MULTI_PASS_REVIEW"',
  "llmPromptVersions.multiPassReview",
  "executeLLMTask",
  "buildReasoningBudgetAuditSummary",
] as const;
const GOVERNED_CANDIDATE_MATERIALIZER_FILE =
  "lib/llm/governed-candidate-materializer.ts";
const GOVERNED_CANDIDATE_MATERIALIZER_REQUIRED_MARKERS = [
  "db.$transaction",
  "tx.artifactBundle.create",
  "tx.artifactReview.create",
  "tx.auditLog.create",
  "ArtifactBundleStatus.DRAFT",
  "ArtifactReviewStatus.PENDING",
  "systemOfRecordWrite: false",
] as const;
const GOVERNED_CANDIDATE_MATERIALIZER_FORBIDDEN_WRITE_PATTERN =
  /\b(?:db|tx|prisma)\.(?:actionItem|approvalRequest|approvalTask|memoryItem|memoryPromotion|recommendationFeedback|preferenceSignal|patternFact|officialWriteIntent|humanActionExecution)\.(?:create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/;
const GOVERNED_CANDIDATE_PROMOTION_FILE =
  "lib/governed-intelligence/governed-candidate-review.ts";
const GOVERNED_CANDIDATE_PROMOTION_REQUIRED_MARKERS = [
  "assertWorkspaceGovernedCandidatePromotionServiceAccess",
  "actorType: ActorType.USER",
  "db.$transaction",
  "artifactBundle.updateMany",
  "ArtifactReviewStatus.CONFIRMED",
  "ArtifactBundleStatus.CONSUMED",
  "ActionType.CREATE_TASK",
  "ActionExecutionMode.REQUIRES_APPROVAL",
  "ApprovalStatus.PENDING",
  "autoExecute: false",
  "contentAuthorship: ActorType.AI",
] as const;
const GOVERNED_CANDIDATE_PROMOTION_FORBIDDEN_PATTERN =
  /\b(?:executeActionItem|createGovernedAction|runCrmImport|activateConnector|externalSend|sendEmail)\s*\(|\bActionType\.(?:DRAFT_EXTERNAL_EMAIL|DRAFT_INTERNAL_NOTE|CREATE_MEETING|UPDATE_OPPORTUNITY_STAGE|ASSIGN_OWNER|CHANGE_DUE_DATE|SEND_MEETING_SUMMARY|GENERATE_REPLY_DRAFT|SCHEDULE_INTERVIEW)\b|\b(?:db|tx|prisma)\.(?:memoryItem|memoryPromotion|recommendationFeedback|preferenceSignal|patternFact|officialWriteIntent|humanActionExecution)\.(?:create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/;
const GOVERNED_CLOSEOUT_CONTRACT_FILE =
  "lib/governed-intelligence/capability-closeout-contracts.ts";
const GOVERNED_CLOSEOUT_CONTRACT_REQUIRED_MARKERS = [
  'requiredHumanClick: z.literal(true)',
  'automaticSendAllowed: z.literal(false)',
  'sendPerformed: z.literal(false)',
  "WORKSPACE_CAPABILITIES.MANAGE_CONNECTORS",
  'oauthCompletionAllowed: z.literal(false)',
  'credentialEntryAllowed: z.literal(false)',
  'activationAllowed: z.literal(false)',
  'connectedStateTransitionAllowed: z.literal(false)',
  'candidateStatus: z.literal("pending_verification")',
  'memoryPromotionCreated: z.literal(false)',
  'canonicalMemoryWritten: z.literal(false)',
] as const;
const GOVERNED_CLOSEOUT_MATERIALIZER_FILE =
  "lib/governed-intelligence/capability-closeout-materializer.ts";
const GOVERNED_CLOSEOUT_MATERIALIZER_REQUIRED_MARKERS = [
  "evaluateCapabilityGrant",
  'decision.decision !== "allow_draft"',
  "db.$transaction",
  "tx.artifactBundle.create",
  "tx.artifactReview.create",
  "tx.auditLog.create",
  "ArtifactBundleStatus.DRAFT",
  "ArtifactReviewStatus.PENDING",
  "systemOfRecordWrite: false",
  "ArtifactReviewStatus.CONFIRMED",
] as const;
const GOVERNED_CLOSEOUT_MATERIALIZER_FORBIDDEN_WRITE_PATTERN =
  /\b(?:db|tx|prisma)\.(?:actionItem|approvalRequest|approvalTask|humanActionExecution|memoryCandidate|memoryItem|memoryPromotion|officialWriteIntent|connector|importSource|recommendationFeedback|preferenceSignal|patternFact)\.(?:create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/;
const GOVERNED_CLOSEOUT_REVIEW_FILE =
  "lib/governed-intelligence/capability-closeout-review.ts";
const GOVERNED_EXTERNAL_SEND_HANDOFF_REQUIRED_MARKERS = [
  "assertWorkspaceGovernedActionManagementServiceAccess",
  "actorType: ActorType.USER",
  "rateLimitReceipt.expiresAt",
  "HumanActionExecutionType.MANUAL_EMAIL_SEND",
  "HumanActionExecutionStatus.READY",
  "HumanActionExecutionAckStatus.PENDING",
  "executedAt: null",
  "automaticSendAllowed: false",
  "sendPerformed: false",
] as const;
const GOVERNED_EXTERNAL_SEND_HANDOFF_FORBIDDEN_PATTERN =
  /(?<![\w.])(?:externalSend|sendEmail|fetch)\s*\(|^\s*import\s+.*(?:nodemailer|features\/connectors\/actions)|\bHumanActionExecutionStatus\.EXECUTED\b|\bHumanActionExecutionAckStatus\.ACKNOWLEDGED\b|\b(?:db|tx|prisma)\.(?:connector|importSource|memoryItem|memoryPromotion|officialWriteIntent)\.(?:create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/m;
const GOVERNED_MEMORY_PROJECTION_REQUIRED_MARKERS = [
  "assertWorkspaceMemoryServiceAccess",
  "ArtifactReviewStatus.CONFIRMED",
  "tx.runtimeSession.findFirst",
  "tx.memoryCandidate.create",
  "RuntimeMemoryCandidateStatus.PENDING_VERIFICATION",
  "memoryPromotionCreated: false",
  "canonicalMemoryWritten: false",
  'actionType: "GOVERNED_MEMORY_CANDIDATE_PROJECTED"',
] as const;
const GOVERNED_MEMORY_PROJECTION_FORBIDDEN_PATTERN =
  /\b(?:db|tx|prisma)\.(?:memoryItem|memoryPromotion|humanActionExecution|connector|importSource|officialWriteIntent)\.(?:create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(|(?<![\w.])(?:externalSend|sendEmail|fetch)\s*\(/;

const FORBIDDEN_CODE_PATTERNS: Array<{ pattern: RegExp; detail: string }> = [
  {
    pattern: /^\s*import\s+.*recommendation-feedback\.service/m,
    detail: "Candidate/Critic modules must not import recommendation feedback writers.",
  },
  {
    pattern:
      /^\s*import\s+[^;]*\b(?:PreferenceSignal|PatternFact|ApprovalTask|MemoryPromotion)\b[^;]*from\s+["']@prisma\/client["']/m,
    detail: "Candidate/Critic modules must not import direct write model types.",
  },
  {
    pattern:
      /\b(?:db|tx|prisma)\.(?:actionItem|approvalRequest|approvalTask|memoryItem|preferenceSignal|patternFact|memoryPromotion|recommendationFeedback|officialWriteIntent|humanActionExecution)\.(?:create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/,
    detail:
      "Candidate/Critic modules must not directly write feedback, preference, approval, pattern, or memory-promotion records.",
  },
  {
    pattern: /^\s*import\s+.*(?:runCrmImport|crm-orchestrator\.service)/m,
    detail: "Candidate/Critic modules must not call CRM import execution.",
  },
  {
    pattern: /^\s*import\s+.*(?:features\/connectors\/actions|activateConnector)/im,
    detail: "Candidate/Critic modules must not activate connectors.",
  },
  {
    pattern:
      /^\s*import\s+[\s\S]{0,400}?from\s+["'][^"']*governed-intelligence\/governed-candidate-review["']/m,
    detail:
      "LLM candidate modules must not import the human candidate review or promotion service.",
  },
  {
    pattern:
      /(?<![\w.])(?:externalSend|sendEmail|fetch)\s*\(|^\s*import\s+.*nodemailer/m,
    detail: "Candidate/Critic modules must not perform external sends.",
  },
];

function walkFiles(root: string, files: string[] = []): string[] {
  if (!fs.existsSync(root)) {
    return files;
  }

  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) {
      walkFiles(absolute, files);
      continue;
    }

    if (!SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      continue;
    }

    if (TEST_FILE_PATTERN.test(entry.name)) {
      continue;
    }

    files.push(absolute);
  }

  return files;
}

function toRepoRelative(repoRoot: string, file: string): string {
  return path.relative(repoRoot, file).replaceAll(path.sep, "/");
}

function isCandidateAware(content: string): boolean {
  return CANDIDATE_AWARE_PATTERN.test(content);
}

export function runLlmCandidateBoundaryCheck(
  repoRoot = REPO_ROOT,
): LlmCandidateBoundaryCheckResult {
  const violations: LlmCandidateBoundaryViolation[] = [];
  const files = TARGET_ROOTS.flatMap((root) => walkFiles(path.join(repoRoot, root)));

  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    if (content.includes(BYPASS_TOKEN)) {
      continue;
    }

    const repoRelative = toRepoRelative(repoRoot, file);

    // Rule D runs on every source module under TARGET_ROOTS, not only
    // candidate-aware ones: a real `skipped` scan literal is never allowed in
    // source. Synthetic fixtures live under lib/evals/** and *.test.ts.
    if (SKIPPED_STATUS_PATTERN.test(content)) {
      violations.push({
        file: repoRelative,
        rule: "LLM-CANDIDATE-D",
        detail:
          "promptInjectionScanResult.status=skipped is only allowed in synthetic fixtures, not source modules.",
      });
    }

    if (!isCandidateAware(content)) {
      continue;
    }

    if (UNSAFE_REVIEW_STATE_PATTERN.test(content)) {
      violations.push({
        file: repoRelative,
        rule: "LLM-CANDIDATE-A",
        detail: "JudgementCandidate/LLMCriticResult must use candidate-only review states.",
      });
    }

    if (UNSAFE_STATE_ENUM_DEFINITION_PATTERN.test(content)) {
      violations.push({
        file: repoRelative,
        rule: "LLM-CANDIDATE-A",
        detail: "Candidate review-state enum must stay closed to candidate-only states.",
      });
    }

    for (const { pattern, detail } of FORBIDDEN_CODE_PATTERNS) {
      if (pattern.test(content)) {
        violations.push({
          file: repoRelative,
          rule: "LLM-CANDIDATE-B",
          detail,
        });
      }
    }

    for (const { pattern, term } of BANNED_TERM_PATTERNS) {
      if (pattern.test(content)) {
        violations.push({
          file: repoRelative,
          rule: "LLM-CANDIDATE-C",
          detail: `Banned v2 term "${term}" — use the approved capabilityRef / candidate naming instead.`,
        });
      }
    }

    if (
      repoRelative !== SELECTOR_RECEIPT_DEFINING_FILE &&
      SELECTOR_RECEIPT_PATTERN.test(content) &&
      SELECTOR_RECEIPT_SINK_PATTERN.test(content)
    ) {
      violations.push({
        file: repoRelative,
        rule: "LLM-CANDIDATE-E",
        detail:
          "Selection receipt content is audit-only; it must not be serialized, prompt-built, or dispatched. Only intelligence-contracts-v2.ts may reference it (projectSelectedContextStub). Use SelectedContextStub.",
      });
    }

    if (
      RICH_CONTEXT_PATTERN.test(content) &&
      RICH_CONTEXT_SINK_PATTERN.test(content)
    ) {
      violations.push({
        file: repoRelative,
        rule: "LLM-CANDIDATE-F",
        detail:
          "Rich local context and trajectory receipts must not be serialized, prompt-built, or dispatched. Project to a safe stub or summary before any remote LLM path.",
      });
    }

    if (
      CONTEXT_PROJECTION_RECEIPT_PATTERN.test(content) &&
      CONTEXT_PROJECTION_RECEIPT_SINK_PATTERN.test(content)
    ) {
      violations.push({
        file: repoRelative,
        rule: "LLM-CANDIDATE-F",
        detail:
          "Context projection receipts are audit-only; prompt builders may consume only their validated SelectedContextStub projection.",
      });
    }

    if (
      PRIVATE_CONTEXT_RECEIPT_PATTERN.test(content) &&
      PRIVATE_CONTEXT_RECEIPT_SINK_PATTERN.test(content)
    ) {
      violations.push({
        file: repoRelative,
        rule: "LLM-CANDIDATE-H",
        detail:
          "Private context build and egress receipts are audit-only; remote prompts may consume only the validated SelectedContextStub projection.",
      });
    }

    if (V3_MULTI_PASS_WORKFLOW_PATTERN.test(content)) {
      const missingMarkers = V3_MULTI_PASS_REQUIRED_MARKERS.filter(
        (marker) => !content.includes(marker),
      );
      if (missingMarkers.length > 0) {
        violations.push({
          file: repoRelative,
          rule: "LLM-CANDIDATE-G",
          detail: `V3 multi-pass workflow must stay on the registered prompt/version/budget/call-log chain; missing ${missingMarkers.join(", ")}.`,
        });
      }
    }

    if (repoRelative === GOVERNED_CANDIDATE_MATERIALIZER_FILE) {
      const missingMarkers =
        GOVERNED_CANDIDATE_MATERIALIZER_REQUIRED_MARKERS.filter(
          (marker) => !content.includes(marker),
        );
      if (missingMarkers.length > 0) {
        violations.push({
          file: repoRelative,
          rule: "LLM-CANDIDATE-I",
          detail: `Governed candidate materialization must stay transactional and DRAFT/PENDING-only; missing ${missingMarkers.join(", ")}.`,
        });
      }
      if (GOVERNED_CANDIDATE_MATERIALIZER_FORBIDDEN_WRITE_PATTERN.test(content)) {
        violations.push({
          file: repoRelative,
          rule: "LLM-CANDIDATE-I",
          detail:
            "Governed candidate materialization may write only ArtifactBundle(DRAFT), ArtifactReview(PENDING), and its audit row.",
        });
      }
    }
  }

  const promotionFile = path.join(repoRoot, GOVERNED_CANDIDATE_PROMOTION_FILE);
  if (fs.existsSync(promotionFile)) {
    const content = fs.readFileSync(promotionFile, "utf8");
    // Rule J intentionally scans only the named promotion export. The end
    // anchor is part of the guard contract and is covered by its fixture test.
    const promotionStart = content.indexOf(
      "export async function promoteGovernedJudgementCandidateToTask",
    );
    const promotionEnd = content.indexOf(
      "export type GovernedCandidateReviewListItem",
      Math.max(0, promotionStart),
    );
    const promotionContent =
      promotionStart >= 0
        ? content.slice(
            promotionStart,
            promotionEnd > promotionStart ? promotionEnd : undefined,
          )
        : "";
    const missingMarkers = GOVERNED_CANDIDATE_PROMOTION_REQUIRED_MARKERS.filter(
      (marker) => !promotionContent.includes(marker),
    );
    if (missingMarkers.length > 0) {
      violations.push({
        file: GOVERNED_CANDIDATE_PROMOTION_FILE,
        rule: "LLM-CANDIDATE-J",
        detail: `Human candidate promotion must stay capability-gated, transactional, CREATE_TASK-only, and pending-approval-only; missing ${missingMarkers.join(", ")}.`,
      });
    }
    if (GOVERNED_CANDIDATE_PROMOTION_FORBIDDEN_PATTERN.test(promotionContent)) {
      violations.push({
        file: GOVERNED_CANDIDATE_PROMOTION_FILE,
        rule: "LLM-CANDIDATE-J",
        detail:
          "Human candidate promotion must not execute, send, write back, activate connectors, or write feedback, pattern, memory, or official intents.",
      });
    }
  }

  const closeoutContractFile = path.join(
    repoRoot,
    GOVERNED_CLOSEOUT_CONTRACT_FILE,
  );
  if (fs.existsSync(closeoutContractFile)) {
    const content = fs.readFileSync(closeoutContractFile, "utf8");
    const missingMarkers = GOVERNED_CLOSEOUT_CONTRACT_REQUIRED_MARKERS.filter(
      (marker) => !content.includes(marker),
    );
    if (missingMarkers.length > 0 || UNSAFE_REVIEW_STATE_PATTERN.test(content)) {
      violations.push({
        file: GOVERNED_CLOSEOUT_CONTRACT_FILE,
        rule: "LLM-CANDIDATE-K",
        detail: `Capability-closeout contracts must stay strict, candidate-only, and explicitly non-executing; missing ${missingMarkers.join(", ") || "safe review state"}.`,
      });
    }
  }

  const closeoutMaterializerFile = path.join(
    repoRoot,
    GOVERNED_CLOSEOUT_MATERIALIZER_FILE,
  );
  if (fs.existsSync(closeoutMaterializerFile)) {
    const content = fs.readFileSync(closeoutMaterializerFile, "utf8");
    const missingMarkers =
      GOVERNED_CLOSEOUT_MATERIALIZER_REQUIRED_MARKERS.filter(
        (marker) => !content.includes(marker),
      );
    if (missingMarkers.length > 0) {
      violations.push({
        file: GOVERNED_CLOSEOUT_MATERIALIZER_FILE,
        rule: "LLM-CANDIDATE-L",
        detail: `Capability-closeout materialization must remain grant-gated and DRAFT/PENDING-only; missing ${missingMarkers.join(", ")}.`,
      });
    }
    if (GOVERNED_CLOSEOUT_MATERIALIZER_FORBIDDEN_WRITE_PATTERN.test(content)) {
      violations.push({
        file: GOVERNED_CLOSEOUT_MATERIALIZER_FILE,
        rule: "LLM-CANDIDATE-L",
        detail:
          "Capability-closeout materialization may write only ArtifactBundle(DRAFT), ArtifactReview(PENDING), and its audit row.",
      });
    }
  }

  const closeoutReviewFile = path.join(repoRoot, GOVERNED_CLOSEOUT_REVIEW_FILE);
  if (fs.existsSync(closeoutReviewFile)) {
    const content = fs.readFileSync(closeoutReviewFile, "utf8");
    const sendStart = content.indexOf(
      "export async function prepareGovernedExternalSendHumanExecution",
    );
    const sendEnd = content.indexOf(
      "type ConfirmedJudgementSource",
      Math.max(0, sendStart),
    );
    const sendContent =
      sendStart >= 0
        ? content.slice(
            sendStart,
            sendEnd > sendStart ? sendEnd : undefined,
          )
        : "";
    const missingSendMarkers =
      GOVERNED_EXTERNAL_SEND_HANDOFF_REQUIRED_MARKERS.filter(
        (marker) => !sendContent.includes(marker),
      );
    if (missingSendMarkers.length > 0) {
      violations.push({
        file: GOVERNED_CLOSEOUT_REVIEW_FILE,
        rule: "LLM-CANDIDATE-M",
        detail: `External-send handoff must remain explicit-human, READY/PENDING, and non-sending; missing ${missingSendMarkers.join(", ")}.`,
      });
    }
    if (GOVERNED_EXTERNAL_SEND_HANDOFF_FORBIDDEN_PATTERN.test(sendContent)) {
      violations.push({
        file: GOVERNED_CLOSEOUT_REVIEW_FILE,
        rule: "LLM-CANDIDATE-M",
        detail:
          "External-send handoff must not send, mark execution complete, activate connectors, write official intents, or promote memory.",
      });
    }

    const memoryStart = content.indexOf(
      "export async function projectConfirmedArtifactToMemoryCandidate",
    );
    const memoryContent =
      memoryStart >= 0 ? content.slice(memoryStart) : "";
    const missingMemoryMarkers =
      GOVERNED_MEMORY_PROJECTION_REQUIRED_MARKERS.filter(
        (marker) => !memoryContent.includes(marker),
      );
    if (missingMemoryMarkers.length > 0) {
      violations.push({
        file: GOVERNED_CLOSEOUT_REVIEW_FILE,
        rule: "LLM-CANDIDATE-N",
        detail: `Confirmed-Artifact memory projection must stay human-gated and PENDING_VERIFICATION-only; missing ${missingMemoryMarkers.join(", ")}.`,
      });
    }
    if (GOVERNED_MEMORY_PROJECTION_FORBIDDEN_PATTERN.test(memoryContent)) {
      violations.push({
        file: GOVERNED_CLOSEOUT_REVIEW_FILE,
        rule: "LLM-CANDIDATE-N",
        detail:
          "Memory projection must not create canonical memory, MemoryPromotion, sends, connector state, or official intents.",
      });
    }
  }

  return {
    ok: violations.length === 0,
    violations,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = runLlmCandidateBoundaryCheck();
  if (!result.ok) {
    console.error("LLM candidate boundary violations:");
    for (const violation of result.violations) {
      console.error(`- [${violation.rule}] ${violation.file}: ${violation.detail}`);
    }
    process.exit(1);
  }

  console.log("LLM candidate boundary check passed.");
}
