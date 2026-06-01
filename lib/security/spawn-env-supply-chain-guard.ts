import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import ts from "typescript";

export type SpawnEnvSeverity = "warn" | "fail";

export type SpawnEnvFinding = {
  readonly id: string;
  readonly file: string;
  readonly line: number;
  readonly severity: SpawnEnvSeverity;
  readonly commandExpression: string;
  readonly argsExpression: string;
  readonly reachability: string;
  readonly reason: string;
};

export type SpawnEnvAnalysis = {
  readonly findings: readonly SpawnEnvFinding[];
  readonly warnCount: number;
  readonly failCount: number;
  readonly scannedFileCount: number;
};

type SourceInput = {
  readonly file: string;
  readonly source: string;
};

type KnownSpawnRoute = {
  readonly id: string;
  readonly file: string;
  readonly commandIncludes: string;
  readonly argsIncludes: string;
  readonly reachability: string;
  readonly reason: string;
  readonly evidence: {
    readonly envBuilder: string;
    readonly requiredBuilderIdentifiers: readonly string[];
    readonly requiredBuilderStringLiterals: readonly string[];
    readonly allowedEnvKeys: readonly string[];
    readonly allowedEnvPrefixes: readonly string[];
    readonly boundaryNotes: readonly string[];
  };
};

const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".next",
  ".tmp",
  "coverage",
  "dev.db",
  "dist",
  "node_modules",
  "test-results",
]);

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".mjs", ".cjs"];

const KNOWN_WARN_ROUTES: readonly KnownSpawnRoute[] = [
  {
    id: "dingtalk-mcp-stdio",
    file: "lib/connectors/dingtalk-mcp-client.ts",
    commandIncludes: "getMcpCommand",
    argsIncludes: "getMcpArgs",
    reachability:
      "DingTalk MCP stdio is reachable after DingTalk MCP prerequisites are configured and the read-only MCP ingest path is selected; existing route is warn-only until reachability is fully documented.",
    reason:
      "legacy-known route approved for warn mode with evidence: buildMcpChildEnv supplies a sanitized child env with DingTalk-specific keys and active profiles; command and args are resolved from DINGTALK_MCP_COMMAND / DINGTALK_MCP_ARGS or current runtime defaults.",
    evidence: {
      envBuilder: "buildMcpChildEnv",
      requiredBuilderIdentifiers: [
        "DINGTALK_CLIENT_ID",
        "DINGTALK_CLIENT_SECRET",
        "DINGTALK_ROBOT_CODE",
        "DINGTALK_AGENT_ID",
        "ACTIVE_PROFILES",
      ],
      requiredBuilderStringLiterals: [],
      allowedEnvKeys: [
        "NODE_ENV",
        "DINGTALK_Client_ID",
        "DINGTALK_Client_Secret",
        "DINGTALK_CLIENT_ID",
        "DINGTALK_CLIENT_SECRET",
        "ROBOT_CODE",
        "DINGTALK_ROBOT_CODE",
        "DINGTALK_AGENT_ID",
        "DINGTALK_CORP_ID",
        "DINGTALK_CORPID",
        "ACTIVE_PROFILES",
      ],
      allowedEnvPrefixes: [],
      boundaryNotes: [
        "child env is rebuilt from a sanitized base instead of passing process.env wholesale",
        "DingTalk route remains MCP stdio ingest and must not imply automatic external send authority",
      ],
    },
  },
  {
    id: "bi-report-odps-mcp-stdio",
    file: "lib/bi-report-skill/query-adapters/odps.ts",
    commandIncludes: "getOdpsMcpCommand",
    argsIncludes: "getOdpsMcpArgs",
    reachability:
      "BI report ODPS MCP stdio is reachable when the ODPS MCP bridge is configured by command or args; existing route is warn-only until reachability is fully documented.",
    reason:
      "legacy-known route approved for warn mode with evidence: buildOdpsMcpChildEnv supplies a sanitized child env with ODPS/BI_REPORT_ODPS allowlisted prefixes and read-only SQL bridge boundary; command and args are resolved from BI_REPORT_ODPS_MCP_COMMAND / BI_REPORT_ODPS_MCP_ARGS.",
    evidence: {
      envBuilder: "buildOdpsMcpChildEnv",
      requiredBuilderIdentifiers: [
        "ODPS_MCP_CHILD_BASE_ENV_KEYS",
        "copyEnvByPrefix",
      ],
      requiredBuilderStringLiterals: ["BI_REPORT_ODPS_", "ODPS_"],
      allowedEnvKeys: [
        "PATH",
        "HOME",
        "TMPDIR",
        "TEMP",
        "TMP",
        "LANG",
        "LC_ALL",
        "TZ",
        "NODE_ENV",
      ],
      allowedEnvPrefixes: ["BI_REPORT_ODPS_", "ODPS_"],
      boundaryNotes: [
        "child env is rebuilt from a sanitized base instead of passing process.env wholesale",
        "ODPS route remains BI report query evidence and must not imply write, connector runtime, or remote execution authority",
      ],
    },
  },
];

function toRepoPath(path: string) {
  return path.split(sep).join("/");
}

function shouldScanFile(file: string) {
  const repoPath = toRepoPath(file);
  if (repoPath.includes("/__mocks__/") || repoPath.includes("/tests/")) {
    return false;
  }
  if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(repoPath)) {
    return false;
  }
  return SOURCE_EXTENSIONS.some((extension) => repoPath.endsWith(extension));
}

export function collectSpawnEnvSourceFiles(root: string) {
  const files: string[] = [];

  function walk(dir: string) {
    for (const entry of readdirSync(dir)) {
      if (IGNORED_DIRECTORIES.has(entry)) {
        continue;
      }
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else {
        const repoPath = toRepoPath(relative(root, fullPath));
        if (shouldScanFile(repoPath)) {
          files.push(fullPath);
        }
      }
    }
  }

  walk(root);
  return files.sort();
}

export function analyzeSpawnEnvSupplyChainSources(sources: readonly SourceInput[]): SpawnEnvAnalysis {
  const findings = sources.flatMap((source) => analyzeSource(source.file, source.source));
  const warnCount = findings.filter((finding) => finding.severity === "warn").length;
  const failCount = findings.filter((finding) => finding.severity === "fail").length;

  return {
    findings,
    warnCount,
    failCount,
    scannedFileCount: sources.length,
  };
}

export function analyzeSpawnEnvSupplyChain(root: string): SpawnEnvAnalysis {
  const files = collectSpawnEnvSourceFiles(root);
  return analyzeSpawnEnvSupplyChainSources(
    files.map((file) => ({
      file: toRepoPath(relative(root, file)),
      source: readFileSync(file, "utf8"),
    })),
  );
}

function analyzeSource(file: string, source: string): SpawnEnvFinding[] {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const envDerivedFunctions = collectEnvDerivedFunctions(sourceFile);
  const findings: SpawnEnvFinding[] = [];

  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && isSpawnCall(node)) {
      const command = node.arguments[0];
      const args = node.arguments[1];
      if (command && (isEnvDerivedExpression(command, envDerivedFunctions, sourceFile) || (args && isEnvDerivedExpression(args, envDerivedFunctions, sourceFile)))) {
        const commandExpression = command.getText(sourceFile);
        const argsExpression = args?.getText(sourceFile) ?? "<missing>";
        const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
        const knownRoute = resolveKnownRoute(file, sourceFile, node, commandExpression, argsExpression);
        findings.push({
          id:
            knownRoute?.evidenceApproved === false
              ? `${knownRoute.route.id}:missing-env-evidence`
              : knownRoute?.route.id ?? `unknown-env-derived-spawn:${file}:${line}`,
          file,
          line,
          severity: knownRoute?.evidenceApproved ? "warn" : "fail",
          commandExpression,
          argsExpression,
          reachability:
            knownRoute?.route.reachability ??
            "Unknown env-derived local process launch; document caller, trigger conditions, and credential/feature gates before release.",
          reason:
            knownRoute?.evidenceApproved === false
              ? `known route metadata matched, but source is missing required env allowlist evidence: ${knownRoute.missingEvidence.join(", ")}. Fail closed until ${knownRoute.route.evidence.envBuilder} or an approved allowlist marker is present.`
              : knownRoute?.route.reason ??
            "new env-derived spawn(command,args,stdio) route; initial guard is fail-closed until owner-approved allow-list and reachability exist.",
        });
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return findings;
}

function collectEnvDerivedFunctions(sourceFile: ts.SourceFile) {
  const names = new Set<string>();

  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name && node.body) {
      const bodyText = node.body.getText(sourceFile);
      if (hasEnvReference(bodyText)) {
        names.add(node.name.text);
      }
    }

    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      if (
        (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)) &&
        hasEnvReference(node.initializer.getText(sourceFile))
      ) {
        names.add(node.name.text);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return names;
}

function isSpawnCall(node: ts.CallExpression) {
  const expression = node.expression;
  if (ts.isIdentifier(expression)) {
    return expression.text === "spawn";
  }
  if (ts.isPropertyAccessExpression(expression)) {
    return expression.name.text === "spawn";
  }
  return false;
}

function isEnvDerivedExpression(
  expression: ts.Expression,
  envDerivedFunctions: ReadonlySet<string>,
  sourceFile: ts.SourceFile,
): boolean {
  const text = expression.getText(sourceFile);
  if (hasEnvReference(text)) {
    return true;
  }

  if (ts.isCallExpression(expression)) {
    const called = expression.expression;
    if (ts.isIdentifier(called) && envDerivedFunctions.has(called.text)) {
      return true;
    }
  }

  let found = false;
  expression.forEachChild((child) => {
    if (ts.isExpression(child) && isEnvDerivedExpression(child, envDerivedFunctions, sourceFile)) {
      found = true;
    }
  });
  return found;
}

function hasEnvReference(text: string) {
  return text.includes("process.env") || text.includes("readRootEnv(");
}

function resolveKnownRoute(
  file: string,
  sourceFile: ts.SourceFile,
  spawnCall: ts.CallExpression,
  commandExpression: string,
  argsExpression: string,
) {
  const route = KNOWN_WARN_ROUTES.find(
    (route) =>
      route.file === file &&
      commandExpression.includes(route.commandIncludes) &&
      argsExpression.includes(route.argsIncludes),
  );
  if (!route) {
    return null;
  }

  const missingEvidence = collectKnownRouteMissingEvidence(route, sourceFile, spawnCall);
  return {
    route,
    evidenceApproved: missingEvidence.length === 0,
    missingEvidence,
  };
}

function collectKnownRouteMissingEvidence(
  route: KnownSpawnRoute,
  sourceFile: ts.SourceFile,
  spawnCall: ts.CallExpression,
) {
  const missing: string[] = [];
  const envExpression = getSpawnEnvExpression(spawnCall);
  if (!envExpression) {
    missing.push(`spawn options env calling ${route.evidence.envBuilder}`);
  } else if (!expressionContainsCallToIdentifier(envExpression, route.evidence.envBuilder)) {
    missing.push(`spawn options env calling ${route.evidence.envBuilder}`);
  }

  const builderBody = findFunctionBody(sourceFile, route.evidence.envBuilder);
  if (!builderBody) {
    missing.push(`${route.evidence.envBuilder} implementation`);
    return missing;
  }

  missing.push(...collectDisallowedBuilderPatterns(route, builderBody));
  missing.push(...collectNonAllowlistedBuilderKeys(route, builderBody));

  for (const identifier of route.evidence.requiredBuilderIdentifiers) {
    if (!nodeHasIdentifier(builderBody, identifier)) {
      missing.push(`${route.evidence.envBuilder} identifier ${identifier}`);
    }
  }

  for (const literal of route.evidence.requiredBuilderStringLiterals) {
    if (!nodeHasStringLiteral(builderBody, literal)) {
      missing.push(`${route.evidence.envBuilder} string literal ${literal}`);
    }
  }

  return missing;
}

function collectNonAllowlistedBuilderKeys(route: KnownSpawnRoute, builderBody: ts.Node) {
  const nonAllowlisted: string[] = [];

  function addNonAllowlisted(pattern: string) {
    if (!nonAllowlisted.includes(pattern)) {
      nonAllowlisted.push(pattern);
    }
  }

  function assertAllowedEnvKey(key: string, label: string) {
    if (!isAllowedRouteEnvKey(route, key)) {
      addNonAllowlisted(`${route.evidence.envBuilder} ${label} ${key}`);
    }
  }

  function visit(node: ts.Node) {
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      const envKey = getStaticProcessEnvKey(node);
      if (envKey) {
        assertAllowedEnvKey(envKey, "reads non-allowlisted process.env key");
      }
    }

    if (ts.isPropertyAssignment(node) && nodeHasStaticProcessEnvAccess(node.initializer)) {
      const outputKey = getStaticPropertyName(node.name);
      if (outputKey) {
        assertAllowedEnvKey(outputKey, "outputs non-allowlisted env key");
      }
    }

    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      nodeHasStaticProcessEnvAccess(node.right)
    ) {
      const outputKey = getStaticAssignedPropertyName(node.left);
      if (outputKey) {
        assertAllowedEnvKey(outputKey, "outputs non-allowlisted env key");
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(builderBody);
  return nonAllowlisted;
}

function collectDisallowedBuilderPatterns(route: KnownSpawnRoute, builderBody: ts.Node) {
  const disallowed: string[] = [];
  const processEnvAliases = collectProcessEnvAliases(builderBody);

  function addDisallowed(pattern: string) {
    if (!disallowed.includes(pattern)) {
      disallowed.push(pattern);
    }
  }

  function visit(node: ts.Node) {
    if (
      ts.isSpreadAssignment(node) &&
      isProcessEnvOrAliasExpression(node.expression, processEnvAliases)
    ) {
      addDisallowed(`${route.evidence.envBuilder} must not spread process.env`);
    }

    if (
      ts.isSpreadElement(node) &&
      isProcessEnvOrAliasExpression(node.expression, processEnvAliases)
    ) {
      addDisallowed(`${route.evidence.envBuilder} must not spread process.env`);
    }

    if (
      ts.isReturnStatement(node) &&
      node.expression &&
      isProcessEnvOrAliasExpression(node.expression, processEnvAliases)
    ) {
      addDisallowed(`${route.evidence.envBuilder} must not return process.env`);
    }

    if (
      ts.isBinaryExpression(node) &&
      isProcessEnvOrAliasExpression(node.right, processEnvAliases)
    ) {
      addDisallowed(`${route.evidence.envBuilder} must not assign process.env wholesale`);
    }

    if (ts.isCallExpression(node) && isObjectAssignCall(node)) {
      for (const argument of node.arguments) {
        if (isProcessEnvOrAliasExpression(argument, processEnvAliases)) {
          addDisallowed(`${route.evidence.envBuilder} must not Object.assign process.env`);
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(builderBody);
  return disallowed;
}

function collectProcessEnvAliases(node: ts.Node) {
  const aliases = new Set<string>();
  let changed = true;

  while (changed) {
    changed = false;

    function addAlias(identifier: ts.Identifier) {
      if (!aliases.has(identifier.text)) {
        aliases.add(identifier.text);
        changed = true;
      }
    }

    function visit(child: ts.Node) {
      if (
        ts.isVariableDeclaration(child) &&
        ts.isIdentifier(child.name) &&
        child.initializer &&
        isProcessEnvOrAliasExpression(child.initializer, aliases)
      ) {
        addAlias(child.name);
      }

      if (
        ts.isBinaryExpression(child) &&
        child.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        ts.isIdentifier(child.left) &&
        isProcessEnvOrAliasExpression(child.right, aliases)
      ) {
        addAlias(child.left);
      }

      ts.forEachChild(child, visit);
    }

    visit(node);
  }

  return aliases;
}

function getSpawnEnvExpression(spawnCall: ts.CallExpression) {
  const options = spawnCall.arguments[2];
  if (!options || !ts.isObjectLiteralExpression(options)) {
    return null;
  }

  for (const property of options.properties) {
    if (!ts.isPropertyAssignment(property)) {
      continue;
    }
    const name = property.name;
    const isEnvProperty =
      (ts.isIdentifier(name) && name.text === "env") ||
      (ts.isStringLiteral(name) && name.text === "env");
    if (isEnvProperty && ts.isExpression(property.initializer)) {
      return property.initializer;
    }
  }
  return null;
}

function expressionContainsCallToIdentifier(expression: ts.Expression, identifier: string) {
  let found = false;

  function visit(node: ts.Node) {
    if (found) {
      return;
    }
    if (ts.isCallExpression(node)) {
      const called = unwrapExpression(node.expression);
      if (ts.isIdentifier(called) && called.text === identifier) {
        found = true;
        return;
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(unwrapExpression(expression));
  return found;
}

function unwrapExpression(expression: ts.Expression): ts.Expression {
  let current = expression;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isNonNullExpression(current) ||
    ts.isSatisfiesExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function isProcessEnvObjectExpression(expression: ts.Expression) {
  const unwrapped = unwrapExpression(expression);
  return (
    ts.isPropertyAccessExpression(unwrapped) &&
    unwrapped.name.text === "env" &&
    ts.isIdentifier(unwrapped.expression) &&
    unwrapped.expression.text === "process"
  );
}

function getStaticProcessEnvKey(node: ts.Node) {
  if (
    ts.isPropertyAccessExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === "env" &&
    ts.isIdentifier(node.expression.expression) &&
    node.expression.expression.text === "process"
  ) {
    return node.name.text;
  }

  if (
    ts.isElementAccessExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === "env" &&
    ts.isIdentifier(node.expression.expression) &&
    node.expression.expression.text === "process" &&
    ts.isStringLiteralLike(node.argumentExpression)
  ) {
    return node.argumentExpression.text;
  }

  return null;
}

function nodeHasStaticProcessEnvAccess(node: ts.Node) {
  let found = false;

  function visit(child: ts.Node) {
    if (found) {
      return;
    }
    if (
      (ts.isPropertyAccessExpression(child) || ts.isElementAccessExpression(child)) &&
      getStaticProcessEnvKey(child)
    ) {
      found = true;
      return;
    }
    ts.forEachChild(child, visit);
  }

  visit(node);
  return found;
}

function getStaticPropertyName(name: ts.PropertyName) {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return null;
}

function getStaticAssignedPropertyName(expression: ts.Expression) {
  const unwrapped = unwrapExpression(expression);
  if (ts.isPropertyAccessExpression(unwrapped)) {
    return unwrapped.name.text;
  }
  if (
    ts.isElementAccessExpression(unwrapped) &&
    ts.isStringLiteralLike(unwrapped.argumentExpression)
  ) {
    return unwrapped.argumentExpression.text;
  }
  return null;
}

function isAllowedRouteEnvKey(route: KnownSpawnRoute, key: string) {
  return (
    route.evidence.allowedEnvKeys.includes(key) ||
    route.evidence.allowedEnvPrefixes.some((prefix) => key.startsWith(prefix))
  );
}

function isProcessEnvOrAliasExpression(
  expression: ts.Expression,
  processEnvAliases: ReadonlySet<string>,
) {
  const unwrapped = unwrapExpression(expression);
  return (
    isProcessEnvObjectExpression(unwrapped) ||
    (ts.isIdentifier(unwrapped) && processEnvAliases.has(unwrapped.text))
  );
}

function isObjectAssignCall(node: ts.CallExpression) {
  const expression = node.expression;
  return (
    ts.isPropertyAccessExpression(expression) &&
    expression.name.text === "assign" &&
    ts.isIdentifier(expression.expression) &&
    expression.expression.text === "Object"
  );
}

function findFunctionBody(sourceFile: ts.SourceFile, name: string) {
  let body: ts.Node | null = null;

  function visit(node: ts.Node) {
    if (body) {
      return;
    }
    if (ts.isFunctionDeclaration(node) && node.name?.text === name && node.body) {
      body = node.body;
      return;
    }
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name &&
      node.initializer &&
      (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
    ) {
      body = node.initializer.body;
      return;
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return body;
}

function nodeHasIdentifier(node: ts.Node, identifier: string) {
  let found = false;

  function visit(child: ts.Node) {
    if (found) {
      return;
    }
    if (ts.isIdentifier(child) && child.text === identifier) {
      found = true;
      return;
    }
    ts.forEachChild(child, visit);
  }

  visit(node);
  return found;
}

function nodeHasStringLiteral(node: ts.Node, literal: string) {
  let found = false;

  function visit(child: ts.Node) {
    if (found) {
      return;
    }
    if (
      (ts.isStringLiteral(child) || ts.isNoSubstitutionTemplateLiteral(child)) &&
      child.text === literal
    ) {
      found = true;
      return;
    }
    ts.forEachChild(child, visit);
  }

  visit(node);
  return found;
}
