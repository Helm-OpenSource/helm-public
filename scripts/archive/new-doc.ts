#!/usr/bin/env tsx
/**
 * `npm run doc:new` — interactive wizard for creating a new in-scope doc with
 * a compliant lifecycle frontmatter (per docs/_doc-lifecycle/CONTRACT.md).
 *
 * The wizard turns the four required answers into a multiple-choice flow so
 * authors don't fill blanks (which is where gaming happens):
 *
 *   1. Doc type (A-G)            → fixes path prefix + filename pattern
 *   2. Owner role                → from a curated list (custom requires extra confirmation)
 *   3. Review window             → 30 / 90 / 180 days (mapped from doc type recommendation)
 *   4. Archive trigger sentences → multi-select from curated, type-specific options
 *
 * Output: a new .md file with complete frontmatter + a starter body skeleton.
 *
 * Usage:
 *   npm run doc:new
 *
 * Non-interactive (CI / scripted) usage:
 *   tsx scripts/new-doc.ts --type=A --owner=helm-core --window=30 --triggers=1,3 --slug=my_sprint_report
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";

// ---------------------------------------------------------------------------
// Curated registries
// ---------------------------------------------------------------------------

type DocType = {
  readonly code: "A" | "B" | "C" | "D" | "E" | "F" | "G";
  readonly label: string;
  readonly directory: string;
  readonly suggestedFilenamePattern: string;
  readonly defaultStatus: "planning" | "active";
  readonly defaultReviewWindowDays: 30 | 90 | 180;
  readonly triggerCatalog: readonly string[];
};

const DOC_TYPES: readonly DocType[] = [
  {
    code: "A",
    label: "Sprint / Phase closeout report",
    directory: "docs/reviews",
    suggestedFilenamePattern: "HELM_<TOPIC>_REPORT_V1.md",
    defaultStatus: "active",
    defaultReviewWindowDays: 30,
    triggerCatalog: [
      "下一个 sprint/phase 收口报告落地（path: docs/reviews/HELM_<NEXT>_REPORT_V1.md）后，本文件 30 天后归档",
      "本 sprint/phase 涉及的 surface 全部在 docs/STATUS.md 升档至「已完整成立」后，本文件归档",
      "自 review_after 起 90 天，无任何 PR / 文档引用本文件",
    ],
  },
  {
    code: "B",
    label: "Planning / PLAN doc",
    directory: "docs/product",
    suggestedFilenamePattern: "HELM_<TOPIC>_PLAN_V1.md",
    defaultStatus: "planning",
    defaultReviewWindowDays: 30,
    triggerCatalog: [
      "对应 enablement review / implementation 报告落地（path: docs/reviews/HELM_<TOPIC>_ENABLEMENT_REVIEW_V1.md）后，本文件状态切到 deprecated 并 30 天后归档",
      "对应 phase / project 被取消或无限期推迟（在 docs/STATUS.md 「刻意未做」段落记录）后，本文件归档",
      "自 review_after 起 90 天，本文件未在任何 PR description 或其他 doc 引用",
    ],
  },
  {
    code: "C",
    label: "Baseline (long-lived)",
    directory: "docs/product",
    suggestedFilenamePattern: "HELM_<TOPIC>_BASELINE.md",
    defaultStatus: "active",
    defaultReviewWindowDays: 180,
    triggerCatalog: [
      "对应 baseline V2 落地（path: docs/product/HELM_<TOPIC>_BASELINE_V2.md）且 status=active 至少 30 天后，本 V1 归档",
      "对应能力在 docs/STATUS.md 升档至「刻意未做」（即 Helm 弃用此方向）后，本文件归档",
    ],
  },
  {
    code: "D",
    label: "Freeze / one-shot evidence",
    directory: "docs/reviews",
    suggestedFilenamePattern: "HELM_<TOPIC>_FREEZE_REPORT_V1.md",
    defaultStatus: "active",
    defaultReviewWindowDays: 30,
    triggerCatalog: [
      "对应 gate 通过（具体证据：approval record id 或 commit hash）后，本文件作为冻结证据保留 30 天后归档",
      "对应数据再次跑批或重新冻结（即出现 V2 版本）后，本 V1 立即归档",
      "自 created 起 90 天的绝对日期之后，无论是否被引用，强制归档",
    ],
  },
  {
    code: "E",
    label: "Requirements / 产品需求",
    directory: "docs/product",
    suggestedFilenamePattern: "HELM_<TOPIC>_REQUIREMENTS_V1.md",
    defaultStatus: "active",
    defaultReviewWindowDays: 90,
    triggerCatalog: [
      "下一版本号落地（path: docs/product/HELM_<TOPIC>_REQUIREMENTS_V2.md）且 status=active 后，本 V1 归档",
      "对应产品方向整体被废弃（在 docs/STATUS.md 「刻意未做」段落记录）后，本文件归档",
      "自 review_after 起 90 天，本文件未被任何 commit 或 PR 引用",
    ],
  },
  {
    code: "F",
    label: "Launch post / 营销 / 一次性事件",
    directory: "docs/launch",
    suggestedFilenamePattern: "HELM_<TOPIC>_RELEASE_POST.md",
    defaultStatus: "planning",
    defaultReviewWindowDays: 30,
    triggerCatalog: [
      "对应 release tag 落地后 30 天，本文件归档至 docs/_archive/launch-<YYYY-MM>/",
      "对应 release 被取消或推迟超过 30 天后，本文件归档",
    ],
  },
  {
    code: "G",
    label: "Roadmap (允许长期 active)",
    directory: "docs/roadmap",
    suggestedFilenamePattern: "HELM_<TOPIC>_ROADMAP.md",
    defaultStatus: "active",
    defaultReviewWindowDays: 90,
    triggerCatalog: [
      "替代版本（HELM_<TOPIC>_ROADMAP_V2.md）落地且 status=active 至少 30 天后，本文件归档",
      "项目从 controlled-trial 迁出（产品阶段大变更，在 docs/STATUS.md 记录）后，本文件归档",
    ],
  },
] as const;

const REGISTERED_OWNERS: readonly string[] = [
  "helm-core",
  "helm-core-runtime",
  "ops-lead",
  "product-owner",
  "dpo",
  "security-reviewer",
  "engineering-lead",
] as const;

// ---------------------------------------------------------------------------
// CLI argument parsing (non-interactive bypass)
// ---------------------------------------------------------------------------

type CliArgs = {
  type?: DocType["code"];
  owner?: string;
  window?: 30 | 90 | 180;
  triggers?: number[];
  slug?: string;
  dryRun?: boolean;
};

function parseArgs(): CliArgs {
  const args: CliArgs = {};
  for (const arg of process.argv.slice(2)) {
    const m = arg.match(/^--([a-zA-Z-]+)=(.+)$/);
    if (!m) continue;
    const [, key, val] = m;
    if (key === "type") args.type = val as DocType["code"];
    else if (key === "owner") args.owner = val;
    else if (key === "window") {
      const n = Number(val);
      if (n === 30 || n === 90 || n === 180) args.window = n;
    } else if (key === "triggers") {
      args.triggers = val
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n));
    } else if (key === "slug") args.slug = val;
    else if (key === "dryRun" || key === "dry-run") args.dryRun = val === "true";
  }
  return args;
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function todayUtcDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysUtc(dateString: string, days: number): string {
  const d = new Date(dateString + "T00:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Frontmatter assembly
// ---------------------------------------------------------------------------

function emitFrontmatter(input: {
  status: "planning" | "active";
  owner: string;
  created: string;
  reviewAfter: string;
  triggers: readonly string[];
}): string {
  const lines = [
    "---",
    `status: ${input.status}`,
    `owner: ${input.owner}`,
    `created: ${input.created}`,
    `review_after: ${input.reviewAfter}`,
    "archive_trigger:",
    ...input.triggers.map((t) => `  - ${t}`),
    "---",
    "",
  ];
  return lines.join("\n");
}

function emitBodySkeleton(input: {
  type: DocType;
  slug: string;
}): string {
  const title = input.slug
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return [
    `# ${title}`,
    "",
    `> 文档类型：${input.type.label}（${input.type.code}）`,
    "",
    "## 一、本文件的定位",
    "",
    "<在这里写：本文件解决什么问题，不解决什么问题>",
    "",
    "## 二、内容",
    "",
    "<具体内容>",
    "",
    "## 变更记录",
    "",
    "| 日期 | 变化 |",
    "| --- | --- |",
    `| ${todayUtcDateString()} | V1 起草 |`,
    "",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Interactive prompts
// ---------------------------------------------------------------------------

async function ask(rl: readline.Interface, q: string): Promise<string> {
  const a = await rl.question(q);
  return a.trim();
}

async function pickDocType(rl: readline.Interface): Promise<DocType> {
  console.log("\n[1/5] 文档类型？\n");
  for (const t of DOC_TYPES) {
    console.log(
      `  ${t.code}. ${t.label.padEnd(40, " ")} → ${t.directory}/${t.suggestedFilenamePattern}`,
    );
  }
  while (true) {
    const ans = (await ask(rl, "\n> 选 A-G： ")).toUpperCase();
    const found = DOC_TYPES.find((t) => t.code === ans);
    if (found) return found;
    console.log("× 无效输入，请输入 A-G 之一");
  }
}

async function pickOwner(rl: readline.Interface): Promise<string> {
  console.log("\n[2/5] 负责人 owner？\n");
  REGISTERED_OWNERS.forEach((o, i) => console.log(`  ${i + 1}. ${o}`));
  console.log(`  ${REGISTERED_OWNERS.length + 1}. <自定义 — 输入真名或邮箱>`);
  while (true) {
    const ans = await ask(
      rl,
      `\n> 选 1-${REGISTERED_OWNERS.length + 1}： `,
    );
    const idx = Number(ans);
    if (Number.isFinite(idx) && idx >= 1 && idx <= REGISTERED_OWNERS.length) {
      return REGISTERED_OWNERS[idx - 1]!;
    }
    if (idx === REGISTERED_OWNERS.length + 1) {
      const custom = await ask(rl, "> 自定义 owner（必须是真名 / role / email）： ");
      if (custom.length > 0 && !["tbd", "unknown", "team", "everyone"].includes(custom.toLowerCase())) {
        return custom;
      }
      console.log("× 不接受 TBD / unknown / team / everyone 这类占位值");
      continue;
    }
    console.log("× 无效输入");
  }
}

async function pickReviewWindow(
  rl: readline.Interface,
  type: DocType,
): Promise<30 | 90 | 180> {
  console.log("\n[3/5] 复审窗口（review_after = created + N 天）？\n");
  const options = [30, 90, 180] as const;
  options.forEach((d) => {
    const def = d === type.defaultReviewWindowDays ? " ← 推荐" : "";
    console.log(`  ${d} 天${def}`);
  });
  while (true) {
    const ans = await ask(
      rl,
      `\n> 选 30 / 90 / 180（直接回车 = 推荐 ${type.defaultReviewWindowDays}）： `,
    );
    if (ans === "") return type.defaultReviewWindowDays;
    const n = Number(ans);
    if (n === 30 || n === 90 || n === 180) return n;
    console.log("× 只接受 30 / 90 / 180");
  }
}

async function pickTriggers(
  rl: readline.Interface,
  type: DocType,
): Promise<string[]> {
  console.log("\n[4/5] 死亡条件（archive_trigger）— 至少选 1 条，建议 2-3 条：\n");
  type.triggerCatalog.forEach((t, i) => {
    console.log(`  ${i + 1}. ${t}`);
  });
  console.log(`  ${type.triggerCatalog.length + 1}. <自定义 — 自行输入一条>`);
  while (true) {
    const ans = await ask(
      rl,
      "\n> 多选用逗号分隔（例 1,3）： ",
    );
    const idxs = ans
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n));
    if (idxs.length === 0) {
      console.log("× 至少选 1 条");
      continue;
    }
    const triggers: string[] = [];
    for (const idx of idxs) {
      if (idx >= 1 && idx <= type.triggerCatalog.length) {
        triggers.push(type.triggerCatalog[idx - 1]!);
      } else if (idx === type.triggerCatalog.length + 1) {
        const custom = await ask(rl, "> 自定义触发条件（≥ 30 字符，不允许「觉得 / 应该 / 永不 / 项目结束」等主观词）： ");
        if (custom.length >= 30) {
          triggers.push(custom);
        } else {
          console.log("× 自定义条件太短（< 30 字符），跳过");
        }
      }
    }
    if (triggers.length > 0) return triggers;
    console.log("× 没有有效条目，请重选");
  }
}

async function pickSlug(rl: readline.Interface, type: DocType): Promise<string> {
  console.log(`\n[5/5] 文件名 slug（用于 ${type.suggestedFilenamePattern.replace("<TOPIC>", "<这里>")}）`);
  while (true) {
    const ans = await ask(
      rl,
      "> 输入 TOPIC（大写 + 下划线，例 PHASE4_RUNTIME_ADOPTION）： ",
    );
    if (/^[A-Z][A-Z0-9_]+$/.test(ans)) return ans;
    console.log("× 只接受大写字母 + 下划线 + 数字");
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const cliArgs = parseArgs();
  const interactive = !(cliArgs.type && cliArgs.owner && cliArgs.window && cliArgs.triggers && cliArgs.slug);

  let docType: DocType;
  let owner: string;
  let windowDays: 30 | 90 | 180;
  let triggers: string[];
  let slug: string;

  if (interactive) {
    console.log("==========================================");
    console.log("  Helm 文档生成向导（满足 lifecycle 契约）");
    console.log("  契约：docs/_doc-lifecycle/CONTRACT.md");
    console.log("==========================================");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    try {
      docType = await pickDocType(rl);
      owner = await pickOwner(rl);
      windowDays = await pickReviewWindow(rl, docType);
      triggers = await pickTriggers(rl, docType);
      slug = await pickSlug(rl, docType);
    } finally {
      rl.close();
    }
  } else {
    docType = DOC_TYPES.find((t) => t.code === cliArgs.type)!;
    owner = cliArgs.owner!;
    windowDays = cliArgs.window!;
    triggers = (cliArgs.triggers ?? []).map(
      (i) => docType.triggerCatalog[i - 1] ?? "",
    ).filter((t) => t.length > 0);
    slug = cliArgs.slug!;
  }

  if (triggers.length === 0) {
    console.error("[error] no valid archive_trigger selected");
    process.exit(1);
  }

  const created = todayUtcDateString();
  const reviewAfter = addDaysUtc(created, windowDays);

  const filename = docType.suggestedFilenamePattern.replace("<TOPIC>", slug);
  const fullPath = path.join(process.cwd(), docType.directory, filename);
  const fullDir = path.dirname(fullPath);

  if (existsSync(fullPath)) {
    console.error(`[error] file already exists: ${path.relative(process.cwd(), fullPath)}`);
    process.exit(1);
  }

  const frontmatter = emitFrontmatter({
    status: docType.defaultStatus,
    owner,
    created,
    reviewAfter,
    triggers,
  });
  const body = emitBodySkeleton({ type: docType, slug });
  const content = frontmatter + body;

  if (cliArgs.dryRun) {
    console.log("\n--- dry-run output ---\n");
    console.log(content);
    console.log(`\n[would write] ${path.relative(process.cwd(), fullPath)}`);
    return;
  }

  if (!existsSync(fullDir)) mkdirSync(fullDir, { recursive: true });
  writeFileSync(fullPath, content, "utf-8");

  console.log("\n==========================================");
  console.log(`✓ 已创建 ${path.relative(process.cwd(), fullPath)}`);
  console.log("==========================================");
  console.log("  下一步：");
  console.log("  1. 编辑文件主体（替换 <...> 占位符）");
  console.log("  2. 在 docs/STATUS.md 注册对应 surface（如果适用）");
  console.log("  3. 跑 npm run check:boundaries 验证契约通过");
  console.log("  4. 创建 PR");
  console.log("");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
