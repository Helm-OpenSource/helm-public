/**
 * Helm Self-Check Functions
 *
 * Core checking functions for Helm project validation.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { isMysqlDatabaseUrl } from "../../lib/db-url";

export type CheckResult = {
  name: string;
  ok: boolean;
  detail: string;
};

const root = process.cwd();
const sourceFilePattern = /\.[cm]?[jt]sx?$/;
const sourceTestFilePattern = /\.(test|spec)\.[cm]?[jt]sx?$/;

/**
 * Read text content from a file
 */
export function readText(relativePath: string): string {
  try {
    const fullPath = path.join(root, relativePath);
    return readFileSync(fullPath, "utf-8");
  } catch {
    return "";
  }
}

/**
 * Recursively list source files from repo-relative roots while skipping test files.
 */
export function listSourceFiles(relativeRoots: readonly string[]): string[] {
  const files: string[] = [];

  function visit(relativePath: string) {
    const fullPath = path.join(root, relativePath);
    if (!existsSync(fullPath)) {
      return;
    }

    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      for (const entry of readdirSync(fullPath, { withFileTypes: true })) {
        const entryRelativePath = path.join(relativePath, entry.name);
        if (entry.isDirectory()) {
          visit(entryRelativePath);
          continue;
        }

        if (!entry.isFile()) {
          continue;
        }

        if (!sourceFilePattern.test(entry.name) || sourceTestFilePattern.test(entry.name)) {
          continue;
        }

        files.push(entryRelativePath);
      }
      return;
    }

    const baseName = path.basename(relativePath);
    if (sourceFilePattern.test(baseName) && !sourceTestFilePattern.test(baseName)) {
      files.push(relativePath);
    }
  }

  for (const relativeRoot of relativeRoots) {
    visit(relativeRoot);
  }

  return files.sort();
}

/**
 * Read environment variable from root .env files
 */
export function readEnvVarFromRootFiles(name: string): string {
  try {
    const envPath = path.join(root, ".env");
    const envExamplePath = path.join(root, ".env.example");

    // Try .env first, then .env.example
    const content = existsSync(envPath)
      ? readFileSync(envPath, "utf-8")
      : existsSync(envExamplePath)
        ? readFileSync(envExamplePath, "utf-8")
        : "";

    const match = content.match(new RegExp(`^${name}=(.*)$`, "m"));
    if (!match?.[1]) {
      return "";
    }

    const rawValue = match[1].trim();
    if (
      (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
      (rawValue.startsWith("'") && rawValue.endsWith("'"))
    ) {
      return rawValue.slice(1, -1).trim();
    }

    return rawValue;
  } catch {
    return "";
  }
}

/**
 * Run a check and return structured result
 */
export function runCheck(name: string, fn: () => string): CheckResult {
  try {
    const detail = fn();
    const ok = detail.includes("✅") || !detail.includes("❌");
    return { name, ok, detail };
  } catch (error) {
    return {
      name,
      ok: false,
      detail: `❌ Error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Check if a file exists
 */
export function checkFileExists(relativePath: string): boolean {
  return existsSync(path.join(root, relativePath));
}

/**
 * Check if database URL is configured
 */
export function checkDatabaseConfigured(): boolean {
  try {
    const dbUrl = process.env.DATABASE_URL || readEnvVarFromRootFiles("DATABASE_URL");
    return Boolean(dbUrl && isMysqlDatabaseUrl(dbUrl));
  } catch {
    return false;
  }
}
