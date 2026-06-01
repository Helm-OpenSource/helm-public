import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { PrismaClient } from "@prisma/client";
import {
  DEFAULT_MYSQL_DATABASE_URL,
  classifyResetTarget,
  getDatabaseNameFromUrl,
  parseDatabaseUrl,
  withDatabaseName,
} from "@/lib/db-url";
import { readEnvVarFromRootFiles } from "@/lib/root-env";

const projectRoot = process.cwd();
const playwrightDistDir = ".tmp/playwright/.next";
const tsconfigPath = resolve(projectRoot, "tsconfig.json");

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
      projectRoot,
      fileNames: [".env.local", ".env"],
    }) ??
    DEFAULT_MYSQL_DATABASE_URL
  );
}

async function reserveAvailablePort() {
  return await new Promise<number>((resolvePort, reject) => {
    const server = createServer();

    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Failed to reserve an available Playwright server port")));
        return;
      }
      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolvePort(port);
      });
    });
  });
}

function runChecked(command: string, args: string[], env: NodeJS.ProcessEnv = process.env) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: "inherit",
    env,
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status ?? 1}`);
  }
}

function cleanGeneratedNextTypes() {
  for (const generatedTypesDir of [
    resolve(projectRoot, ".next", "types"),
    resolve(projectRoot, playwrightDistDir, "types"),
  ]) {
    rmSync(generatedTypesDir, { force: true, recursive: true });
  }
}

function withBuildNodeOptions(baseEnv: NodeJS.ProcessEnv) {
  const existing = baseEnv.NODE_OPTIONS ?? "";
  if (/--max-old-space-size=\d+/i.test(existing)) {
    return existing;
  }
  return [existing, "--max-old-space-size=4096"].filter(Boolean).join(" ");
}

async function waitForServer(url: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown = null;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status < 500) {
        return;
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(500);
  }

  throw new Error(
    `Timed out waiting for Playwright production server at ${url}${
      lastError instanceof Error ? `: ${lastError.message}` : ""
    }`,
  );
}

async function stopServer(server: ReturnType<typeof spawn>) {
  if (server.exitCode !== null) {
    return;
  }
  server.kill("SIGTERM");
  await Promise.race([
    new Promise<void>((resolveDone) => {
      server.once("exit", () => resolveDone());
    }),
    sleep(5_000).then(() => {
      if (server.exitCode === null) {
        server.kill("SIGKILL");
      }
    }),
  ]);
}

async function createTemporaryMysqlDatabase(baseDatabaseUrl: string) {
  const parsed = parseDatabaseUrl(baseDatabaseUrl);
  if (!parsed || parsed.protocol !== "mysql:") {
    throw new Error(`e2e requires mysql DATABASE_URL, received: ${baseDatabaseUrl}`);
  }

  const baseDatabaseName = getDatabaseNameFromUrl(baseDatabaseUrl);
  if (!baseDatabaseName) {
    throw new Error(`e2e DATABASE_URL is missing database name: ${baseDatabaseUrl}`);
  }

  const tempDatabaseName = `helm2026_e2e_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  const tempDatabaseUrl = withDatabaseName(baseDatabaseUrl, tempDatabaseName);
  const adminUrl = new URL(baseDatabaseUrl);
  adminUrl.pathname = "/mysql";

  const adminClient = new PrismaClient({
    datasources: {
      db: { url: adminUrl.toString() },
    },
  });

  try {
    await adminClient.$executeRawUnsafe(
      `CREATE DATABASE IF NOT EXISTS ${quoteMysqlIdentifier(tempDatabaseName)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
  } finally {
    await adminClient.$disconnect();
  }

  return {
    tempDatabaseName,
    tempDatabaseUrl,
    adminUrl: adminUrl.toString(),
  };
}

function isMysqlCreateDatabasePermissionError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /Access denied|ER_DBACCESS_DENIED_ERROR|ER_ACCESS_DENIED_ERROR|code:\s*1044|code:\s*1045/i.test(message);
}

function assertE2eResetTargetIsIsolated(databaseUrl: string) {
  const decision = classifyResetTarget({
    databaseUrl,
    ci: process.env.CI === "true",
    allowlistedDatabases: (process.env.DB_RESET_ALLOWLIST ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
  });

  if (decision.isBlockedShared || !decision.databaseName) {
    throw new Error(
      [
        `Refusing e2e reset for DATABASE_URL target "${decision.databaseName ?? "(unknown)"}".`,
        "Set PLAYWRIGHT_DATABASE_URL to an isolated test database, or allow temporary database creation.",
        "Shared databases such as helm2026 / helm2026_main must never be reset by e2e.",
      ].join(" "),
    );
  }
}

async function dropTemporaryMysqlDatabase(adminUrl: string, databaseName: string) {
  const adminClient = new PrismaClient({
    datasources: {
      db: { url: adminUrl },
    },
  });

  try {
    await adminClient.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${quoteMysqlIdentifier(databaseName)}`);
  } finally {
    await adminClient.$disconnect();
  }
}

async function main() {
  const playwrightPort = await reserveAvailablePort();
  const playwrightBaseUrl = `http://127.0.0.1:${playwrightPort}`;
  const originalTsconfig = readFileSync(tsconfigPath, "utf8");
  const baseDatabaseUrl = resolveBaseDatabaseUrl();
  const fixedE2eDatabaseUrl = process.env.PLAYWRIGHT_DATABASE_URL;
  let tempDatabase: Awaited<ReturnType<typeof createTemporaryMysqlDatabase>> | null = null;
  let e2eDatabaseUrl = fixedE2eDatabaseUrl ?? "";
  const shouldResetExistingDatabase = Boolean(fixedE2eDatabaseUrl);

  if (!fixedE2eDatabaseUrl) {
    try {
      tempDatabase = await createTemporaryMysqlDatabase(baseDatabaseUrl);
      e2eDatabaseUrl = tempDatabase.tempDatabaseUrl;
    } catch (error) {
      if (!isMysqlCreateDatabasePermissionError(error)) {
        throw error;
      }
      throw new Error(
        [
          "[run-playwright-e2e] Missing CREATE DATABASE privilege for temporary e2e database.",
          "Refusing to fall back to resetting the base DATABASE_URL.",
          "Set PLAYWRIGHT_DATABASE_URL to an isolated test database if the current account cannot create temporary databases.",
        ].join(" "),
      );
    }
  }

  if (!e2eDatabaseUrl) {
    throw new Error("failed to resolve e2e DATABASE_URL");
  }
  const e2eDatabaseName = getDatabaseNameFromUrl(e2eDatabaseUrl) ?? "";
  if (shouldResetExistingDatabase) {
    assertE2eResetTargetIsIsolated(e2eDatabaseUrl);
  }

  const isolatedEnv = {
    ...process.env,
    DATABASE_URL: e2eDatabaseUrl,
    NEXT_DIST_DIR: playwrightDistDir,
    PLAYWRIGHT_BASE_URL: playwrightBaseUrl,
    PLAYWRIGHT_SERVER_PORT: String(playwrightPort),
    HELM_ALLOW_VERIFICATION_CODE_PREVIEW: "1",
    DB_RESET_ALLOWLIST: [process.env.DB_RESET_ALLOWLIST, e2eDatabaseName].filter(Boolean).join(","),
    NODE_OPTIONS: withBuildNodeOptions(process.env),
  };

  if (shouldResetExistingDatabase) {
    runChecked("npm", ["run", "db:reset"], isolatedEnv);
  } else {
    runChecked("npm", ["run", "db:prepare"], isolatedEnv);
  }
  cleanGeneratedNextTypes();
  runChecked("npm", ["run", "build"], isolatedEnv);

  const server = spawn("npm", ["run", "start", "--", "--hostname", "127.0.0.1", "--port", String(playwrightPort)], {
    cwd: projectRoot,
    stdio: "inherit",
    env: isolatedEnv,
  });

  const cleanup = async () => {
    await stopServer(server);
    if (tempDatabase) {
      await dropTemporaryMysqlDatabase(tempDatabase.adminUrl, tempDatabase.tempDatabaseName);
    }
  };

  process.once("SIGINT", () => {
    void cleanup().finally(() => process.exit(130));
  });
  process.once("SIGTERM", () => {
    void cleanup().finally(() => process.exit(143));
  });

  let exitCode = 1;
  try {
    await waitForServer(playwrightBaseUrl, 60_000);
    const run = spawnSync("playwright", ["test"], {
      cwd: projectRoot,
      stdio: "inherit",
      env: {
        ...isolatedEnv,
        PLAYWRIGHT_REUSE_SERVER: "1",
      },
    });
    exitCode = run.status ?? 1;
  } finally {
    await cleanup();
    if (readFileSync(tsconfigPath, "utf8") !== originalTsconfig) {
      writeFileSync(tsconfigPath, originalTsconfig, "utf8");
    }
  }

  process.exit(exitCode);
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
