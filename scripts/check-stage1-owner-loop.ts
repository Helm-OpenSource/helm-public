#!/usr/bin/env tsx

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

type Violation = {
  file: string;
  reason: string;
};

const REQUIRED_FILES = [
  "lib/stage1-owner-loop/contracts.ts",
  "lib/stage1-owner-loop/types.ts",
  "lib/stage1-owner-loop/observation.service.ts",
  "lib/stage1-owner-loop/decision-follow-through.service.ts",
  "lib/stage1-owner-loop/decision-evaluation.service.ts",
  "features/dashboard/stage1-owner-loop-query.ts",
  "features/dashboard/stage1-owner-loop-readout.ts",
  "features/dashboard/stage1-owner-loop-console.tsx",
  "tests/e2e/stage1-owner-loop.spec.ts",
  "prisma/migrations/20260718080000_stage1_owner_loop/migration.sql",
  "docs/product/HELM_STAGE1_OWNER_LOOP_METHOD.md",
  "docs/operations/HELM_STAGE1_OWNER_LOOP_RUNBOOK.md",
] as const;

const REQUIRED_TOKENS: ReadonlyArray<{
  file: string;
  tokens: readonly string[];
}> = [
  {
    file: "prisma/schema.prisma",
    tokens: [
      "model EnterpriseObservationProgram",
      "model ObservationSource",
      "model ObservationSourceRun",
      "model DecisionRecord",
      "model SupervisionSignalRecord",
      "model DecisionWorkPacketClaim",
    ],
  },
  {
    file: "features/dashboard/stage1-owner-loop-query.ts",
    tokens: [
      "input.membershipRole !== WorkspaceRole.OWNER",
      "db.$transaction(",
      "Prisma.TransactionIsolationLevel.RepeatableRead",
      "tx.enterpriseObservationProgram.findMany",
      "tx.decisionWorkPacketClaim.findMany",
      "loadCurrentAcceptedCaioInitializationContextForRead",
    ],
  },
  {
    file: "features/dashboard/stage1-owner-loop-readout.ts",
    tokens: [
      'boundary: "review_first"',
      'projection === "RECEIPT_MISSING"',
      'verificationState === "VERIFIED"',
    ],
  },
  {
    file: "features/dashboard/stage1-owner-loop-console.tsx",
    tokens: [
      'data-stage1-owner-loop-console="true"',
      "本面板不执行、不外发、不产生承诺",
      "this surface does not execute, send, or create commitments",
    ],
  },
  {
    file: "tests/e2e/stage1-owner-loop.spec.ts",
    tokens: [
      'openDemoWorkspace(page, "founder")',
      'openDemoWorkspace(page, "sales")',
      'data-stage1-owner-loop-console="true"',
      'data-stage1-owner-loop-metric="${metricKey}"',
      "browserErrors",
    ],
  },
  {
    file: "docs/product/HELM_STAGE1_OWNER_LOOP_METHOD.md",
    tokens: [
      "一把手授权层",
      "全源观察层",
      "证据与真值层",
      "Company Memory",
      "经营世界模型",
      "一把手交互层",
      "决策与监督层",
      "治理执行闭环",
      "公共参考切片已成形",
      "完整产品运行面仍需",
    ],
  },
  {
    file: "docs/operations/HELM_STAGE1_OWNER_LOOP_RUNBOOK.md",
    tokens: [
      "授权撤销",
      "独立验收",
      "隔离数据库验证",
      "非 OWNER",
      "没有回执时不宣称完成",
    ],
  },
  {
    file: "docs/STATUS.md",
    tokens: [
      "Stage 1 一把手经营闭环公共参考切片",
      "已成形但仍需下一层",
      "不声明 Stage 1 产品或生产部署完整成立",
    ],
  },
];

function read(repoRoot: string, file: string): string | null {
  const absolutePath = path.join(repoRoot, file);
  return existsSync(absolutePath) ? readFileSync(absolutePath, "utf8") : null;
}

export function checkStage1OwnerLoop(repoRoot = process.cwd()): Violation[] {
  const violations: Violation[] = [];

  for (const file of REQUIRED_FILES) {
    if (!existsSync(path.join(repoRoot, file))) {
      violations.push({ file, reason: "required file is missing" });
    }
  }

  for (const requirement of REQUIRED_TOKENS) {
    const content = read(repoRoot, requirement.file);
    if (content === null) {
      violations.push({
        file: requirement.file,
        reason: "required evidence file is missing",
      });
      continue;
    }
    for (const token of requirement.tokens) {
      if (!content.includes(token)) {
        violations.push({
          file: requirement.file,
          reason: `required evidence token is missing: ${token}`,
        });
      }
    }
  }

  const manifestContent = read(repoRoot, "docs/public-docs-manifest.json");
  if (manifestContent !== null) {
    try {
      const manifest = JSON.parse(manifestContent) as { allowedDocs?: unknown };
      const allowedDocs = Array.isArray(manifest.allowedDocs)
        ? manifest.allowedDocs
        : [];
      for (const file of [
        "docs/product/HELM_STAGE1_OWNER_LOOP_METHOD.md",
        "docs/operations/HELM_STAGE1_OWNER_LOOP_RUNBOOK.md",
      ]) {
        if (!allowedDocs.includes(file)) {
          violations.push({
            file: "docs/public-docs-manifest.json",
            reason: `public document is not allowlisted: ${file}`,
          });
        }
      }
    } catch {
      violations.push({
        file: "docs/public-docs-manifest.json",
        reason: "manifest is not valid JSON",
      });
    }
  }

  const packageContent = read(repoRoot, "package.json");
  if (packageContent !== null) {
    try {
      const packageJson = JSON.parse(packageContent) as {
        scripts?: Record<string, string>;
      };
      const scripts = packageJson.scripts ?? {};
      if (
        !scripts["check:stage1-owner-loop"]?.includes("check-stage1-owner-loop")
      ) {
        violations.push({
          file: "package.json",
          reason: "check:stage1-owner-loop script is missing its static guard",
        });
      }
      if (!scripts["check:stage1-owner-loop"]?.includes("vitest run")) {
        violations.push({
          file: "package.json",
          reason: "check:stage1-owner-loop script is missing behavior tests",
        });
      }
      if (!scripts["check:boundaries"]?.includes("check:stage1-owner-loop")) {
        violations.push({
          file: "package.json",
          reason: "check:boundaries does not include the Stage 1 gate",
        });
      }
    } catch {
      violations.push({
        file: "package.json",
        reason: "package.json is invalid",
      });
    }
  }

  return violations;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const violations = checkStage1OwnerLoop();
  if (violations.length > 0) {
    console.error("stage1-owner-loop: FAIL");
    for (const violation of violations) {
      console.error(`- ${violation.file}: ${violation.reason}`);
    }
    process.exitCode = 1;
  } else {
    console.log(
      "stage1-owner-loop: PASS - contracts, persistence, OWNER readout, tests and public docs are linked; this is not production readiness",
    );
  }
}
