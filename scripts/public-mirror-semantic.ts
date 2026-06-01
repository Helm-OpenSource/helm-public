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

/** Case-insensitive char class for a lowercase ascii letter, e.g. m → [mM]. */
function ciChars(value: string): string {
  return value
    .split("")
    .map((c) => (/[a-z]/.test(c) ? `[${c}${c.toUpperCase()}]` : c))
    .join("");
}

/**
 * Match a tenant slug even when it is embedded in a camelCase / PascalCase
 * identifier or a path segment — the blind spot that once let a tenant-named
 * Core helper ship in the mirror. `\b${slug}\b` misses a capitalized slug sitting
 * after a lowercase letter because that junction is not a `\b`. This adds:
 *   - (case-insensitive) plain word-boundary slug;
 *   - (case-insensitive) a camelCase hump: a letter/digit immediately followed by
 *     the slug (e.g. `get<Slug>`, `x<Slug>`);
 *   - (**case-sensitive** uppercase hump) the slug immediately followed by an
 *     UPPERCASE letter (e.g. `<Slug>Daily`).
 * The uppercase-hump branch is deliberately case-sensitive: under a global `/i`
 * flag `[A-Z]` would also match lowercase, so an unrelated word like `<slug>x`
 * would false-positive. Built with explicit case-insensitive
 * char classes for the slug instead of the `/i` flag so the `[A-Z]` stays literal.
 * Hyphen/underscore/slash separators are already word boundaries, so kebab and
 * path forms (`<slug>-daily`, `a/<slug>/b`) are covered by the `\b` alternative.
 */
function slugPattern(value: string): RegExp {
  const ci = ciChars(value);
  // (a) plain word-boundary slug (ci); (b) slug glued AFTER a letter/digit (ci);
  // (c) slug glued BEFORE an UPPERCASE letter (case-sensitive [A-Z]).
  return new RegExp(`(\\b${ci}\\b)|([A-Za-z0-9]${ci})|(${ci}[A-Z])`);
}

function semanticRule(kind: "tenant-slug" | "customer-name", value: string): string {
  return ["semantic", kind, value].join(":");
}

function customerHostPattern(labelParts: ReadonlyArray<string>, tld: string): RegExp {
  const domain = `${labelParts.join("")}\\.${tld}`;
  return new RegExp(`(?:^|[^\\w.-])[\\w.-]*${domain}\\b`, "i");
}

const tenantSlugPrimary = ["gua", "ngpu"].join("");
const tenantSlugExternalCase = ["mi", "dun"].join("");
const tenantSlugZhaojiling = ["zhao", "jiling"].join("");
const tenantSlugAicaitest = ["aicai", "test"].join("");
const customerNameExternalCaseCn = ["mi", "dun-cn"].join("");
const customerNamePrimaryCn = ["gua", "ngpu-cn"].join("");

// repo-split internal entrypoints that must not leak into the public mirror's
// entry docs (README / docs index): the private target-repo names and the
// tenant extension source path. These name the commercial topology and are
// internal-only, so the open Core mirror must not advertise them.
const splitRepoName = (a: string, b: string) => [a, b].join("-");
const repoSplitNames: ReadonlyArray<string> = [
  splitRepoName("helm", "packs"),
  splitRepoName("helm", "overlays"),
  splitRepoName("helm", "control-plane"),
];
const tenantExtensionPath = ["extensions", tenantSlugPrimary].join("/");

/** Tenant slugs, scanned in BOTH file content and the file's relative path,
 *  with camelCase-aware matching (see slugPattern). */
const TENANT_SLUGS: ReadonlyArray<string> = [
  tenantSlugPrimary,
  tenantSlugExternalCase,
  tenantSlugZhaojiling,
  tenantSlugAicaitest,
];

const PRIVATE_SEMANTIC_PATTERNS: ReadonlyArray<PrivateSemanticPattern> = [
  ...TENANT_SLUGS.map((slug) => ({
    rule: semanticRule("tenant-slug", slug),
    pattern: slugPattern(slug),
  })),
  {
    rule: semanticRule("customer-name", customerNameExternalCaseCn),
    pattern: new RegExp(["米", "盾", "云?"].join(""), "u"),
  },
  {
    rule: semanticRule("customer-name", customerNamePrimaryCn),
    pattern: new RegExp(["光", "[普谱潽]"].join(""), "u"),
  },
  {
    rule: ["semantic", "person-name", "qian-zhilong"].join(":"),
    pattern: new RegExp(["钱", "志", "龙"].join(""), "u"),
  },
  {
    rule: ["semantic", "person-name", "wang-lizhen"].join(":"),
    pattern: new RegExp([["王", "丽", "珍"].join(""), ["wang", "lizhen"].join("")].join("|"), "i"),
  },
  {
    rule: ["semantic", "person-name", "li-jianle"].join(":"),
    pattern: new RegExp([["李", "建", "乐"].join(""), ["li", "jianle"].join("")].join("|"), "i"),
  },
  {
    rule: ["semantic", "internal-host", "aliyun-mysql-rds-host"].join(":"),
    pattern: /[\w.-]+\.mysql\.rds\.aliyuncs\.com/i,
  },
  {
    rule: ["semantic", "internal-host", "customer-domain-a-host"].join(":"),
    pattern: customerHostPattern(["aicai", "group"], "com"),
  },
  {
    rule: ["semantic", "internal-host", "customer-domain-c-host"].join(":"),
    pattern: customerHostPattern(["zhao", "jiling"], "com"),
  },
  {
    rule: ["semantic", "internal-host", "customer-domain-d-host"].join(":"),
    pattern: customerHostPattern(["hz", "miz"], "cn"),
  },
  {
    rule: ["semantic", "internal-host", "customer-domain-e-host"].join(":"),
    pattern: customerHostPattern(["360", "amc"], "cn"),
  },
  {
    rule: ["semantic", "internal-ip", "rfc1918"].join(":"),
    pattern: /\b(?:10(?:\.\d{1,3}){3}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}|192\.168(?:\.\d{1,3}){2})\b/,
  },
  ...repoSplitNames.map((name) => ({
    rule: ["semantic", "split-repo", name].join(":"),
    // Match the bare repo name as a word (e.g. `helm-packs`); the hyphenated
    // form does not collide with ordinary prose.
    pattern: new RegExp(`(^|[^\\w-])${name}([^\\w-]|$)`),
  })),
  {
    rule: ["semantic", "private-path", tenantExtensionPath].join(":"),
    pattern: new RegExp(tenantExtensionPath.replace(/\//g, "\\/")),
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
  // Public entry documentation — these are the first thing a reader of the open
  // mirror sees, so they must not leak tenant slugs or repo-split internals.
  "README.md",
  "README.en.md",
]);

// Public ENTRY documentation that is also scanned for the leak set: the docs
// index + status registry a reader of the mirror lands on first. (Deep internal
// planning/review docs under docs/** are governed by the curated
// public-release-guard policy-descriptor allowlist, not re-scanned here, to
// avoid double-flagging files that legitimately name a tenant to explain a
// boundary. The mirror EXCLUDES these two via PUBLIC_MIRROR_PRIVATE_FILES, so in
// a correctly-built mirror they are absent; this list is the fail-closed
// backstop that trips if either is ever shipped again.)
const SEMANTIC_ENTRY_DOC_FILES = new Set(["docs/README.md", "docs/STATUS.md"]);

const SEMANTIC_ALLOW_FILES = new Set([
  "scripts/public-release-guard.ts",
  "scripts/public-mirror-semantic.ts",
  "scripts/public-mirror-smoke.ts",
  // The README projection builder necessarily names the repo-split target repos
  // in its doc comment in order to strip that banner. It is mirror tooling, not
  // public-facing content (and is itself a PRIVATE_FILE excluded from mirrors).
  "scripts/build-public-readme.ts",
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
  // Public entry docs (docs index + status): fail-closed backstop.
  if (SEMANTIC_ENTRY_DOC_FILES.has(normalized)) return true;
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
    ".md",
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

    // PATH scan (camelCase-aware): a tenant slug in the file's own relative path
    // is a leak regardless of file type — the class of leak (a tenant-named Core
    // helper) that previously slipped through undetected. Runs for any file under
    // a semantic scan root (not just text files, and even for files whose CONTENT
    // we skip, e.g. tests), but honors the allow-list.
    const [pathRoot] = relativePath.split("/");
    const pathInScanScope =
      SEMANTIC_SCAN_ROOTS.has(pathRoot) && !SEMANTIC_ALLOW_FILES.has(relativePath);
    if (pathInScanScope) {
      for (const slug of TENANT_SLUGS) {
        if (slugPattern(slug).test(relativePath)) {
          violations.push({
            rule: `${semanticRule("tenant-slug", slug)}:path`,
            path: relativePath,
            line: 0,
            excerpt: relativePath,
          });
        }
      }
    }

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
