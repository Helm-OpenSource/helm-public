/**
 * check-extension-boundaries — 接入面 7 步清单的代码层闸门
 *
 * 与 check-resource-manifests 互补：那个校 L2 manifest 字段，本脚本校代码组织。
 * 7 步清单（best-practice §5）映射：
 *   L1 Connector 隔离      → A) 扩展业务子目录禁直接 fetch / 直接 import http
 *   Audit 落库强制         → B) connector client 文件必须引用 call-log repository
 *   降级剧本               → C) connector client 必须含 fallback 字段或显式 @no-degraded 标
 *   Worker 形态守门        → D) worker manifest forbiddenActions 非空 + operationMode=observer + writes=[]
 *   Worker decide 纯净度   → E) worker decide.ts 不引 node:fs / node:net / fetch
 *
 * 设计原则：
 *   - 静态扫描，0 依赖（不解析 AST，仅基于路径 + 文本规则）
 *   - 宁可 strict（false-positive 比 false-negative 好；豁免必须显式 @bypass-* 注释）
 *   - 退出码 1 表示 fail；0 表示通过
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

export type Issue = { readonly file: string; readonly rule: string; readonly message: string };

export type Options = {
  readonly repoRoot?: string;
  readonly scanRoot?: string;
};

export type Result = {
  readonly ok: boolean;
  readonly exitCode: 0 | 1;
  readonly files: readonly string[];
  readonly scannedManifests: number;
  readonly scannedDecides: number;
  readonly issues: readonly Issue[];
};

function walk(dir: string, acc: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return acc;
  }
  for (const entry of entries) {
    if (entry.startsWith(".")) continue;
    if (entry === "node_modules") continue;
    const full = join(dir, entry);
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      walk(full, acc);
    } else if (
      entry.endsWith(".ts") ||
      entry.endsWith(".tsx")
    ) {
      acc.push(full);
    }
  }
  return acc;
}

function read(file: string): string {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

function rel(file: string, repoRoot: string): string {
  return relative(repoRoot, file);
}

function isTestFile(file: string): boolean {
  return /\.(test|spec)\.tsx?$/.test(file) || file.includes("/tests/") || file.includes("/__tests__/");
}

function isFixtureFile(file: string): boolean {
  return /\.fixtures?\.ts$/.test(file);
}

function hasBypass(content: string, ruleId: string): boolean {
  return content.includes(`@bypass-${ruleId}`);
}

// ---------- A) connector 隔离 ----------
// 扩展内业务子目录不能直接 fetch / import node:http(s) / import node-fetch。
// 豁免：lib/gateway/* + tests + fixtures + scripts。

function isInsideGateway(path: string): boolean {
  return /\/lib\/gateway\//.test(path);
}

function isExtensionScript(path: string): boolean {
  return /\/scripts\//.test(path);
}

function ruleConnectorIsolation(file: string, content: string, repoRoot: string): Issue[] {
  const issues: Issue[] = [];
  // 仅对 .ts 服务端文件强制；.tsx 客户端组件里的 fetch() 通常是浏览器调用 Helm 自己的
  // /api/* 路由，是 in-app 通信，不是出站到外部上游。这种合法用法不在本规则范围。
  if (file.endsWith(".tsx")) return issues;
  if (
    isInsideGateway(file) ||
    isTestFile(file) ||
    isFixtureFile(file) ||
    isExtensionScript(file) ||
    hasBypass(content, "connector-isolation")
  ) {
    return issues;
  }
  // 直接调 fetch 全局
  if (/(^|[^a-zA-Z0-9_])fetch\s*\(/.test(content) && !/this\.fetchImpl/.test(content)) {
    issues.push({
      file: rel(file, repoRoot),
      rule: "connector-isolation",
      message:
        "扩展业务代码不允许直接 fetch()；走 lib/gateway/ 出站。绕过请加 @bypass-connector-isolation 注释并在 PR 描述说明",
    });
  }
  // import node:http(s) / node-fetch
  if (/from\s+["']node:https?["']/.test(content) || /from\s+["']node-fetch["']/.test(content)) {
    issues.push({
      file: rel(file, repoRoot),
      rule: "connector-isolation",
      message: "扩展业务代码不允许直接 import http/https/node-fetch；走 lib/gateway/",
    });
  }
  return issues;
}

// ---------- B) audit 落库强制 ----------
// lib/gateway/*-client.ts 必须引用 call-log repository（出站强制审计）。

function ruleAuditEnforced(file: string, content: string, repoRoot: string): Issue[] {
  const issues: Issue[] = [];
  if (!/\/lib\/gateway\/.*-client\.ts$/.test(file)) return issues;
  if (hasBypass(content, "audit-enforced")) return issues;
  if (!/CallLogRepository|call-?log-?repository|callLogRepository/i.test(content)) {
    issues.push({
      file: rel(file, repoRoot),
      rule: "audit-enforced",
      message:
        "出站 client 必须引用 call-log repository（每次出站强制审计落库）。绕过请加 @bypass-audit-enforced",
    });
  }
  return issues;
}

// ---------- C) 降级剧本声明 ----------
// lib/gateway/*-client.ts 必须含 fallback 概念或显式 @no-degraded。

function ruleDegradedDeclared(file: string, content: string, repoRoot: string): Issue[] {
  const issues: Issue[] = [];
  if (!/\/lib\/gateway\/.*-client\.ts$/.test(file)) return issues;
  if (content.includes("@no-degraded") || hasBypass(content, "degraded-declared")) return issues;
  if (!/(fallback|degraded|cache|mock)/i.test(content)) {
    issues.push({
      file: rel(file, repoRoot),
      rule: "degraded-declared",
      message:
        "出站 client 必须有 fallback / degraded / cache / mock 路径之一；不需要降级请在文件顶部加 @no-degraded 显式声明并附理由",
    });
  }
  return issues;
}

// ---------- D) worker manifest 边界 ----------
// extensions/*/workers/*/manifest.ts 必须：
//   - forbiddenActions 非空数组
//   - operationMode 为 observer / DEFAULT_OPERATION_MODE
//   - dataAccess.writes 为空数组（preview 期 hard rule）

function isWorkerManifest(file: string): boolean {
  return /\/workers\/[^/]+\/manifest\.ts$/.test(file);
}

function ruleWorkerManifest(file: string, content: string, repoRoot: string): Issue[] {
  const issues: Issue[] = [];
  if (!isWorkerManifest(file)) return issues;
  if (hasBypass(content, "worker-manifest")) return issues;

  if (!/forbiddenActions\s*:\s*\[/.test(content) || /forbiddenActions\s*:\s*\[\s*\]/.test(content)) {
    issues.push({
      file: rel(file, repoRoot),
      rule: "worker-manifest",
      message: "worker manifest 必须含非空 forbiddenActions 数组（best-practice §3 P5 / parent §10 边界）",
    });
  }

  const okMode =
    /operationMode\s*:\s*DEFAULT_OPERATION_MODE/.test(content) ||
    /operationMode\s*:\s*"observer"/.test(content);
  if (!okMode) {
    issues.push({
      file: rel(file, repoRoot),
      rule: "worker-manifest",
      message:
        "worker manifest.operationMode 必须是 DEFAULT_OPERATION_MODE 或 \"observer\"（observer-first 起步原则）",
    });
  }

  // writes 必须显式 [] —— preview 期不允许 worker 自身落业务表
  if (!/writes\s*:\s*\[\s*\]/.test(content)) {
    issues.push({
      file: rel(file, repoRoot),
      rule: "worker-manifest",
      message: "worker manifest.dataAccess.writes 必须是空数组 []（preview 期 worker 自身禁写业务表）",
    });
  }
  return issues;
}

// ---------- E) worker decide 纯净度 ----------
// worker decide.ts 不引 node:fs / node:net / 直接 fetch。

function isWorkerDecide(file: string): boolean {
  return /\/workers\/[^/]+\/decide\.ts$/.test(file);
}

function ruleWorkerDecidePure(file: string, content: string, repoRoot: string): Issue[] {
  const issues: Issue[] = [];
  if (!isWorkerDecide(file)) return issues;
  if (hasBypass(content, "worker-decide-pure")) return issues;

  const banned: Array<{ rx: RegExp; what: string }> = [
    { rx: /from\s+["']node:fs["']/, what: "node:fs" },
    { rx: /from\s+["']node:net["']/, what: "node:net" },
    { rx: /from\s+["']node:https?["']/, what: "node:http(s)" },
    { rx: /from\s+["']node-fetch["']/, what: "node-fetch" },
    { rx: /(^|[^a-zA-Z0-9_])fetch\s*\(/, what: "fetch()" },
    { rx: /\bDate\.now\s*\(/, what: "Date.now() — 注入 now 参数" },
    { rx: /\brandomUUID\s*\(/, what: "randomUUID — 用确定性 key" },
  ];
  for (const b of banned) {
    if (b.rx.test(content)) {
      issues.push({
        file: rel(file, repoRoot),
        rule: "worker-decide-pure",
        message: `worker decide.ts 必须是纯函数：禁用 ${b.what}`,
      });
    }
  }
  return issues;
}

// ---------- runner ----------

export function runExtensionBoundaryCheck(options: Options = {}): Result {
  const repoRoot = options.repoRoot ?? process.cwd();
  const scanRoot = options.scanRoot ?? join(repoRoot, "extensions");
  const files = walk(scanRoot);

  const allIssues: Issue[] = [];
  for (const file of files) {
    const content = read(file);
    allIssues.push(...ruleConnectorIsolation(file, content, repoRoot));
    allIssues.push(...ruleAuditEnforced(file, content, repoRoot));
    allIssues.push(...ruleDegradedDeclared(file, content, repoRoot));
    allIssues.push(...ruleWorkerManifest(file, content, repoRoot));
    allIssues.push(...ruleWorkerDecidePure(file, content, repoRoot));
  }

  const scannedManifests = files.filter((f) => isWorkerManifest(f)).length;
  const scannedDecides = files.filter((f) => isWorkerDecide(f)).length;

  return {
    ok: allIssues.length === 0,
    exitCode: allIssues.length === 0 ? 0 : 1,
    files,
    scannedManifests,
    scannedDecides,
    issues: allIssues,
  };
}

// ---------- main ----------

function main(): number {
  const result = runExtensionBoundaryCheck();
  if (result.files.length === 0) {
    console.log("[check:extension-boundaries] no extension files scanned");
    return result.exitCode;
  }

  if (result.ok) {
    console.log(
      `[check:extension-boundaries] OK — ${result.files.length} files scanned (${result.scannedManifests} worker manifests, ${result.scannedDecides} decide.ts)`,
    );
    return result.exitCode;
  }

  // group by rule
  const byRule = new Map<string, Issue[]>();
  for (const i of result.issues) {
    const arr = byRule.get(i.rule) ?? [];
    arr.push(i);
    byRule.set(i.rule, arr);
  }

  console.error(`[check:extension-boundaries] FAILED — ${result.issues.length} issue(s):`);
  for (const [rule, issues] of byRule) {
    console.error(`\n  [${rule}] (${issues.length})`);
    for (const i of issues) {
      console.error(`    ${i.file}: ${i.message}`);
    }
  }
  return result.exitCode;
}

if (require.main === module) {
  process.exitCode = main();
}
