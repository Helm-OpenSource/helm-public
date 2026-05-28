#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import net from "node:net";
import path from "node:path";

type ComposeRuntime =
  | {
      cmd: "docker";
      baseArgs: string[];
      label: string;
    }
  | {
      cmd: "docker-compose";
      baseArgs: string[];
      label: string;
    };

type CheckResult = {
  errors: string[];
  warnings: string[];
  compose: ComposeRuntime | null;
};

const root = process.cwd();
const doctorOnly = process.argv.includes("--doctor");
const forwardedArgs = process.argv.slice(2).filter((arg) => arg !== "--doctor");

function runCheck(command: string, args: string[]) {
  return spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: "pipe",
  });
}

function detectComposeRuntime(): ComposeRuntime | null {
  const dockerCompose = runCheck("docker", ["compose", "version"]);
  if (dockerCompose.status === 0) {
    return { cmd: "docker", baseArgs: ["compose"], label: "docker compose" };
  }

  const legacyCompose = runCheck("docker-compose", ["version"]);
  if (legacyCompose.status === 0) {
    return { cmd: "docker-compose", baseArgs: [], label: "docker-compose" };
  }

  return null;
}

function dockerDaemonReady() {
  return runCheck("docker", ["info"]).status === 0;
}

function extractEnvValue(fileContent: string, key: string): string | null {
  for (const line of fileContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) continue;
    const currentKey = trimmed.slice(0, separatorIndex).trim();
    if (currentKey !== key) continue;
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    if (
      (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
      (rawValue.startsWith("'") && rawValue.endsWith("'"))
    ) {
      return rawValue.slice(1, -1);
    }
    return rawValue;
  }
  return null;
}

async function isPortAvailable(port: number) {
  return await new Promise<boolean>((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "0.0.0.0");
  });
}

async function runChecks(): Promise<CheckResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const compose = detectComposeRuntime();

  if (!compose) {
    errors.push("未检测到 `docker compose` 或 `docker-compose`。请先安装 Docker Desktop / OrbStack / colima。");
    return { errors, warnings, compose: null };
  }

  if (!dockerDaemonReady()) {
    errors.push("Docker 已安装，但 daemon 当前不可用。请先启动 Docker Desktop / OrbStack / colima。");
  }

  if (!existsSync(path.join(root, "docker-compose.yml"))) {
    errors.push("仓库根目录缺少 `docker-compose.yml`，当前 quickstart 无法继续。");
  }

  if (!existsSync(path.join(root, "Dockerfile"))) {
    errors.push("仓库根目录缺少 `Dockerfile`，当前 quickstart 无法继续。");
  }

  if (!existsSync(path.join(root, ".env.example"))) {
    errors.push("仓库根目录缺少 `.env.example`，请先恢复公开环境样板。");
  }

  const envPath = path.join(root, ".env");
  if (!existsSync(envPath)) {
    warnings.push("未发现 `.env`。这不会阻止 Docker demo path，但本机 `npm run dev` 路径仍需要手动 `cp .env.example .env`。");
  } else {
    const envContent = readFileSync(envPath, "utf8");
    const databaseUrl = extractEnvValue(envContent, "DATABASE_URL");
    if (databaseUrl?.includes("file:")) {
      warnings.push("当前 `.env` 的 `DATABASE_URL` 指向 SQLite；Docker quickstart 会使用 compose 内部 MySQL，不会用这条连接串。");
    }
  }

  if (!(await isPortAvailable(3000))) {
    errors.push("本机 `3000` 端口已被占用；请先释放，或修改 `docker-compose.yml` 中 app 的映射端口。");
  }

  if (!(await isPortAvailable(3306))) {
    errors.push("本机 `3306` 端口已被占用；请先释放，或修改 `docker-compose.yml` 中 MySQL 的映射端口。");
  }

  return { errors, warnings, compose };
}

function printChecklist(result: CheckResult) {
  console.log("");
  console.log("Helm quickstart preflight");
  console.log("=========================");
  console.log(`repo: ${root}`);
  console.log(`compose: ${result.compose?.label ?? "missing"}`);
  console.log("demo routes:");
  console.log("- http://localhost:3000");
  console.log("- http://localhost:3000/demo");
  console.log("- http://localhost:3000/operating");
  console.log("");

  console.log(result.errors.length ? "preflight: FAIL" : "preflight: PASS");

  if (result.warnings.length) {
    console.log("");
    console.log("warnings:");
    for (const warning of result.warnings) {
      console.log(`- ${warning}`);
    }
  }

  if (result.errors.length) {
    console.log("");
    console.log("errors:");
    for (const error of result.errors) {
      console.log(`- ${error}`);
    }
  }

  console.log("");
  console.log("notes:");
  console.log("- `npm run quickstart` 会执行 `docker compose up --build`。");
  console.log("- 停止服务：`docker compose down`");
  console.log("- 如果你要先只做环境检查，用 `npm run quickstart:doctor`。");
  console.log("");
}

async function main() {
  const result = await runChecks();
  printChecklist(result);

  if (result.errors.length) {
    process.exit(1);
  }

  if (doctorOnly) {
    process.exit(0);
  }

  if (!result.compose) {
    process.exit(1);
  }

  const args =
    forwardedArgs.length > 0
      ? [...result.compose.baseArgs, ...forwardedArgs]
      : [...result.compose.baseArgs, "up", "--build"];

  console.log(`starting: ${[result.compose.cmd, ...args].join(" ")}`);
  console.log("");

  const child = spawnSync(result.compose.cmd, args, {
    cwd: root,
    stdio: "inherit",
  });

  process.exit(child.status ?? 1);
}

void main();
