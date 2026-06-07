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
  /\b(JudgementCandidate|LLMCriticResult|judgementCandidate|llmCriticResult|reviewJudgementBoundaryWithLLM|CounterfactualReviewerOutput|reviewCounterfactualWithLLM|SelectedContextStub|LLMContextSelectionReceipt|RuntimePermissionProfile|resolveRuntimePermissionForCapability|SkillRevisionCandidate)\b/;
const UNSAFE_REVIEW_STATE_PATTERN =
  /reviewState\s*:\s*["'](?:approved|committed|executed|auto_promote|production_ready)["']/i;
const UNSAFE_STATE_ENUM_DEFINITION_PATTERN =
  /\b(?:JUDGEMENT_REVIEW_STATES|judgementReviewStateSchema|COUNTERFACTUAL_REVIEW_STATES|counterfactualReviewStateSchema)\b[\s\S]{0,500}["'](?:approved|committed|executed|auto_promote|production_ready)["']/i;

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

// v2 rule E: the audit-only selection receipt must not be serialized into an
// LLM prompt. Flag a prompt-building module that also references the receipt.
const SELECTOR_RECEIPT_PATTERN = /\b(LLMContextSelectionReceipt|selectorReceipt|selectionReceipt)\b/;
const PROMPT_BUILDER_PATTERN = /\buserPrompt\s*:/;

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

    if (PROMPT_BUILDER_PATTERN.test(content) && SELECTOR_RECEIPT_PATTERN.test(content)) {
      violations.push({
        file: repoRelative,
        rule: "LLM-CANDIDATE-E",
        detail:
          "Selection receipt content is audit-only; it must not be passed into an LLM prompt. Use SelectedContextStub.",
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
