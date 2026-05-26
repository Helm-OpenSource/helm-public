import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const DEFAULT_ROOTS = [
  "lib/intelligence-growth",
  "lib/evals",
  "scripts",
  "evals",
] as const;

type BoundaryPattern = {
  readonly reason: string;
  readonly regex: RegExp;
};

export type IntelligenceGrowthBoundaryStaticFile = {
  readonly filePath: string;
  readonly content: string;
};

export type IntelligenceGrowthBoundaryStaticEvalOptions = {
  readonly root?: string;
  readonly files?: readonly IntelligenceGrowthBoundaryStaticFile[];
};

export type IntelligenceGrowthBoundaryStaticEvalSummary = {
  readonly passed: boolean;
  readonly scannedFileCount: number;
  readonly forbiddenImportCount: number;
  readonly forbiddenEnvCount: number;
  readonly forbiddenNetworkCount: number;
  readonly forbiddenAppApiReferenceCount: number;
  readonly forbiddenDatabaseReferenceCount: number;
  readonly forbiddenProductionQueryReferenceCount: number;
  readonly forbiddenRuntimeReferenceCount: number;
  readonly candidateOnly: true;
  readonly runtimeAllowed: false;
  readonly officialWriteAllowed: false;
  readonly autoExecutionAllowed: false;
  readonly canonicalMemoryWriteAllowed: false;
  readonly promptOrPolicyUpdateAllowed: false;
  readonly skillAutoPromotionAllowed: false;
  readonly failures: readonly {
    readonly filePath: string;
    readonly reason: string;
    readonly match: string;
  }[];
};

const FORBIDDEN_PATTERNS: readonly BoundaryPattern[] = [
  {
    reason: "forbidden_prisma_import",
    regex: new RegExp(escapeRegExp(["@", "prisma/client"].join(""))),
  },
  {
    reason: "forbidden_db_helper_import",
    regex: new RegExp(escapeRegExp(["@/lib", "db"].join("/"))),
  },
  {
    reason: "forbidden_database_env",
    regex: new RegExp(escapeRegExp(["DATABASE", "URL"].join("_"))),
  },
  {
    reason: "forbidden_openai_env",
    regex: new RegExp(escapeRegExp(["OPENAI", "API", "KEY"].join("_"))),
  },
  {
    reason: "forbidden_anthropic_env",
    regex: new RegExp(escapeRegExp(["ANTHROPIC", "API", "KEY"].join("_"))),
  },
  {
    reason: "forbidden_fetch_call",
    regex: /\bfetch\s*\(/,
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
    reason: "forbidden_app_api_reference",
    regex: new RegExp(escapeRegExp(["app", "api"].join("/"))),
  },
  {
    reason: "forbidden_next_server_import",
    regex: new RegExp(escapeRegExp(["next", "server"].join("/"))),
  },
  {
    reason: "forbidden_app_route_import",
    regex: new RegExp(escapeRegExp(["@", "app"].join("/"))),
  },
  {
    reason: "forbidden_production_query_reference",
    regex: new RegExp(escapeRegExp(["data", "queries"].join("/"))),
  },
  {
    reason: "forbidden_production_query_import",
    regex: new RegExp(escapeRegExp(["@/data", "queries"].join("/"))),
  },
];

export function runIntelligenceGrowthBoundaryStaticEval(
  options: IntelligenceGrowthBoundaryStaticEvalOptions = {},
): IntelligenceGrowthBoundaryStaticEvalSummary {
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

  return {
    passed: uniqueFailures.length === 0,
    scannedFileCount: files.length,
    forbiddenImportCount: uniqueFailures.filter((failure) =>
      failure.reason.endsWith("_import"),
    ).length,
    forbiddenEnvCount: uniqueFailures.filter((failure) =>
      failure.reason.endsWith("_env"),
    ).length,
    forbiddenNetworkCount,
    forbiddenAppApiReferenceCount,
    forbiddenDatabaseReferenceCount,
    forbiddenProductionQueryReferenceCount,
    forbiddenRuntimeReferenceCount:
      forbiddenNetworkCount +
      forbiddenAppApiReferenceCount +
      forbiddenProductionQueryReferenceCount,
    candidateOnly: true,
    runtimeAllowed: false,
    officialWriteAllowed: false,
    autoExecutionAllowed: false,
    canonicalMemoryWriteAllowed: false,
    promptOrPolicyUpdateAllowed: false,
    skillAutoPromotionAllowed: false,
    failures: uniqueFailures,
  };
}

function isNetworkFailure(failure: { readonly reason: string }): boolean {
  return failure.reason === "forbidden_fetch_call" ||
    failure.reason === "forbidden_openai_host" ||
    failure.reason === "forbidden_anthropic_host";
}

function isAppApiFailure(failure: { readonly reason: string }): boolean {
  return failure.reason === "forbidden_app_api_reference" ||
    failure.reason === "forbidden_next_server_import" ||
    failure.reason === "forbidden_app_route_import";
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

function collectDefaultFiles(root: string): readonly IntelligenceGrowthBoundaryStaticFile[] {
  const files: IntelligenceGrowthBoundaryStaticFile[] = [];
  for (const relRoot of DEFAULT_ROOTS) {
    const absRoot = path.join(root, relRoot);
    collectFiles(absRoot, root, files);
  }
  return files.filter((file) => shouldScan(file.filePath));
}

function collectFiles(
  absPath: string,
  root: string,
  files: IntelligenceGrowthBoundaryStaticFile[],
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
  if (filePath.startsWith("lib/intelligence-growth/")) {
    return isCodeFile(filePath);
  }
  if (filePath.startsWith("lib/evals/intelligence-growth")) {
    return isCodeFile(filePath);
  }
  if (filePath.startsWith("scripts/intelligence-growth")) {
    return filePath.endsWith(".ts");
  }
  if (filePath.startsWith("evals/intelligence-growth")) {
    return filePath.endsWith(".json") || filePath.endsWith(".md");
  }
  return false;
}

function isCodeFile(filePath: string): boolean {
  return filePath.endsWith(".ts") || filePath.endsWith(".tsx");
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
