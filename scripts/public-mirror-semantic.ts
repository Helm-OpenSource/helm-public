import {
  readdirSync,
  readFileSync,
  statSync,
} from "node:fs";
import path from "node:path";

export type PublicMirrorSemanticViolation = {
  readonly rule: string;
  readonly path: string;
  readonly line: number;
  readonly excerpt: string;
};

type PrivateSemanticPattern = {
  readonly rule: string;
  readonly pattern: RegExp;
};

function wordPattern(value: string): RegExp {
  return new RegExp(`\\b${value}\\b`, "i");
}

function semanticRule(kind: "tenant-slug" | "customer-name", value: string): string {
  return ["semantic", kind, value].join(":");
}

const tenantSlugGuangpu = ["gua", "ngpu"].join("");
const tenantSlugMidun = ["mi", "dun"].join("");
const tenantSlugZhaojiling = ["zhao", "jiling"].join("");
const tenantSlugAicaitest = ["aicai", "test"].join("");
const customerNameMidunCn = ["mi", "dun-cn"].join("");
const customerNameGuangpuCn = ["gua", "ngpu-cn"].join("");

const PRIVATE_SEMANTIC_PATTERNS: ReadonlyArray<PrivateSemanticPattern> = [
  {
    rule: semanticRule("tenant-slug", tenantSlugGuangpu),
    pattern: wordPattern(tenantSlugGuangpu),
  },
  {
    rule: semanticRule("tenant-slug", tenantSlugMidun),
    pattern: wordPattern(tenantSlugMidun),
  },
  {
    rule: semanticRule("tenant-slug", tenantSlugZhaojiling),
    pattern: wordPattern(tenantSlugZhaojiling),
  },
  {
    rule: semanticRule("tenant-slug", tenantSlugAicaitest),
    pattern: wordPattern(tenantSlugAicaitest),
  },
  {
    rule: semanticRule("customer-name", customerNameMidunCn),
    pattern: new RegExp(["米", "盾", "云?"].join(""), "u"),
  },
  {
    rule: semanticRule("customer-name", customerNameGuangpuCn),
    pattern: new RegExp(["光", "[普谱]"].join(""), "u"),
  },
];

const SEMANTIC_SCAN_ROOTS = new Set([
  "app",
  "components",
  "data",
  "features",
  "hooks",
  "lib",
  "prisma",
  "scripts",
  "tests",
]);

const SEMANTIC_SCAN_ROOT_FILES = new Set([
  ".env.example",
  ".dockerignore",
  "Dockerfile",
  "instrumentation.ts",
  "middleware.ts",
  "next.config.ts",
  "package.json",
  "playwright.config.ts",
  "tsconfig.json",
]);

const SEMANTIC_ALLOW_FILES = new Set([
  "scripts/public-release-guard.ts",
  "scripts/public-mirror-semantic.ts",
  "scripts/public-mirror-smoke.ts",
]);

const SKIP_DIRS = new Set([
  ".git",
  ".next",
  "coverage",
  "node_modules",
  "playwright-report",
  "test-results",
]);

function normalizeRelativePath(relativePath: string): string {
  return relativePath.split(path.sep).filter(Boolean).join("/");
}

function shouldScanSemanticPath(relativePath: string): boolean {
  const normalized = normalizeRelativePath(relativePath);
  if (!normalized) return false;
  if (SEMANTIC_ALLOW_FILES.has(normalized)) return false;
  const basename = path.basename(normalized);
  if (basename.includes(".test.") || basename.includes(".spec.")) return false;
  if (SEMANTIC_SCAN_ROOT_FILES.has(normalized)) return true;
  const [root] = normalized.split("/");
  return SEMANTIC_SCAN_ROOTS.has(root);
}

function isProbablyTextFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  if (!ext) return true;
  return [
    ".cjs",
    ".css",
    ".csv",
    ".env",
    ".js",
    ".json",
    ".jsx",
    ".mjs",
    ".prisma",
    ".sql",
    ".ts",
    ".tsx",
    ".txt",
    ".yaml",
    ".yml",
  ].includes(ext);
}

export function runPublicMirrorSemanticSmoke(repoRoot: string): {
  scannedFiles: number;
  violations: PublicMirrorSemanticViolation[];
} {
  const root = path.resolve(repoRoot);
  let scannedFiles = 0;
  const violations: PublicMirrorSemanticViolation[] = [];

  function scanEntry(entryPath: string): void {
    const stats = statSync(entryPath);
    const relativePath = normalizeRelativePath(path.relative(root, entryPath));
    const basename = path.basename(entryPath);

    if (stats.isDirectory()) {
      if (SKIP_DIRS.has(basename)) return;
      for (const child of readdirSync(entryPath)) {
        scanEntry(path.join(entryPath, child));
      }
      return;
    }

    if (!stats.isFile()) return;
    if (!shouldScanSemanticPath(relativePath)) return;
    if (!isProbablyTextFile(entryPath)) return;

    scannedFiles += 1;
    const lines = readFileSync(entryPath, "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const { rule, pattern } of PRIVATE_SEMANTIC_PATTERNS) {
        if (!pattern.test(line)) continue;
        violations.push({
          rule,
          path: relativePath,
          line: index + 1,
          excerpt: line.trim().slice(0, 220),
        });
      }
    });
  }

  scanEntry(root);
  return { scannedFiles, violations };
}
