import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  DEFAULT_MYSQL_DATABASE_URL,
  classifyResetTarget,
  getDatabaseNameFromUrl,
  isMysqlDatabaseUrl,
  parseDatabaseUrl,
} from "../lib/db-url";
import { readEnvVarFromRootFiles } from "../lib/root-env";
import {
  isIgnorableExtensionSetupSqlError,
  listExtensionSetupSqlFiles,
  walkSqlFiles,
} from "./setup-db-sql-files";

const projectRoot = process.cwd();
const mode = process.argv[2];

function runPrisma(args: string[]) {
  execFileSync("prisma", args, {
    cwd: projectRoot,
    stdio: "inherit",
    env: process.env,
  });
}

function runNpm(args: string[]) {
  execFileSync("npm", args, {
    cwd: projectRoot,
    stdio: "inherit",
    env: process.env,
  });
}

function parseAllowlist(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function quoteMysqlIdentifier(identifier: string) {
  if (!/^[A-Za-z0-9_]+$/.test(identifier)) {
    throw new Error(`Unsafe MySQL identifier: ${identifier}`);
  }

  return `\`${identifier}\``;
}

async function ensureMysqlDatabaseExists(databaseUrl: string) {
  const parsed = parseDatabaseUrl(databaseUrl);
  if (!parsed || parsed.protocol !== "mysql:") {
    throw new Error(`setup-db expects a mysql DATABASE_URL, received: ${databaseUrl}`);
  }

  const databaseName = getDatabaseNameFromUrl(databaseUrl);
  if (!databaseName) {
    throw new Error(`setup-db requires a database name in DATABASE_URL, received: ${databaseUrl}`);
  }

  const targetClient = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });

  try {
    await targetClient.$queryRawUnsafe("SELECT 1");
    return;
  } catch {
    // Fall through to CREATE DATABASE attempt.
  } finally {
    await targetClient.$disconnect();
  }

  const adminUrl = new URL(parsed.toString());
  adminUrl.pathname = "/mysql";

  const adminClient = new PrismaClient({
    datasources: {
      db: {
        url: adminUrl.toString(),
      },
    },
  });

  try {
    try {
      await adminClient.$executeRawUnsafe(
        `CREATE DATABASE IF NOT EXISTS ${quoteMysqlIdentifier(databaseName)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
      );
    } catch (error) {
      // Some managed RDS users have no CREATE privilege; continue and verify connectivity.
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!errorMessage.includes("Access denied")) {
        throw error;
      }
    }
  } finally {
    await adminClient.$disconnect();
  }

  const verifyClient = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });

  try {
    await verifyClient.$queryRawUnsafe("SELECT 1");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Unable to use target MySQL database "${databaseName}". ` +
        "Ensure the database is pre-created and this user has access. " +
        `Original error: ${errorMessage}`,
    );
  } finally {
    await verifyClient.$disconnect();
  }
}

/**
 * Walks only explicit extension sql directories and executes each statement
 * via raw SQL on the resolved database. Report-skill query.sql files can use
 * source warehouse dialects and MUST NOT be applied to Helm's MySQL setup
 * database. All extension setup SQL files MUST be idempotent (CREATE TABLE IF
 * NOT EXISTS, ON DUPLICATE KEY UPDATE, etc.).
 *
 * Set HELM_SKIP_EXTENSION_SQL=1 to opt out.
 */
async function runExtensionSqlFiles(databaseUrl: string) {
  if (process.env.HELM_SKIP_EXTENSION_SQL === "1") return;

  const extensionsRoot = path.resolve(projectRoot, "extensions");
  if (!existsSync(extensionsRoot)) return;

  const files = listExtensionSetupSqlFiles(extensionsRoot);
  if (files.length === 0) return;

  const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      const statements = content
        .split(/;[\t ]*(?:\r?\n|$)/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith("--"));
      for (const stmt of statements) {
        try {
          await client.$executeRawUnsafe(stmt);
        } catch (error) {
          if (isIgnorableExtensionSetupSqlError(error)) {
            console.log(
              `[setup-db] skipped idempotent duplicate in ${path.relative(projectRoot, file)}`,
            );
            continue;
          }
          const msg = error instanceof Error ? error.message : String(error);
          throw new Error(
            `[setup-db] failed to apply ${path.relative(projectRoot, file)}\n  statement: ${stmt.slice(0, 200)}...\n  error: ${msg}`,
          );
        }
      }
      console.log(`[setup-db] applied ${path.relative(projectRoot, file)}`);
    }
  } finally {
    await client.$disconnect();
  }
}

/**
 * Applies project-local MySQL manual SQL files that supplement the current
 * Prisma migration baseline. These files must stay idempotent because local
 * verification and Playwright e2e can run them repeatedly on isolated DBs.
 */
async function runProjectManualSqlFiles(databaseUrl: string) {
  const manualRoot = path.resolve(projectRoot, "prisma", "manual");
  if (!existsSync(manualRoot)) return;

  const files = walkSqlFiles(manualRoot).sort();
  if (files.length === 0) return;

  const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      const statements = content
        .split(/;[\t ]*(?:\r?\n|$)/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith("--"));
      for (const stmt of statements) {
        try {
          await client.$executeRawUnsafe(stmt);
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          throw new Error(
            `[setup-db] failed to apply ${path.relative(projectRoot, file)}\n  statement: ${stmt.slice(0, 200)}...\n  error: ${msg}`,
          );
        }
      }
      console.log(`[setup-db] applied ${path.relative(projectRoot, file)}`);
    }
  } finally {
    await client.$disconnect();
  }
}

async function main() {
  const resolvedDatabaseUrl =
    process.env.DATABASE_URL ??
    readEnvVarFromRootFiles("DATABASE_URL", {
      projectRoot,
      fileNames: [".env.local", ".env"],
    }) ??
    DEFAULT_MYSQL_DATABASE_URL;

  if (!isMysqlDatabaseUrl(resolvedDatabaseUrl)) {
    throw new Error(
      `setup-db only supports MySQL DATABASE_URL. Received: ${resolvedDatabaseUrl}.` +
        " For one-off data migration from sqlite use SQLITE_SOURCE_DATABASE_URL with db:sqlite-export.",
    );
  }

  process.env.DATABASE_URL = resolvedDatabaseUrl;

  switch (mode) {
    case "migrate": {
      await ensureMysqlDatabaseExists(resolvedDatabaseUrl);
      runPrisma(["migrate", "deploy", "--schema", "prisma/schema.prisma"]);
      await runExtensionSqlFiles(resolvedDatabaseUrl);
      await runProjectManualSqlFiles(resolvedDatabaseUrl);
      return;
    }
    case "prepare": {
      await ensureMysqlDatabaseExists(resolvedDatabaseUrl);
      runPrisma(["migrate", "deploy", "--schema", "prisma/schema.prisma"]);
      await runExtensionSqlFiles(resolvedDatabaseUrl);
      await runProjectManualSqlFiles(resolvedDatabaseUrl);
      runNpm(["run", "db:seed"]);
      return;
    }
    case "reset": {
      const decision = classifyResetTarget({
        databaseUrl: resolvedDatabaseUrl,
        ci: process.env.CI === "true",
        allowlistedDatabases: parseAllowlist(process.env.DB_RESET_ALLOWLIST),
      });

      if (!decision.canReset) {
        const databaseName = decision.databaseName ?? "(unknown)";
        throw new Error(
          [
            `Refusing db:reset for DATABASE_URL target "${databaseName}".`,
            "Allowed targets are CI temporary databases or DB_RESET_ALLOWLIST entries.",
            `Blocked shared databases include helm2026 / helm2026_main. Current allowlist: ${process.env.DB_RESET_ALLOWLIST ?? "(empty)"}`,
          ].join(" "),
        );
      }

      await ensureMysqlDatabaseExists(resolvedDatabaseUrl);
      runPrisma([
        "migrate",
        "reset",
        "--force",
        "--skip-generate",
        "--skip-seed",
        "--schema",
        "prisma/schema.prisma",
      ]);
      await runExtensionSqlFiles(resolvedDatabaseUrl);
      await runProjectManualSqlFiles(resolvedDatabaseUrl);
      runNpm(["run", "db:seed:force"]);
      return;
    }
    default:
      throw new Error("Usage: tsx prisma/setup-db.ts <migrate|prepare|reset>");
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
