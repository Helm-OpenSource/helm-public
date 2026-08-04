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
//   6. CPV1-BOUNDARY / CPV1-WIRING / CPV1-CI — Public owns no reverse
//                      composition runner or external checkout, Public
//                      workflows remain secret-free and action-allowlisted,
//                      package.json carries the frozen loop-suite and gate
//                      commands, and CI carries a non-skippable MySQL job.
//
// Passing this gate is a statement that the SYNTHETIC reference loop is
// formed on the public path. It is NOT customer initialization, NOT
// production evidence, and NOT value evidence; it changes no permission,
// route, API, database, or execution state machine.

import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import ts from "typescript";
import { parseDocument } from "yaml";

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
const CAIO_ACCESS_GATEWAY_DIRECTORY = "tools/caio-access-gateway";
const ALLOWED_CAIO_ACCESS_GATEWAY_FILES = new Set([
  "mount-fixture.ts",
  "production-caller.test.ts",
  "server-config.test.ts",
  "server-config.ts",
  "server.test.ts",
  "server.ts",
]);
const ALLOWED_TEST_RUNNER_CONFIG_FILES = new Set([
  "vitest.config.ts",
  "vitest.public.config.ts",
]);
const REPOSITORY_SOURCE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
]);
const REPOSITORY_SCAN_IGNORED_DIRECTORIES = new Set([
  ".git",
  ".next",
  ".turbo",
  "coverage",
  "node_modules",
  "playwright-report",
  "test-results",
]);
const TEST_RUNNER_CONFIG_FILE =
  /^(?:vite|vitest)(?:\.[^.]+)*\.config\.[cm]?[jt]s$/u;

// These are the only existing runtime-computed imports in Public. Both resolve
// local files with a fixed declaration in the named module. Every new file or
// expression is denied until this explicit ownership list is reviewed.
type ComputedDynamicImportAllowance = Readonly<{
  expression: string;
  initializerKind: "pack_bootstrap_path" | "sqlite_client_module_path";
}>;

const ALLOWED_COMPUTED_DYNAMIC_IMPORTS = new Map<
  string,
  readonly ComputedDynamicImportAllowance[]
>([
  [
    "instrumentation.ts",
    [
      {
        expression: "packBootstrapPath",
        initializerKind: "pack_bootstrap_path",
      },
    ],
  ],
  [
    "scripts/archive/sqlite-to-mysql-migration.ts",
    [
      {
        expression: "sqliteClientModulePath",
        initializerKind: "sqlite_client_module_path",
      },
    ],
  ],
]);
const ALLOWED_WORKFLOW_ACTIONS = new Set([
  "actions/checkout@v5",
  "actions/setup-node@v5",
  "actions/upload-artifact@v6",
  "peter-evans/create-pull-request@v6",
]);
// Empty by design. Public Core currently owns no cross-repository checkout.
// Adding an anonymous public dependency is an explicit boundary change, not a
// value that may arrive through vars or a renamed workflow.
const ALLOWED_ANONYMOUS_CHECKOUT_REPOSITORIES = new Set<string>();

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

const WORKFLOW_SECRET_EXPRESSION = /\$\{\{[^}]*\bsecrets\b/iu;
const WORKFLOW_MANUAL_REMOTE_FETCH =
  /\b(?:curl|wget)\b|\bgh\s+(?:api|repo\s+clone)\b|\bgit\b[^\n]{0,160}\b(?:clone|fetch|remote\s+add)\b/iu;
const WORKFLOW_OIDC_REQUEST_ENVIRONMENT =
  /\bACTIONS_ID_TOKEN_REQUEST_(?:URL|TOKEN)\b/u;
const WORKFLOW_OIDC_REQUEST_ENVIRONMENT_OBFUSCATED =
  /ACTIONS_ID_TOKEN_REQUEST_(?:URL|TOKEN)/u;
const WORKFLOW_USES =
  /(?:^|[-,{])\s*["']?uses["']?\s*:\s*["']?([^\s"'#},]+)["']?/gimu;
const D2_DOCKER_SMOKE_WORKFLOW = ".github/workflows/d2-docker-smoke.yml";
const D2_DOCKER_SMOKE_HELPER = "scripts/d2-docker-smoke.sh";
const D2_DOCKER_SMOKE_INVOCATION = "bash scripts/d2-docker-smoke.sh";
const D2_DOCKER_SMOKE_WORKFLOW_SHA256 =
  "fe979c50e2fa354e389843472223b68970ab11069bdff880e0cff8e5b58031b6";
const D2_DOCKER_SMOKE_HELPER_SHA256 =
  "1385d785b7692aaec20cc79f8ff00ec8474b1966f19e10d283ef8e3bfe6c7431";
const GATEWAY_REVERSE_COMPOSITION_MARKERS = [
  {
    label: "split-repository name",
    pattern: new RegExp(["helm", "-overlays"].join(""), "iu"),
  },
  { label: "external repository URL", pattern: /github\.com\//iu },
  {
    label: "external checkout root",
    pattern: /\b(?:CROSS_REPO|PRIVATE_REPO|HELM_OVERLAYS|DOWNSTREAM_ROOT)\b/iu,
  },
  {
    label: "external dependency path",
    pattern: /(?:^|["'`/\\])\.deps(?:["'`/\\]|$)/iu,
  },
  { label: "pinned external commit", pattern: /\b[0-9a-f]{40}\b/iu },
  { label: "child-process repository access", pattern: /node:child_process/iu },
  {
    label: "environment-owned test dependency",
    pattern: /\bprocess\.env\b/u,
  },
] as const;

const VITEST_REVERSE_COMPOSITION_MARKERS =
  GATEWAY_REVERSE_COMPOSITION_MARKERS.filter(
    ({ label }) => label !== "environment-owned test dependency",
  );

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

function listRepositorySourceFiles(repoRoot: string): string[] {
  const files: string[] = [];
  const visit = (
    absoluteDirectory: string,
    relativeDirectory: string,
  ): void => {
    for (const entry of readdirSync(absoluteDirectory, {
      withFileTypes: true,
    }).sort((left, right) => left.name.localeCompare(right.name))) {
      const relativeFile = relativeDirectory
        ? path.posix.join(relativeDirectory, entry.name)
        : entry.name;
      if (entry.isDirectory()) {
        const ignoredAtEveryDepth =
          entry.name === ".git" || entry.name === "node_modules";
        if (
          !ignoredAtEveryDepth &&
          (relativeDirectory !== "" ||
            !REPOSITORY_SCAN_IGNORED_DIRECTORIES.has(entry.name))
        ) {
          visit(path.join(absoluteDirectory, entry.name), relativeFile);
        }
        continue;
      }
      if (
        entry.isFile() &&
        REPOSITORY_SOURCE_EXTENSIONS.has(path.extname(entry.name))
      ) {
        files.push(relativeFile);
      }
    }
  };
  visit(repoRoot, "");
  return files;
}

function scriptKindFor(file: string): ts.ScriptKind {
  if (file.endsWith(".tsx") || file.endsWith(".jsx")) {
    return ts.ScriptKind.TSX;
  }
  if (file.endsWith(".js") || file.endsWith(".mjs") || file.endsWith(".cjs")) {
    return ts.ScriptKind.JS;
  }
  return ts.ScriptKind.TS;
}

function unwrapTransparentExpression(node: ts.Expression): ts.Expression {
  let current = node;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isNonNullExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

type ComputedDynamicImport = Readonly<{
  expression: string;
  call: ts.CallExpression;
}>;

type SourceInspection = Readonly<{
  source: ts.SourceFile;
  computedImports: readonly ComputedDynamicImport[];
  parseDiagnostics: readonly ts.Diagnostic[];
}>;

function inspectSourceFile(file: string, content: string): SourceInspection {
  const source = ts.createSourceFile(
    file,
    content,
    ts.ScriptTarget.Latest,
    true,
    scriptKindFor(file),
  );
  const computedImports: ComputedDynamicImport[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword
    ) {
      const argument = node.arguments[0];
      if (argument === undefined) {
        computedImports.push({ expression: "<missing>", call: node });
      } else {
        const unwrapped = unwrapTransparentExpression(argument);
        if (
          !ts.isStringLiteral(unwrapped) &&
          !ts.isNoSubstitutionTemplateLiteral(unwrapped)
        ) {
          computedImports.push({
            expression: unwrapped.getText(source),
            call: node,
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  const parseDiagnostics = (
    source as ts.SourceFile & {
      readonly parseDiagnostics?: readonly ts.Diagnostic[];
    }
  ).parseDiagnostics;
  return {
    source,
    computedImports,
    parseDiagnostics: parseDiagnostics ?? [],
  };
}

function isStringValue(
  node: ts.Expression | undefined,
  expected: string,
): boolean {
  const value =
    node === undefined ? undefined : unwrapTransparentExpression(node);
  return (
    (value !== undefined &&
      ts.isStringLiteral(value) &&
      value.text === expected) ||
    (value !== undefined &&
      ts.isNoSubstitutionTemplateLiteral(value) &&
      value.text === expected)
  );
}

function isPackBootstrapInitializer(node: ts.Expression): boolean {
  const value = unwrapTransparentExpression(node);
  if (
    !ts.isCallExpression(value) ||
    !ts.isPropertyAccessExpression(value.expression) ||
    value.expression.name.text !== "join" ||
    value.arguments.length !== 1 ||
    !isStringValue(value.arguments[0], "/")
  ) {
    return false;
  }
  const target = unwrapTransparentExpression(value.expression.expression);
  return (
    ts.isArrayLiteralExpression(target) &&
    target.elements.length === 2 &&
    isStringValue(target.elements[0], "@/extensions") &&
    isStringValue(target.elements[1], "pack-bootstrap")
  );
}

function isSqliteClientModuleInitializer(node: ts.Expression): boolean {
  const value = unwrapTransparentExpression(node);
  if (
    !ts.isPropertyAccessExpression(value) ||
    value.name.text !== "href" ||
    !ts.isCallExpression(value.expression) ||
    !ts.isIdentifier(value.expression.expression) ||
    value.expression.expression.text !== "pathToFileURL" ||
    value.expression.arguments.length !== 1
  ) {
    return false;
  }
  const resolvedPath = unwrapTransparentExpression(
    value.expression.arguments[0]!,
  );
  return (
    ts.isCallExpression(resolvedPath) &&
    ts.isPropertyAccessExpression(resolvedPath.expression) &&
    ts.isIdentifier(resolvedPath.expression.expression) &&
    resolvedPath.expression.expression.text === "path" &&
    resolvedPath.expression.name.text === "resolve" &&
    resolvedPath.arguments.length === 2 &&
    ts.isIdentifier(unwrapTransparentExpression(resolvedPath.arguments[0]!)) &&
    (unwrapTransparentExpression(resolvedPath.arguments[0]!) as ts.Identifier)
      .text === "projectRoot" &&
    isStringValue(resolvedPath.arguments[1], "generated/sqlite-client/index.js")
  );
}

function hasBoundComputedImportAllowance(
  inspection: SourceInspection,
  allowance: ComputedDynamicImportAllowance,
): boolean {
  const declarations: ts.VariableDeclaration[] = [];
  let identifierCount = 0;
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && node.text === allowance.expression) {
      identifierCount += 1;
    }
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === allowance.expression
    ) {
      declarations.push(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(inspection.source);

  const declaration = declarations[0];
  if (
    declarations.length !== 1 ||
    declaration?.initializer === undefined ||
    !ts.isVariableDeclarationList(declaration.parent) ||
    (declaration.parent.flags & ts.NodeFlags.Const) === 0 ||
    identifierCount !== 2
  ) {
    return false;
  }
  const initializerMatches =
    allowance.initializerKind === "pack_bootstrap_path"
      ? isPackBootstrapInitializer(declaration.initializer)
      : isSqliteClientModuleInitializer(declaration.initializer);
  if (!initializerMatches) return false;

  if (
    allowance.initializerKind === "sqlite_client_module_path" &&
    (!hasSqlitePathImportProvenance(inspection.source) ||
      !hasSafeProjectRootBinding(inspection.source, declaration))
  ) {
    return false;
  }

  const declarationScope = findLexicalDeclarationScope(declaration);

  return inspection.computedImports.some((computedImport) => {
    const argument = computedImport.call.arguments[0];
    return (
      argument !== undefined &&
      ts.isIdentifier(unwrapTransparentExpression(argument)) &&
      (unwrapTransparentExpression(argument) as ts.Identifier).text ===
        allowance.expression &&
      declaration.getStart(inspection.source) <
        computedImport.call.getStart(inspection.source) &&
      declarationScope.pos <= computedImport.call.pos &&
      computedImport.call.end <= declarationScope.end
    );
  });
}

function hasSafeProjectRootBinding(
  source: ts.SourceFile,
  sqliteModuleDeclaration: ts.VariableDeclaration,
): boolean {
  const declarations: ts.VariableDeclaration[] = [];
  let mutated = false;
  let rebound = false;
  const isProjectRoot = (node: ts.Node): node is ts.Identifier =>
    ts.isIdentifier(node) && node.text === "projectRoot";
  const bindingContainsProjectRoot = (name: ts.BindingName): boolean =>
    ts.isIdentifier(name)
      ? name.text === "projectRoot"
      : name.elements.some(
          (element) =>
            !ts.isOmittedExpression(element) &&
            bindingContainsProjectRoot(element.name),
        );
  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node)) {
      if (isProjectRoot(node.name)) {
        declarations.push(node);
      } else if (bindingContainsProjectRoot(node.name)) {
        rebound = true;
      }
    }
    if (
      (ts.isParameter(node) && bindingContainsProjectRoot(node.name)) ||
      (ts.isImportSpecifier(node) && node.name.text === "projectRoot") ||
      (ts.isImportClause(node) && node.name?.text === "projectRoot") ||
      ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) &&
        node.name?.text === "projectRoot")
    ) {
      rebound = true;
    }
    if (
      ts.isBinaryExpression(node) &&
      isProjectRoot(unwrapTransparentExpression(node.left)) &&
      node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
      node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
    ) {
      mutated = true;
    }
    if (
      (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
      isProjectRoot(unwrapTransparentExpression(node.operand)) &&
      (node.operator === ts.SyntaxKind.PlusPlusToken ||
        node.operator === ts.SyntaxKind.MinusMinusToken)
    ) {
      mutated = true;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);

  const declaration = declarations[0];
  if (
    declarations.length !== 1 ||
    declaration?.initializer === undefined ||
    !ts.isVariableDeclarationList(declaration.parent) ||
    (declaration.parent.flags & ts.NodeFlags.Const) === 0 ||
    mutated ||
    rebound
  ) {
    return false;
  }
  const initializer = unwrapTransparentExpression(declaration.initializer);
  if (
    !ts.isCallExpression(initializer) ||
    initializer.arguments.length !== 0 ||
    !ts.isPropertyAccessExpression(initializer.expression) ||
    !ts.isIdentifier(initializer.expression.expression) ||
    initializer.expression.expression.text !== "process" ||
    initializer.expression.name.text !== "cwd" ||
    !hasUnshadowedGlobalProcessBinding(source)
  ) {
    return false;
  }
  const scope = findLexicalDeclarationScope(declaration);
  return (
    declaration.getStart(source) < sqliteModuleDeclaration.getStart(source) &&
    scope.pos <= sqliteModuleDeclaration.pos &&
    sqliteModuleDeclaration.end <= scope.end
  );
}

function hasUnshadowedGlobalProcessBinding(source: ts.SourceFile): boolean {
  let unsafe = false;
  const bindingContainsProcess = (name: ts.BindingName): boolean =>
    ts.isIdentifier(name)
      ? name.text === "process"
      : name.elements.some(
          (element) =>
            !ts.isOmittedExpression(element) &&
            bindingContainsProcess(element.name),
        );
  const isGlobalProcessReference = (node: ts.Expression): boolean => {
    const expression = unwrapTransparentExpression(node);
    if (ts.isIdentifier(expression)) return expression.text === "process";
    if (
      ts.isPropertyAccessExpression(expression) &&
      ts.isIdentifier(unwrapTransparentExpression(expression.expression))
    ) {
      return (
        (unwrapTransparentExpression(expression.expression) as ts.Identifier)
          .text === "globalThis" && expression.name.text === "process"
      );
    }
    return (
      ts.isElementAccessExpression(expression) &&
      ts.isIdentifier(unwrapTransparentExpression(expression.expression)) &&
      (unwrapTransparentExpression(expression.expression) as ts.Identifier)
        .text === "globalThis" &&
      expression.argumentExpression !== undefined &&
      ts.isStringLiteralLike(expression.argumentExpression) &&
      expression.argumentExpression.text === "process"
    );
  };
  const isProcessMemberReference = (
    node: ts.Expression,
    member: string,
  ): boolean => {
    const expression = unwrapTransparentExpression(node);
    return (
      (ts.isPropertyAccessExpression(expression) &&
        isGlobalProcessReference(expression.expression) &&
        expression.name.text === member) ||
      (ts.isElementAccessExpression(expression) &&
        isGlobalProcessReference(expression.expression) &&
        expression.argumentExpression !== undefined &&
        ts.isStringLiteralLike(expression.argumentExpression) &&
        expression.argumentExpression.text === member)
    );
  };
  const isProcessReference = (node: ts.Expression): boolean => {
    const expression = unwrapTransparentExpression(node);
    return (
      isGlobalProcessReference(expression) ||
      isProcessMemberReference(expression, "cwd")
    );
  };
  const visit = (node: ts.Node): void => {
    if (unsafe) return;
    if (
      (ts.isVariableDeclaration(node) &&
        node.initializer !== undefined &&
        (isGlobalProcessReference(node.initializer) ||
          isProcessMemberReference(node.initializer, "chdir"))) ||
      ((ts.isVariableDeclaration(node) || ts.isParameter(node)) &&
        bindingContainsProcess(node.name)) ||
      (ts.isImportClause(node) && node.name?.text === "process") ||
      (ts.isImportSpecifier(node) && node.name.text === "process") ||
      (ts.isNamespaceImport(node) && node.name.text === "process") ||
      (ts.isImportEqualsDeclaration(node) && node.name.text === "process") ||
      ((ts.isFunctionDeclaration(node) ||
        ts.isFunctionExpression(node) ||
        ts.isClassDeclaration(node) ||
        ts.isClassExpression(node) ||
        ts.isEnumDeclaration(node) ||
        ts.isModuleDeclaration(node)) &&
        node.name !== undefined &&
        ts.isIdentifier(node.name) &&
        node.name.text === "process")
    ) {
      unsafe = true;
      return;
    }
    if (ts.isCallExpression(node)) {
      const callee = unwrapTransparentExpression(node.expression);
      const mutatorName = ts.isPropertyAccessExpression(callee)
        ? callee.name.text
        : null;
      const mutatorOwner =
        ts.isPropertyAccessExpression(callee) &&
        ts.isIdentifier(unwrapTransparentExpression(callee.expression))
          ? (unwrapTransparentExpression(callee.expression) as ts.Identifier)
              .text
          : null;
      const target = node.arguments[0];
      const member = node.arguments[1];
      if (
        node.arguments.some(
          (argument) =>
            isGlobalProcessReference(argument) ||
            isProcessMemberReference(argument, "cwd") ||
            isProcessMemberReference(argument, "chdir"),
        )
      ) {
        unsafe = true;
        return;
      }
      if (
        target !== undefined &&
        isGlobalProcessReference(target) &&
        member !== undefined &&
        ts.isStringLiteralLike(unwrapTransparentExpression(member)) &&
        /^(?:cwd|chdir)$/u.test(
          (unwrapTransparentExpression(member) as ts.StringLiteralLike).text,
        ) &&
        ((mutatorOwner === "Reflect" && mutatorName === "set") ||
          (mutatorOwner === "Object" &&
            /^(?:defineProperty|assign)$/u.test(mutatorName ?? "")))
      ) {
        unsafe = true;
        return;
      }
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
      node.operatorToken.kind <= ts.SyntaxKind.LastAssignment &&
      (isProcessReference(node.left) ||
        isGlobalProcessReference(node.right) ||
        isProcessMemberReference(node.right, "chdir"))
    ) {
      unsafe = true;
      return;
    }
    if (
      ((ts.isPropertyAccessExpression(node) ||
        ts.isElementAccessExpression(node)) &&
        isProcessMemberReference(node, "chdir")) ||
      ((ts.isPrefixUnaryExpression(node) ||
        ts.isPostfixUnaryExpression(node)) &&
        isProcessReference(node.operand)) ||
      (ts.isDeleteExpression(node) && isProcessReference(node.expression)) ||
      ((ts.isForInStatement(node) || ts.isForOfStatement(node)) &&
        !ts.isVariableDeclarationList(node.initializer) &&
        isProcessReference(node.initializer))
    ) {
      unsafe = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return !unsafe;
}

function findLexicalDeclarationScope(
  declaration: ts.VariableDeclaration,
): ts.Node {
  let current: ts.Node = declaration.parent;
  while (
    !ts.isSourceFile(current) &&
    !ts.isBlock(current) &&
    !ts.isCaseBlock(current) &&
    !ts.isModuleBlock(current)
  ) {
    current = current.parent;
  }
  return current;
}

function hasSqlitePathImportProvenance(source: ts.SourceFile): boolean {
  let pathImported = false;
  let pathToFileUrlImported = false;
  for (const statement of source.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.importClause === undefined
    ) {
      continue;
    }
    const moduleName = statement.moduleSpecifier.text;
    if (moduleName === "node:path") {
      pathImported ||=
        statement.importClause.name?.text === "path" ||
        (statement.importClause.namedBindings !== undefined &&
          ts.isNamespaceImport(statement.importClause.namedBindings) &&
          statement.importClause.namedBindings.name.text === "path");
    }
    if (
      moduleName === "node:url" &&
      statement.importClause.namedBindings !== undefined &&
      ts.isNamedImports(statement.importClause.namedBindings)
    ) {
      pathToFileUrlImported ||=
        statement.importClause.namedBindings.elements.some(
          (element) =>
            element.name.text === "pathToFileURL" &&
            (element.propertyName?.text ?? element.name.text) ===
              "pathToFileURL",
        );
    }
  }
  let localBindingShadowsImport = false;
  const bindingContains = (name: ts.BindingName, expected: string): boolean =>
    ts.isIdentifier(name)
      ? name.text === expected
      : name.elements.some(
          (element) =>
            !ts.isOmittedExpression(element) &&
            bindingContains(element.name, expected),
        );
  const visit = (node: ts.Node): void => {
    if (localBindingShadowsImport || ts.isImportDeclaration(node)) return;
    if (
      ((ts.isVariableDeclaration(node) || ts.isParameter(node)) &&
        (bindingContains(node.name, "path") ||
          bindingContains(node.name, "pathToFileURL"))) ||
      ((ts.isFunctionDeclaration(node) ||
        ts.isFunctionExpression(node) ||
        ts.isClassDeclaration(node) ||
        ts.isClassExpression(node)) &&
        (node.name?.text === "path" || node.name?.text === "pathToFileURL"))
    ) {
      localBindingShadowsImport = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return pathImported && pathToFileUrlImported && !localBindingShadowsImport;
}

function availableComputedDynamicImportAllowances(
  file: string,
  inspection: SourceInspection,
): Map<string, number> {
  const available = new Map<string, number>();
  for (const allowance of ALLOWED_COMPUTED_DYNAMIC_IMPORTS.get(file) ?? []) {
    if (hasBoundComputedImportAllowance(inspection, allowance)) {
      available.set(
        allowance.expression,
        (available.get(allowance.expression) ?? 0) + 1,
      );
    }
  }
  return available;
}

function blankWholeLineComments(source: string): string {
  return source
    .split("\n")
    .map((line) => (/^\s*#/u.test(line) ? "" : line))
    .join("\n");
}

function extractWorkflowStepBlocks(source: string): string[] {
  const lines = blankWholeLineComments(source).split("\n");
  const blocks: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const start = lines[index]?.match(/^(\s*)-\s+/u);
    if (!start) continue;
    const indent = start[1]?.length ?? 0;
    let end = index + 1;
    while (end < lines.length) {
      const next = lines[end] ?? "";
      const nextStep = next.match(/^(\s*)-\s+/u);
      if (nextStep && (nextStep[1]?.length ?? 0) <= indent) break;
      if (
        next.trim() !== "" &&
        next.length - next.trimStart().length < indent
      ) {
        break;
      }
      end += 1;
    }
    blocks.push(lines.slice(index, end).join("\n"));
    index = end - 1;
  }
  return blocks;
}

function readWorkflowInput(stepBlock: string, key: string): string | null {
  const match = stepBlock.match(
    new RegExp(
      `(?:^|[\\s,{])["']?${key}["']?\\s*:\\s*(?:"([^"]*)"|'([^']*)'|([^\\s,}#]+))`,
      "imu",
    ),
  );
  return match ? (match[1] ?? match[2] ?? match[3] ?? "") : null;
}

type UnknownRecord = Record<string, unknown>;

type WorkflowCommand = Readonly<{
  command: string;
  cwd: string;
  d2LocalCloneAllowed: boolean;
}>;

type WorkflowSemanticModel = Readonly<{
  commands: readonly WorkflowCommand[];
  actions: readonly string[];
  hasOidcWrite: boolean;
  errors: readonly string[];
}>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOidcWritePermission(value: unknown): boolean {
  if (typeof value === "string") {
    return value.toLowerCase() === "write-all";
  }
  if (!isRecord(value) || !("id-token" in value)) return false;
  const idTokenPermission = value["id-token"];
  return !(
    typeof idTokenPermission === "string" &&
    idTokenPermission.toLowerCase() === "none"
  );
}

function readWorkflowWorkingDirectory(
  value: unknown,
  inherited: string,
  errors: string[],
  label: string,
): string {
  if (value === undefined) return inherited;
  if (typeof value !== "string") {
    errors.push(`${label} working-directory could not be verified`);
    return inherited;
  }
  if (value.includes("${{") || path.posix.isAbsolute(value)) {
    errors.push(`${label} working-directory must be a static repository path`);
    return inherited;
  }
  const normalized = path.posix.normalize(value.replace(/^\.\//u, ""));
  if (normalized === "." || normalized === "") {
    return "";
  }
  if (normalized === ".." || normalized.startsWith("../")) {
    errors.push(`${label} working-directory leaves the repository`);
    return inherited;
  }
  return normalized;
}

function readDefaultsWorkingDirectory(
  defaults: unknown,
  inherited: string,
  errors: string[],
  label: string,
): string {
  if (defaults === undefined) return inherited;
  if (!isRecord(defaults) || !isRecord(defaults.run)) {
    errors.push(`${label} defaults.run could not be verified`);
    return inherited;
  }
  readWorkflowShell(
    defaults.run.shell,
    errors,
    `${label} defaults.run`,
  );
  return readWorkflowWorkingDirectory(
    defaults.run["working-directory"],
    inherited,
    errors,
    `${label} defaults.run`,
  );
}

const VERIFIED_WORKFLOW_SHELLS = new Set(["bash", "sh"]);

function readWorkflowShell(
  value: unknown,
  errors: string[],
  label: string,
): void {
  if (value === undefined) return;
  if (
    typeof value !== "string" ||
    !VERIFIED_WORKFLOW_SHELLS.has(value.trim())
  ) {
    errors.push(`${label} shell could not be verified statically`);
  }
}

const IMPLICIT_EXECUTION_ENVIRONMENT_KEYS = new Set([
  "BASH_ENV",
  "DYLD_INSERT_LIBRARIES",
  "ENV",
  "LD_PRELOAD",
  "NODE_PATH",
  "PATH",
  "PERL5OPT",
  "PYTHONPATH",
  "RUBYOPT",
]);

function readWorkflowEnvironment(
  value: unknown,
  errors: string[],
  label: string,
): UnknownRecord {
  if (value === undefined) return {};
  if (!isRecord(value)) {
    errors.push(`${label} environment could not be verified`);
    return {};
  }
  for (const [key, environmentValue] of Object.entries(value)) {
    if (IMPLICIT_EXECUTION_ENVIRONMENT_KEYS.has(key)) {
      errors.push(
        `${label} environment enables implicit execution through ${key}`,
      );
      continue;
    }
    if (
      key === "NODE_OPTIONS" &&
      (typeof environmentValue !== "string" ||
        !/^--max-old-space-size=\d+$/u.test(environmentValue.trim()))
    ) {
      errors.push(
        `${label} environment enables implicit execution through NODE_OPTIONS`,
      );
    }
  }
  return value;
}

function readJobContainerEnvironment(
  value: unknown,
  errors: string[],
  label: string,
): void {
  if (value === undefined || typeof value === "string") return;
  if (!isRecord(value)) {
    errors.push(`${label} container could not be verified`);
    return;
  }
  readWorkflowEnvironment(value.env, errors, `${label} container`);
}

function parseWorkflowSemantics(
  source: string,
  d2WorkflowDigestMatches: boolean,
): WorkflowSemanticModel {
  const errors: string[] = [];
  let parsed: unknown;
  try {
    const document = parseDocument(source, {
      schema: "core",
      uniqueKeys: true,
    });
    if (document.errors.length > 0) {
      return {
        commands: [],
        actions: [],
        hasOidcWrite: false,
        errors: [
          "workflow must be valid YAML before CI ownership can be verified",
        ],
      };
    }
    parsed = document.toJS({ maxAliasCount: 0 });
  } catch {
    return {
      commands: [],
      actions: [],
      hasOidcWrite: false,
      errors: [
        "workflow must be valid YAML before CI ownership can be verified",
      ],
    };
  }
  if (!isRecord(parsed) || !isRecord(parsed.jobs)) {
    return {
      commands: [],
      actions: [],
      hasOidcWrite: false,
      errors: ["workflow jobs must be an explicit mapping"],
    };
  }

  const commands: WorkflowCommand[] = [];
  const actions: string[] = [];
  readWorkflowEnvironment(parsed.env, errors, "workflow");
  const workflowWorkingDirectory = readDefaultsWorkingDirectory(
    parsed.defaults,
    "",
    errors,
    "workflow",
  );
  let hasOidcWrite = hasOidcWritePermission(parsed.permissions);
  for (const [jobName, jobValue] of Object.entries(parsed.jobs)) {
    if (!isRecord(jobValue)) {
      errors.push(`workflow job ${jobName} must be an explicit mapping`);
      continue;
    }
    hasOidcWrite ||= hasOidcWritePermission(jobValue.permissions);
    if (typeof jobValue.uses === "string") {
      actions.push(jobValue.uses);
      continue;
    }
    if (!Array.isArray(jobValue.steps)) {
      errors.push(`workflow job ${jobName} steps could not be verified`);
      continue;
    }
    const jobEnvironment = readWorkflowEnvironment(
      jobValue.env,
      errors,
      `workflow job ${jobName}`,
    );
    readJobContainerEnvironment(
      jobValue.container,
      errors,
      `workflow job ${jobName}`,
    );
    const jobWorkingDirectory = readDefaultsWorkingDirectory(
      jobValue.defaults,
      workflowWorkingDirectory,
      errors,
      `workflow job ${jobName}`,
    );
    const jobHasLocalRepositoryBinding =
      jobEnvironment.HELM_D2_SMOKE_REPO_URL === "${{ github.workspace }}" &&
      jobEnvironment.HELM_D2_SMOKE_REF === "HEAD";
    for (const [stepIndex, stepValue] of jobValue.steps.entries()) {
      if (!isRecord(stepValue)) {
        errors.push(
          `workflow job ${jobName} step ${stepIndex + 1} must be an explicit mapping`,
        );
        continue;
      }
      const stepEnvironment = readWorkflowEnvironment(
        stepValue.env,
        errors,
        `workflow job ${jobName} step ${stepIndex + 1}`,
      );
      readWorkflowShell(
        stepValue.shell,
        errors,
        `workflow job ${jobName} step ${stepIndex + 1}`,
      );
      if ("run" in stepValue) {
        if (typeof stepValue.run !== "string") {
          errors.push(
            `workflow job ${jobName} step ${stepIndex + 1} run command could not be verified`,
          );
        } else {
          const stepOverridesLocalBinding =
            "HELM_D2_SMOKE_REPO_URL" in stepEnvironment ||
            "HELM_D2_SMOKE_REF" in stepEnvironment ||
            /\bHELM_D2_SMOKE_(?:REPO_URL|REF)=/u.test(stepValue.run);
          const stepWorkingDirectory = readWorkflowWorkingDirectory(
            stepValue["working-directory"],
            jobWorkingDirectory,
            errors,
            `workflow job ${jobName} step ${stepIndex + 1}`,
          );
          commands.push({
            command: stepValue.run,
            cwd: stepWorkingDirectory,
            d2LocalCloneAllowed:
              d2WorkflowDigestMatches &&
              jobName === "d2-docker-smoke" &&
              jobHasLocalRepositoryBinding &&
              !stepOverridesLocalBinding,
          });
        }
      }
      if ("uses" in stepValue) {
        if (typeof stepValue.uses !== "string") {
          errors.push(
            `workflow job ${jobName} step ${stepIndex + 1} action could not be verified`,
          );
        } else {
          actions.push(stepValue.uses);
        }
      }
    }
  }
  return { commands, actions, hasOidcWrite, errors };
}

function normalizeObfuscatedCommand(source: string): string {
  return source.replace(/[\s'"`\\+${}]/gu, "");
}

type StaticCommandInvocation = Readonly<{
  executable: string;
  args: readonly string[];
  pathDirectories: readonly string[] | null;
  unresolved: boolean;
}>;

// This tokenizer only recovers static command boundaries and quoted words.
// Dynamic entries remain unresolved; it is not an execution-capable shell parser.
function tokenizeStaticShellCommands(
  source: string,
  recursionDepth = 0,
): Readonly<{
  commands: readonly Readonly<{
    tokens: readonly string[];
    complete: boolean;
  }>[];
}> {
  const commands: Array<{ tokens: string[]; complete: boolean }> = [];
  let command: string[] = [];
  let token = "";
  let quote: "single" | "double" | null = null;
  let commandComplete = true;
  const finishToken = () => {
    if (token !== "") command.push(token);
    token = "";
  };
  const finishCommand = () => {
    finishToken();
    if (command.length > 0) {
      commands.push({ tokens: command, complete: commandComplete });
    }
    command = [];
    commandComplete = true;
  };
  const readParenthesizedSource = (
    openIndex: number,
  ): Readonly<{ body: string; endIndex: number; complete: boolean }> => {
    let depth = 1;
    let nestedQuote: "single" | "double" | null = null;
    for (let index = openIndex + 1; index < source.length; index += 1) {
      const character = source[index]!;
      const next = source[index + 1];
      if (nestedQuote === "single") {
        if (character === "'") nestedQuote = null;
        continue;
      }
      if (character === "\\") {
        index += next === undefined ? 0 : 1;
        continue;
      }
      if (character === "'") {
        if (nestedQuote === null) nestedQuote = "single";
        continue;
      }
      if (character === '"') {
        nestedQuote = nestedQuote === "double" ? null : "double";
        continue;
      }
      if (
        nestedQuote === "double" &&
        (character === "$" || character === "<" || character === ">") &&
        next === "("
      ) {
        depth += 1;
        index += 1;
        continue;
      }
      if (nestedQuote === "double") {
        if (character === ")" && depth > 1) depth -= 1;
        continue;
      }
      if (character === "(") depth += 1;
      if (character !== ")") continue;
      depth -= 1;
      if (depth === 0) {
        return {
          body: source.slice(openIndex + 1, index),
          endIndex: index,
          complete: true,
        };
      }
    }
    return {
      body: source.slice(openIndex + 1),
      endIndex: source.length - 1,
      complete: false,
    };
  };
  const appendNestedCommands = (nestedSource: string, complete: boolean) => {
    if (!complete || recursionDepth >= 32) {
      commandComplete = false;
      return;
    }
    commands.push(
      ...tokenizeStaticShellCommands(nestedSource, recursionDepth + 1).commands,
    );
  };

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]!;
    const next = source[index + 1];
    if (quote === "single") {
      if (character === "'") quote = null;
      else token += character;
      continue;
    }
    if (quote === "double") {
      if (character === '"') {
        quote = null;
      } else if (character === "\\" && next !== undefined) {
        if (next === "\n") index += 1;
        else {
          token += next;
          index += 1;
        }
      } else if (
        (character === "$" || character === "<" || character === ">") &&
        next === "("
      ) {
        const nested = readParenthesizedSource(index + 1);
        appendNestedCommands(nested.body, nested.complete);
        token += `${character}(...)`;
        index = nested.endIndex;
      } else if (character === "`") {
        let endIndex = index + 1;
        while (
          endIndex < source.length &&
          (source[endIndex] !== "`" || source[endIndex - 1] === "\\")
        ) {
          endIndex += 1;
        }
        const complete = endIndex < source.length;
        appendNestedCommands(source.slice(index + 1, endIndex), complete);
        token += "`...`";
        index = complete ? endIndex : source.length - 1;
      } else {
        token += character;
      }
      continue;
    }
    if (character === "'") {
      quote = "single";
      continue;
    }
    if (character === '"') {
      quote = "double";
      continue;
    }
    if (character === "\\") {
      if (next === "\n") index += 1;
      else if (next !== undefined) {
        token += next;
        index += 1;
      } else {
        commandComplete = false;
      }
      continue;
    }
    if (
      (character === "$" || character === "<" || character === ">") &&
      next === "("
    ) {
      const nested = readParenthesizedSource(index + 1);
      appendNestedCommands(nested.body, nested.complete);
      token += `${character}(...)`;
      index = nested.endIndex;
      continue;
    }
    if (character === "`") {
      let endIndex = index + 1;
      while (
        endIndex < source.length &&
        (source[endIndex] !== "`" || source[endIndex - 1] === "\\")
      ) {
        endIndex += 1;
      }
      const complete = endIndex < source.length;
      appendNestedCommands(source.slice(index + 1, endIndex), complete);
      token += "`...`";
      index = complete ? endIndex : source.length - 1;
      continue;
    }
    if (character === "#" && token === "" && command.length === 0) {
      while (index + 1 < source.length && source[index + 1] !== "\n") {
        index += 1;
      }
      continue;
    }
    if (/\s/u.test(character)) {
      finishToken();
      if (character === "\n") finishCommand();
      continue;
    }
    if (character === ";" || character === "|" || character === "&") {
      finishCommand();
      while (source[index + 1] === character) index += 1;
      continue;
    }
    if (character === "(" || character === ")") {
      finishCommand();
      continue;
    }
    token += character;
  }
  if (quote !== null) commandComplete = false;
  finishCommand();
  return { commands };
}

function unwrapStaticCommand(
  tokens: readonly string[],
  tokenizationComplete: boolean,
): StaticCommandInvocation | null {
  let index = 0;
  let unresolved = !tokenizationComplete;
  let pathDirectories: string[] | null = null;
  const isAssignment = (value: string) =>
    /^[A-Za-z_][A-Za-z0-9_]*\+?=/u.test(value);
  const recordAssignment = (assignment: string) => {
    const separatorIndex = assignment.indexOf("=");
    const variableName = assignment
      .slice(0, separatorIndex)
      .replace(/\+$/u, "");
    if (variableName !== "PATH") return;
    const directories: string[] = [];
    for (const directory of assignment.slice(separatorIndex + 1).split(":")) {
      if (directory === "$PATH" || directory === "${PATH}") continue;
      if (/[$`]/u.test(directory)) {
        unresolved = true;
        continue;
      }
      directories.push(directory === "" ? "." : directory);
    }
    pathDirectories = directories;
  };
  while (isAssignment(tokens[index] ?? "")) {
    recordAssignment(tokens[index]!);
    index += 1;
  }

  while (index < tokens.length) {
    const executable = path.posix.basename(tokens[index] ?? "");
    if (executable === "env") {
      index += 1;
      while (index < tokens.length) {
        const option = tokens[index]!;
        if (option === "--") {
          index += 1;
          break;
        }
        if (option === "-u" || option === "--unset") {
          if (tokens[index + 1] === undefined) unresolved = true;
          index += 2;
          continue;
        }
        if (/^--unset=/u.test(option) || option === "-i") {
          index += 1;
          continue;
        }
        if (isAssignment(option)) {
          recordAssignment(option);
          index += 1;
          continue;
        }
        if (option.startsWith("-")) {
          unresolved = true;
          index += 1;
          continue;
        }
        break;
      }
      continue;
    }
    if (executable === "builtin") {
      index += 1;
      while (tokens[index]?.startsWith("-")) {
        if (tokens[index] !== "--" && tokens[index] !== "-p") {
          unresolved = true;
        }
        index += 1;
      }
      continue;
    }
    if (executable === "command") {
      index += 1;
      while (tokens[index]?.startsWith("-")) {
        const option = tokens[index]!;
        if (option === "-v" || option === "-V") return null;
        if (option !== "-p" && option !== "--") unresolved = true;
        index += 1;
      }
      continue;
    }
    if (executable === "exec") {
      index += 1;
      while (tokens[index]?.startsWith("-")) {
        const option = tokens[index]!;
        if (option === "-a") index += 2;
        else {
          if (option !== "-c" && option !== "-l" && option !== "--") {
            unresolved = true;
          }
          index += 1;
        }
      }
      continue;
    }
    if (executable === "nohup") {
      index += 1;
      while (tokens[index]?.startsWith("-")) {
        if (tokens[index] !== "--") unresolved = true;
        index += 1;
      }
      continue;
    }
    break;
  }
  const executable = tokens[index];
  if (executable === undefined) {
    return pathDirectories === null
      ? null
      : {
          executable: "",
          args: [],
          pathDirectories,
          unresolved: true,
        };
  }
  const args = tokens.slice(index + 1);
  if (/[`$]/u.test(executable)) unresolved = true;
  if (
    /^(?:declare|export|readonly|typeset)$/u.test(
      path.posix.basename(executable),
    ) &&
    (pathDirectories !== null ||
      args.some((argument) => /^PATH(?:\+?=.*)?$/u.test(argument)))
  ) {
    unresolved = true;
  }
  return {
    executable,
    args,
    pathDirectories,
    unresolved,
  };
}

function extractStaticCommandInvocations(
  command: string,
): StaticCommandInvocation[] {
  const tokenized = tokenizeStaticShellCommands(command);
  return tokenized.commands.flatMap(({ tokens, complete }) => {
    const invocation = unwrapStaticCommand(tokens, complete);
    return invocation === null ? [] : [invocation];
  });
}

type NpmInvocation = Readonly<{
  kind: "install" | "script";
  scriptName: string | null;
  prefix: string | null;
  workspace: string | null;
  ignoreScripts: boolean;
  unresolved: boolean;
}>;

// npm changes package context through prefix/workspace flags and runs lifecycle
// hooks implicitly, so command reachability must retain that context.
function extractNpmInvocations(command: string): NpmInvocation[] {
  const invocations: NpmInvocation[] = [];
  for (const invocation of extractStaticCommandInvocations(command)) {
    if (path.posix.basename(invocation.executable) !== "npm") continue;
    let prefix: string | null = null;
    let workspace: string | null = null;
    let ignoreScripts = false;
    let unresolved = invocation.unresolved;
    const positionals: string[] = [];
    for (let index = 0; index < invocation.args.length; index += 1) {
      const argument = invocation.args[index]!;
      if (argument === "--") break;
      if (argument === "--prefix" || argument === "-C") {
        const value = invocation.args[index + 1];
        if (value === undefined || prefix !== null) unresolved = true;
        else prefix = value;
        index += 1;
        continue;
      }
      if (argument.startsWith("--prefix=")) {
        if (prefix !== null) unresolved = true;
        prefix = argument.slice("--prefix=".length);
        continue;
      }
      if (argument === "--workspace" || argument === "-w") {
        const value = invocation.args[index + 1];
        if (value === undefined || workspace !== null) unresolved = true;
        else workspace = value;
        index += 1;
        continue;
      }
      if (argument.startsWith("--workspace=")) {
        if (workspace !== null) unresolved = true;
        workspace = argument.slice("--workspace=".length);
        continue;
      }
      if (argument === "--ignore-scripts") {
        ignoreScripts = true;
        continue;
      }
      if (
        /^(?:--silent|--if-present|--foreground-scripts|--include-workspace-root|--no-audit|--no-fund)$/u.test(
          argument,
        )
      ) {
        continue;
      }
      if (argument.startsWith("-")) {
        unresolved = true;
        continue;
      }
      positionals.push(argument);
    }
    const commandName = positionals[0];
    if (
      commandName === "ci" ||
      commandName === "install" ||
      commandName === "i"
    ) {
      invocations.push({
        kind: "install",
        scriptName: null,
        prefix,
        workspace,
        ignoreScripts,
        unresolved,
      });
      continue;
    }
    const scriptName =
      commandName === "run" || commandName === "run-script"
        ? positionals[1]
        : commandName;
    invocations.push({
      kind: "script",
      scriptName: scriptName ?? null,
      prefix,
      workspace,
      ignoreScripts,
      unresolved:
        unresolved ||
        scriptName === undefined ||
        commandName === "exec" ||
        commandName === "x",
    });
  }
  return invocations;
}

type NpmScriptResolution =
  | Readonly<{
      kind: "resolved";
      cwd: string;
      packageFile: string;
      commands: readonly string[];
    }>
  | Readonly<{
      kind: "invalid_package" | "missing_package" | "missing_script";
      packageFile: string | null;
    }>;

type NpmPackageResolution = Readonly<{
  cwd: string;
  packageFile: string;
  manifest: UnknownRecord;
  scripts: Readonly<Record<string, unknown>>;
}>;

function resolveNpmPackage(
  repoRoot: string,
  cwd: string,
): NpmPackageResolution | null {
  let packageRoot = cwd;
  while (true) {
    const packageFile = packageRoot
      ? path.posix.join(packageRoot, PACKAGE_FILE)
      : PACKAGE_FILE;
    const packageContent = read(repoRoot, packageFile);
    if (packageContent !== null) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(packageContent);
      } catch {
        return null;
      }
      if (
        !isRecord(parsed) ||
        (parsed.scripts !== undefined && !isRecord(parsed.scripts))
      ) {
        return null;
      }
      return {
        cwd: packageRoot,
        packageFile,
        manifest: parsed,
        scripts: isRecord(parsed.scripts) ? parsed.scripts : {},
      };
    }
    if (packageRoot === "") break;
    const parent = path.posix.dirname(packageRoot);
    packageRoot = parent === "." ? "" : parent;
  }
  return null;
}

function resolveNpmScript(
  repoRoot: string,
  cwd: string,
  scriptName: string,
): NpmScriptResolution {
  const resolvedPackage = resolveNpmPackage(repoRoot, cwd);
  if (resolvedPackage === null) {
    return { kind: "missing_package", packageFile: null };
  }
  if (typeof resolvedPackage.scripts[scriptName] !== "string") {
    return {
      kind: "missing_script",
      packageFile: resolvedPackage.packageFile,
    };
  }
  const commands = [
    resolvedPackage.scripts[`pre${scriptName}`],
    resolvedPackage.scripts[scriptName],
    resolvedPackage.scripts[`post${scriptName}`],
  ].filter((command): command is string => typeof command === "string");
  return {
    kind: "resolved",
    cwd: resolvedPackage.cwd,
    packageFile: resolvedPackage.packageFile,
    commands,
  };
}

const NPM_INSTALL_LIFECYCLE_SCRIPTS = [
  "preinstall",
  "install",
  "postinstall",
  "prepublish",
  "preprepare",
  "prepare",
  "postprepare",
  "dependencies",
] as const;

function resolveNpmInvocationCwd(
  repoRoot: string,
  currentCwd: string,
  invocation: NpmInvocation,
): string | null {
  let effectiveCwd = currentCwd;
  if (invocation.prefix !== null) {
    const prefixed = resolveWorkflowHelperPath(currentCwd, invocation.prefix);
    if (
      prefixed === null ||
      read(
        repoRoot,
        prefixed ? path.posix.join(prefixed, PACKAGE_FILE) : PACKAGE_FILE,
      ) === null
    ) {
      return null;
    }
    effectiveCwd = prefixed;
  }
  if (invocation.workspace === null) return effectiveCwd;

  const rootPackage = findNpmWorkspaceRootPackage(repoRoot, effectiveCwd);
  if (rootPackage === null || /[`$]/u.test(invocation.workspace)) return null;
  return (
    resolveSelectedWorkspacePackage(repoRoot, rootPackage, invocation.workspace)
      ?.cwd ?? null
  );
}

function readNpmPackageAt(
  repoRoot: string,
  cwd: string,
): NpmPackageResolution | null {
  const packageFile = cwd ? path.posix.join(cwd, PACKAGE_FILE) : PACKAGE_FILE;
  let currentPath = repoRoot;
  try {
    for (const segment of packageFile.split("/")) {
      currentPath = path.join(currentPath, segment);
      if (lstatSync(currentPath).isSymbolicLink()) return null;
    }
  } catch {
    return null;
  }
  const packageContent = read(repoRoot, packageFile);
  if (packageContent === null) return null;
  try {
    const manifest = JSON.parse(packageContent) as unknown;
    if (
      !isRecord(manifest) ||
      (manifest.scripts !== undefined && !isRecord(manifest.scripts))
    ) {
      return null;
    }
    return {
      cwd,
      packageFile,
      manifest,
      scripts: isRecord(manifest.scripts) ? manifest.scripts : {},
    };
  } catch {
    return null;
  }
}

function configuredWorkspacePatterns(
  manifest: UnknownRecord,
): readonly string[] | null {
  if (manifest.workspaces === undefined) return [];
  const patterns = Array.isArray(manifest.workspaces)
    ? manifest.workspaces
    : isRecord(manifest.workspaces) &&
        Array.isArray(manifest.workspaces.packages)
      ? manifest.workspaces.packages
      : null;
  return patterns !== null &&
    patterns.every((pattern): pattern is string => typeof pattern === "string")
    ? patterns
    : null;
}

function resolveDeclaredWorkspacePackages(
  repoRoot: string,
  rootPackage: NpmPackageResolution,
): readonly NpmPackageResolution[] | null {
  const patterns = configuredWorkspacePatterns(rootPackage.manifest);
  if (patterns === null) return null;
  const packages = new Map<string, NpmPackageResolution>();
  for (const pattern of patterns) {
    if (path.posix.isAbsolute(pattern) || /[`$?{}[\]]/u.test(pattern)) {
      return null;
    }
    const starCount = [...pattern].filter(
      (character) => character === "*",
    ).length;
    if (starCount === 0) {
      const workspacePath = resolveWorkflowHelperPath(rootPackage.cwd, pattern);
      if (workspacePath === null) return null;
      const workspacePackage = readNpmPackageAt(repoRoot, workspacePath);
      if (workspacePackage === null) return null;
      packages.set(workspacePackage.packageFile, workspacePackage);
      continue;
    }
    if (starCount !== 1 || !pattern.endsWith("/*")) return null;
    const parentPattern = pattern.slice(0, -2);
    const parent = resolveWorkflowHelperPath(rootPackage.cwd, parentPattern);
    if (parent === null) return null;
    const absoluteParent = path.join(repoRoot, parent);
    if (!existsSync(absoluteParent)) return null;
    for (const entry of readdirSync(absoluteParent, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) return null;
      if (!entry.isDirectory()) continue;
      const workspacePath = path.posix.join(parent, entry.name);
      const workspacePackage = readNpmPackageAt(repoRoot, workspacePath);
      if (workspacePackage === null) {
        if (existsSync(path.join(repoRoot, workspacePath, PACKAGE_FILE))) {
          return null;
        }
        continue;
      }
      packages.set(workspacePackage.packageFile, workspacePackage);
    }
  }
  return [...packages.values()];
}

function findNpmWorkspaceRootPackage(
  repoRoot: string,
  cwd: string,
): NpmPackageResolution | null {
  const packageContext = resolveNpmPackage(repoRoot, cwd);
  if (packageContext === null) return null;
  let candidateCwd = packageContext.cwd;
  while (true) {
    const candidatePackage = readNpmPackageAt(repoRoot, candidateCwd);
    if (candidatePackage !== null) {
      const patterns = configuredWorkspacePatterns(candidatePackage.manifest);
      if (patterns === null) return null;
      if (patterns.length > 0) {
        const workspaces = resolveDeclaredWorkspacePackages(
          repoRoot,
          candidatePackage,
        );
        if (workspaces === null) return null;
        if (
          candidatePackage.packageFile === packageContext.packageFile ||
          workspaces.some(
            (workspacePackage) =>
              packageContext.cwd === workspacePackage.cwd ||
              packageContext.cwd.startsWith(`${workspacePackage.cwd}/`),
          )
        ) {
          return candidatePackage;
        }
      }
    }
    if (candidateCwd === "") return packageContext;
    const parent = path.posix.dirname(candidateCwd);
    candidateCwd = parent === "." ? "" : parent;
  }
}

function resolveSelectedWorkspacePackage(
  repoRoot: string,
  rootPackage: NpmPackageResolution,
  selector: string,
): NpmPackageResolution | null {
  const directWorkspace = resolveWorkflowHelperPath(rootPackage.cwd, selector);
  if (directWorkspace !== null) {
    const directPackage = readNpmPackageAt(repoRoot, directWorkspace);
    if (directPackage !== null) return directPackage;
  }
  const workspacePackages = resolveDeclaredWorkspacePackages(
    repoRoot,
    rootPackage,
  );
  if (workspacePackages === null) return null;
  return (
    workspacePackages.find(
      (workspacePackage) => workspacePackage.manifest.name === selector,
    ) ?? null
  );
}

function resolveNpmInstallPackages(
  repoRoot: string,
  currentCwd: string,
  invocation: NpmInvocation,
): readonly NpmPackageResolution[] | null {
  const effectiveCwd = resolveNpmInvocationCwd(repoRoot, currentCwd, {
    ...invocation,
    workspace: null,
  });
  if (effectiveCwd === null) return null;
  const rootPackage = findNpmWorkspaceRootPackage(repoRoot, effectiveCwd);
  if (rootPackage === null) return null;

  if (invocation.workspace !== null) {
    const selectedPackage = resolveSelectedWorkspacePackage(
      repoRoot,
      rootPackage,
      invocation.workspace,
    );
    if (selectedPackage === null) return null;
    return selectedPackage.packageFile === rootPackage.packageFile
      ? [rootPackage]
      : [rootPackage, selectedPackage];
  }

  const workspaces = resolveDeclaredWorkspacePackages(repoRoot, rootPackage);
  return workspaces === null ? null : [rootPackage, ...workspaces];
}

type LocalHelperReference = Readonly<{
  path: string;
  tsconfigPath: string | null;
}>;

function extractLocalHelperReferences(
  repoRoot: string,
  cwd: string,
  command: string,
): Readonly<{
  references: readonly LocalHelperReference[];
  unresolved: boolean;
}> {
  const references = new Map<string, LocalHelperReference>();
  let unresolved = false;
  const add = (helperPath: string | undefined, tsconfigPath: string | null) => {
    if (helperPath === undefined) return;
    if (/^[`$]|\$\{|\$\(/u.test(helperPath)) {
      unresolved = true;
      return;
    }
    const normalized = helperPath.replace(/^\.\//u, "");
    references.set(`${normalized}\u0000${tsconfigPath ?? ""}`, {
      path: normalized,
      tsconfigPath,
    });
  };
  const parseNodeLike = (
    args: readonly string[],
    allowTsconfig: boolean,
  ): void => {
    let tsconfigPath: string | null = null;
    for (let index = 0; index < args.length; index += 1) {
      const argument = args[index]!;
      if (argument === "--tsconfig") {
        const value = args[index + 1];
        if (value === undefined || tsconfigPath !== null) unresolved = true;
        else tsconfigPath = value;
        index += 1;
        continue;
      }
      if (argument.startsWith("--tsconfig=")) {
        if (tsconfigPath !== null) unresolved = true;
        tsconfigPath = argument.slice("--tsconfig=".length);
        continue;
      }
      if (
        argument === "-e" ||
        argument === "--eval" ||
        argument === "-p" ||
        argument === "--print"
      ) {
        return;
      }
      if (
        argument === "--import" ||
        argument === "-r" ||
        argument === "--require"
      ) {
        if (args[index + 1] === undefined) unresolved = true;
        index += 1;
        continue;
      }
      if (argument === "--") continue;
      if (argument.startsWith("-")) continue;
      if (!allowTsconfig && tsconfigPath !== null) unresolved = true;
      add(argument, tsconfigPath);
      return;
    }
  };

  for (const invocation of extractStaticCommandInvocations(command)) {
    const executable = path.posix.basename(invocation.executable);
    unresolved ||= invocation.unresolved;
    if (executable === "source" || executable === ".") {
      const helperPath = invocation.args.find(
        (argument) => !argument.startsWith("-"),
      );
      if (helperPath === undefined) unresolved = true;
      else add(helperPath, null);
      continue;
    }
    if (/^(?:bash|sh|zsh|ksh)$/u.test(executable)) {
      for (let index = 0; index < invocation.args.length; index += 1) {
        const argument = invocation.args[index]!;
        if (argument === "-c" || /^-[A-Za-z]*c[A-Za-z]*$/u.test(argument)) {
          unresolved = true;
          break;
        }
        if (argument === "-o" || argument === "-O") {
          if (invocation.args[index + 1] === undefined) unresolved = true;
          index += 1;
          continue;
        }
        if (argument === "--") continue;
        if (argument.startsWith("-")) continue;
        add(argument, null);
        break;
      }
      continue;
    }
    if (executable === "node" || executable === "tsx") {
      parseNodeLike(invocation.args, executable === "tsx");
      continue;
    }
    if (executable === "npx") {
      let index = 0;
      while (invocation.args[index]?.startsWith("-")) index += 1;
      if (path.posix.basename(invocation.args[index] ?? "") === "tsx") {
        parseNodeLike(invocation.args.slice(index + 1), true);
      }
      continue;
    }
    if (
      !path.posix.isAbsolute(invocation.executable) &&
      !/^[<>]/u.test(invocation.executable) &&
      invocation.executable.includes("/")
    ) {
      add(invocation.executable, null);
    }
    if (
      invocation.pathDirectories !== null &&
      invocation.executable !== "" &&
      !invocation.executable.includes("/")
    ) {
      for (const directory of invocation.pathDirectories) {
        if (path.posix.isAbsolute(directory)) continue;
        const helperPath = path.posix.join(directory, invocation.executable);
        const resolved = resolveWorkflowHelperPath(cwd, helperPath);
        if (resolved === null) {
          unresolved = true;
        } else if (read(repoRoot, resolved) !== null) {
          add(helperPath, null);
        }
      }
    }
  }
  return { references: [...references.values()], unresolved };
}

function hasUnsupportedLocalInterpreter(command: string): boolean {
  return extractStaticCommandInvocations(command).some((invocation) =>
    /^(?:python(?:\d+(?:\.\d+)*)?|ruby|perl|php|bun|deno|pwsh|powershell)$/u.test(
      path.posix.basename(invocation.executable),
    ),
  );
}

const VERIFIED_GITHUB_ENV_DATABASE_KEYS = new Set([
  "DATABASE_URL",
  "STAGE1_OWNER_LOOP_DATABASE_URL",
  "CAIO_INITIALIZATION_GATE_DATABASE_URL",
  "CAIO_PRO_V1_DATABASE_URL",
  "MODEL_EGRESS_STORE_DATABASE_URL",
  "CAIO_ACCESS_GATEWAY_DATABASE_URL",
  "CAIO_CONTEXT_MEMORY_DATABASE_URL",
  "CAIO_AUDIT_STATE_DATABASE_URL",
]);

function readVerifiedGitHubEnvPrintfKey(command: string): string | null {
  const match = command.match(
    /^\s*printf\s+(['"])([A-Za-z_][A-Za-z0-9_]*)=[^'"]*\1(?:\s+[^;&|`]*)?\s*$/u,
  );
  const key = match?.[2];
  return key !== undefined && VERIFIED_GITHUB_ENV_DATABASE_KEYS.has(key)
    ? key
    : null;
}

function readGitHubEnvAppendProducer(line: string): string | null {
  if ((line.match(/\bGITHUB_ENV\b/gu) ?? []).length !== 1) return null;
  const match = line.match(
    /^(.*?)\s*>>\s*(?:"\$\{GITHUB_ENV\}"|"\$GITHUB_ENV"|'\$\{GITHUB_ENV\}'|'\$GITHUB_ENV'|\$\{GITHUB_ENV\}|\$GITHUB_ENV)\s*$/u,
  );
  return match?.[1]?.trim() ?? null;
}

function hasOnlyVerifiedGitHubEnvWrites(command: string): boolean {
  const lines = blankWholeLineComments(command).split("\n");
  let sawWrite = false;
  for (const [index, line] of lines.entries()) {
    if (!/\bGITHUB_ENV\b/u.test(line)) continue;
    sawWrite = true;
    const producer = readGitHubEnvAppendProducer(line);
    if (producer === null) return false;
    if (producer !== "}") {
      if (readVerifiedGitHubEnvPrintfKey(producer) === null) return false;
      continue;
    }

    let groupStart = index - 1;
    while (groupStart >= 0 && lines[groupStart]?.trim() !== "{") {
      groupStart -= 1;
    }
    if (groupStart < 0) return false;
    const writers = lines
      .slice(groupStart + 1, index)
      .map((entry) => entry.trim())
      .filter(Boolean);
    if (
      writers.length === 0 ||
      writers.some(
        (writer) => readVerifiedGitHubEnvPrintfKey(writer) === null,
      )
    ) {
      return false;
    }
  }
  return sawWrite;
}

function hasImplicitWorkflowExecutionMutation(command: string): boolean {
  const executable = blankWholeLineComments(command);
  if (/\bGITHUB_PATH\b/u.test(executable)) return true;
  return (
    /\bGITHUB_ENV\b/u.test(executable) &&
    !hasOnlyVerifiedGitHubEnvWrites(executable)
  );
}

type PendingHelper = Readonly<{
  file: string;
  cwd: string;
  d2LocalCloneAllowed: boolean;
  tsconfigFile: string | null;
}>;

type ReachableCommand = WorkflowCommand &
  Readonly<{
    sourceFile: string;
  }>;

type ReachableHelperCheck = Readonly<{
  violations: readonly CaioProV1Violation[];
  commands: readonly Pick<WorkflowCommand, "command" | "cwd">[];
}>;

function resolveWorkflowHelperPath(
  cwd: string,
  helperPath: string,
): string | null {
  if (path.posix.isAbsolute(helperPath)) return null;
  const normalized = path.posix.normalize(
    path.posix.join(cwd, helperPath.replace(/^\.\//u, "")),
  );
  if (normalized === ".." || normalized.startsWith("../")) return null;
  return normalized;
}

function findNearestRepoFile(
  repoRoot: string,
  cwd: string,
  fileName: string,
): string | null {
  let directory = cwd;
  while (true) {
    const candidate = directory
      ? path.posix.join(directory, fileName)
      : fileName;
    if (read(repoRoot, candidate) !== null) return candidate;
    if (directory === "") return null;
    const parent = path.posix.dirname(directory);
    directory = parent === "." ? "" : parent;
  }
}

function checkWorkflowReachableHelpers(
  repoRoot: string,
  workflowFile: string,
  commands: readonly WorkflowCommand[],
): ReachableHelperCheck {
  const violations: CaioProV1Violation[] = [];
  const reachableCommands = new Map<
    string,
    Pick<WorkflowCommand, "command" | "cwd">
  >();
  const pendingCommands: ReachableCommand[] = commands.map((command) => ({
    ...command,
    sourceFile: workflowFile,
  }));
  const pendingHelpers: PendingHelper[] = [];
  const visitedCommands = new Set<string>();
  const visitedHelpers = new Set<string>();
  while (pendingCommands.length > 0 || pendingHelpers.length > 0) {
    const pendingCommand = pendingCommands.shift();
    if (pendingCommand !== undefined) {
      const commandKey = `${pendingCommand.cwd}\u0000${pendingCommand.d2LocalCloneAllowed ? "local" : "ordinary"}\u0000${pendingCommand.command}`;
      if (visitedCommands.has(commandKey)) continue;
      visitedCommands.add(commandKey);
      reachableCommands.set(
        `${pendingCommand.cwd}\u0000${pendingCommand.command}`,
        { command: pendingCommand.command, cwd: pendingCommand.cwd },
      );
      if (hasUnsupportedLocalInterpreter(pendingCommand.command)) {
        violations.push({
          rule: "CPV1-CI",
          file: pendingCommand.sourceFile,
          detail:
            "workflow-reachable command uses an unsupported local interpreter and could not be verified statically",
        });
      }
      if (hasImplicitWorkflowExecutionMutation(pendingCommand.command)) {
        violations.push({
          rule: "CPV1-CI",
          file: pendingCommand.sourceFile,
          detail:
            "workflow implicit execution state mutation could not be resolved statically",
        });
      }
      if (
        !pendingCommand.d2LocalCloneAllowed &&
        extractStaticCommandInvocations(pendingCommand.command).some(
          (invocation) =>
            /^(?:cd|pushd|popd)$/u.test(
              path.posix.basename(invocation.executable),
            ),
        )
      ) {
        violations.push({
          rule: "CPV1-CI",
          file: pendingCommand.sourceFile,
          detail:
            "workflow-reachable working directory mutation could not be resolved statically",
        });
      }
      if (/\bTSX_TSCONFIG_PATH\b/u.test(pendingCommand.command)) {
        violations.push({
          rule: "CPV1-CI",
          file: pendingCommand.sourceFile,
          detail:
            "workflow TSX_TSCONFIG_PATH selection could not be resolved statically",
        });
      }
      if (
        (path.posix.basename(pendingCommand.sourceFile) === PACKAGE_FILE &&
          WORKFLOW_MANUAL_REMOTE_FETCH.test(pendingCommand.command)) ||
        (pendingCommand.sourceFile !== workflowFile &&
          hasInlineNodeFetch(pendingCommand.command))
      ) {
        violations.push({
          rule: "CPV1-CI",
          file: pendingCommand.sourceFile,
          detail:
            "workflow-reachable command must not fetch remote repositories",
        });
      }
      const helperExtraction = extractLocalHelperReferences(
        repoRoot,
        pendingCommand.cwd,
        pendingCommand.command,
      );
      for (const helperReference of helperExtraction.references) {
        const resolved = resolveWorkflowHelperPath(
          pendingCommand.cwd,
          helperReference.path,
        );
        if (resolved === null) {
          violations.push({
            rule: "CPV1-CI",
            file: workflowFile,
            detail: `workflow helper path leaves the repository: ${helperReference.path}`,
          });
        } else {
          const explicitTsconfig =
            helperReference.tsconfigPath === null
              ? null
              : resolveWorkflowHelperPath(
                  pendingCommand.cwd,
                  helperReference.tsconfigPath,
                );
          if (
            helperReference.tsconfigPath !== null &&
            explicitTsconfig === null
          ) {
            violations.push({
              rule: "CPV1-CI",
              file: pendingCommand.sourceFile,
              detail: `workflow tsconfig path leaves the repository: ${helperReference.tsconfigPath}`,
            });
            continue;
          }
          pendingHelpers.push({
            file: resolved,
            cwd: pendingCommand.cwd,
            d2LocalCloneAllowed:
              pendingCommand.d2LocalCloneAllowed &&
              workflowFile === D2_DOCKER_SMOKE_WORKFLOW &&
              pendingCommand.cwd === "" &&
              pendingCommand.command === D2_DOCKER_SMOKE_INVOCATION &&
              resolved === D2_DOCKER_SMOKE_HELPER,
            tsconfigFile:
              explicitTsconfig ??
              findNearestRepoFile(
                repoRoot,
                pendingCommand.cwd,
                "tsconfig.json",
              ),
          });
        }
      }
      for (const npmInvocation of extractNpmInvocations(
        pendingCommand.command,
      )) {
        if (npmInvocation.unresolved) {
          violations.push({
            rule: "CPV1-CI",
            file: pendingCommand.sourceFile,
            detail: "workflow npm invocation could not be resolved statically",
          });
          continue;
        }
        const npmCwd = resolveNpmInvocationCwd(
          repoRoot,
          pendingCommand.cwd,
          npmInvocation,
        );
        if (npmCwd === null) {
          violations.push({
            rule: "CPV1-CI",
            file: pendingCommand.sourceFile,
            detail: "workflow npm execution context could not be resolved",
          });
          continue;
        }
        if (npmInvocation.kind === "install") {
          if (npmInvocation.ignoreScripts) continue;
          const installPackages = resolveNpmInstallPackages(
            repoRoot,
            pendingCommand.cwd,
            npmInvocation,
          );
          if (installPackages === null) {
            violations.push({
              rule: "CPV1-CI",
              file: pendingCommand.sourceFile,
              detail:
                "workflow npm install package graph could not be resolved",
            });
            continue;
          }
          for (const installPackage of installPackages) {
            for (const lifecycleName of NPM_INSTALL_LIFECYCLE_SCRIPTS) {
              const lifecycleCommand = installPackage.scripts[lifecycleName];
              if (typeof lifecycleCommand !== "string") continue;
              pendingCommands.push({
                command: lifecycleCommand,
                cwd: installPackage.cwd,
                d2LocalCloneAllowed: false,
                sourceFile: installPackage.packageFile,
              });
            }
          }
          continue;
        }
        const scriptName = npmInvocation.scriptName;
        if (scriptName === null) {
          violations.push({
            rule: "CPV1-CI",
            file: pendingCommand.sourceFile,
            detail: "workflow npm script name could not be resolved",
          });
          continue;
        }
        const resolution = resolveNpmScript(repoRoot, npmCwd, scriptName);
        if (resolution.kind !== "resolved") {
          const packageContext =
            resolution.packageFile === null
              ? ` from working directory ${pendingCommand.cwd || "."}`
              : ` in ${resolution.packageFile}`;
          violations.push({
            rule: "CPV1-CI",
            file: workflowFile,
            detail:
              resolution.kind === "invalid_package"
                ? `workflow npm package could not be parsed: ${resolution.packageFile}`
                : `workflow npm script could not be resolved${packageContext}: ${scriptName}`,
          });
        } else {
          for (const command of resolution.commands) {
            pendingCommands.push({
              command,
              cwd: resolution.cwd,
              d2LocalCloneAllowed: false,
              sourceFile: resolution.packageFile,
            });
          }
        }
      }
      if (helperExtraction.unresolved) {
        violations.push({
          rule: "CPV1-CI",
          file: pendingCommand.sourceFile,
          detail: "workflow helper entry could not be resolved statically",
        });
      }
      continue;
    }

    const helper = pendingHelpers.shift()!;
    const helperKey = `${helper.file}\u0000${helper.cwd}\u0000${helper.tsconfigFile ?? ""}\u0000${helper.d2LocalCloneAllowed ? "local" : "ordinary"}`;
    if (visitedHelpers.has(helperKey)) continue;
    visitedHelpers.add(helperKey);
    const content = read(repoRoot, helper.file);
    if (content === null) {
      violations.push({
        rule: "CPV1-CI",
        file: workflowFile,
        detail: `workflow-reachable helper could not be read: ${helper.file}`,
      });
      continue;
    }
    if (isShellHelper(helper.file, content)) {
      pendingCommands.push({
        command: blankWholeLineComments(content),
        cwd: helper.cwd,
        d2LocalCloneAllowed:
          helper.d2LocalCloneAllowed &&
          isSafeLocalCloneHelper(helper.file, content),
        sourceFile: helper.file,
      });
    } else {
      const inspection = inspectSourceFile(helper.file, content);
      if (inspection.parseDiagnostics.length > 0) {
        violations.push({
          rule: "CPV1-CI",
          file: helper.file,
          detail: "workflow-reachable helper could not be parsed statically",
        });
      }
      if (
        helper.tsconfigFile !== null &&
        readTsModuleResolutionConfig(repoRoot, helper.tsconfigFile) === null
      ) {
        violations.push({
          rule: "CPV1-CI",
          file: helper.tsconfigFile,
          detail: "workflow TypeScript configuration could not be resolved",
        });
      }
      for (const moduleSpecifier of findStaticModuleSpecifiers(inspection)) {
        const resolution = resolveLocalModulePath(
          repoRoot,
          helper.file,
          moduleSpecifier,
          helper.tsconfigFile,
        );
        if (resolution.kind === "unresolved") {
          violations.push({
            rule: "CPV1-CI",
            file: helper.file,
            detail: `workflow-reachable local module could not be resolved: ${moduleSpecifier}`,
          });
        } else if (resolution.kind === "resolved") {
          pendingHelpers.push({
            file: resolution.file,
            cwd: helper.cwd,
            d2LocalCloneAllowed: false,
            tsconfigFile: helper.tsconfigFile,
          });
        }
      }
    }
    if (
      helperHasRemoteRepositoryAccess(helper.file, content) &&
      !(
        helper.d2LocalCloneAllowed &&
        isSafeLocalCloneHelper(helper.file, content)
      )
    ) {
      violations.push({
        rule: "CPV1-CI",
        file: helper.file,
        detail: "workflow-reachable helper must not fetch remote repositories",
      });
    }
  }
  return { violations, commands: [...reachableCommands.values()] };
}

function findStaticModuleSpecifiers(inspection: SourceInspection): string[] {
  if (inspection.parseDiagnostics.length > 0) return [];
  const specifiers = new Set<string>();
  const add = (node: ts.Expression | undefined): void => {
    if (node !== undefined && ts.isStringLiteralLike(node)) {
      specifiers.add(node.text);
    }
  };
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      add(node.moduleSpecifier);
    } else if (ts.isCallExpression(node)) {
      if (
        node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === "require")
      ) {
        add(node.arguments[0]);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(inspection.source);
  return [...specifiers];
}

type LocalModuleResolution =
  | Readonly<{ kind: "external" | "unresolved" }>
  | Readonly<{ kind: "resolved"; file: string }>;

type TsModuleResolutionConfig = Readonly<{
  baseUrl: string | null;
  hasBaseUrl: boolean;
  paths: Readonly<Record<string, unknown>>;
  pathsBase: string;
  hasPaths: boolean;
}>;

function resolveRepoRelativePath(base: string, target: string): string | null {
  const normalized = path.posix.normalize(path.posix.join(base, target));
  return normalized === ".." || normalized.startsWith("../")
    ? null
    : normalized === "."
      ? ""
      : normalized;
}

function readTsModuleResolutionConfig(
  repoRoot: string,
  configFile = "tsconfig.json",
  visited = new Set<string>(),
): TsModuleResolutionConfig | null {
  if (visited.has(configFile)) return null;
  visited.add(configFile);
  const content = read(repoRoot, configFile);
  if (content === null) return null;
  const parsed = ts.parseConfigFileTextToJson(configFile, content);
  if (parsed.error !== undefined || !isRecord(parsed.config)) return null;

  const configDirectory = path.posix.dirname(configFile);
  const localDirectory = configDirectory === "." ? "" : configDirectory;
  let inherited: TsModuleResolutionConfig = {
    baseUrl: null,
    hasBaseUrl: false,
    paths: {},
    pathsBase: localDirectory,
    hasPaths: false,
  };
  if (parsed.config.extends !== undefined) {
    const extendedConfigs =
      typeof parsed.config.extends === "string"
        ? [parsed.config.extends]
        : Array.isArray(parsed.config.extends) &&
            parsed.config.extends.every(
              (entry): entry is string => typeof entry === "string",
            )
          ? parsed.config.extends
          : null;
    if (extendedConfigs === null) {
      return null;
    }
    for (const extendedConfig of extendedConfigs) {
      if (!extendedConfig.startsWith(".")) return null;
      let extendedFile = resolveRepoRelativePath(
        localDirectory,
        extendedConfig,
      );
      if (extendedFile === null) return null;
      if (!path.posix.extname(extendedFile)) extendedFile += ".json";
      const resolvedParent = readTsModuleResolutionConfig(
        repoRoot,
        extendedFile,
        new Set(visited),
      );
      if (resolvedParent === null) return null;
      inherited = {
        baseUrl: resolvedParent.hasBaseUrl
          ? resolvedParent.baseUrl
          : inherited.baseUrl,
        hasBaseUrl: inherited.hasBaseUrl || resolvedParent.hasBaseUrl,
        paths: resolvedParent.hasPaths ? resolvedParent.paths : inherited.paths,
        pathsBase: resolvedParent.hasPaths
          ? resolvedParent.pathsBase
          : inherited.pathsBase,
        hasPaths: inherited.hasPaths || resolvedParent.hasPaths,
      };
    }
  }

  const compilerOptions = isRecord(parsed.config.compilerOptions)
    ? parsed.config.compilerOptions
    : {};
  let baseUrl = inherited.baseUrl;
  let hasBaseUrl = inherited.hasBaseUrl;
  if (compilerOptions.baseUrl !== undefined) {
    if (typeof compilerOptions.baseUrl !== "string") return null;
    baseUrl = resolveRepoRelativePath(localDirectory, compilerOptions.baseUrl);
    if (baseUrl === null) return null;
    hasBaseUrl = true;
  }
  let paths = inherited.paths;
  let pathsBase = inherited.pathsBase;
  let hasPaths = inherited.hasPaths;
  if (compilerOptions.paths !== undefined) {
    if (!isRecord(compilerOptions.paths)) return null;
    paths = compilerOptions.paths;
    pathsBase = baseUrl ?? localDirectory;
    hasPaths = true;
  }
  return { baseUrl, hasBaseUrl, paths, pathsBase, hasPaths };
}

function resolveSourceFileCandidate(
  repoRoot: string,
  base: string,
): string | null {
  if (base === ".." || base.startsWith("../") || path.posix.isAbsolute(base)) {
    return null;
  }
  const candidates = REPOSITORY_SOURCE_EXTENSIONS.has(path.posix.extname(base))
    ? [base]
    : [
        base,
        ...[...REPOSITORY_SOURCE_EXTENSIONS].map(
          (extension) => `${base}${extension}`,
        ),
        ...[...REPOSITORY_SOURCE_EXTENSIONS].map((extension) =>
          path.posix.join(base, `index${extension}`),
        ),
      ];
  return (
    candidates.find((candidate) => read(repoRoot, candidate) !== null) ?? null
  );
}

function resolvePackageImportPath(
  repoRoot: string,
  parentFile: string,
  moduleSpecifier: string,
): LocalModuleResolution {
  const packageFile = findNearestRepoFile(
    repoRoot,
    path.posix.dirname(parentFile),
    PACKAGE_FILE,
  );
  if (packageFile === null) return { kind: "unresolved" };
  const content = read(repoRoot, packageFile);
  if (content === null) return { kind: "unresolved" };
  let manifest: unknown;
  try {
    manifest = JSON.parse(content);
  } catch {
    return { kind: "unresolved" };
  }
  if (!isRecord(manifest) || !isRecord(manifest.imports)) {
    return { kind: "unresolved" };
  }

  let target: unknown;
  if (Object.prototype.hasOwnProperty.call(manifest.imports, moduleSpecifier)) {
    target = manifest.imports[moduleSpecifier];
  } else {
    return { kind: "unresolved" };
  }

  if (typeof target !== "string") return { kind: "unresolved" };
  if (!target.startsWith("./")) {
    return target.startsWith("../") || path.posix.isAbsolute(target)
      ? { kind: "unresolved" }
      : { kind: "external" };
  }
  if (target.includes("*")) return { kind: "unresolved" };
  const packageDirectory = path.posix.dirname(packageFile);
  const base = resolveRepoRelativePath(
    packageDirectory === "." ? "" : packageDirectory,
    target,
  );
  if (base === null) return { kind: "unresolved" };
  const file = resolveSourceFileCandidate(repoRoot, base);
  return file === null ? { kind: "unresolved" } : { kind: "resolved", file };
}

function resolveLocalModulePath(
  repoRoot: string,
  parentFile: string,
  moduleSpecifier: string,
  tsconfigFile: string | null,
): LocalModuleResolution {
  if (moduleSpecifier.startsWith(".")) {
    const base = path.posix.normalize(
      path.posix.join(path.posix.dirname(parentFile), moduleSpecifier),
    );
    const file = resolveSourceFileCandidate(repoRoot, base);
    return file === null ? { kind: "unresolved" } : { kind: "resolved", file };
  }

  if (moduleSpecifier.startsWith("#")) {
    return resolvePackageImportPath(repoRoot, parentFile, moduleSpecifier);
  }

  if (tsconfigFile === null) return { kind: "external" };
  const config = readTsModuleResolutionConfig(repoRoot, tsconfigFile);
  if (config === null) {
    return { kind: "unresolved" };
  }
  const matchingPathPatterns = Object.entries(config.paths)
    .map(([pattern, targets], declarationIndex) => {
      const wildcardIndex = pattern.indexOf("*");
      if (
        wildcardIndex !== pattern.lastIndexOf("*") ||
        !Array.isArray(targets)
      ) {
        return null;
      }
      const prefix =
        wildcardIndex < 0 ? pattern : pattern.slice(0, wildcardIndex);
      const suffix = wildcardIndex < 0 ? "" : pattern.slice(wildcardIndex + 1);
      const matches =
        wildcardIndex < 0
          ? moduleSpecifier === pattern
          : moduleSpecifier.startsWith(prefix) &&
            moduleSpecifier.endsWith(suffix) &&
            moduleSpecifier.length >= prefix.length + suffix.length;
      return matches
        ? {
            pattern,
            targets,
            wildcardIndex,
            prefix,
            suffix,
            declarationIndex,
          }
        : null;
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((left, right) => {
      const leftExact = left.wildcardIndex < 0 ? 1 : 0;
      const rightExact = right.wildcardIndex < 0 ? 1 : 0;
      return (
        rightExact - leftExact ||
        right.prefix.length - left.prefix.length ||
        left.declarationIndex - right.declarationIndex
      );
    });
  const selectedPathPattern = matchingPathPatterns[0];
  if (selectedPathPattern !== undefined) {
    const wildcard =
      selectedPathPattern.wildcardIndex < 0
        ? ""
        : moduleSpecifier.slice(
            selectedPathPattern.prefix.length,
            moduleSpecifier.length - selectedPathPattern.suffix.length,
          );
    for (const target of selectedPathPattern.targets) {
      if (typeof target !== "string") return { kind: "unresolved" };
      const base = path.posix.normalize(
        path.posix.join(config.pathsBase, target.replace("*", wildcard)),
      );
      const file = resolveSourceFileCandidate(repoRoot, base);
      if (file !== null) return { kind: "resolved", file };
    }
    return { kind: "unresolved" };
  }
  if (config.baseUrl !== null) {
    const base = resolveRepoRelativePath(config.baseUrl, moduleSpecifier);
    if (base === null) return { kind: "unresolved" };
    const file = resolveSourceFileCandidate(repoRoot, base);
    if (file !== null) return { kind: "resolved", file };
  }
  return { kind: "external" };
}

function isSafeLocalCloneHelper(file: string, content: string): boolean {
  return (
    file === D2_DOCKER_SMOKE_HELPER &&
    createHash("sha256").update(content).digest("hex") ===
      D2_DOCKER_SMOKE_HELPER_SHA256
  );
}

function helperHasRemoteRepositoryAccess(
  file: string,
  content: string,
): boolean {
  if (isShellHelper(file, content)) {
    return WORKFLOW_MANUAL_REMOTE_FETCH.test(content);
  }
  const inspection = inspectSourceFile(file, content);
  if (inspection.parseDiagnostics.length > 0) return true;
  const childProcessCallAliases = new Map<string, string>();
  const childProcessModuleAliases = new Set<string>();
  const fetchCallAliases = new Set(["fetch"]);
  for (const statement of inspection.source.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      !/^(?:node:)?child_process$/u.test(statement.moduleSpecifier.text) ||
      statement.importClause === undefined
    ) {
      continue;
    }
    if (statement.importClause.name !== undefined) {
      childProcessModuleAliases.add(statement.importClause.name.text);
    }
    if (statement.importClause.namedBindings === undefined) continue;
    if (ts.isNamespaceImport(statement.importClause.namedBindings)) {
      childProcessModuleAliases.add(
        statement.importClause.namedBindings.name.text,
      );
      continue;
    }
    if (!ts.isNamedImports(statement.importClause.namedBindings)) continue;
    for (const element of statement.importClause.namedBindings.elements) {
      const importedName = element.propertyName?.text ?? element.name.text;
      if (
        /^(?:exec|execSync|execFile|execFileSync|spawn|spawnSync)$/u.test(
          importedName,
        )
      ) {
        childProcessCallAliases.set(element.name.text, importedName);
      }
    }
  }
  const isChildProcessRequire = (expression: ts.Expression): boolean => {
    const value = unwrapTransparentExpression(expression);
    return (
      ts.isCallExpression(value) &&
      ts.isIdentifier(value.expression) &&
      value.expression.text === "require" &&
      value.arguments.length === 1 &&
      ts.isStringLiteralLike(value.arguments[0]!) &&
      /^(?:node:)?child_process$/u.test(value.arguments[0].text)
    );
  };
  const staticPropertyName = (expression: ts.Expression): string | null => {
    const value = unwrapTransparentExpression(expression);
    if (ts.isPropertyAccessExpression(value)) return value.name.text;
    if (
      ts.isElementAccessExpression(value) &&
      value.argumentExpression !== undefined &&
      ts.isStringLiteralLike(value.argumentExpression)
    ) {
      return value.argumentExpression.text;
    }
    return null;
  };
  const propertyTarget = (expression: ts.Expression): ts.Expression | null => {
    const value = unwrapTransparentExpression(expression);
    return ts.isPropertyAccessExpression(value) ||
      ts.isElementAccessExpression(value)
      ? value.expression
      : null;
  };
  const isChildProcessModuleReference = (
    expression: ts.Expression,
  ): boolean => {
    const value = unwrapTransparentExpression(expression);
    return (
      isChildProcessRequire(value) ||
      (ts.isIdentifier(value) && childProcessModuleAliases.has(value.text))
    );
  };
  const isFetchReference = (expression: ts.Expression): boolean => {
    const value = unwrapTransparentExpression(expression);
    return (
      (ts.isIdentifier(value) && fetchCallAliases.has(value.text)) ||
      staticPropertyName(value) === "fetch"
    );
  };
  const isFetchInvocation = (expression: ts.Expression): boolean => {
    if (isFetchReference(expression)) return true;
    const target = propertyTarget(expression);
    return (
      target !== null &&
      /^(?:call|apply|bind)$/u.test(staticPropertyName(expression) ?? "") &&
      isFetchReference(target)
    );
  };
  const collectCommonJsAliases = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isObjectBindingPattern(node.name) &&
      node.initializer !== undefined
    ) {
      for (const element of node.name.elements) {
        if (!ts.isIdentifier(element.name)) continue;
        const propertyName =
          element.propertyName?.getText(inspection.source) ?? element.name.text;
        if (propertyName.replace(/^['"]|['"]$/gu, "") === "fetch") {
          fetchCallAliases.add(element.name.text);
        }
      }
    }
    if (
      ts.isVariableDeclaration(node) &&
      ts.isObjectBindingPattern(node.name) &&
      node.initializer !== undefined &&
      isChildProcessModuleReference(node.initializer)
    ) {
      for (const element of node.name.elements) {
        if (!ts.isIdentifier(element.name)) continue;
        const importedName =
          element.propertyName?.getText(inspection.source) ?? element.name.text;
        const normalizedImportedName = importedName.replace(
          /^["']|["']$/gu,
          "",
        );
        if (
          /^(?:exec|execSync|execFile|execFileSync|spawn|spawnSync)$/u.test(
            normalizedImportedName,
          )
        ) {
          childProcessCallAliases.set(
            element.name.text,
            normalizedImportedName,
          );
        }
      }
    }
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer !== undefined
    ) {
      const initializer = unwrapTransparentExpression(node.initializer);
      if (isChildProcessRequire(initializer)) {
        childProcessModuleAliases.add(node.name.text);
      }
      if (isFetchReference(initializer)) {
        fetchCallAliases.add(node.name.text);
      }
      if (
        ts.isPropertyAccessExpression(initializer) ||
        (ts.isElementAccessExpression(initializer) &&
          initializer.argumentExpression !== undefined &&
          ts.isStringLiteralLike(initializer.argumentExpression))
      ) {
        const importedName = ts.isPropertyAccessExpression(initializer)
          ? initializer.name.text
          : (initializer.argumentExpression as ts.StringLiteralLike).text;
        if (
          /^(?:exec|execSync|execFile|execFileSync|spawn|spawnSync)$/u.test(
            importedName,
          ) &&
          isChildProcessModuleReference(initializer.expression)
        ) {
          childProcessCallAliases.set(node.name.text, importedName);
        }
      }
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isObjectLiteralExpression(unwrapTransparentExpression(node.left))
    ) {
      const pattern = unwrapTransparentExpression(
        node.left,
      ) as ts.ObjectLiteralExpression;
      const value = unwrapTransparentExpression(node.right);
      for (const property of pattern.properties) {
        let importedName: string | null = null;
        let alias: string | null = null;
        if (
          ts.isPropertyAssignment(property) &&
          ts.isIdentifier(unwrapTransparentExpression(property.initializer))
        ) {
          importedName = ts.isIdentifier(property.name)
            ? property.name.text
            : ts.isStringLiteralLike(property.name)
              ? property.name.text
              : null;
          alias = (
            unwrapTransparentExpression(property.initializer) as ts.Identifier
          ).text;
        } else if (ts.isShorthandPropertyAssignment(property)) {
          importedName = property.name.text;
          alias = property.name.text;
        }
        if (importedName === null || alias === null) continue;
        if (importedName === "fetch") fetchCallAliases.add(alias);
        if (
          isChildProcessModuleReference(value) &&
          /^(?:exec|execSync|execFile|execFileSync|spawn|spawnSync)$/u.test(
            importedName,
          )
        ) {
          childProcessCallAliases.set(alias, importedName);
        }
      }
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isIdentifier(unwrapTransparentExpression(node.left))
    ) {
      const alias = (unwrapTransparentExpression(node.left) as ts.Identifier)
        .text;
      const value = unwrapTransparentExpression(node.right);
      if (isFetchReference(value)) fetchCallAliases.add(alias);
      if (isChildProcessRequire(value)) childProcessModuleAliases.add(alias);
      if (
        ts.isPropertyAccessExpression(value) ||
        (ts.isElementAccessExpression(value) &&
          value.argumentExpression !== undefined &&
          ts.isStringLiteralLike(value.argumentExpression))
      ) {
        const importedName = ts.isPropertyAccessExpression(value)
          ? value.name.text
          : (value.argumentExpression as ts.StringLiteralLike).text;
        if (
          /^(?:exec|execSync|execFile|execFileSync|spawn|spawnSync)$/u.test(
            importedName,
          ) &&
          isChildProcessModuleReference(value.expression)
        ) {
          childProcessCallAliases.set(alias, importedName);
        }
      }
    }
    ts.forEachChild(node, collectCommonJsAliases);
  };
  collectCommonJsAliases(inspection.source);
  let remoteAccess = false;
  const visit = (node: ts.Node): void => {
    if (remoteAccess) return;
    if (ts.isCallExpression(node)) {
      const callee = unwrapTransparentExpression(node.expression);
      if (isFetchInvocation(callee)) {
        remoteAccess = true;
        return;
      }
      const calleeName = ts.isIdentifier(callee)
        ? (childProcessCallAliases.get(callee.text) ?? callee.text)
        : staticPropertyName(callee);
      if (
        calleeName !== null &&
        /^(?:exec|execSync|execFile|execFileSync|spawn|spawnSync)$/u.test(
          calleeName,
        )
      ) {
        const firstArgument = node.arguments[0];
        if (firstArgument === undefined) {
          return;
        }
        const firstValue = unwrapTransparentExpression(firstArgument);
        const staticCommand = ts.isStringLiteralLike(firstValue)
          ? firstValue.text
          : firstValue.getText(inspection.source);
        const commandParts = [staticCommand];
        if (/^(?:execFile|execFileSync|spawn|spawnSync)$/u.test(calleeName)) {
          const argv = node.arguments[1];
          if (argv !== undefined) {
            if (
              !ts.isArrayLiteralExpression(argv) ||
              argv.elements.some((element) => !ts.isStringLiteralLike(element))
            ) {
              if (/^(?:curl|gh|wget)$/u.test(staticCommand)) {
                remoteAccess = true;
              }
              return;
            }
            commandParts.push(
              ...argv.elements.map(
                (element) => (element as ts.StringLiteralLike).text,
              ),
            );
          }
        }
        const command = commandParts.join(" ");
        if (WORKFLOW_MANUAL_REMOTE_FETCH.test(command)) {
          remoteAccess = true;
          return;
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(inspection.source);
  return remoteAccess;
}

function isShellHelper(file: string, content: string): boolean {
  return (
    /\.(?:sh|bash|zsh)$/u.test(file) ||
    /^#![^\n]*(?:ba|z|k)?sh\b/u.test(content) ||
    path.posix.extname(file) === ""
  );
}

function hasInlineNodeFetch(command: string): boolean {
  for (const invocation of extractStaticCommandInvocations(command)) {
    if (path.posix.basename(invocation.executable) !== "node") continue;
    for (let index = 0; index < invocation.args.length; index += 1) {
      const argument = invocation.args[index]!;
      const inlineSource =
        argument === "-e" ||
        argument === "--eval" ||
        argument === "-p" ||
        argument === "--print"
          ? invocation.args[index + 1]
          : argument.startsWith("--eval=")
            ? argument.slice("--eval=".length)
            : null;
      if (
        inlineSource !== null &&
        inlineSource !== undefined &&
        helperHasRemoteRepositoryAccess("inline-node.mjs", inlineSource)
      ) {
        return true;
      }
    }
  }
  return false;
}

type WorkflowIsolationCheck = Readonly<{
  violations: readonly CaioProV1Violation[];
  reachableCommands: readonly Pick<WorkflowCommand, "command" | "cwd">[];
}>;

function checkPublicWorkflowIsolation(
  repoRoot: string,
  workflowFile: string,
  source: string,
): WorkflowIsolationCheck {
  const violations: CaioProV1Violation[] = [];
  const d2WorkflowDigestMatches =
    workflowFile === D2_DOCKER_SMOKE_WORKFLOW &&
    createHash("sha256").update(source).digest("hex") ===
      D2_DOCKER_SMOKE_WORKFLOW_SHA256;
  const semantic = parseWorkflowSemantics(source, d2WorkflowDigestMatches);
  const executableSource = blankWholeLineComments(source);
  const normalizedCommandSource = executableSource.replace(/\\\s*\n\s*/gu, " ");
  const reject = (detail: string) =>
    violations.push({ rule: "CPV1-CI", file: workflowFile, detail });

  for (const error of semantic.errors) reject(error);

  if (WORKFLOW_SECRET_EXPRESSION.test(executableSource)) {
    reject(
      "Public workflows must not reference Actions secrets; private-repository credentials belong to no Public CI job",
    );
  }
  if (
    semantic.hasOidcWrite ||
    WORKFLOW_OIDC_REQUEST_ENVIRONMENT.test(executableSource) ||
    semantic.commands.some(({ command }) =>
      WORKFLOW_OIDC_REQUEST_ENVIRONMENT_OBFUSCATED.test(
        normalizeObfuscatedCommand(command),
      ),
    )
  ) {
    reject(
      "Public workflows must not mint external credentials through OIDC-capable permissions",
    );
  }
  if (WORKFLOW_MANUAL_REMOTE_FETCH.test(normalizedCommandSource)) {
    reject(
      "Public workflows must not fetch another repository through shell network commands",
    );
  }
  if (/\bTSX_TSCONFIG_PATH\b/u.test(executableSource)) {
    reject(
      "Public workflows must not select TSX_TSCONFIG_PATH because that module-resolution context cannot be verified statically",
    );
  }
  if (semantic.commands.some(({ command }) => hasInlineNodeFetch(command))) {
    reject(
      "Public workflows must not fetch another repository through inline node evaluation",
    );
  }

  const workflowActions = semantic.actions;
  const actionsToValidate = new Set([
    ...workflowActions,
    ...[...executableSource.matchAll(WORKFLOW_USES)].map(
      (match) => match[1] ?? "",
    ),
  ]);
  for (const action of actionsToValidate) {
    if (!ALLOWED_WORKFLOW_ACTIONS.has(action)) {
      reject(`workflow action is not allowlisted for Public CI: ${action}`);
    }
  }

  let parsedCheckoutCount = 0;
  for (const stepBlock of extractWorkflowStepBlocks(executableSource)) {
    if (readWorkflowInput(stepBlock, "uses") !== "actions/checkout@v5") {
      continue;
    }
    parsedCheckoutCount += 1;
    if (
      /(?:^[ \t]*(?:-[ \t]*)?|[,{][ \t]*)["'][^"'\r\n]+["'][ \t]*:/mu.test(
        stepBlock,
      ) ||
      /\bwith\s*:[ \t]*(?:\$\{\{|\*|\S)/iu.test(stepBlock) ||
      /(?:^|\s)<<\s*:/mu.test(stepBlock)
    ) {
      reject(
        "actions/checkout inputs must use plain explicit mapping keys; quoted keys, scalar expressions, aliases, and YAML merges cannot hide repository ownership",
      );
    }
    const repository = readWorkflowInput(stepBlock, "repository");
    const token = readWorkflowInput(stepBlock, "token");
    if (repository !== null) {
      if (!ALLOWED_ANONYMOUS_CHECKOUT_REPOSITORIES.has(repository)) {
        reject(
          `external checkout is not allowlisted for Public CI: ${repository}`,
        );
      }
      if (readWorkflowInput(stepBlock, "persist-credentials") !== "false") {
        reject(
          "an allowlisted anonymous checkout must set persist-credentials: false",
        );
      }
    }
    if (token !== null) {
      reject(
        "actions/checkout must not receive an explicit token in Public CI",
      );
    }
  }

  const checkoutActionCount = workflowActions.filter(
    (action) => action === "actions/checkout@v5",
  ).length;
  if (parsedCheckoutCount !== checkoutActionCount) {
    reject(
      "every actions/checkout step must use an explicit block mapping so repository ownership can be verified",
    );
  }

  const reachable = checkWorkflowReachableHelpers(
    repoRoot,
    workflowFile,
    semantic.commands,
  );
  violations.push(...reachable.violations);

  return { violations, reachableCommands: reachable.commands };
}

function findReverseCompositionMarkers(
  file: string,
  content: string,
  markers: readonly { label: string; pattern: RegExp }[],
): CaioProV1Violation[] {
  return markers
    .filter(({ pattern }) => pattern.test(content))
    .map(({ label }) => ({
      rule: "CPV1-BOUNDARY",
      file,
      detail: `Public Core must not own reverse-composition semantics: ${label}`,
    }));
}

function findReferencedRunnerConfigs(
  commands: readonly Pick<WorkflowCommand, "command" | "cwd">[],
): Set<string> {
  const configs = new Set<string>();
  for (const { command, cwd } of commands) {
    const normalizedCommand = command.replace(/\\\s*\n\s*/gu, " ");
    for (const match of normalizedCommand.matchAll(
      /\b(?:npx\s+)?(?:vitest|vite)\b[^;&|\n]*?(?:--config(?:=|\s+)|-c(?:=|\s+))(?:"([^"]+)"|'([^']+)'|([^\s;&|]+))/gu,
    )) {
      const raw = match[1] ?? match[2] ?? match[3];
      if (raw === undefined) continue;
      const normalized = path.posix.normalize(
        path.posix.join(cwd, raw.replace(/^\.\//u, "")),
      );
      configs.add(normalized);
    }
  }
  return configs;
}

function checkPublicCompositionOwnership(
  repoRoot: string,
  referencedRunnerConfigs: ReadonlySet<string>,
): CaioProV1Violation[] {
  const violations: CaioProV1Violation[] = [];
  const seenFiles = new Set<string>();
  const gatewayRoot = path.join(repoRoot, CAIO_ACCESS_GATEWAY_DIRECTORY);
  if (existsSync(gatewayRoot)) {
    for (const entry of readdirSync(gatewayRoot, { withFileTypes: true })) {
      const file = path.posix.join(CAIO_ACCESS_GATEWAY_DIRECTORY, entry.name);
      if (
        !entry.isFile() ||
        !ALLOWED_CAIO_ACCESS_GATEWAY_FILES.has(entry.name)
      ) {
        violations.push({
          rule: "CPV1-BOUNDARY",
          file,
          detail:
            "Public CAIO Access Gateway file is not in the explicit Core-owned allowlist; cross-repository composition belongs downstream",
        });
        continue;
      }
      const content = read(repoRoot, file);
      if (content !== null) {
        violations.push(
          ...findReverseCompositionMarkers(
            file,
            content,
            GATEWAY_REVERSE_COMPOSITION_MARKERS,
          ),
        );
      }
    }
  }

  for (const file of listRepositorySourceFiles(repoRoot)) {
    seenFiles.add(file);
    const content = read(repoRoot, file);
    if (content === null) {
      violations.push({
        rule: "CPV1-BOUNDARY",
        file,
        detail: "Public source ownership could not be read and verified",
      });
      continue;
    }

    if (
      TEST_RUNNER_CONFIG_FILE.test(path.posix.basename(file)) ||
      referencedRunnerConfigs.has(file)
    ) {
      if (!ALLOWED_TEST_RUNNER_CONFIG_FILES.has(file)) {
        violations.push({
          rule: "CPV1-BOUNDARY",
          file,
          detail:
            "Public test-runner config is not allowlisted; a dedicated reverse-composition runner belongs downstream",
        });
      } else {
        violations.push(
          ...findReverseCompositionMarkers(
            file,
            content,
            VITEST_REVERSE_COMPOSITION_MARKERS,
          ),
        );
      }
    }

    const inspection = inspectSourceFile(file, content);
    if (inspection.parseDiagnostics.length > 0) {
      violations.push({
        rule: "CPV1-BOUNDARY",
        file,
        detail:
          "Public source could not be parsed, so dynamic-import ownership could not be verified",
      });
      continue;
    }
    const allowedExpressions = availableComputedDynamicImportAllowances(
      file,
      inspection,
    );
    for (const computedImport of inspection.computedImports) {
      const remainingAllowance =
        allowedExpressions.get(computedImport.expression) ?? 0;
      if (remainingAllowance > 0) {
        allowedExpressions.set(
          computedImport.expression,
          remainingAllowance - 1,
        );
        continue;
      }
      violations.push({
        rule: "CPV1-BOUNDARY",
        file,
        detail:
          "Public source must not add a computed dynamic import outside the explicit local-module allowlist",
      });
    }
  }

  for (const configFile of referencedRunnerConfigs) {
    if (
      path.posix.isAbsolute(configFile) ||
      configFile === ".." ||
      configFile.startsWith("../")
    ) {
      violations.push({
        rule: "CPV1-BOUNDARY",
        file: configFile,
        detail:
          "Public test-runner config path must remain inside the repository",
      });
    } else if (!seenFiles.has(configFile)) {
      violations.push({
        rule: "CPV1-BOUNDARY",
        file: configFile,
        detail:
          "referenced Public test-runner config could not be read and verified",
      });
    }
  }

  return violations;
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
  const acceptanceAttempt = (assessment: typeof readyAssessment, key: string) =>
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
      !notReadyCompletion.missingItemKeys.includes("p8_incident_posture_clear")
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
      error.message.includes("value_receipt_forbidden_value_basis:token_usage");
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
  const packageContent = read(repoRoot, PACKAGE_FILE);
  let packageScripts: Record<string, string> = {};
  if (packageContent !== null) {
    try {
      const parsedPackage = JSON.parse(packageContent) as { scripts?: unknown };
      if (isRecord(parsedPackage.scripts)) {
        packageScripts = Object.fromEntries(
          Object.entries(parsedPackage.scripts).filter(
            (entry): entry is [string, string] => typeof entry[1] === "string",
          ),
        );
      }
    } catch {
      // The existing CPV1-WIRING check below records the invalid JSON.
    }
  }
  const workflowFiles = listWorkflowFiles(repoRoot);
  const workflowIsolation = new Map<string, WorkflowIsolationCheck>();
  for (const workflowFile of workflowFiles) {
    const content = read(repoRoot, workflowFile);
    if (content !== null) {
      workflowIsolation.set(
        workflowFile,
        checkPublicWorkflowIsolation(repoRoot, workflowFile, content),
      );
    }
  }
  const referencedRunnerConfigs = findReferencedRunnerConfigs([
    ...Object.values(packageScripts).map((command) => ({ command, cwd: "" })),
    ...[...workflowIsolation.values()].flatMap(
      ({ reachableCommands }) => reachableCommands,
    ),
  ]);
  violations.push(
    ...checkPublicCompositionOwnership(repoRoot, referencedRunnerConfigs),
  );

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

  for (const workflowFile of workflowFiles) {
    violations.push(...(workflowIsolation.get(workflowFile)?.violations ?? []));
  }

  return violations;
}

export function checkCaioProV1(repoRoot = process.cwd()): CaioProV1Violation[] {
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
