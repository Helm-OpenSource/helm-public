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
import { existsSync, readFileSync, readdirSync } from "node:fs";
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
    initializer.expression.name.text !== "cwd"
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
  return readWorkflowWorkingDirectory(
    defaults.run["working-directory"],
    inherited,
    errors,
    `${label} defaults.run`,
  );
}

function parseWorkflowSemantics(source: string): WorkflowSemanticModel {
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
    const jobEnvironment = isRecord(jobValue.env) ? jobValue.env : {};
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
      if ("run" in stepValue) {
        if (typeof stepValue.run !== "string") {
          errors.push(
            `workflow job ${jobName} step ${stepIndex + 1} run command could not be verified`,
          );
        } else {
          const stepEnvironment = isRecord(stepValue.env) ? stepValue.env : {};
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

function extractNpmScriptNames(command: string): string[] {
  const names = new Set<string>();
  for (const match of command.matchAll(
    /\bnpm\s+(?:run(?:-script)?\s+)?([A-Za-z0-9:_-]+)\b/gu,
  )) {
    const name = match[1];
    if (name !== undefined && name !== "ci" && name !== "install") {
      names.add(name);
    }
  }
  return [...names];
}

function extractLocalHelperPaths(command: string): string[] {
  const helpers = new Set<string>();
  const patterns = [
    /(?:^|[;&|\n])[ \t]*(?:env[ \t]+)?(?:[A-Za-z_][A-Za-z0-9_]*=(?:"[^"\n]*"|'[^'\n]*'|[^\s;&|]+)[ \t]+)*(?:\/(?:usr\/)?bin\/)?(?:bash|sh|zsh)[ \t]+(?:-[A-Za-z]+[ \t]+)*(?:"([^"\n]+)"|'([^'\n]+)'|([./A-Za-z0-9_-]+(?:\.(?:sh|bash|zsh))?))/gu,
    /(?:^|[;&|\n])[ \t]*(?:env[ \t]+)?(?:[A-Za-z_][A-Za-z0-9_]*=(?:"[^"\n]*"|'[^'\n]*'|[^\s;&|]+)[ \t]+)*(?:source|\.)[ \t]+(?:"([^"\n]+)"|'([^'\n]+)'|([./A-Za-z0-9_-]+(?:\.(?:sh|bash|zsh))?))/gu,
    /(?:^|[;&|\n])[ \t]*(?:env[ \t]+)?(?:[A-Za-z_][A-Za-z0-9_]*=(?:"[^"\n]*"|'[^'\n]*'|[^\s;&|]+)[ \t]+)*(?:node|tsx)[ \t]+(?:(?:--import[ \t]+\S+|--[A-Za-z-]+(?:=\S+)?)[ \t]+)*(?:"([^"\n]+\.(?:[cm]?[jt]s|tsx))"|'([^'\n]+\.(?:[cm]?[jt]s|tsx))'|([./A-Za-z0-9_-]+\.(?:[cm]?[jt]s|tsx)))/gu,
    /(?:^|[;&|\n])[ \t]*(?:env[ \t]+)?(?:[A-Za-z_][A-Za-z0-9_]*=(?:"[^"\n]*"|'[^'\n]*'|[^\s;&|]+)[ \t]+)*npx[ \t]+(?:--yes[ \t]+)?tsx[ \t]+(?:"([^"\n]+\.(?:[cm]?[jt]s|tsx))"|'([^'\n]+\.(?:[cm]?[jt]s|tsx))'|([./A-Za-z0-9_-]+\.(?:[cm]?[jt]s|tsx)))/gu,
    /(?:^|[;&|\n])[ \t]*\.\/([A-Za-z0-9_./-]+\.(?:sh|bash|zsh|[cm]?[jt]s|tsx))/gu,
  ];
  for (const pattern of patterns) {
    for (const match of command.matchAll(pattern)) {
      const helper = match[1] ?? match[2] ?? match[3];
      if (helper !== undefined) helpers.add(helper.replace(/^\.\//u, ""));
    }
  }
  return [...helpers];
}

function hasUnresolvedHelperReference(command: string): boolean {
  return (
    /(?:^|[;&|\n]\s*)[ \t]*(?:(?:env[ \t]+)?[A-Za-z_][A-Za-z0-9_]*=[^\s;&|]+[ \t]+)*(?:bash|sh|zsh)[ \t]+-[A-Za-z]*c\b/u.test(
      command,
    ) ||
    /(?:^|[;&|\n]\s*)[ \t]*(?:(?:env[ \t]+)?[A-Za-z_][A-Za-z0-9_]*=[^\s;&|]+[ \t]+)*(?:(?:bash|sh|zsh)[ \t]+(?:-[A-Za-z]+[ \t]+)*|(?:source|\.)[ \t]+)(?:["']?\$|`|\$\()/u.test(
      command,
    ) ||
    /(?:^|[;&|\n]\s*)[ \t]*(?:(?:env[ \t]+)?[A-Za-z_][A-Za-z0-9_]*=[^\s;&|]+[ \t]+)*(?:node|tsx)[ \t]+(?:(?:--import[ \t]+\S+|--[A-Za-z-]+(?:=\S+)?)[ \t]+)*(?:["']?\$|`|\$\()/u.test(
      command,
    )
  );
}

type PendingHelper = Readonly<{
  file: string;
  cwd: string;
  d2LocalCloneAllowed: boolean;
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

function checkWorkflowReachableHelpers(
  repoRoot: string,
  workflowFile: string,
  commands: readonly WorkflowCommand[],
  packageScripts: Readonly<Record<string, string>>,
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
      for (const helperPath of extractLocalHelperPaths(
        pendingCommand.command,
      )) {
        const resolved = resolveWorkflowHelperPath(
          pendingCommand.cwd,
          helperPath,
        );
        if (resolved === null) {
          violations.push({
            rule: "CPV1-CI",
            file: workflowFile,
            detail: `workflow helper path leaves the repository: ${helperPath}`,
          });
        } else {
          pendingHelpers.push({
            file: resolved,
            cwd: pendingCommand.cwd,
            d2LocalCloneAllowed:
              pendingCommand.d2LocalCloneAllowed &&
              workflowFile === D2_DOCKER_SMOKE_WORKFLOW &&
              pendingCommand.cwd === "" &&
              pendingCommand.command === D2_DOCKER_SMOKE_INVOCATION &&
              resolved === D2_DOCKER_SMOKE_HELPER,
          });
        }
      }
      for (const scriptName of extractNpmScriptNames(pendingCommand.command)) {
        const script = packageScripts[scriptName];
        if (script === undefined) {
          violations.push({
            rule: "CPV1-CI",
            file: workflowFile,
            detail: `workflow npm script could not be resolved: ${scriptName}`,
          });
        } else {
          pendingCommands.push({
            command: script,
            cwd: "",
            d2LocalCloneAllowed: false,
            sourceFile: pendingCommand.sourceFile,
          });
        }
      }
      if (hasUnresolvedHelperReference(pendingCommand.command)) {
        violations.push({
          rule: "CPV1-CI",
          file: pendingCommand.sourceFile,
          detail: "workflow helper entry could not be resolved statically",
        });
      }
      continue;
    }

    const helper = pendingHelpers.shift()!;
    const helperKey = `${helper.file}\u0000${helper.cwd}\u0000${helper.d2LocalCloneAllowed ? "local" : "ordinary"}`;
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
        d2LocalCloneAllowed: false,
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
      for (const moduleSpecifier of findStaticModuleSpecifiers(inspection)) {
        const resolution = resolveLocalModulePath(
          repoRoot,
          helper.file,
          moduleSpecifier,
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

function resolveLocalModulePath(
  repoRoot: string,
  parentFile: string,
  moduleSpecifier: string,
): LocalModuleResolution {
  if (moduleSpecifier.startsWith(".")) {
    const base = path.posix.normalize(
      path.posix.join(path.posix.dirname(parentFile), moduleSpecifier),
    );
    const file = resolveSourceFileCandidate(repoRoot, base);
    return file === null ? { kind: "unresolved" } : { kind: "resolved", file };
  }

  const tsconfigContent = read(repoRoot, "tsconfig.json");
  if (tsconfigContent === null) return { kind: "external" };
  const parsed = ts.parseConfigFileTextToJson("tsconfig.json", tsconfigContent);
  if (parsed.error !== undefined || !isRecord(parsed.config)) {
    return moduleSpecifier.startsWith("@/")
      ? { kind: "unresolved" }
      : { kind: "external" };
  }
  const compilerOptions = isRecord(parsed.config.compilerOptions)
    ? parsed.config.compilerOptions
    : {};
  const paths = isRecord(compilerOptions.paths) ? compilerOptions.paths : {};
  const baseUrl =
    typeof compilerOptions.baseUrl === "string" ? compilerOptions.baseUrl : ".";
  for (const [pattern, targetValue] of Object.entries(paths)) {
    if (!Array.isArray(targetValue)) continue;
    const wildcardIndex = pattern.indexOf("*");
    const prefix =
      wildcardIndex < 0 ? pattern : pattern.slice(0, wildcardIndex);
    const suffix = wildcardIndex < 0 ? "" : pattern.slice(wildcardIndex + 1);
    if (
      (wildcardIndex < 0 && moduleSpecifier !== pattern) ||
      (wildcardIndex >= 0 &&
        (!moduleSpecifier.startsWith(prefix) ||
          !moduleSpecifier.endsWith(suffix)))
    ) {
      continue;
    }
    const wildcard =
      wildcardIndex < 0
        ? ""
        : moduleSpecifier.slice(
            prefix.length,
            moduleSpecifier.length - suffix.length,
          );
    for (const target of targetValue) {
      if (typeof target !== "string") return { kind: "unresolved" };
      const base = path.posix.normalize(
        path.posix.join(baseUrl, target.replace("*", wildcard)),
      );
      const file = resolveSourceFileCandidate(repoRoot, base);
      if (file !== null) return { kind: "resolved", file };
    }
    return { kind: "unresolved" };
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
  let remoteAccess = false;
  const visit = (node: ts.Node): void => {
    if (remoteAccess) return;
    if (ts.isCallExpression(node)) {
      const callee = unwrapTransparentExpression(node.expression);
      const calleeName = ts.isIdentifier(callee)
        ? callee.text
        : ts.isPropertyAccessExpression(callee)
          ? callee.name.text
          : null;
      if (calleeName === "fetch") {
        remoteAccess = true;
        return;
      }
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
  const normalized = command.replace(/\\\s*\n\s*/gu, " ");
  return /\bnode\b[^;&|\n]*?(?:\s-e\b|\s--eval\b)[^;&|\n]*?\b(?:globalThis\.)?fetch\s*\(/u.test(
    normalized,
  );
}

type WorkflowIsolationCheck = Readonly<{
  violations: readonly CaioProV1Violation[];
  reachableCommands: readonly Pick<WorkflowCommand, "command" | "cwd">[];
}>;

function checkPublicWorkflowIsolation(
  repoRoot: string,
  workflowFile: string,
  source: string,
  packageScripts: Readonly<Record<string, string>>,
): WorkflowIsolationCheck {
  const violations: CaioProV1Violation[] = [];
  const semantic = parseWorkflowSemantics(source);
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
    packageScripts,
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
      /\b(?:npx\s+)?(?:vitest|vite)\b[^;&|\n]*?(?:--config(?:=|\s+)|-c\s+)(?:"([^"]+)"|'([^']+)'|([^\s;&|]+))/gu,
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
        checkPublicWorkflowIsolation(
          repoRoot,
          workflowFile,
          content,
          packageScripts,
        ),
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
