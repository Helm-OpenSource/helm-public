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
  /\b(JudgementCandidate|LLMCriticResult|judgementCandidate|llmCriticResult|reviewJudgementBoundaryWithLLM)\b/;
const UNSAFE_REVIEW_STATE_PATTERN =
  /reviewState\s*:\s*["'](?:approved|committed|executed|auto_promote|production_ready)["']/i;
const UNSAFE_STATE_ENUM_DEFINITION_PATTERN =
  /\b(?:JUDGEMENT_REVIEW_STATES|judgementReviewStateSchema)\b[\s\S]{0,500}["'](?:approved|committed|executed|auto_promote|production_ready)["']/i;

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

    if (!isCandidateAware(content)) {
      continue;
    }

    const repoRelative = toRepoRelative(repoRoot, file);
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
