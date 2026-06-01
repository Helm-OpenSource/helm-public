import { PrismaClient } from "@prisma/client";
import { DEFAULT_MYSQL_DATABASE_URL, getDatabaseNameFromUrl, parseDatabaseUrl, withDatabaseName } from "@/lib/db-url";
import { readEnvVarFromRootFiles } from "@/lib/root-env";

function quoteMysqlIdentifier(identifier: string) {
  if (!/^[A-Za-z0-9_]+$/.test(identifier)) {
    throw new Error(`Unsafe MySQL identifier: ${identifier}`);
  }

  return `\`${identifier}\``;
}

function resolveBaseDatabaseUrl() {
  return (
    process.env.DATABASE_URL ??
    readEnvVarFromRootFiles("DATABASE_URL", {
      projectRoot: process.cwd(),
      fileNames: [".env.local", ".env"],
    }) ??
    DEFAULT_MYSQL_DATABASE_URL
  );
}

async function main() {
  const baseDatabaseUrl = resolveBaseDatabaseUrl();
  const parsed = parseDatabaseUrl(baseDatabaseUrl);
  if (!parsed || parsed.protocol !== "mysql:") {
    throw new Error(`prepare-e2e-db expects mysql DATABASE_URL, received: ${baseDatabaseUrl}`);
  }

  const baseDatabaseName = getDatabaseNameFromUrl(baseDatabaseUrl);
  if (!baseDatabaseName) {
    throw new Error(`prepare-e2e-db DATABASE_URL is missing database name: ${baseDatabaseUrl}`);
  }

  const requestedDatabaseName = process.argv[2];
  const databaseName =
    requestedDatabaseName && requestedDatabaseName.length > 0
      ? requestedDatabaseName
      : `helm2026_e2e_${Date.now()}_${Math.floor(Math.random() * 100000)}`;

  const adminUrl = new URL(baseDatabaseUrl);
  adminUrl.pathname = "/mysql";

  const adminClient = new PrismaClient({
    datasources: {
      db: { url: adminUrl.toString() },
    },
  });

  try {
    await adminClient.$executeRawUnsafe(
      `CREATE DATABASE IF NOT EXISTS ${quoteMysqlIdentifier(databaseName)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
  } finally {
    await adminClient.$disconnect();
  }

  const isolatedUrl = withDatabaseName(baseDatabaseUrl, databaseName);
  console.log(isolatedUrl);
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
