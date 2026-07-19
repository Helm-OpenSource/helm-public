#!/usr/bin/env tsx
/**
 * public-release-guard
 *
 * Independent gate per release readiness correction §一 #4.
 * Enforced in PR CI repo guards and manually before generating a public mirror
 * or tagging a public release. NOT part of `npm run check:boundaries` main
 * chain (per owner decision; revisit in June window).
 *
 * Rules (fail = blocker):
 *   1. Tenant-slug leakage: configured private tenant slugs must not appear in
 *      public-mirror-eligible files.
 *   2. Internal host leakage: production / staging RDS hosts must
 *      not appear in public-mirror-eligible files.
 *   3. Private-path reference: links / paths pointing into
 *      tenant-private, internal, or commercial-private asset roots from
 *      public-mirror-eligible files.
 *   4. Commercial entitlement boundary misuse: public source must not use
 *      Deployment Profile env / BUILD_EDITION / NEXT_PUBLIC commercial flags
 *      as license, source, security, or entitlement gates.
 *   5. License / trademark hygiene: public release roots must retain
 *      Apache-2.0 license metadata, must not ship conflicting SPDX headers,
 *      and must not describe Helm trademark or Powered-by-Helm runtime
 *      requirements as an Apache-2.0 enforcement mechanism.
 *   6. Debug API route presence: `app/api/debug-*` and `app/api/debug_*`
 *      directories must not exist. The Next.js App Router exposes any
 *      `route.{ts,tsx,js,jsx}` under such a path as a publicly-reachable
 *      endpoint; "debug" is a semantic admission that the handler was
 *      not designed for an untrusted caller. A legitimate diagnostic
 *      endpoint belongs under `app/api/diagnostics/` or
 *      `app/api/observability/` with explicit cron-token / session
 *      authorization. Triggered by the 2026-05-20 fa34d8c1b incident
 *      where `app/api/debug-env/route.ts` (no auth, returned process.env
 *      length + head/tail fingerprints) reached main alongside
 *      legitimate DingTalk delivery work.
 *
 * Files inside private roots are not scanned — they are excluded
 * from the public mirror by definition. An explicit allow-list
 * carries policy-describing files that legitimately mention slugs
 * as deprecation targets.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

export type PublicReleaseGuardOptions = {
  readonly repoRoot?: string;
  readonly knownLeakedTokenSha256?: ReadonlySet<string>;
  readonly requirePrivateRootsAbsent?: boolean;
  readonly includeLocalBuildArtifacts?: boolean;
};

export type PublicReleaseGuardResult = {
  readonly scannedFiles: number;
  readonly violations: ReadonlyArray<Violation>;
  readonly publicPackageManifest?: PublicPackageManifestProjection;
};

// Tenant slugs that must not leak to the public mirror. Keep the values
// fragment-built so the public mirror tooling can ship without advertising
// tenant names as plain text.
const TENANT_SLUG_PRIMARY = ["gua", "ngpu"].join("");
const TENANT_SLUG_EXTERNAL_CASE_SYSTEM = ["mi", "dun"].join("");
const TENANT_SLUG_LEGACY_OPERATOR = ["zhao", "jiling"].join("");
const TENANT_SLUG_LEGACY_TEST = ["aicai", "test"].join("");

const TENANT_SLUG_BLACKLIST: ReadonlyArray<string> = [
  TENANT_SLUG_PRIMARY,
  TENANT_SLUG_EXTERNAL_CASE_SYSTEM,
  TENANT_SLUG_LEGACY_OPERATOR,
  TENANT_SLUG_LEGACY_TEST,
];

/** Case-insensitive char class for a lowercase ascii letter, e.g. m → [mM]. */
function ciSlugChars(slug: string): string {
  return slug
    .split("")
    .map((c) => (/[a-z]/.test(c) ? `[${c}${c.toUpperCase()}]` : c))
    .join("");
}

/**
 * Match a tenant slug in content even when it is embedded in a camelCase /
 * PascalCase identifier — the blind spot that once let a tenant-named helper ship
 * in the public mirror. `\b<slug>\b` misses a capitalized slug sitting after a
 * lowercase letter (e.g. `…d<Slug>…`) because that junction is not a `\b`. This
 * adds:
 *   - (case-insensitive) plain word-boundary slug;
 *   - (case-insensitive) the slug glued after a letter/digit (camelCase hump);
 *   - (**case-sensitive**) the slug immediately before an UPPERCASE letter.
 * The uppercase-hump branch stays case-sensitive so an unrelated lowercase suffix
 * (e.g. `<slug>x`) does not false-positive under a global `/i` flag;
 * the slug itself is matched case-insensitively via explicit char classes.
 * Hyphen/underscore/slash separators are already `\b`, so kebab-case and path
 * forms (`<slug>-daily`, `a/<slug>/b`) stay covered.
 */
function tenantSlugPattern(slug: string): RegExp {
  const ci = ciSlugChars(slug);
  return new RegExp(`(\\b${ci}\\b)|([A-Za-z0-9]${ci})|(${ci}[A-Z])`);
}

function customerHostPattern(labelParts: ReadonlyArray<string>, tld: string): RegExp {
  const domain = `${labelParts.join("")}\\.${tld}`;
  return new RegExp(`(?:^|[^\\w.-])[\\w.-]*${domain}\\b`, "i");
}

/** True if a file's relative PATH names a tenant slug (camelCase-aware). A
 *  tenant-named filename is a leak regardless of the file's contents. */
function pathNamesTenantSlug(relativePath: string): string | null {
  for (const slug of TENANT_SLUG_BLACKLIST) {
    if (tenantSlugPattern(slug).test(relativePath)) return slug;
  }
  return null;
}

// Customer display names that must not leak through generated release
// artifacts. Public docs can still carry explicitly reviewed case-study
// wording; generated source maps, SBOMs, and Docker context files cannot.
const CUSTOMER_NAME_BLACKLIST: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  {
    name: [TENANT_SLUG_EXTERNAL_CASE_SYSTEM, "cn"].join("-"),
    pattern: new RegExp(["米", "盾", "云?"].join(""), "u"),
  },
  {
    name: [TENANT_SLUG_PRIMARY, "cn"].join("-"),
    pattern: new RegExp(["光", "[普谱潽]"].join(""), "u"),
  },
];

const PRIVATE_PERSON_NAME_BLACKLIST: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  { name: "qian-zhilong", pattern: new RegExp(["钱", "志", "龙"].join(""), "u") },
  {
    name: "wang-lizhen",
    pattern: new RegExp([["王", "丽", "珍"].join(""), ["wang", "lizhen"].join("")].join("|"), "i"),
  },
  {
    name: "li-jianle",
    pattern: new RegExp([["李", "建", "乐"].join(""), ["li", "jianle"].join("")].join("|"), "i"),
  },
];

// Internal infrastructure hosts that must not leak.
const INTERNAL_HOST_PATTERNS: ReadonlyArray<{ name: string; pattern: RegExp }> =
  [
    { name: "rm-shuyao", pattern: /rm-shuyao[\w.-]*\.aliyuncs\.com/i },
    { name: "aliyun-mysql-rds-host", pattern: /[\w.-]+\.mysql\.rds\.aliyuncs\.com/i },
    { name: "aliyun-rds-host", pattern: /[\w.-]+\.rds\.aliyuncs\.com/i },
    { name: "customer-domain-a-host", pattern: customerHostPattern(["aicai", "group"], "com") },
    { name: "customer-domain-b-host", pattern: customerHostPattern(["aicai", "test"], "com") },
    { name: "customer-domain-c-host", pattern: customerHostPattern(["zhao", "jiling"], "com") },
    { name: "customer-domain-d-host", pattern: customerHostPattern(["hz", "miz"], "cn") },
    { name: "customer-domain-e-host", pattern: customerHostPattern(["360", "amc"], "cn") },
  ];

// Owner-approved public disclosure addresses. These are intentionally narrow:
// the guard still blocks the underlying private-looking domain / slug anywhere
// else, and it still blocks other addresses on the same domain.
const PUBLIC_CONTACT_EMAIL_ALLOW_LIST: ReadonlySet<string> = new Set([
  "Helm-security@zhaojiling.com",
]);

const PUBLIC_CONTACT_EMAIL_DOCUMENT_ALLOW_LIST: ReadonlySet<string> = new Set([
  "SECURITY.md",
  "SECURITY.en.md",
  "docs/pilot/PUBLIC_TRIAL_RUNBOOK.md",
]);

const RFC1918_IPV4_PATTERN =
  /\b(?:10(?:\.\d{1,3}){3}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}|192\.168(?:\.\d{1,3}){2})\b/;

const CN_MOBILE_PATTERN = /(?<![\d+])(?:\+?86[-\s]?)?1[3-9]\d{9}\b/g;
const SYNTHETIC_CN_MOBILE_NUMBERS = new Set([
  "13800000000",
  "13800138000",
  "13800009999",
  "13800001111",
  "13800002222",
  "13800003333",
  "13800004444",
  "13900139000",
  "13900000000",
]);

// Placeholder credential values that are explicitly OK to ship in docs / examples.
// Anything else captured by URL_EMBEDDED_CREDENTIAL_PATTERN is treated as a
// real credential leak.
const CREDENTIAL_PLACEHOLDERS: ReadonlySet<string> = new Set([
  "",
  "***",
  "root",
  "pass",
  "password",
  "changeme",
  "example",
  "secret",
  "your-password",
  "your_password",
  "yourpassword",
]);

// URL-embedded credential pattern: scheme://user:password@host
const URL_EMBEDDED_CREDENTIAL_PATTERN =
  /[a-z][a-z0-9+.-]*:\/\/[^\s:@/'"`]+:([^\s@'"`]+)@/gi;

// Known-leaked credential SHA-256 deny list. The literal value is NEVER
// stored in this source — only the hash. The guard hashes every candidate
// substring on each scanned line and fails if any hash matches.
//
// To add a new entry without leaking the value into source:
//   node -e "console.log(require('crypto').createHash('sha256').update(process.argv[1]).digest('hex'));" "<value>"
//
// Rotated credentials still belong on this list — git history retains the
// original value, and the guard's job is to prevent re-introduction into
// the working tree.
const KNOWN_LEAKED_TOKEN_SHA256: ReadonlySet<string> = new Set([
  // Rotated MySQL root host marker (P0 redaction 2026-04-27).
  "1f2690821816efa16646ccb339b92178107ac6a29d98938379002868c86736e6",
]);

// Characters that can plausibly appear inside a leaked credential string.
// `.` is intentionally NOT in the set: dotted property paths and version
// strings (e.g. `runtime.v21.runThread.threadId`) are ubiquitous in source
// and would dominate false positives. JWT-shaped credentials (xxx.yyy.zzz)
// would need a dedicated rule and are not in scope today.
const CANDIDATE_TOKEN_PATTERN = /[A-Za-z0-9_\-+/=]{8,128}/g;

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

// Assignment-form credential rule (Rule C). Unlike the earlier
// keyword-anywhere + entropy-anywhere heuristic — which drove ~70+ false
// positives on PascalCase identifiers (`Phase3qRejectionError`) and test
// salts and was removed — this rule requires the credential keyword to sit
// in ASSIGNMENT position (`KEYWORD = value` / `KEYWORD: value`) AND the
// assigned value to be a high-entropy token. Measured false-positive count
// across app/features/lib/scripts/docs/prisma on the current tree: 0, while
// it still catches standalone leaks like the rotated dev RDS example removed
// 2026-04-27 (`DB_PASSWORD=<entropy>`, `client_secret: <entropy>`).
//
// Captures: group 1 = keyword-bearing identifier, group 2 = assigned value.
const ASSIGNMENT_CREDENTIAL_PATTERN =
  /\b([A-Za-z0-9_]*?(?:password|secret|token|api[_-]?key|private[_-]?key|credential|pwd))\s*[:=]\s*['"`]?([^\s'"`,;)}{]{8,})/gi;

// Intentionally-public high-entropy assignment values (e.g. a published
// sample fixture token) may be permitted by SHA-256 without storing the
// plaintext here — same discipline as KNOWN_LEAKED_TOKEN_SHA256. Empty today.
//   node -e "console.log(require('crypto').createHash('sha256').update(process.argv[1]).digest('hex'));" "<value>"
const ALLOWED_ASSIGNMENT_VALUE_SHA256: ReadonlySet<string> = new Set<string>([]);

const PLACEHOLDER_TOKEN_PATTERN =
  /^(\*+|<[^>]+>|x+|\$\{[^}]+\}|password|secret|token|key|api_key|private_key|credential|pwd|root|pass|example|changeme|todo|tbd|na|n\/a|null|undefined|true|false)$/i;

function looksLikeHighEntropyToken(token: string): boolean {
  // Real-world credentials in the formats Helm accepts (Aliyun, Stripe,
  // OpenAI, AWS, generic random) almost always satisfy:
  //   length >= 16   AND
  //   contains digit AND upper-case letter AND lower-case letter
  // Identifier-like strings in the codebase (PascalCase types, kebab-case
  // rule names, snake_case env var names) typically miss at least one of
  // these — they lack digits or are single-case.
  if (token.length < 16) return false;
  if (PLACEHOLDER_TOKEN_PATTERN.test(token)) return false;
  if (!/\d/.test(token)) return false;
  if (!/[A-Z]/.test(token)) return false;
  if (!/[a-z]/.test(token)) return false;
  return true;
}

// Tenant / internal roots that are private by policy and excluded from the
// public mirror. Files inside these roots are not scanned. References to
// these paths from outside are flagged.
const TENANT_PRIVATE_ROOTS: ReadonlyArray<string> = [
  ["extensions", TENANT_SLUG_PRIMARY].join("/"),
  [
    "extensions",
    TENANT_SLUG_PRIMARY,
    [TENANT_SLUG_EXTERNAL_CASE_SYSTEM, "integrate"].join("-"),
    "lib",
    "helm-readout",
  ].join("/"),
  "extensions/helm-implementation-console",
  "extensions/helm-implementation-console/private",
  ["app/(workspace)", TENANT_SLUG_PRIMARY].join("/"),
  ["app/(workspace)", TENANT_SLUG_PRIMARY, TENANT_SLUG_EXTERNAL_CASE_SYSTEM].join("/"),
  [
    "app/api/extensions",
    TENANT_SLUG_PRIMARY,
    [TENANT_SLUG_EXTERNAL_CASE_SYSTEM, "integrate"].join("-"),
  ].join("/"),
  ["app/api/extensions", TENANT_SLUG_PRIMARY].join("/"),
  ["app/(workspace)", [TENANT_SLUG_PRIMARY, "signals"].join("-")].join("/"),
  ["features", [TENANT_SLUG_PRIMARY, "signals"].join("-")].join("/"),
  "docs/internal",
  ".agents/skills/helm-cloud-zip-deploy",
];

// Commercial-private asset roots excluded from public mirrors. These are
// root-level conventions for future commercial assets; keeping them here
// prevents customer proof, customer-specific goldens, paid packs, and
// official production adapters from accidentally becoming public source
// artifacts.
const COMMERCIAL_PRIVATE_ROOTS: ReadonlyArray<string> = [
  "customer-eval-goldens",
  "customer-proof-packs",
  "commercial-workflow-packs",
  "paid-connectors",
  "official-connectors/production",
  "enterprise-entitlements",
  "helm-cloud-control-plane",
  "partner-agreements",
];

const PRIVATE_ROOTS: ReadonlyArray<string> = [
  ...TENANT_PRIVATE_ROOTS,
  ...COMMERCIAL_PRIVATE_ROOTS,
];

export const PUBLIC_MIRROR_PRIVATE_ROOTS: ReadonlyArray<string> = PRIVATE_ROOTS;

const TENANT_SLUG_PRIMARY_UPPER = ["GUA", "NGPU"].join("");

function primaryTenantReviewDoc(suffix: string): string {
  return ["docs/reviews/HELM", TENANT_SLUG_PRIMARY_UPPER, suffix].join("_");
}

// Specific files that are internal-only by policy and excluded from the
// public mirror. The file's own header should declare its internal status.
// Examples: the relocated long-form README that carries historical context.
const PRIVATE_FILES: ReadonlyArray<string> = [
  "docs/HELM_INTERNAL_FREEZE_REFERENCE.md",
  // Note (split-gap close): two tests previously listed here were resolved by
  // location instead of per-file exclusion, so the split never drops them:
  //  - tenant readout degraded-mode test (reads tenant-private readout pages,
  //    asserts on customer strings) → MOVED to the tenant extension tests root,
  //    covered by the tenant private
  //    root + the private split mapping to the overlays repo.
  //  - reports-extension-fail-open.test.ts → it is Core-NEUTRAL (tests
  //    resolveReportsExtensionAccessSafely from ./registry; extension IDs are
  //    fragment-built so no literal tenant slug appears), so it now SHIPS in the
  //    Core mirror as a first-party fail-open contract test. Removing the
  //    incorrect exclusion fixes a Core test being lost from the public mirror.
  // Note: the two tenant-coupled registry tests that used to be private-file
  // entries here (features/settings/solution-extension-actions.test.ts,
  // features/approvals/approval-bi-board-availability.test.ts) were MOVED into
  // the tenant extension tests root — so they are now covered by the
  // private root AND the split mapping to the overlays repo (no split gap). No
  // per-file allowlist entry needed.
  "scripts/decision-first-boundary-check.ts",
  "scripts/helm-self-check.ts",
  "scripts/helm-self-check-refactored.ts",
  "scripts/self-check/config.ts",
  // Repo-split migration tooling. The companion planning docs live under
  // docs/internal/, which is already excluded as a private root; do not list
  // those doc filenames here because this guard source itself ships in the
  // public mirror.
  "scripts/repo-split-manifest.ts",
  "scripts/repo-split-mapping.ts",
  "scripts/repo-split-execute.ts",
  "scripts/check-core-no-pack-import.ts",
  // Pack-bootstrap aggregator: the only file that names which Packs/Overlays a
  // deployment wires. Excluded from the public Core mirror so instrumentation.ts
  // (which ships) imports it generically and degrades to Core-only when absent.
  "extensions/pack-bootstrap.ts",
  "PLANS.md",
  // Public mirror bootstrap: docs with private tenant/customer terms are kept
  // out until they are rewritten as generic open-core documentation. The
  // Golden Path HSI and case-management sample anchors now ship as public-safe
  // projections, so they are intentionally not listed here.
  "docs/brand/HELM_OPEN_SOURCE_COMMUNITY_DISTRIBUTION_PLAN_V1.md",
  "docs/product/HELM_EXTENSION_BUNDLE_MANIFEST_SCHEMA_DRAFT_V1.md",
  "docs/product/HELM_EXTERNAL_RESOURCE_SIGNAL_INTEGRATION_METHOD_V1.md",
  "docs/product/HELM_OPEN_SOURCE_AND_CLOUD_TRIAL_RELEASE_READINESS_CORRECTION_V1.md",
  "docs/product/HELM_TENANT_RESOURCE_INTEGRATION_GOVERNANCE_PRD_V1.md",
  "docs/product/HELM_TENANT_RESOURCE_PHASE_4_TENANT_EXTENSION_ADOPTION_CONTRACT_V1.md",
  "docs/reviews/HELM_BI_REPORT_SKILL_PUSH_DRY_RUN_SKELETON_REPORT_V1.md",
  "docs/reviews/HELM_EXTENSION_BUNDLE_READ_ONLY_VALIDATION_ADOPTION_PLAN_V1.md",
  "docs/reviews/HELM_EXTENSION_BUNDLE_READ_ONLY_VALIDATION_ADOPTION_REPORT_V1.md",
  primaryTenantReviewDoc("EXTENSION_COLLABORATION_FREEZE_REPORT_V1.md"),
  primaryTenantReviewDoc("SEAT_PROFILE_EXTENSION_KEY_BACKFILL_REPORT_V1.md"),
  "docs/reviews/HELM_MONITOR_SUBSTRATE_READ_ONLY_ADOPTION_REPORT_V1.md",
  "docs/reviews/HELM_MULTI_TENANT_EXTENSION_HARNESS_REPORT_V1.md",
  "docs/reviews/HELM_PAGE_PRESENTATION_PRIORITY_ALIGNMENT_FREEZE_REPORT_V1.md",
  "docs/reviews/HELM_REMAINING_DIRTY_WORKTREE_TRIAGE_V1.md",
  "docs/reviews/HELM_RESERVED_TENANT_COMMERCIAL_MODULE_REFACTOR_FREEZE_REPORT_V1.md",
  "docs/reviews/HELM_TENANT_RESOURCE_INTEGRATION_GOVERNANCE_IMPLEMENTATION_PLAN_V1.md",
  "docs/reviews/HELM_TENANT_RESOURCE_PHASE_4_TENANT_EXTENSION_ADOPTION_REPORT_V1.md",
  "docs/sales/packs/PACK_B_SI_DELIVERY_COMMITMENT_RESEARCH_V1.md",
  "docs/sales/packs/PACK_INDUSTRY_SELECTION_RESEARCH_V1.md",
  "evals/llm-context/context-quality-cases.json",
  "lib/public-mirror-tree-verifier.test.ts",
  "scripts/doc-lifecycle-grandfather.json",
  "scripts/odps-sample-oyx-repay-nc.ts",
];

export const PUBLIC_MIRROR_PRIVATE_FILES: ReadonlyArray<string> = PRIVATE_FILES;

const FOUNDER_LOOP_FULL_REQUIREMENTS_BASENAME = [
  "HELM",
  "FOUNDER",
  "OPERATING",
  "LOOP",
  "REQUIREMENTS",
  "V1",
].join("_");

const FOUNDER_LOOP_FULL_REQUIREMENTS_INTERNAL_PATH = [
  "docs",
  "internal",
  "product",
  `${FOUNDER_LOOP_FULL_REQUIREMENTS_BASENAME}.md`,
].join("/");

const FOUNDER_LOOP_FULL_REQUIREMENTS_BASENAME_PATTERN = new RegExp(
  `\\b${FOUNDER_LOOP_FULL_REQUIREMENTS_BASENAME}(?:\\.md)?\\b`,
);

function getForbiddenPublicDocReferenceRule(line: string): string | null {
  if (line.includes(FOUNDER_LOOP_FULL_REQUIREMENTS_INTERNAL_PATH)) {
    return "private-doc-ref:founder-operating-loop-internal-path";
  }
  if (FOUNDER_LOOP_FULL_REQUIREMENTS_BASENAME_PATTERN.test(line)) {
    return "private-doc-ref:founder-operating-loop-full-requirements";
  }
  return null;
}

// Local-only files that are always gitignored and never enter the public
// mirror. The guard would otherwise read them via filesystem walk and
// surface the developer's local credentials in CI output.
// Debug API route guard (Rule 6). Matches any file under
// `app/api/debug-<name>/` or `app/api/debug_<name>/` — Next.js App Router
// turns each such directory into a publicly-reachable endpoint, and the
// "debug" prefix indicates the handler was never designed for an
// untrusted caller. Triggered by the fa34d8c1b incident (2026-05-20)
// where `app/api/debug-env/route.ts` shipped without authentication.
const DEBUG_API_ROUTE_PATH_PATTERN = /^app\/api\/debug[-_][^/]+\//;

function getDebugApiRouteRule(relativePath: string): string | null {
  const normalized = relativePath.replace(/\\/g, "/");
  const match = DEBUG_API_ROUTE_PATH_PATTERN.exec(normalized);
  if (!match) return null;
  const segment = normalized.split("/")[2] ?? "debug";
  return `debug-api-route:${segment}`;
}

const LOCAL_ONLY_FILE_PATTERNS: ReadonlyArray<RegExp> = [
  /^\.env$/,
  /^\.env\..*/,
];

function isLocalOnlyFile(relativePath: string): boolean {
  const basename = path.basename(relativePath);
  if (basename === ".env.example") return false;
  return LOCAL_ONLY_FILE_PATTERNS.some((pattern) => pattern.test(basename));
}

// Directories to skip entirely during walk.
const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  ".next",
  "dist",
  "build",
  "coverage",
  ".turbo",
  ".vercel",
  "playwright-report",
  "test-results",
  // Claude Code / Codex / IDE machine-local session state. Not release
  // artifacts. May contain shell-history-style command snippets that
  // legitimately quote rotated credentials.
  ".claude",
  ".codex",
  ".idea",
  ".vscode",
  ".tmp",
  "tmp",
  // Generated artifacts (Prisma client builds, sqlite engines, etc.).
  // Binary content here trips heuristics with garbage; not part of the
  // release surface anyway.
  "generated",
]);

const RELEASE_ARTIFACT_SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  "coverage",
  ".turbo",
  ".vercel",
  "playwright-report",
  "test-results",
  ".claude",
  ".codex",
  ".idea",
  ".vscode",
  ".tmp",
  "tmp",
  "generated",
]);

// Binary / large asset extensions to skip.
const SKIP_EXTENSIONS = new Set([
  ".db",
  ".sqlite",
  ".sqlite3",
  ".node",
  ".dylib",
  ".so",
  ".dll",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".pdf",
  ".lock",
  ".ico",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".zip",
  ".tar",
  ".gz",
  ".mp4",
  ".mov",
]);

// Files explicitly allowed to mention slugs / private paths because
// their purpose is to describe the policy itself.
//
// IMPORTANT: policy-descriptor allow-listing only suppresses
//   tenant-slug:* / private-path-ref:* / internal-host:*
// rules. The credential:url-embedded rule continues to run on these files
// — secrets can never be policy-described.
const POLICY_DESCRIPTOR_ALLOW_LIST = new Set<string>([
  "scripts/public-release-guard.ts",
  "scripts/build-public-env-example.ts",
  "scripts/build-public-readme.ts",
  "scripts/public-mirror-semantic.ts",
  "scripts/decision-first-boundary-check.ts",
  "lib/extensions/registry.tsx",
  "docs/product/HELM_OPEN_SOURCE_AND_CLOUD_TRIAL_LAUNCH_PLAN_V1.md",
  "docs/product/HELM_OPEN_SOURCE_AND_CLOUD_TRIAL_RELEASE_READINESS_CORRECTION_V1.md",
  "docs/product/HELM_OPEN_SOURCE_COMMERCIAL_BOUNDARY_PLAN.md",
  "docs/product/HELM_OPEN_CORE_COMMERCIAL_MATRIX.md",
  "docs/product/HELM_TRADEMARK_AND_BRAND_USAGE_GUIDE.md",
  "docs/product/HELM_CERTIFIED_ECOSYSTEM_CHECKLIST.md",
  "GOVERNANCE.md",
  "docs/reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3_RUNTIME_ENABLEMENT_REVIEW_V1.md",
  // Repo-root navigation files — describe the public/private boundary.
  "README.md",
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "WORKING-CONTEXT.md",
  "docs/STATUS.md",
  "PLANS.md",
  ".dockerignore",
  "external-resource-kit/README.md",
  "docs/README.md",
  // Case management sample extraction spec — names tenant slugs as
  // sanitization targets; the spec itself is the policy descriptor for
  // building extensions/case-management-sample/ from the tenant-private
  // vertical pack. Added 2026-05-18 alongside the spec.
  "docs/_planning/CASE_MANAGEMENT_SAMPLE_EXTRACTION_SPEC_V1.md",
  // Reserved-account anchor and tenant separation policy descriptors.
  "docs/product/HELM_RESERVED_ACCOUNT_DEPLOYMENT_CONFIG_V1.md",
  "docs/product/HELM_MULTI_TENANT_EXTENSION_DIRECTORY_AND_NAMING_PROTOCOL_V1.md",
  "docs/product/HELM_EXTENSION_BUNDLE_MANIFEST_SCHEMA_DRAFT_V1.md",
  "docs/product/HELM_EXTERNAL_RESOURCE_SIGNAL_INTEGRATION_METHOD_V1.md",
  "docs/product/HELM_TENANT_RESOURCE_PHASE_4_TENANT_EXTENSION_ADOPTION_CONTRACT_V1.md",
  // Self-check / orchestration scripts that describe what tenant-extension
  // files must exist on disk. They reference private paths but are not
  // source-of-truth leaks; they are inventory/orchestration descriptors.
  "scripts/helm-self-check.ts",
  "scripts/helm-self-check-refactored.ts",
  // Doc-lifecycle orchestration: the path strings are the data (SKIP_PREFIXES
  // for archive/_pii-mapping/release-runbook-logs/llm-spend-reports, plus
  // packet/audit-log path templates inside the workflows). The script and
  // workflows live in the public mirror but only operate on paths that are
  // themselves in TENANT_PRIVATE_ROOTS. Added 2026-05-19 alongside the
  // doc lifecycle CI guard.
  "scripts/check-doc-frontmatter.ts",
  "scripts/docs-archive-mover.ts",
  "scripts/docs-frontmatter-backfill.ts",
  "scripts/docs-lifecycle-auto-apply.ts",
  "scripts/docs-lifecycle-classify-orphans.ts",
  "scripts/docs-lifecycle-find-eligible-packet.ts",
  "scripts/docs-owner-review-packet.ts",
  "scripts/docs-reference-scan.ts",
  "scripts/llm-monthly-spend-report.ts",
  "scripts/release-maintenance-runbook.ts",
  ".github/workflows/docs-lifecycle-auto-apply.yml",
  ".github/workflows/docs-lifecycle-monthly-packet.yml",
  // package.json carries npm scripts that orchestrate tenant-private tools;
  // those entries only fire when the tenant subtree is present (private
  // mirror). The shape of the file is itself a policy descriptor.
  "package.json",
  // ---------------------------------------------------------------------
  // 2026-05-20: HSI Phase 1 + Delivery Engineer Golden Path requirements
  // explicitly name the first real customer track (vs the
  // D002 美业 public-reference PACK track). The tenant slug is part of
  // the product strategy itself — it is the named anchor that Required
  // Reviewer / receipted-handoff / tenant-private-fixture boundaries
  // attach to. Rewriting it to `<tenant-A>` removes the indexing key
  // reviewers use to scope their checks. Both documents are
  // policy-descriptors in the same sense as the existing
  // HELM_OPEN_SOURCE_AND_CLOUD_TRIAL_LAUNCH_PLAN_V1.md entry above.
  // ---------------------------------------------------------------------
  "docs/product/HELM_HEADLESS_SIGNAL_INTERFACE_REQUIREMENTS.md",
  "docs/product/HELM_DELIVERY_ENGINEER_GOLDEN_PATH_REQUIREMENTS.md",
  // ---------------------------------------------------------------------
  // docs/reviews/* historical / closeout / phase-report files that
  // legitimately reference tenant slugs or internal hosts as part of the
  // historical narrative. Listed explicitly (not by prefix) so that any
  // future doc added under docs/reviews/ must be reviewed and added by
  // hand. The credential rule still runs on every file in this list.
  // ---------------------------------------------------------------------
  "docs/reviews/HELM_BI_REPORT_SKILL_PUSH_DRY_RUN_SKELETON_REPORT_V1.md",
  "docs/reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3T_LIVE_DB_REACHABILITY_RECHECK_V1.md",
  "docs/reviews/HELM_CAPABILITY_DECISION_TRACE_READ_ONLY_ADOPTION_REPORT_V1.md",
  "docs/reviews/HELM_EXTENSION_BUNDLE_READ_ONLY_VALIDATION_ADOPTION_PLAN_V1.md",
  "docs/reviews/HELM_EXTENSION_BUNDLE_READ_ONLY_VALIDATION_ADOPTION_REPORT_V1.md",
  primaryTenantReviewDoc("EXTENSION_COLLABORATION_FREEZE_REPORT_V1.md"),
  primaryTenantReviewDoc("SEAT_PROFILE_EXTENSION_KEY_BACKFILL_REPORT_V1.md"),
  "docs/reviews/HELM_HARNESS_SWARM_RUNTIME_SANDBOX_FINAL_CLOSEOUT_PLAN_V1.md",
  "docs/reviews/HELM_HARNESS_SWARM_RUNTIME_SANDBOX_FINAL_CLOSEOUT_REPORT_V1.md",
  "docs/reviews/HELM_MARKET_POSITIONING_AND_ADVANCEMENT_UPGRADE_CLOSEOUT_V1.md",
  "docs/reviews/HELM_MEMORY_OBSERVABILITY_BUDGETING_READ_ONLY_ADOPTION_REPORT_V1.md",
  "docs/reviews/HELM_MOBILE_COMMAND_SURFACE_IMPLEMENTATION_CLOSEOUT_V1.md",
  "docs/reviews/HELM_MONITOR_SUBSTRATE_READ_ONLY_ADOPTION_REPORT_V1.md",
  "docs/reviews/HELM_MULTI_TENANT_EXTENSION_HARNESS_REPORT_V1.md",
  "docs/reviews/HELM_PHASE3_REQUIRED_REVIEWER_CANDIDATE_FRAMEWORK_V1.md",
  "docs/reviews/HELM_REMAINING_DIRTY_WORKTREE_TRIAGE_V1.md",
  "docs/reviews/HELM_RESERVED_TENANT_COMMERCIAL_MODULE_REFACTOR_FREEZE_REPORT_V1.md",
  "docs/reviews/HELM_RUNTIME_SERVER_MINIMAL_IMPLEMENTATION_PLAN_V1.md",
  "docs/reviews/HELM_RUNTIME_SERVER_MINIMAL_IMPLEMENTATION_REPORT_V1.md",
  "docs/reviews/HELM_TENANT_RESOURCE_PHASE_3_PERSISTED_PROOF_AND_NARROW_GUARDED_WRITE_PILOT_REPORT_V1.md",
  "docs/reviews/HELM_TENANT_RESOURCE_PHASE_4_TENANT_EXTENSION_ADOPTION_REPORT_V1.md",
]);

// Path prefixes whose entire contents are treated as policy descriptor.
// Narrow on purpose: any new prefix added here must justify why every
// file under that subtree should be exempt from tenant-slug / private-path
// scans. The credential rule still runs on every file matched by a prefix.
const POLICY_DESCRIPTOR_PREFIX_ALLOW_LIST: ReadonlyArray<string> = [
  "docs/product/HELM_RESERVED_TENANT_",
  "docs/product/HELM_TENANT_RESOURCE_",
  // NOTE: docs/reviews/ is intentionally NOT a prefix any more. Each
  // legitimate review doc must be added explicitly to
  // POLICY_DESCRIPTOR_ALLOW_LIST above.
];

const POLICY_REFERENCE_IMPLEMENTATION_FILES = new Set<string>([
  "scripts/public-release-guard.ts",
  "scripts/public-mirror-semantic.ts",
  "lib/public-release-guard.test.ts",
  "lib/public-mirror-semantic-entry-docs.test.ts",
]);

function isPolicyDescriptorByPrefix(relativePath: string): boolean {
  return POLICY_DESCRIPTOR_PREFIX_ALLOW_LIST.some((prefix) =>
    relativePath === prefix || relativePath.startsWith(prefix),
  );
}

function isSourceMapArtifact(relativePath: string): boolean {
  return relativePath.toLowerCase().endsWith(".map");
}

function isSbomArtifact(relativePath: string): boolean {
  const basename = path.basename(relativePath).toLowerCase();
  return (
    basename.includes("sbom") ||
    basename === "bom.json" ||
    basename.endsWith(".spdx") ||
    basename.endsWith(".spdx.json") ||
    basename.endsWith(".cyclonedx.json") ||
    basename.endsWith(".cdx.json")
  );
}

function isDockerContextArtifact(relativePath: string): boolean {
  const normalized = relativePath.replaceAll(path.sep, "/");
  const basename = path.basename(normalized).toLowerCase();
  return (
    basename === "dockerfile" ||
    basename.startsWith("dockerfile.") ||
    basename === "docker-compose.yml" ||
    basename === "docker-compose.yaml" ||
    /^docker-compose\..+\.ya?ml$/.test(basename)
  );
}

function isDockerfileArtifact(relativePath: string): boolean {
  const basename = path.basename(relativePath.replaceAll(path.sep, "/")).toLowerCase();
  return basename === "dockerfile" || basename.startsWith("dockerfile.");
}

function getReleaseArtifactRulePrefix(relativePath: string): string | null {
  if (isSourceMapArtifact(relativePath)) return "source-map";
  if (isSbomArtifact(relativePath)) return "sbom";
  if (isDockerContextArtifact(relativePath)) return "docker-context";
  return null;
}

const COMMERCIAL_ENTITLEMENT_SOURCE_PREFIXES: ReadonlyArray<string> = [
  "app/",
  "components/",
  "data/",
  "features/",
  "hooks/",
  "lib/",
  "prisma/",
  "scripts/",
  "tests/",
];

const COMMERCIAL_ENTITLEMENT_SOURCE_FILES = new Set<string>([
  "instrumentation.ts",
  "middleware.ts",
  "next.config.ts",
]);

const COMMERCIAL_ENTITLEMENT_SOURCE_EXTENSIONS = new Set<string>([
  ".cjs",
  ".js",
  ".jsx",
  ".mjs",
  ".ts",
  ".tsx",
]);

const COMMERCIAL_ENTITLEMENT_ALLOW_LIST = new Set<string>([
  "lib/deployment-profile/contract.ts",
  "lib/deployment-profile/contract.test.ts",
  "lib/delivery-engineer/golden-path-doctor.ts",
  "lib/delivery-engineer/golden-path-doctor.test.ts",
  "scripts/validate-env.ts",
]);

const DEPLOYMENT_PROFILE_AUTHORITY_ENV_PATTERN =
  /\b(?:HELM_RELEASE_PROFILE|HELM_DEPLOYMENT_REGION|HELM_DATA_RESIDENCY|BUILD_EDITION)\b/;

const NEXT_PUBLIC_COMMERCIAL_AUTHORITY_PATTERN =
  /\bNEXT_PUBLIC_[A-Z0-9_]*(?:ENTITLE|ENTITLEMENT|LICENSE|ENTERPRISE|CLOUD|WHITE_LABEL|WHITE|MULTI_WORKSPACE|BILLING|SSO|SAML|SCIM|AUDIT)[A-Z0-9_]*\b/;

function isCommercialEntitlementSourceFile(relativePath: string): boolean {
  const normalized = relativePath.replaceAll(path.sep, "/");
  if (COMMERCIAL_ENTITLEMENT_ALLOW_LIST.has(normalized)) return false;
  if (COMMERCIAL_ENTITLEMENT_SOURCE_FILES.has(normalized)) return true;
  if (!COMMERCIAL_ENTITLEMENT_SOURCE_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    return false;
  }
  return COMMERCIAL_ENTITLEMENT_SOURCE_EXTENSIONS.has(path.extname(normalized));
}

function getCommercialEntitlementBoundaryRule(
  relativePath: string,
  line: string,
): string | null {
  if (!isCommercialEntitlementSourceFile(relativePath)) return null;
  if (DEPLOYMENT_PROFILE_AUTHORITY_ENV_PATTERN.test(line)) {
    return "commercial-entitlement:deployment-profile-env";
  }
  if (NEXT_PUBLIC_COMMERCIAL_AUTHORITY_PATTERN.test(line)) {
    return "commercial-entitlement:next-public-authority";
  }
  return null;
}

const APACHE_LICENSE_TEXT_PATTERN = /Apache License/i;
const APACHE_LICENSE_VERSION_PATTERN = /Version 2\.0|Apache-2\.0/i;

const SOURCE_LICENSE_HEADER_EXTENSIONS = new Set([
  ".cjs",
  ".css",
  ".js",
  ".jsx",
  ".mjs",
  ".mts",
  ".cts",
  ".ts",
  ".tsx",
]);

const SPDX_LICENSE_HEADER_PATTERN =
  /SPDX-License-Identifier:\s*([^\r\n*]+)/i;

const HELM_REGISTERED_MARK_PATTERN = /\bHelm\s*[®™]/u;
const POWERED_BY_HELM_PATTERN = /Powered by Helm/i;
const POWERED_BY_HELM_RUNTIME_FORCE_PATTERN =
  /\b(?:must|shall|required|requires|forced?|retain(?:ed)?|remain|cannot remove|may not remove)\b|运行时强制|强制保留|必须保留|不可移除|不得移除|不能移除|不可关闭|不能关闭|强制展示/u;
const POWERED_BY_HELM_BOUNDARY_WORDING_PATTERN =
  /cannot claim|not runtime-forced|not forced|not required|does not require|do not claim|must not claim|不得写成|不能声称|不应声称|不能宣称|不是运行时强制|不强制|不要求|不是.*强制|非.*强制/u;

function isSourceLicenseHeaderCandidate(relativePath: string): boolean {
  return SOURCE_LICENSE_HEADER_EXTENSIONS.has(
    path.extname(relativePath).toLowerCase(),
  );
}

function getLicenseHeaderRule(
  relativePath: string,
  line: string,
  lineNumber: number,
): string | null {
  if (!isSourceLicenseHeaderCandidate(relativePath)) return null;
  if (lineNumber > 20) return null;

  const spdxMatch = SPDX_LICENSE_HEADER_PATTERN.exec(line);
  if (!spdxMatch) return null;

  const licenseExpression = (spdxMatch[1] ?? "").trim();
  if (/\bApache-2\.0\b/i.test(licenseExpression)) return null;
  return "license-header:non-apache";
}

function getTrademarkRule(line: string): string | null {
  if (HELM_REGISTERED_MARK_PATTERN.test(line)) {
    return "trademark:registered-mark";
  }

  if (!POWERED_BY_HELM_PATTERN.test(line)) return null;
  if (!POWERED_BY_HELM_RUNTIME_FORCE_PATTERN.test(line)) return null;
  if (POWERED_BY_HELM_BOUNDARY_WORDING_PATTERN.test(line)) return null;
  return "trademark:powered-by-runtime-force";
}

// Credential-shaped substrings to mask in violation excerpts before printing.
// Order matters: longer/more-specific patterns must run first to avoid partial
// rewrites. The guard's own output must never re-leak a tracked secret, even
// when it is flagging a different rule (tenant-slug, internal-host, etc.).
const SECRET_REDACTION_PATTERNS: ReadonlyArray<{ name: string; pattern: RegExp; replacement: string }> = [
  // URL-embedded credentials: scheme://user:password@host
  {
    name: "url-credentials",
    pattern: /([a-z][a-z0-9+.-]*:\/\/[^\s:@/'"`]+):[^\s@'"`]+@/gi,
    replacement: "$1:***@",
  },
  // bare assignment forms: PASSWORD=..., TOKEN=..., secret: ..., api_key=...
  // Case-insensitive and aligned with ASSIGNMENT_CREDENTIAL_PATTERN so any
  // value flagged by Rule C is also redacted from the printed excerpt.
  {
    name: "assignment-credentials",
    pattern: /\b([A-Za-z0-9_]*?(?:password|secret|token|api[_-]?key|private[_-]?key|credential|pwd)\s*[:=]\s*['"`]?)([^\s'"`,;]{4,})/gi,
    replacement: "$1***",
  },
];

function maskSecrets(line: string): string {
  let masked = line;
  for (const { pattern, replacement } of SECRET_REDACTION_PATTERNS) {
    masked = masked.replace(pattern, replacement);
  }
  return masked;
}

export type Violation = {
  rule: string;
  path: string;
  line: number;
  excerpt: string;
};

export type PublicPackageManifestProjection = {
  readonly removedScripts: ReadonlyArray<string>;
  readonly manifest: Record<string, unknown>;
};

function cloneJsonObject(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function hasForbiddenPublicPackageReference(value: string): boolean {
  const lower = value.toLowerCase();
  for (const slug of TENANT_SLUG_BLACKLIST) {
    if (tenantSlugPattern(slug).test(value)) return true;
  }
  for (const root of PRIVATE_ROOTS) {
    if (lower.includes(root.toLowerCase())) return true;
  }
  for (const { pattern } of INTERNAL_HOST_PATTERNS) {
    if (pattern.test(value)) return true;
  }
  return false;
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every((entry) => typeof entry === "string");
}

const PUBLIC_PACKAGE_SCRIPT_OVERRIDES: Readonly<Record<string, string>> = {
  typecheck: "tsc --noEmit --project tsconfig.public.json",
  "db:prepare":
    "node -e \"console.log('public mirror: database prepare is not required')\"",
  "self-check":
    "npm run public:smoke:static && npm run check:secret-history",
  "check:boundaries":
    "npm run public:smoke:static && npm run check:golden-path-docs && npm run check:source-profiler-boundaries && npm run check:diagnostics-risk && npm run check:llm-candidate-boundaries && npm run check:recoverable-agent-runtime && npm run check:agentic-sarp && npm run check:work-unit-governance && npm run check:ai-shelf-trust-center-contract && npm run check:stage1-owner-loop",
  "check:source-profiler-boundaries":
    "node --import tsx scripts/check-source-profiler-boundaries.ts",
  "check:golden-path-docs":
    "node --import tsx scripts/check-golden-path-docs.ts",
  "check:diagnostics-risk":
    "node --import tsx scripts/check-diagnostics-risk.ts",
  "check:llm-candidate-boundaries":
    "node --import tsx scripts/check-llm-candidate-boundaries.ts",
  "check:recoverable-agent-runtime":
    "node --import tsx scripts/check-recoverable-agent-runtime.ts",
  "check:agentic-sarp": "node --import tsx scripts/check-agentic-sarp.ts",
  "check:work-unit-governance":
    "node --import tsx scripts/check-work-unit-governance.ts",
  "check:ai-shelf-trust-center-contract":
    "node --import tsx scripts/check-ai-shelf-trust-center-contract.ts",
  "check:stage1-owner-loop":
    "node --import tsx scripts/check-stage1-owner-loop.ts && vitest run lib/stage1-owner-loop features/dashboard/stage1-owner-loop-readout.test.ts features/dashboard/stage1-owner-loop-console-accessibility.test.ts --config vitest.public.config.ts",
  "sarp:proof": "node --import tsx scripts/sarp-proof.ts",
  "eval:llm-critic-boundaries":
    "vitest run lib/evals/llm-critic-evals.test.ts",
  "eval:llm-v2-boundaries":
    "vitest run lib/evals/llm-counterfactual-evals.test.ts lib/evals/memory-bench-evals.test.ts lib/evals/overlay-context-hygiene-evals.test.ts",
  "eval:llm-trajectory-harness": "vitest run lib/evals/llm-trajectory-harness.test.ts",
  "eval:llm-v3-boundaries":
    "vitest run lib/llm/intelligence-contracts-v3.test.ts lib/llm/reasoning-budget.test.ts lib/llm-workflows/multi-pass-review.workflow.test.ts lib/evals/llm-trajectory-harness.test.ts lib/evals/llm-v3-proposer-evals.test.ts lib/evals/llm-v3-disabled-snapshot.test.ts",
  "eval:governed-runtime-contracts":
    "vitest run lib/llm/governed-runtime-contracts.test.ts lib/llm/governed-candidate-materializer.test.ts lib/governed-intelligence/governed-candidate-review.test.ts features/governed-candidates/governed-candidate-review-panel.test.tsx scripts/check-llm-candidate-boundaries.test.ts --config vitest.public.config.ts",
  "eval:recoverable-agent-runtime":
    "vitest run lib/agent-runtime/agent-loop.test.ts lib/agent-runtime/recoverable-run-store.test.ts lib/agent-runtime/recoverable-runner.test.ts lib/agent-runtime/recoverable-run-store-mysql.test.ts scripts/check-recoverable-agent-runtime.test.ts --config vitest.public.config.ts",
  test: "vitest run --config vitest.public.config.ts",
  "test:public:guards":
    "vitest run lib/public-release-guard.test.ts lib/public-mirror-semantic-entry-docs.test.ts scripts/check-llm-candidate-boundaries.test.ts scripts/check-recoverable-agent-runtime.test.ts scripts/check-agentic-sarp.test.ts scripts/check-work-unit-governance.test.ts lib/work-unit-governance/runtime.test.ts lib/work-unit-governance/mainline-ledger.test.ts lib/work-unit-governance/private-mainline-store.test.ts lib/work-unit-governance/owner-lifecycle.test.ts lib/work-unit-governance/owner-notification-binding.test.ts lib/work-unit-governance/activation-handoff.test.ts lib/work-unit-governance/activation-runtime-binding.test.ts lib/work-unit-governance/repair-learning-loop.test.ts lib/work-unit-governance/learning-asset-store-binding.test.ts lib/work-unit-governance/proof-package.test.ts features/work-unit-governance/work-unit-review-console.test.tsx features/work-unit-governance/work-unit-mainline-ledger-panel.test.tsx features/work-unit-governance/work-unit-owner-lifecycle-panel.test.tsx features/work-unit-governance/work-unit-activation-handoff-panel.test.tsx features/work-unit-governance/work-unit-repair-learning-panel.test.tsx features/work-unit-governance/work-unit-proof-package-panel.test.tsx scripts/check-ai-shelf-trust-center-contract.test.ts scripts/sarp-proof.test.ts lib/agent-runtime/agent-loop.test.ts lib/agent-runtime/recoverable-run-store.test.ts lib/agent-runtime/recoverable-runner.test.ts lib/agent-runtime/recoverable-run-store-mysql.test.ts lib/evals/llm-critic-evals.test.ts lib/llm/runtime-permission.test.ts lib/llm/overlay-context-hygiene.test.ts lib/llm/intelligence-contracts-v2.test.ts lib/llm/intelligence-contracts-v3.test.ts lib/llm/governed-runtime-contracts.test.ts lib/llm/governed-candidate-materializer.test.ts lib/governed-intelligence/governed-candidate-review.test.ts features/governed-candidates/governed-candidate-review-panel.test.tsx lib/llm/reasoning-budget.test.ts lib/llm-workflows/review-counterfactual.workflow.test.ts lib/llm-workflows/multi-pass-review.workflow.test.ts lib/evals/llm-counterfactual-evals.test.ts lib/evals/memory-bench-evals.test.ts lib/evals/overlay-context-hygiene-evals.test.ts lib/evals/llm-trajectory-harness.test.ts lib/evals/llm-v3-proposer-evals.test.ts lib/evals/llm-v3-disabled-snapshot.test.ts",
  "quality:regression": "npm run test:public:guards && npm run public:smoke:static",
  "public:e2e:smoke": "npm run public:smoke:static",
  e2e: "npm run public:e2e:smoke",
  "public:smoke": "node --import tsx scripts/public-mirror-smoke.ts --repo-root . --run-commands",
  "check:public-docs": "node --import tsx scripts/check-public-docs-curation.ts",
  "check:public-commit-metadata":
    "node --import tsx scripts/public-commit-metadata-check.ts",
  "check:bilingual-mixing":
    "node --import tsx scripts/lint-bilingual-mixing.ts",
  "check:bilingual-mixing:update":
    "node --import tsx scripts/lint-bilingual-mixing.ts --update-baseline",
  "check:public-release":
    "npm run check:public-docs && node --import tsx scripts/public-release-guard.ts",
  "release:check": "node --import tsx scripts/release-readiness-check.ts",
  "public:smoke:static":
    "npm run check:public-docs && node --import tsx scripts/public-mirror-smoke.ts --repo-root .",
};

const PUBLIC_PACKAGE_SCRIPT_ALLOW_LIST: ReadonlySet<string> = new Set([
  "dev",
  "build",
  "start",
  "postinstall",
  "prepare",
  "lint",
  "lint:strict",
  "typecheck",
  "validate:env",
  "delivery:doctor",
  "golden:path",
  "eval:headless-signal-interface",
  "eval:signal-first-mile-quality",
  "eval:internal-commercialization",
  "eval:operating-signal-flow",
  "eval:operating-judgement-fusion",
  "eval:expert-capability-feedback-loop",
  "eval:operating-harness-contracts",
  "eval:operating-harness-p0",
  "eval:operating-harness-p1",
  "eval:operating-harness-p2",
  "eval:operating-harness-p3a-context",
  "eval:operating-harness-p3-readiness",
  "eval:cross-system-accountability-gap",
  "eval:llm-critic-boundaries",
  "eval:llm-v2-boundaries",
  "eval:llm-trajectory-harness",
  "eval:llm-v3-boundaries",
  "eval:governed-runtime-contracts",
  "eval:recoverable-agent-runtime",
  "kit:dry-run",
  "pack:fixture-check",
  "source-profiler",
  "source-profiler:init",
  "check:source-profiler-boundaries",
  "check:golden-path-docs",
  "diagnostics:doctor",
  "check:diagnostics-risk",
  "check:llm-candidate-boundaries",
  "check:recoverable-agent-runtime",
  "check:agentic-sarp",
  "check:work-unit-governance",
  "check:ai-shelf-trust-center-contract",
  "check:stage1-owner-loop",
  "sarp:proof",
  "public-mirror:build",
  "db:generate",
  "db:migrate",
  "db:prepare",
  "db:reset",
  "db:seed",
  "db:seed:force",
  "smoke:docker:d2",
  "check:public-docs",
  "check:public-commit-metadata",
  "check:bilingual-mixing",
  "check:bilingual-mixing:update",
  "check:public-release",
  "check:secret-history",
  "release:check",
  "self-check",
  "check:boundaries",
  "test",
  "test:public:guards",
  "quality:regression",
  "e2e",
  "public:e2e:smoke",
  "public:smoke:static",
  "public:smoke",
]);

export function projectPublicPackageManifest(
  sourceManifest: Record<string, unknown>,
): PublicPackageManifestProjection {
  const manifest = cloneJsonObject(sourceManifest);
  const removedScripts: string[] = [];

  if (manifest.private === true) {
    manifest.private = false;
  }

  if (isStringRecord(manifest.scripts)) {
    const publicScripts: Record<string, string> = {};
    for (const [name, command] of Object.entries(manifest.scripts)) {
      const candidate = `${name}\n${command}`;
      if (!PUBLIC_PACKAGE_SCRIPT_ALLOW_LIST.has(name)) {
        removedScripts.push(name);
        continue;
      }
      if (hasForbiddenPublicPackageReference(candidate)) {
        removedScripts.push(name);
        continue;
      }
      publicScripts[name] = PUBLIC_PACKAGE_SCRIPT_OVERRIDES[name] ?? command;
    }
    for (const [name, command] of Object.entries(PUBLIC_PACKAGE_SCRIPT_OVERRIDES)) {
      publicScripts[name] = command;
    }
    manifest.scripts = publicScripts;
  }

  return { manifest, removedScripts };
}

export function validatePublicPackageManifestProjection(
  projection: PublicPackageManifestProjection,
  relativePath = "package.json",
): Violation[] {
  const violations: Violation[] = [];
  const { manifest } = projection;

  if (manifest.private === true) {
    violations.push({
      rule: "package-json:private-true",
      path: relativePath,
      line: 1,
      excerpt: "public package manifest must not keep private=true",
    });
  }

  if (manifest.license !== "Apache-2.0") {
    violations.push({
      rule: "license-baseline:package-license",
      path: relativePath,
      line: 1,
      excerpt: "public package manifest must declare license=Apache-2.0",
    });
  }

  if (isStringRecord(manifest.scripts)) {
    for (const [name, command] of Object.entries(manifest.scripts)) {
      const candidate = `${name}\n${command}`;
      if (!hasForbiddenPublicPackageReference(candidate)) continue;
      violations.push({
        rule: "package-json:private-script",
        path: relativePath,
        line: 1,
        excerpt: maskSecrets(`${name}: ${command}`).slice(0, 240),
      });
    }
  }

  return violations;
}

function validateLicenseBaseline(root: string): Violation[] {
  const violations: Violation[] = [];
  let license = "";
  try {
    license = readFileSync(path.join(root, "LICENSE"), "utf8");
  } catch {
    violations.push({
      rule: "license-baseline:missing-license",
      path: "LICENSE",
      line: 1,
      excerpt: "public release root must include Apache-2.0 LICENSE",
    });
  }

  if (
    license &&
    (!APACHE_LICENSE_TEXT_PATTERN.test(license) ||
      !APACHE_LICENSE_VERSION_PATTERN.test(license))
  ) {
    violations.push({
      rule: "license-baseline:invalid-license",
      path: "LICENSE",
      line: 1,
      excerpt: "public release root LICENSE must identify Apache License Version 2.0",
    });
  }

  let notice = "";
  try {
    notice = readFileSync(path.join(root, "NOTICE"), "utf8");
  } catch {
    violations.push({
      rule: "license-baseline:missing-notice",
      path: "NOTICE",
      line: 1,
      excerpt: "public release root must include NOTICE",
    });
  }

  if (
    notice &&
    (!/\bHelm\b/i.test(notice) ||
      !APACHE_LICENSE_TEXT_PATTERN.test(notice) ||
      !APACHE_LICENSE_VERSION_PATTERN.test(notice))
  ) {
    violations.push({
      rule: "license-baseline:invalid-notice",
      path: "NOTICE",
      line: 1,
      excerpt: "public release root NOTICE must identify Helm and Apache-2.0",
    });
  }

  return violations;
}

function isInsidePrivateRoot(relativePath: string): boolean {
  return PRIVATE_ROOTS.some(
    (root) =>
      relativePath === root || relativePath.startsWith(root + path.sep) ||
      relativePath.startsWith(root + "/"),
  );
}

function isPrivateFile(relativePath: string): boolean {
  return PRIVATE_FILES.includes(relativePath);
}

function walk(root: string, dir: string, accumulator: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = path.join(dir, entry);
    let stats;
    try {
      stats = statSync(full);
    } catch {
      continue;
    }
    if (stats.isDirectory()) {
      walk(root, full, accumulator);
      continue;
    }
    if (!stats.isFile()) continue;
    const ext = path.extname(entry).toLowerCase();
    if (SKIP_EXTENSIONS.has(ext)) continue;
    accumulator.push(path.relative(root, full));
  }
}

function walkReleaseArtifactCandidates(
  root: string,
  dir: string,
  accumulator: string[],
  options: { readonly includeLocalBuildArtifacts?: boolean } = {},
): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }

  for (const entry of entries) {
    if (RELEASE_ARTIFACT_SKIP_DIRS.has(entry)) continue;
    if (entry === ".next" && !options.includeLocalBuildArtifacts) continue;
    const full = path.join(dir, entry);
    let stats;
    try {
      stats = statSync(full);
    } catch {
      continue;
    }

    if (stats.isDirectory()) {
      walkReleaseArtifactCandidates(root, full, accumulator, options);
      continue;
    }
    if (!stats.isFile()) continue;

    const relativePath = path.relative(root, full);
    if (isInsidePrivateRoot(relativePath)) continue;
    if (isPrivateFile(relativePath)) continue;
    if (isLocalOnlyFile(relativePath)) continue;
    if (!getReleaseArtifactRulePrefix(relativePath)) continue;
    accumulator.push(relativePath);
  }
}

function collectForbiddenReleaseReferences(line: string): string[] {
  const references: string[] = [];

  for (const slug of TENANT_SLUG_BLACKLIST) {
    if (tenantSlugPattern(slug).test(line)) references.push(`tenant-slug:${slug}`);
  }

  for (const { name, pattern } of INTERNAL_HOST_PATTERNS) {
    if (pattern.test(line)) references.push(`internal-host:${name}`);
  }

  for (const { name, pattern } of CUSTOMER_NAME_BLACKLIST) {
    if (pattern.test(line)) references.push(`customer-name:${name}`);
  }

  for (const { name, pattern } of PRIVATE_PERSON_NAME_BLACKLIST) {
    if (pattern.test(line)) references.push(`person-name:${name}`);
  }

  CN_MOBILE_PATTERN.lastIndex = 0;
  let mobileMatch: RegExpExecArray | null;
  while ((mobileMatch = CN_MOBILE_PATTERN.exec(line)) !== null) {
    const normalized = mobileMatch[0].replace(/\D/g, "").replace(/^86/, "");
    if (SYNTHETIC_CN_MOBILE_NUMBERS.has(normalized)) continue;
    references.push("cn-mobile");
    break;
  }

  if (RFC1918_IPV4_PATTERN.test(line)) references.push("internal-ip:rfc1918");

  for (const root of PRIVATE_ROOTS) {
    if (line.includes(root)) references.push(`private-path-ref:${root}`);
  }

  return references;
}

function isPolicyDescriptorSuppressedReference(reference: string): boolean {
  return (
    reference.startsWith("tenant-slug:") ||
    reference.startsWith("private-path-ref:")
  );
}

function isPolicyReferenceImplementationFile(relativePath: string): boolean {
  return POLICY_REFERENCE_IMPLEMENTATION_FILES.has(relativePath);
}

function isAllowedPublicContactReference(
  relativePath: string,
  line: string,
  reference: string,
): boolean {
  if (!PUBLIC_CONTACT_EMAIL_DOCUMENT_ALLOW_LIST.has(relativePath)) return false;

  const lowerLine = line.toLowerCase();
  const mentionsAllowedEmail = Array.from(PUBLIC_CONTACT_EMAIL_ALLOW_LIST).some(
    (email) => lowerLine.includes(email.toLowerCase()),
  );
  if (!mentionsAllowedEmail) return false;

  return (
    reference === `tenant-slug:${TENANT_SLUG_LEGACY_OPERATOR}` ||
    reference === "internal-host:customer-domain-c-host"
  );
}

function scanFile(
  root: string,
  relativePath: string,
  violations: Violation[],
  knownLeakedTokenSha256: ReadonlySet<string>,
): void {
  if (isInsidePrivateRoot(relativePath)) return;
  if (isPrivateFile(relativePath)) return;
  if (isLocalOnlyFile(relativePath)) return;

  // Rule 6: debug API route presence is a path-only violation — the
  // file content is not consulted, since the directory name itself is
  // the leak. Skip the rest of the line-level scan once flagged.
  const debugApiRouteRule = getDebugApiRouteRule(relativePath);
  if (debugApiRouteRule) {
    violations.push({
      rule: debugApiRouteRule,
      path: relativePath,
      line: 1,
      excerpt: relativePath,
    });
    return;
  }

  // Policy-descriptor files skip tenant-slug / private-path-ref / internal-host
  // checks but STILL run the credential rule. We compute this once and gate
  // the per-rule checks below.
  const isPolicyDescriptor =
    POLICY_DESCRIPTOR_ALLOW_LIST.has(relativePath) ||
    isPolicyDescriptorByPrefix(relativePath);
  const releaseArtifactRulePrefix = getReleaseArtifactRulePrefix(relativePath);

  // PATH leak: a tenant slug in the file's own relative path (filename or a
  // directory segment, camelCase-aware) is a leak regardless of content — this
  // is the class of leak (a tenant-named Core helper) that previously slipped
  // through. Files inside private roots / private files / local-only were
  // already returned above; policy-descriptor files are exempt (they may
  // legitimately name a slug).
  if (!isPolicyDescriptor) {
    const pathSlug = pathNamesTenantSlug(relativePath);
    if (pathSlug) {
      violations.push({
        rule: `tenant-slug:${pathSlug}:path`,
        path: relativePath,
        line: 0,
        excerpt: relativePath,
      });
    }
  }

  let content: string;
  try {
    content = readFileSync(path.join(root, relativePath), "utf-8");
  } catch {
    return;
  }

  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    const forbiddenPublicDocReferenceRule = getForbiddenPublicDocReferenceRule(line);
    if (forbiddenPublicDocReferenceRule) {
      violations.push({
        rule: forbiddenPublicDocReferenceRule,
        path: relativePath,
        line: lineNumber,
        excerpt: maskSecrets(line.trim()).slice(0, 240),
      });
    }

    // Credential leak detection — runs on every scanned file, even on
    // policy-descriptor files. Secrets must never be policy-described.

    // At most one credential violation per line: the more specific rules
    // (URL-embedded, known-leaked hash) take precedence over the generic
    // assignment rule, so a single leak is not double-counted.
    let credentialFlaggedOnLine = false;

    // Rule A: URL-embedded credential.
    URL_EMBEDDED_CREDENTIAL_PATTERN.lastIndex = 0;
    let credentialMatch: RegExpExecArray | null;
    while ((credentialMatch = URL_EMBEDDED_CREDENTIAL_PATTERN.exec(line)) !== null) {
      const value = credentialMatch[1] ?? "";
      if (!CREDENTIAL_PLACEHOLDERS.has(value.toLowerCase())) {
        violations.push({
          rule: "credential:url-embedded",
          path: relativePath,
          line: lineNumber,
          excerpt: maskSecrets(line.trim()).slice(0, 240),
        });
        credentialFlaggedOnLine = true;
        break;
      }
    }

    // Rule B: known-leaked-token sha256 deny list. Hash every candidate
    // substring on the line and flag if any hash matches. The plaintext
    // never enters source.
    if (knownLeakedTokenSha256.size > 0) {
      CANDIDATE_TOKEN_PATTERN.lastIndex = 0;
      let tokenMatch: RegExpExecArray | null;
      while ((tokenMatch = CANDIDATE_TOKEN_PATTERN.exec(line)) !== null) {
        const candidate = tokenMatch[0];
        if (knownLeakedTokenSha256.has(sha256Hex(candidate))) {
          violations.push({
            rule: "credential:known-leaked-token",
            path: relativePath,
            line: lineNumber,
            excerpt: maskSecrets(line.trim()).slice(0, 240),
          });
          credentialFlaggedOnLine = true;
          break;
        }
      }
    }

    // Rule C: assignment-form credential. `KEYWORD = <high-entropy-value>` /
    // `KEYWORD: <high-entropy-value>`. The earlier keyword-anywhere +
    // entropy-anywhere heuristic was removed for ~70+ false positives; the
    // assignment-position requirement plus the placeholder/entropy filters
    // give 0 measured false positives on the current tree while still
    // catching standalone leaks the SHA-256 deny list cannot know in advance.
    if (!credentialFlaggedOnLine) {
      ASSIGNMENT_CREDENTIAL_PATTERN.lastIndex = 0;
      let assignmentMatch: RegExpExecArray | null;
      while (
        (assignmentMatch = ASSIGNMENT_CREDENTIAL_PATTERN.exec(line)) !== null
      ) {
        const value = assignmentMatch[2] ?? "";
        if (
          looksLikeHighEntropyToken(value) &&
          !ALLOWED_ASSIGNMENT_VALUE_SHA256.has(sha256Hex(value))
        ) {
          violations.push({
            rule: "credential:assignment-form",
            path: relativePath,
            line: lineNumber,
            excerpt: maskSecrets(line.trim()).slice(0, 240),
          });
          break;
        }
      }
    }

    if (!isPolicyDescriptor) {
      const licenseHeaderRule = getLicenseHeaderRule(
        relativePath,
        line,
        lineNumber,
      );
      if (licenseHeaderRule) {
        violations.push({
          rule: licenseHeaderRule,
          path: relativePath,
          line: lineNumber,
          excerpt: maskSecrets(line.trim()).slice(0, 240),
        });
      }

      const trademarkRule = getTrademarkRule(line);
      if (trademarkRule) {
        violations.push({
          rule: trademarkRule,
          path: relativePath,
          line: lineNumber,
          excerpt: maskSecrets(line.trim()).slice(0, 240),
        });
      }
    }

    if (!isPolicyDescriptor) {
      const commercialEntitlementRule = getCommercialEntitlementBoundaryRule(
        relativePath,
        line,
      );
      if (commercialEntitlementRule) {
        violations.push({
          rule: commercialEntitlementRule,
          path: relativePath,
          line: lineNumber,
          excerpt: maskSecrets(line.trim()).slice(0, 240),
        });
      }
    }

    if (releaseArtifactRulePrefix) {
      const forbiddenReferences = collectForbiddenReleaseReferences(line);
      for (const reference of forbiddenReferences) {
        if (isAllowedPublicContactReference(relativePath, line, reference)) {
          continue;
        }
        violations.push({
          rule: `${releaseArtifactRulePrefix}:${reference}`,
          path: relativePath,
          line: lineNumber,
          excerpt: maskSecrets(line.trim()).slice(0, 240),
        });
      }
      continue;
    }

    const forbiddenReferences = collectForbiddenReleaseReferences(line);
    for (const reference of forbiddenReferences) {
      if (isPolicyReferenceImplementationFile(relativePath)) continue;
      if (
        isPolicyDescriptor &&
        isPolicyDescriptorSuppressedReference(reference)
      ) {
        continue;
      }
      if (isAllowedPublicContactReference(relativePath, line, reference)) {
        continue;
      }
      violations.push({
        rule: reference,
        path: relativePath,
        line: lineNumber,
        excerpt: maskSecrets(line.trim()).slice(0, 240),
      });
    }
  }
}

function dockerfileCopiesFullContext(content: string): boolean {
  return content.split(/\r?\n/).some((line) => {
    const normalized = line.trim();
    if (!normalized || normalized.startsWith("#")) return false;
    return /^\s*(COPY|ADD)\s+\.?\s+\.\s*$/i.test(normalized);
  });
}

function normalizeDockerignorePattern(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("!")) {
    return null;
  }
  return trimmed
    .replaceAll("\\", "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
}

function dockerignoreCoversRoot(patterns: ReadonlyArray<string>, root: string): boolean {
  const normalizedRoot = root.replaceAll("\\", "/").replace(/\/+$/, "");
  return patterns.some((pattern) => {
    if (pattern === normalizedRoot) return true;
    if (normalizedRoot.startsWith(`${pattern}/`)) return true;
    if (pattern.endsWith("/**")) {
      const prefix = pattern.slice(0, -3).replace(/\/+$/, "");
      return normalizedRoot === prefix || normalizedRoot.startsWith(`${prefix}/`);
    }
    return false;
  });
}

function collectDockerfileArtifacts(root: string): string[] {
  const candidates: string[] = [];
  walkReleaseArtifactCandidates(root, root, candidates);
  return [...new Set(candidates)].filter(isDockerfileArtifact);
}

function validateDockerContext(root: string): Violation[] {
  const violations: Violation[] = [];
  const dockerfileArtifacts = collectDockerfileArtifacts(root);
  if (dockerfileArtifacts.length === 0) return violations;

  let dockerignore = "";
  try {
    dockerignore = readFileSync(path.join(root, ".dockerignore"), "utf8");
  } catch {
    for (const dockerfileArtifact of dockerfileArtifacts) {
      violations.push({
        rule: "docker-context:missing-dockerignore",
        path: ".dockerignore",
        line: 1,
        excerpt:
          `${dockerfileArtifact} exists; .dockerignore is required for public mirror hygiene.`,
      });
    }
    return violations;
  }

  const patterns = dockerignore
    .split(/\r?\n/)
    .map(normalizeDockerignorePattern)
    .filter((pattern): pattern is string => Boolean(pattern));

  for (const dockerfileArtifact of dockerfileArtifacts) {
    let dockerfile = "";
    try {
      dockerfile = readFileSync(path.join(root, dockerfileArtifact), "utf8");
    } catch {
      continue;
    }

    if (!dockerfileCopiesFullContext(dockerfile)) continue;

    for (const privateRoot of PRIVATE_ROOTS) {
      if (!statPathExists(path.join(root, privateRoot))) continue;
      if (dockerignoreCoversRoot(patterns, privateRoot)) continue;
      violations.push({
        rule: "docker-context:missing-private-root-ignore",
        path: ".dockerignore",
        line: 1,
        excerpt:
          `${dockerfileArtifact} copies the full build context; .dockerignore must exclude ${privateRoot}.`,
      });
    }
  }

  return violations;
}

function statPathExists(fullPath: string): boolean {
  try {
    statSync(fullPath);
    return true;
  } catch {
    return false;
  }
}

function validateNoPrivateRootsInPublicMirror(root: string): Violation[] {
  const violations: Violation[] = [];
  for (const privateRoot of PRIVATE_ROOTS) {
    if (!statPathExists(path.join(root, privateRoot))) continue;
    violations.push({
      rule: "public-mirror-tree:private-root-present",
      path: privateRoot,
      line: 1,
      excerpt:
        `${privateRoot} is private by policy and must be removed from the prepared public mirror tree.`,
    });
  }
  for (const privateFile of PRIVATE_FILES) {
    if (!statPathExists(path.join(root, privateFile))) continue;
    violations.push({
      rule: "public-mirror-tree:private-file-present",
      path: privateFile,
      line: 1,
      excerpt:
        `${privateFile} is private by policy and must be removed from the prepared public mirror tree.`,
    });
  }
  return violations;
}

export function runPublicReleaseGuard(options: PublicReleaseGuardOptions = {}): PublicReleaseGuardResult {
  const root = options.repoRoot ?? process.cwd();
  const knownLeakedTokenSha256 =
    options.knownLeakedTokenSha256 ?? KNOWN_LEAKED_TOKEN_SHA256;
  const files: string[] = [];
  walk(root, root, files);
  walkReleaseArtifactCandidates(root, root, files, {
    includeLocalBuildArtifacts: options.includeLocalBuildArtifacts,
  });
  const uniqueFiles = [...new Set(files)];

  const violations: Violation[] = [];
  for (const file of uniqueFiles) {
    scanFile(root, file, violations, knownLeakedTokenSha256);
  }
  violations.push(...validateLicenseBaseline(root));
  violations.push(...validateDockerContext(root));
  const packageManifestProjection = readPublicPackageManifestProjection(root);
  if (packageManifestProjection) {
    violations.push(
      ...validatePublicPackageManifestProjection(packageManifestProjection),
    );
  }
  if (options.requirePrivateRootsAbsent) {
    violations.push(...validateNoPrivateRootsInPublicMirror(root));
  }

  return {
    scannedFiles: uniqueFiles.length,
    violations,
    publicPackageManifest: packageManifestProjection,
  };
}

function readPublicPackageManifestProjection(
  root: string,
): PublicPackageManifestProjection | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  } catch {
    return undefined;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return undefined;
  }
  return projectPublicPackageManifest(parsed as Record<string, unknown>);
}

function main(): number {
  const includeLocalBuildArtifacts = process.argv
    .slice(2)
    .includes("--include-local-build-artifacts");
  const result = runPublicReleaseGuard({ includeLocalBuildArtifacts });
  const violations = [...result.violations];

  if (violations.length === 0) {
    console.log(
      `public-release-guard: PASS — scanned ${result.scannedFiles} files; no public-mirror blockers.`,
    );
    return 0;
  }

  const grouped = new Map<string, Violation[]>();
  for (const v of violations) {
    if (!grouped.has(v.rule)) grouped.set(v.rule, []);
    grouped.get(v.rule)!.push(v);
  }

  console.error(
    `public-release-guard: FAIL — ${violations.length} occurrence(s) across ${grouped.size} rule(s); scanned ${result.scannedFiles} files.`,
  );
  console.error("");

  const sortedRules = [...grouped.keys()].sort();
  for (const rule of sortedRules) {
    const vs = grouped.get(rule)!;
    console.error(`[${rule}] ${vs.length} occurrence(s):`);
    for (const v of vs.slice(0, 20)) {
      console.error(`  ${v.path}:${v.line}: ${v.excerpt}`);
    }
    if (vs.length > 20) {
      console.error(`  ... ${vs.length - 20} more`);
    }
    console.error("");
  }

  console.error(
    "To resolve: move private content into PRIVATE_ROOTS, or add a policy-descriptor file to POLICY_DESCRIPTOR_ALLOW_LIST after explicit review.",
  );
  return 1;
}

if (require.main === module) {
  process.exitCode = main();
}
