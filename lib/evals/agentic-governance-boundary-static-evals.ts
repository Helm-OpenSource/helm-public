import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const EXACT_SCAN_FILES = [
  "scripts/agentic-governance-eval.ts",
  "scripts/external-agent-intake-eval.ts",
] as const;

const SCAN_DIRECTORIES = [
  "features/agentic-governance",
  "features/external-agent-intake",
  "evals/external-agent-intake",
] as const;

type BoundaryPattern = {
  readonly reason: string;
  readonly regex: RegExp;
};

export type AgenticGovernanceBoundaryStaticFile = {
  readonly filePath: string;
  readonly content: string;
};

export type AgenticGovernanceBoundaryStaticEvalOptions = {
  readonly root?: string;
  readonly files?: readonly AgenticGovernanceBoundaryStaticFile[];
};

export type AgenticGovernanceBoundaryStaticEvalSummary = {
  readonly passed: boolean;
  readonly scannedFileCount: number;
  readonly forbiddenImportCount: number;
  readonly forbiddenEnvCount: number;
  readonly forbiddenNetworkCount: number;
  readonly forbiddenAppApiReferenceCount: number;
  readonly forbiddenDatabaseReferenceCount: number;
  readonly forbiddenProductionQueryReferenceCount: number;
  readonly forbiddenSchemaReferenceCount: number;
  readonly forbiddenProviderClientReferenceCount: number;
  readonly forbiddenCredentialReferenceCount: number;
  readonly forbiddenRuntimeReferenceCount: number;
  readonly candidateOnly: true;
  readonly offlineOnly: true;
  readonly runtimeAllowed: false;
  readonly officialWriteAllowed: false;
  readonly autoExecutionAllowed: false;
  readonly providerClientAllowed: false;
  readonly credentialUseAllowed: false;
  readonly databaseAllowed: false;
  readonly apiAllowed: false;
  readonly uiAllowed: false;
  readonly schemaChangeAllowed: false;
  readonly directMustPushAllowed: false;
  readonly directMemoryWriteAllowed: false;
  readonly failures: readonly {
    readonly filePath: string;
    readonly reason: string;
    readonly match: string;
  }[];
};

const FORBIDDEN_PATTERNS: readonly BoundaryPattern[] = [
  {
    reason: "forbidden_prisma_import",
    regex: importFromPattern("@prisma/client"),
  },
  {
    reason: "forbidden_db_helper_import",
    regex: importFromPattern("@/lib/db"),
  },
  {
    reason: "forbidden_database_env",
    regex: /\bprocess\.env\.DATABASE_URL\b/,
  },
  {
    reason: "forbidden_env_access",
    regex: /\bprocess\.env\b/,
  },
  {
    reason: "forbidden_provider_client_openai_import",
    regex: importFromPrefixPattern("openai"),
  },
  {
    reason: "forbidden_provider_client_anthropic_import",
    regex: importFromPrefixPattern("@anthropic-ai/sdk"),
  },
  {
    reason: "forbidden_provider_client_ai_sdk_import",
    regex: importFromPattern("ai"),
  },
  {
    reason: "forbidden_provider_client_langchain_import",
    regex: importFromPrefixPattern("langchain"),
  },
  {
    reason: "forbidden_provider_client_langchain_scoped_import",
    regex: importFromPrefixPattern("@langchain"),
  },
  {
    reason: "forbidden_provider_client_salesforce_import",
    regex: importFromPattern("jsforce"),
  },
  {
    reason: "forbidden_provider_client_salesforce_core_import",
    regex: importFromPrefixPattern("@salesforce"),
  },
  {
    reason: "forbidden_provider_client_hubspot_import",
    regex: importFromPattern("hubspot"),
  },
  {
    reason: "forbidden_provider_client_hubspot_api_import",
    regex: importFromPrefixPattern("@hubspot/api-client"),
  },
  {
    reason: "forbidden_openai_host",
    regex: new RegExp(escapeRegExp(["api", "openai", "com"].join("."))),
  },
  {
    reason: "forbidden_anthropic_host",
    regex: new RegExp(escapeRegExp(["anthropic", "com"].join("."))),
  },
  {
    reason: "forbidden_fetch_call",
    regex: /\bfetch\s*\(/,
  },
  {
    reason: "forbidden_http_client_call",
    regex: /\b(?:axios|request)\s*\(/,
  },
  {
    reason: "forbidden_app_api_reference",
    regex: new RegExp(escapeRegExp(["app", "api"].join("/"))),
  },
  {
    reason: "forbidden_next_server_import",
    regex: importFromPattern("next/server"),
  },
  {
    reason: "forbidden_app_route_import",
    regex: importFromPrefixPattern("@/app"),
  },
  {
    reason: "forbidden_ui_route_reference",
    regex: new RegExp(escapeRegExp(["app", "(workspace)"].join("/"))),
  },
  {
    reason: "forbidden_production_query_reference",
    regex: new RegExp(escapeRegExp(["data", "queries"].join("/"))),
  },
  {
    reason: "forbidden_production_query_import",
    regex: importFromPattern("@/data/queries"),
  },
  {
    reason: "forbidden_schema_reference",
    regex: /\b(?:prisma\/schema\.prisma|schema\.prisma|prisma\/migrations)\b/,
  },
  {
    reason: "forbidden_credential_env_reference",
    regex: /\bprocess\.env\.[A-Z0-9_]*(?:API_KEY|TOKEN|SECRET|CREDENTIAL|CLIENT_SECRET)\b/,
  },
];

export function runAgenticGovernanceBoundaryStaticEval(
  options: AgenticGovernanceBoundaryStaticEvalOptions = {},
): AgenticGovernanceBoundaryStaticEvalSummary {
  const root = options.root ?? process.cwd();
  const files = options.files ?? collectDefaultFiles(root);
  const failures: {
    filePath: string;
    reason: string;
    match: string;
  }[] = [];

  for (const file of files) {
    for (const pattern of FORBIDDEN_PATTERNS) {
      const match = file.content.match(pattern.regex);
      if (match) {
        failures.push({
          filePath: file.filePath,
          reason: pattern.reason,
          match: match[0],
        });
      }
    }
  }

  const uniqueFailures = deduplicateFailures(failures);
  const forbiddenNetworkCount = uniqueFailures.filter(isNetworkFailure).length;
  const forbiddenAppApiReferenceCount = uniqueFailures.filter(isAppApiFailure).length;
  const forbiddenProductionQueryReferenceCount = uniqueFailures.filter(isProductionQueryFailure).length;
  const forbiddenDatabaseReferenceCount = uniqueFailures.filter(isDatabaseFailure).length;
  const forbiddenSchemaReferenceCount = uniqueFailures.filter(isSchemaFailure).length;
  const forbiddenProviderClientReferenceCount = uniqueFailures.filter(isProviderClientFailure).length;
  const forbiddenCredentialReferenceCount = uniqueFailures.filter(isCredentialFailure).length;

  return {
    passed: uniqueFailures.length === 0,
    scannedFileCount: files.length,
    forbiddenImportCount: uniqueFailures.filter((failure) =>
      failure.reason.endsWith("_import"),
    ).length,
    forbiddenEnvCount: uniqueFailures.filter((failure) =>
      failure.reason.endsWith("_env") || failure.reason.endsWith("_env_reference"),
    ).length,
    forbiddenNetworkCount,
    forbiddenAppApiReferenceCount,
    forbiddenDatabaseReferenceCount,
    forbiddenProductionQueryReferenceCount,
    forbiddenSchemaReferenceCount,
    forbiddenProviderClientReferenceCount,
    forbiddenCredentialReferenceCount,
    forbiddenRuntimeReferenceCount:
      forbiddenNetworkCount +
      forbiddenAppApiReferenceCount +
      forbiddenProductionQueryReferenceCount +
      forbiddenSchemaReferenceCount +
      forbiddenProviderClientReferenceCount,
    candidateOnly: true,
    offlineOnly: true,
    runtimeAllowed: false,
    officialWriteAllowed: false,
    autoExecutionAllowed: false,
    providerClientAllowed: false,
    credentialUseAllowed: false,
    databaseAllowed: false,
    apiAllowed: false,
    uiAllowed: false,
    schemaChangeAllowed: false,
    directMustPushAllowed: false,
    directMemoryWriteAllowed: false,
    failures: uniqueFailures,
  };
}

function isNetworkFailure(failure: { readonly reason: string }): boolean {
  return failure.reason === "forbidden_fetch_call" ||
    failure.reason === "forbidden_http_client_call" ||
    failure.reason === "forbidden_openai_host" ||
    failure.reason === "forbidden_anthropic_host";
}

function isAppApiFailure(failure: { readonly reason: string }): boolean {
  return failure.reason === "forbidden_app_api_reference" ||
    failure.reason === "forbidden_next_server_import" ||
    failure.reason === "forbidden_app_route_import" ||
    failure.reason === "forbidden_ui_route_reference";
}

function isProductionQueryFailure(failure: { readonly reason: string }): boolean {
  return failure.reason === "forbidden_production_query_reference" ||
    failure.reason === "forbidden_production_query_import";
}

function isDatabaseFailure(failure: { readonly reason: string }): boolean {
  return failure.reason === "forbidden_prisma_import" ||
    failure.reason === "forbidden_db_helper_import" ||
    failure.reason === "forbidden_database_env";
}

function isSchemaFailure(failure: { readonly reason: string }): boolean {
  return failure.reason === "forbidden_schema_reference";
}

function isProviderClientFailure(failure: { readonly reason: string }): boolean {
  return failure.reason.startsWith("forbidden_provider_client_");
}

function isCredentialFailure(failure: { readonly reason: string }): boolean {
  return failure.reason === "forbidden_env_access" ||
    failure.reason === "forbidden_credential_env_reference";
}

function collectDefaultFiles(root: string): readonly AgenticGovernanceBoundaryStaticFile[] {
  const files: AgenticGovernanceBoundaryStaticFile[] = [];
  for (const relFile of EXACT_SCAN_FILES) {
    const absFile = path.join(root, relFile);
    files.push({
      filePath: relFile,
      content: readFileSync(absFile, "utf8"),
    });
  }
  for (const relRoot of SCAN_DIRECTORIES) {
    collectFiles(path.join(root, relRoot), root, files);
  }
  return files.filter((file) => shouldScan(file.filePath));
}

function collectFiles(
  absPath: string,
  root: string,
  files: AgenticGovernanceBoundaryStaticFile[],
): void {
  const stat = statSync(absPath);
  if (stat.isDirectory()) {
    for (const entry of readdirSync(absPath)) {
      collectFiles(path.join(absPath, entry), root, files);
    }
    return;
  }
  if (!stat.isFile()) return;

  const filePath = path.relative(root, absPath);
  files.push({
    filePath,
    content: readFileSync(absPath, "utf8"),
  });
}

function shouldScan(filePath: string): boolean {
  if (EXACT_SCAN_FILES.includes(filePath as (typeof EXACT_SCAN_FILES)[number])) {
    return true;
  }
  if (filePath.startsWith("features/agentic-governance/")) {
    return isCodeFile(filePath);
  }
  if (filePath.startsWith("features/external-agent-intake/")) {
    return isCodeFile(filePath);
  }
  if (filePath.startsWith("evals/external-agent-intake/")) {
    return filePath.endsWith(".json") || filePath.endsWith(".md");
  }
  return false;
}

function isCodeFile(filePath: string): boolean {
  return filePath.endsWith(".ts") || filePath.endsWith(".tsx");
}

function importFromPattern(moduleName: string): RegExp {
  return moduleReferencePattern(moduleName, false);
}

function importFromPrefixPattern(modulePrefix: string): RegExp {
  return moduleReferencePattern(modulePrefix, true);
}

function moduleReferencePattern(moduleName: string, allowSubpath: boolean): RegExp {
  const modulePattern = [
    escapeRegExp(moduleName),
    allowSubpath ? String.raw`(?:\/[^"']*)?` : "",
  ].join("");
  return new RegExp(
    [
      String.raw`\b(?:import\s+(?:type\s+)?(?:[^'";]+\s+from\s+)?|export\s+[^'";]+\s+from\s+)["']${modulePattern}["']`,
      String.raw`\brequire\s*\(\s*["']${modulePattern}["']\s*\)`,
      String.raw`\bimport\s*\(\s*["']${modulePattern}["']\s*\)`,
    ].join("|"),
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function deduplicateFailures(
  failures: readonly {
    readonly filePath: string;
    readonly reason: string;
    readonly match: string;
  }[],
): readonly {
  readonly filePath: string;
  readonly reason: string;
  readonly match: string;
}[] {
  const seen = new Set<string>();
  return failures.filter((failure) => {
    const key = `${failure.filePath}:${failure.reason}:${failure.match}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
