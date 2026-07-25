#!/usr/bin/env tsx

import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import path from "node:path";

export type ModelEgressGovernanceViolation = {
  rule: string;
  file: string;
  line: number;
  detail: string;
};

const RUNTIME_ROOTS = [
  "app",
  "components",
  "features",
  "lib",
  "scripts",
  "prisma",
] as const;
const CLAIM_STORE =
  "lib/llm/model-egress-store.service.ts";
const GOVERNED_GATEWAY =
  "lib/llm/governed-model-gateway.service.ts";
const PROJECTION_SERVICE =
  "lib/llm/governed-model-projection.service.ts";
const POLICY_STORE =
  "lib/llm/model-route-policy-store.service.ts";
const ADAPTER_REGISTRY =
  "lib/llm/governed-model-adapter-registry.service.ts";
const OWNER_READOUT =
  "features/dashboard/model-egress-readout.ts";
const OWNER_QUERY =
  "features/dashboard/model-egress-query.ts";
const PRODUCT_DOC =
  "docs/product/HELM_CAIO_MODEL_ADMISSION_AND_EGRESS.md";
const RUNBOOK_DOC =
  "docs/operations/HELM_CAIO_MODEL_EGRESS_RUNBOOK.md";
const CI_WORKFLOW = ".github/workflows/ci.yml";
const SELF = "scripts/check-model-egress-governance.ts";
const TEST_FILE = /\.(?:test|spec)\.[cm]?[jt]sx?$/u;
const SOURCE_FILE = /\.[cm]?[jt]sx?$/u;

const FORBIDDEN_DELEGATE_WRITES = [
  {
    delegate: "modelEgressReceipt",
    operations: [
      "create",
      "createMany",
      "update",
      "updateMany",
      "upsert",
      "delete",
      "deleteMany",
    ],
    rule: "MEG-RECEIPT-APPEND-ONLY",
  },
  {
    delegate: "modelRouteDecision",
    operations: [
      "create",
      "createMany",
      "update",
      "updateMany",
      "upsert",
      "delete",
      "deleteMany",
    ],
    rule: "MEG-DECISION-IMMUTABLE",
  },
] as const;

const REQUIRED_STORE_TOKENS = [
  "await lockModelEgressWorkspace(tx, input.workspaceId)",
  "const claimed = await tx.modelRouteDecision.updateMany({",
  "dispatchClaimedAt: null",
  "dispatchGatewayRef: null",
  "dispatchRuntimeJson: null",
  "dispatchRuntimeHash: null",
  "dispatchClaimHash: null",
  "dispatchProviderIdempotencyKey: null",
  "dispatchLeaseExpiresAt: null",
  "validUntil: { gt: now }",
  "activeRouteDispatches",
  "model_route_concurrency_limit_reached",
  "decision.routeSnapshot.maxConcurrency",
  "validateGovernedProjectionRouteBinding",
  "model_route_projection_trust_changed",
  "pricing_version_not_owner_approved",
  "route_cost_budget_exceeded",
  "terminal_receipt_request_disposition_must_be_known",
  "accepted_receipt_provider_request_ref_required",
  "MODEL_GOVERNANCE_PERSISTED_INT_MAX",
] as const;

const REQUIRED_MIGRATION_TOKENS = [
  "CONSTRAINT `ProviderReadiness_no_raw_credential_chk`",
  "CONSTRAINT `ModelRouteDecision_claim_shape_chk`",
  "CONSTRAINT `ModelRouteDecision_allowed_shape_chk`",
  "CONSTRAINT `ModelEgressReceipt_no_raw_content_chk`",
  "CONSTRAINT `ModelEgressReceipt_phase_shape_chk`",
  "CONSTRAINT `ModelEgressReceipt_fallback_pair_chk`",
  "CONSTRAINT `ModelEgressReceipt_not_accepted_cost_chk`",
  "CONSTRAINT `ModelEgressReceipt_request_ref_disposition_chk`",
  "CREATE TRIGGER `ModelEgressReceipt_append_only_update`",
  "CREATE TRIGGER `ModelEgressReceipt_append_only_delete`",
  "AND `outcome` IN ('SUCCESS', 'FAILURE', 'PARTIAL')",
  "AND `actualCostUsdMicros` IS NOT NULL",
  "AND `costCurrency` = 'USD'",
  "AND `pricingVersion` IS NOT NULL",
  "AND `requestDisposition` IN ('ACCEPTED', 'NOT_ACCEPTED')",
  "ModelRouteDecision_workspace_route_claim_idx",
  "ModelRouteDecision_workspace_provider_idem_key",
  "ModelRouteDecision_workspace_lease_idx",
  "`resolutionSource` IN ('NONE', 'INVOKE', 'RECONCILE')",
] as const;

const REQUIRED_GATEWAY_TOKENS = [
  "dispatch_lease_active_terminal_missing",
  "dispatch_reconciliation_not_supported",
  "dispatch_reconciliation_inconclusive",
  "terminal_reconciled_without_output",
  "dispatch_claim_replayed_terminal_missing",
  "terminal_receipt_persistence_failed_output_withheld",
  "provider_input_budget_exceeded",
  "provider_cost_budget_exceeded",
  "provider_pricing_evidence_invalid",
  "adapter_request_disposition_unknown",
  "adapter_provider_request_ref_invalid",
  "MODEL_GOVERNANCE_PERSISTED_INT_MAX",
  "adapter_output_not_governed_json",
  "providerIdempotencyKey",
  "providerRequestRefHash",
  "rawContentPersisted: false",
] as const;
const INTERNAL_AUTHORITY_BOUNDARIES = [
  {
    tokens: [
      "GOVERNED_GATEWAY_AUTHORITY",
      "prepareModelRouteDecision",
      "claimModelRouteDispatch",
      "recordModelEgressTerminalReceipt",
    ],
    allowedFiles: [CLAIM_STORE, GOVERNED_GATEWAY],
  },
  {
    tokens: [
      "GOVERNED_MODEL_PROJECTION_AUTHORITY",
      "recordGovernedModelProjectionReceipt",
    ],
    allowedFiles: [CLAIM_STORE, PROJECTION_SERVICE],
  },
  {
    tokens: [
      "GOVERNED_MODEL_READINESS_AUTHORITY",
      "recordProviderAdapterReadinessReceipt",
    ],
    allowedFiles: [POLICY_STORE, ADAPTER_REGISTRY],
  },
  {
    // Holding or invoking a governed provider adapter OUTSIDE the
    // registry/gateway is a raw-egress bypass: adapter.invoke() accepts
    // claim hashes as plain strings and cannot itself verify them, so
    // the only legal call site is the governed gateway. Referencing the
    // adapter type anywhere else in public core is refused outright —
    // defense-in-depth against a caller wiring dispatch around the
    // decision/claim/receipt chain.
    tokens: ["GovernedModelProviderAdapter"],
    allowedFiles: [ADAPTER_REGISTRY, GOVERNED_GATEWAY],
  },
] as const;
const REQUIRED_OWNER_QUERY_TOKENS = [
  "db.membership.findUnique",
  "membership.role !== WorkspaceRole.OWNER",
  "membership.status !== MembershipStatus.ACTIVE",
  "rawCredentialIncluded: true",
  'modelProbeStatus: "READY"',
  'decision: "ALLOWED"',
  "egressReceipts: { none: { sequence: 2 } }",
] as const;
const FORBIDDEN_OWNER_QUERY_SELECTS = [
  "credentialRef: true",
  "receiptJson: true",
  "policyJson: true",
  "decisionJson: true",
  "projectedPayloadHash: true",
  "providerRequestRefHash: true",
  "dispatchRuntimeHash: true",
  "dispatchClaimHash: true",
] as const;
const REQUIRED_OWNER_READOUT_TOKENS = [
  'mode: "read_only"',
  "rawContentVisible: false",
  "credentialsVisible: false",
  "dispatchAvailable: false",
] as const;
const REQUIRED_MYSQL_CI_TOKENS = [
  "image: mysql:8.4",
  "DATABASE_URL:",
  "MODEL_EGRESS_STORE_DATABASE_URL:",
  "MODEL_EGRESS_STORE_TEST_DATABASE_NAME: helm_caio_p1d_ci",
  "npx tsx prisma/setup-db.ts prepare",
  "npm run test:model-egress:mysql",
] as const;

function toPosix(value: string): string {
  return value.split(path.sep).join("/");
}

function lineNumberAt(content: string, offset: number): number {
  return content.slice(0, offset).split(/\r?\n/u).length;
}

function listFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  const output: string[] = [];
  const pending = [root];
  while (pending.length > 0) {
    const current = pending.pop()!;
    for (const entry of readdirSync(current, {
      withFileTypes: true,
    })) {
      if (
        entry.name === "node_modules" ||
        entry.name === ".next" ||
        entry.name === "generated"
      ) {
        continue;
      }
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(absolute);
      } else if (
        entry.isFile() &&
        statSync(absolute).size <= 5 * 1024 * 1024
      ) {
        output.push(absolute);
      }
    }
  }
  return output.sort();
}

function delegateWritePattern(
  delegate: string,
  operation: string,
): RegExp {
  return new RegExp(
    String.raw`(?:\b${delegate}\b|\[\s*["']${delegate}["']\s*\])\s*(?:\.|\[\s*["'])\s*${operation}(?:["']\s*\])?\s*\(`,
    "gu",
  );
}

export function scanModelEgressDirectWrites(
  repoRoot: string,
): ModelEgressGovernanceViolation[] {
  const violations: ModelEgressGovernanceViolation[] = [];
  const files = RUNTIME_ROOTS.flatMap((relativeRoot) =>
    listFiles(path.join(repoRoot, relativeRoot)),
  );

  for (const absolute of files) {
    const relative = toPosix(path.relative(repoRoot, absolute));
    if (
      relative === SELF ||
      TEST_FILE.test(relative) ||
      !SOURCE_FILE.test(relative)
    ) {
      continue;
    }
    const content = readFileSync(absolute, "utf8");
    for (const boundary of INTERNAL_AUTHORITY_BOUNDARIES) {
      if (boundary.allowedFiles.includes(relative as never)) {
        continue;
      }
      for (const token of boundary.tokens) {
        const tokenPattern = new RegExp(
          String.raw`\b${token}\b`,
          "gu",
        );
        for (const match of content.matchAll(tokenPattern)) {
          violations.push({
            rule: "MEG-GATEWAY-BYPASS",
            file: relative,
            line: lineNumberAt(content, match.index ?? 0),
            detail: `${token} is internal to the governed model gateway`,
          });
        }
      }
    }
    for (const boundary of FORBIDDEN_DELEGATE_WRITES) {
      for (const operation of boundary.operations) {
        const pattern = delegateWritePattern(
          boundary.delegate,
          operation,
        );
        for (const match of content.matchAll(pattern)) {
          const isGovernedStoreWrite =
            relative === CLAIM_STORE &&
            ((boundary.delegate === "modelRouteDecision" &&
              (operation === "create" ||
                operation === "updateMany")) ||
              (boundary.delegate === "modelEgressReceipt" &&
                operation === "create"));
          if (isGovernedStoreWrite) continue;
          violations.push({
            rule: boundary.rule,
            file: relative,
            line: lineNumberAt(content, match.index ?? 0),
            detail: `${boundary.delegate}.${operation} must go through the governed append-only store`,
          });
        }
      }
    }

    const rawMutation =
      /\b(?:UPDATE|DELETE\s+FROM|INSERT\s+INTO)\s+[`"']?(ModelEgressReceipt|ModelRouteDecision)\b/giu;
    for (const match of content.matchAll(rawMutation)) {
      violations.push({
        rule: "MEG-RAW-MUTATION",
        file: relative,
        line: lineNumberAt(content, match.index ?? 0),
        detail: `raw ${match[0]} bypasses the governed store`,
      });
    }
  }
  return violations;
}

export function checkModelEgressMysqlCiWiring(
  repoRoot: string,
): ModelEgressGovernanceViolation[] {
  const violations: ModelEgressGovernanceViolation[] = [];
  const packagePath = path.join(repoRoot, "package.json");
  if (!existsSync(packagePath)) {
    violations.push({
      rule: "MEG-MYSQL-CI",
      file: "package.json",
      line: 1,
      detail: "package.json is missing",
    });
  } else {
    try {
      const packageJson = JSON.parse(
        readFileSync(packagePath, "utf8"),
      ) as { scripts?: Record<string, string> };
      const integrationScript =
        packageJson.scripts?.["test:model-egress:mysql"] ?? "";
      if (
        !integrationScript.includes(
          "lib/llm/model-egress-store.mysql.test.ts",
        )
      ) {
        violations.push({
          rule: "MEG-MYSQL-CI",
          file: "package.json",
          line: 1,
          detail:
            "test:model-egress:mysql does not execute the isolated MySQL store test",
        });
      }
    } catch {
      violations.push({
        rule: "MEG-MYSQL-CI",
        file: "package.json",
        line: 1,
        detail: "package.json is not valid JSON",
      });
    }
  }

  const workflowPath = path.join(repoRoot, CI_WORKFLOW);
  if (!existsSync(workflowPath)) {
    violations.push({
      rule: "MEG-MYSQL-CI",
      file: CI_WORKFLOW,
      line: 1,
      detail: "CI workflow is missing",
    });
    return violations;
  }
  const workflow = readFileSync(workflowPath, "utf8");
  const jobStart = workflow.indexOf("  model-egress-mysql:\n");
  if (jobStart < 0) {
    violations.push({
      rule: "MEG-MYSQL-CI",
      file: CI_WORKFLOW,
      line: 1,
      detail: "model-egress-mysql job is missing",
    });
    return violations;
  }
  const jobTail = workflow.slice(
    jobStart + "  model-egress-mysql:\n".length,
  );
  const nextJobOffset = jobTail.search(/\n  [a-z0-9][\w-]*:\n/u);
  const job =
    nextJobOffset >= 0
      ? jobTail.slice(0, nextJobOffset)
      : jobTail;
  for (const token of REQUIRED_MYSQL_CI_TOKENS) {
    if (!job.includes(token)) {
      violations.push({
        rule: "MEG-MYSQL-CI",
        file: CI_WORKFLOW,
        line: lineNumberAt(workflow, jobStart),
        detail: `model-egress-mysql job is missing: ${token}`,
      });
    }
  }
  if (job.includes("continue-on-error")) {
    violations.push({
      rule: "MEG-MYSQL-CI",
      file: CI_WORKFLOW,
      line: lineNumberAt(workflow, jobStart),
      detail: "model-egress-mysql must be fail-closed",
    });
  }
  const dependentJobs = [
    ...workflow.matchAll(
      /needs:\s*\[[^\]]*model-egress-mysql[^\]]*\]/gu,
    ),
  ];
  if (dependentJobs.length < 2) {
    violations.push({
      rule: "MEG-MYSQL-CI",
      file: CI_WORKFLOW,
      line: 1,
      detail:
        "both build and test must depend on model-egress-mysql",
    });
  }
  return violations;
}

export function checkModelEgressGovernance(
  repoRoot = process.cwd(),
): ModelEgressGovernanceViolation[] {
  const violations = scanModelEgressDirectWrites(repoRoot);
  violations.push(...checkModelEgressMysqlCiWiring(repoRoot));
  const storePath = path.join(repoRoot, CLAIM_STORE);
  if (!existsSync(storePath)) {
    violations.push({
      rule: "MEG-STORE",
      file: CLAIM_STORE,
      line: 1,
      detail: "governed model-egress store is missing",
    });
  } else {
    const store = readFileSync(storePath, "utf8");
    const claimWrites = [
      ...store.matchAll(
        delegateWritePattern(
          "modelRouteDecision",
          "updateMany",
        ),
      ),
    ];
    if (claimWrites.length !== 1) {
      violations.push({
        rule: "MEG-CLAIM-CAS",
        file: CLAIM_STORE,
        line: 1,
        detail: `expected exactly one conditional dispatch-claim mutation, found ${claimWrites.length}`,
      });
    }
    for (const [delegate, operation, expected] of [
      ["modelRouteDecision", "create", 1],
      ["modelEgressReceipt", "create", 1],
    ] as const) {
      const writes = [
        ...store.matchAll(
          delegateWritePattern(delegate, operation),
        ),
      ];
      if (writes.length !== expected) {
        violations.push({
          rule:
            delegate === "modelRouteDecision"
              ? "MEG-DECISION-IMMUTABLE"
              : "MEG-RECEIPT-APPEND-ONLY",
          file: CLAIM_STORE,
          line: 1,
          detail: `expected exactly ${expected} governed ${delegate}.${operation} write, found ${writes.length}`,
        });
      }
    }
    for (const token of REQUIRED_STORE_TOKENS) {
      if (!store.includes(token)) {
        violations.push({
          rule: "MEG-CLAIM-CAS",
          file: CLAIM_STORE,
          line: 1,
          detail: `dispatch claim guard token is missing: ${token}`,
        });
      }
    }
  }

  const migrationRelative =
    "prisma/migrations/20260723230000_caio_model_egress_governance/migration.sql";
  const migrationPath = path.join(repoRoot, migrationRelative);
  if (!existsSync(migrationPath)) {
    violations.push({
      rule: "MEG-MIGRATION",
      file: migrationRelative,
      line: 1,
      detail: "model-egress governance migration is missing",
    });
  } else {
    const migration = readFileSync(migrationPath, "utf8");
    for (const token of REQUIRED_MIGRATION_TOKENS) {
      if (!migration.includes(token)) {
        violations.push({
          rule: "MEG-MIGRATION",
          file: migrationRelative,
          line: 1,
          detail: `database constraint is missing: ${token}`,
        });
      }
    }
  }

  const gatewayPath = path.join(repoRoot, GOVERNED_GATEWAY);
  if (!existsSync(gatewayPath)) {
    violations.push({
      rule: "MEG-GATEWAY",
      file: GOVERNED_GATEWAY,
      line: 1,
      detail: "governed model gateway is missing",
    });
  } else {
    const gateway = readFileSync(gatewayPath, "utf8");
    for (const token of REQUIRED_GATEWAY_TOKENS) {
      if (!gateway.includes(token)) {
        violations.push({
          rule: "MEG-GATEWAY",
          file: GOVERNED_GATEWAY,
          line: 1,
          detail: `gateway fail-closed token is missing: ${token}`,
        });
      }
    }
    if (
      gateway.includes("executeLLMTask") ||
      gateway.includes("provider-registry")
    ) {
      violations.push({
        rule: "MEG-GATEWAY",
        file: GOVERNED_GATEWAY,
        line: 1,
        detail:
          "governed gateway must not bypass policy through the legacy provider registry",
      });
    }
  }

  const ownerQueryPath = path.join(repoRoot, OWNER_QUERY);
  if (!existsSync(ownerQueryPath)) {
    violations.push({
      rule: "MEG-OWNER-READOUT",
      file: OWNER_QUERY,
      line: 1,
      detail: "owner-only model-egress query is missing",
    });
  } else {
    const ownerQuery = readFileSync(ownerQueryPath, "utf8");
    for (const token of REQUIRED_OWNER_QUERY_TOKENS) {
      if (!ownerQuery.includes(token)) {
        violations.push({
          rule: "MEG-OWNER-READOUT",
          file: OWNER_QUERY,
          line: 1,
          detail: `owner-only query guard token is missing: ${token}`,
        });
      }
    }
    for (const token of FORBIDDEN_OWNER_QUERY_SELECTS) {
      if (ownerQuery.includes(token)) {
        violations.push({
          rule: "MEG-OWNER-READOUT",
          file: OWNER_QUERY,
          line: 1,
          detail: `owner readout selects a sensitive field: ${token}`,
        });
      }
    }
  }

  const ownerReadoutPath = path.join(repoRoot, OWNER_READOUT);
  if (!existsSync(ownerReadoutPath)) {
    violations.push({
      rule: "MEG-OWNER-READOUT",
      file: OWNER_READOUT,
      line: 1,
      detail: "model-egress owner readout is missing",
    });
  } else {
    const ownerReadout = readFileSync(ownerReadoutPath, "utf8");
    for (const token of REQUIRED_OWNER_READOUT_TOKENS) {
      if (!ownerReadout.includes(token)) {
        violations.push({
          rule: "MEG-OWNER-READOUT",
          file: OWNER_READOUT,
          line: 1,
          detail: `read-only projection token is missing: ${token}`,
        });
      }
    }
  }

  for (const [relative, tokens] of [
    [
      PRODUCT_DOC,
      [
        "Public Core 默认没有真实",
        "缺少 sequence 2 时",
        "不保存原始",
        "lease 只定义何时可以向 provider 查询既有请求",
        "provider 实际报告的",
        "actualCostUsdMicros",
        "pricing trust root",
        "UPDATE/DELETE trigger",
        "adapter 输出还必须是",
        "dispatch claim 是本次调用的授权截止点",
        "MySQL `INT` 上限",
        "远端 CI 尚未产生回执",
      ],
    ],
    [
      RUNBOOK_DOC,
      [
        "没有生产 adapter",
        "in_doubt",
        "不能升级为生产事实",
        "lease 到期只是开始对账的门槛",
        "实际输入或请求输出 token 超预算",
        "实际费用超 route 上限",
        "requestDisposition=unknown",
        "dispatch claim 视为授权截止点",
        "合法形状 UPDATE 和 DELETE",
      ],
    ],
  ] as const) {
    const absolute = path.join(repoRoot, relative);
    if (!existsSync(absolute)) {
      violations.push({
        rule: "MEG-DOCS",
        file: relative,
        line: 1,
        detail: "model-egress governance document is missing",
      });
      continue;
    }
    const content = readFileSync(absolute, "utf8");
    for (const token of tokens) {
      if (!content.includes(token)) {
        violations.push({
          rule: "MEG-DOCS",
          file: relative,
          line: 1,
          detail: `required governance wording is missing: ${token}`,
        });
      }
    }
  }

  const docsManifestPath = path.join(
    repoRoot,
    "docs/public-docs-manifest.json",
  );
  if (existsSync(docsManifestPath)) {
    const manifest = readFileSync(docsManifestPath, "utf8");
    for (const relative of [PRODUCT_DOC, RUNBOOK_DOC]) {
      if (!manifest.includes(relative)) {
        violations.push({
          rule: "MEG-DOCS",
          file: "docs/public-docs-manifest.json",
          line: 1,
          detail: `public docs manifest is missing: ${relative}`,
        });
      }
    }
  }

  const statusPath = path.join(repoRoot, "docs/STATUS.md");
  if (
    existsSync(statusPath) &&
    !readFileSync(statusPath, "utf8").includes(
      "Helm CAIO 模型准入与数据出域治理 P1D",
    )
  ) {
    violations.push({
      rule: "MEG-DOCS",
      file: "docs/STATUS.md",
      line: 1,
      detail: "honest P1D status row is missing",
    });
  }

  const packagePath = path.join(repoRoot, "package.json");
  if (existsSync(packagePath)) {
    try {
      const packageJson = JSON.parse(
        readFileSync(packagePath, "utf8"),
      ) as { scripts?: Record<string, string> };
      const scripts = packageJson.scripts ?? {};
      if (
        !scripts["check:model-egress-governance"]?.includes(
          "check-model-egress-governance",
        )
      ) {
        violations.push({
          rule: "MEG-GATE",
          file: "package.json",
          line: 1,
          detail:
            "check:model-egress-governance is not linked to its static guard",
        });
      }
      if (
        !scripts["check:boundaries"]?.includes(
          "check:model-egress-governance",
        )
      ) {
        violations.push({
          rule: "MEG-GATE",
          file: "package.json",
          line: 1,
          detail:
            "check:boundaries does not include model-egress governance",
        });
      }
    } catch {
      violations.push({
        rule: "MEG-GATE",
        file: "package.json",
        line: 1,
        detail: "package.json is not valid JSON",
      });
    }
  }

  return violations;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const violations = checkModelEgressGovernance();
  if (violations.length === 0) {
    console.log(
      "model-egress-governance: PASS - immutable decisions, append-only receipts, CAS claim and database checks are linked",
    );
  } else {
    console.error(
      `model-egress-governance: FAIL - ${violations.length} violation(s)`,
    );
    for (const violation of violations) {
      console.error(
        `- [${violation.rule}] ${violation.file}:${violation.line} ${violation.detail}`,
      );
    }
    process.exitCode = 1;
  }
}
