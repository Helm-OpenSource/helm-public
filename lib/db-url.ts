export const DEFAULT_MYSQL_DATABASE_URL =
  "mysql://root:root@127.0.0.1:3306/helm2026?charset=utf8mb4";

const BLOCKED_SHARED_DATABASES = new Set(["helm2026", "helm2026_main"]);

export function parseDatabaseUrl(databaseUrl: string | null | undefined) {
  if (!databaseUrl) {
    return undefined;
  }

  try {
    return new URL(databaseUrl);
  } catch {
    return undefined;
  }
}

export function isMysqlDatabaseUrl(databaseUrl: string | null | undefined) {
  const parsed = parseDatabaseUrl(databaseUrl);
  return parsed?.protocol === "mysql:";
}

export function getDatabaseNameFromUrl(databaseUrl: string | null | undefined) {
  const parsed = parseDatabaseUrl(databaseUrl);
  if (!parsed) {
    return undefined;
  }

  return parsed.pathname.replace(/^\//, "") || undefined;
}

export function withDatabaseName(databaseUrl: string, databaseName: string) {
  const parsed = parseDatabaseUrl(databaseUrl);
  if (!parsed) {
    throw new Error(`Invalid DATABASE_URL: ${databaseUrl}`);
  }

  parsed.pathname = `/${databaseName}`;
  return parsed.toString();
}

export function classifyResetTarget(options: {
  databaseUrl: string | null | undefined;
  ci?: boolean;
  allowlistedDatabases?: Iterable<string>;
}) {
  const databaseName = getDatabaseNameFromUrl(options.databaseUrl);
  const allowlist = new Set(options.allowlistedDatabases ?? []);
  const isBlockedShared = databaseName ? BLOCKED_SHARED_DATABASES.has(databaseName) : false;
  const isCiTempDatabase = Boolean(
    options.ci &&
      databaseName &&
      /(^|_)(ci|tmp|temp|test|e2e)(_|$)/i.test(databaseName),
  );
  const isAllowlisted = databaseName ? allowlist.has(databaseName) : false;

  return {
    databaseName,
    isBlockedShared,
    isCiTempDatabase,
    isAllowlisted,
    canReset: !isBlockedShared && (isCiTempDatabase || isAllowlisted),
  };
}
