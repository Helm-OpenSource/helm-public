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
  /\b(JudgementCandidate|LLMCriticResult|judgementCandidate|llmCriticResult|reviewJudgementBoundaryWithLLM|CounterfactualReviewerOutput|reviewCounterfactualWithLLM|SelectedContextStub|LLMContextSelectionReceipt|RuntimePermissionProfile|resolveRuntimePermissionForCapability|SkillRevisionCandidate|ModelCapabilityProfile|RichLocalContextBundle|ContextProjectionReceipt|JudgementProposalBundle|SourceToSignalProposalBundle|LLMTaskTrajectoryReceipt)\b/;
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
      /\b(?:db|tx|prisma)\.(?:preferenceSignal|patternFact|approvalTask|memoryPromotion|recommendationFeedback)\.(?:create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/,
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
      repoRelative !== "lib/llm/intelligence-contracts-v3.ts" &&
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
