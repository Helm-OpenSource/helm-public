import fs from "node:fs";
import path from "node:path";

type OdpsTableAliasKnowledge = {
  cnName: string;
  alias: string;
  physicalTableName: string;
  domain: string;
  description: string;
  partitionField: string;
  isCore: boolean;
  isActive: boolean;
};

type OdpsFieldConventionKnowledge = {
  tableAlias: string;
  fieldName: string;
  fieldType: string;
  meaning: string;
  commonUsage: string;
  notes: string | null;
  isActive: boolean;
};

type OdpsEnumKnowledge = {
  tableAlias: string;
  fieldName: string;
  enumValue: string;
  enumLabel: string;
  businessCategory: string;
  notes: string | null;
  isActive: boolean;
};

type OdpsQueryConventionKnowledge = {
  ruleType: string;
  ruleKey: string;
  scope: string;
  title: string;
  content: string;
  examples: string[];
  isActive: boolean;
};

type OdpsKnowledgeDocument = {
  version: string;
  tableAliases: OdpsTableAliasKnowledge[];
  fieldConventions: OdpsFieldConventionKnowledge[];
  enumKnowledge: OdpsEnumKnowledge[];
  queryConventions: OdpsQueryConventionKnowledge[];
};

export type BiReportOdpsKnowledgeContext = {
  matchedAliases: string[];
  tableAliases: string[];
  fieldConventions: string[];
  enumKnowledge: string[];
  queryConventions: string[];
};

export type BiReportOdpsQueryLint = {
  matchedAliases: string[];
  matchedPhysicalTables: string[];
  warnings: string[];
};

const SKILL_ALIAS_MAP: Record<string, string[]> = {
  bi_business_income_expense_monthly: ["business_income_expense"],
  bi_revenue_daily: ["business_income_expense"],
  bi_repay_daily: ["bill_repay", "instalment", "instalment_plan", "loan_lender", "lender_repay_serial"],
  bi_mtype_repay_monthly: ["assets_mtype"],
};

let cachedKnowledge: OdpsKnowledgeDocument | null = null;

/**
 * Resolves the path to the ODPS knowledge document. Source-of-truth is the
 * `BI_REPORT_ODPS_KNOWLEDGE_PATH` env var (relative to repo root or
 * absolute). The shared library does not embed any tenant-specific default
 * path; the tenant extension is responsible for setting this env var at
 * deployment time. When the env var is unset, the library treats the
 * knowledge document as absent and downstream consumers degrade gracefully.
 */
function resolveOdpsKnowledgePath(): string | null {
  const configured = process.env.BI_REPORT_ODPS_KNOWLEDGE_PATH?.trim();
  if (!configured) return null;
  return path.isAbsolute(configured)
    ? configured
    : path.join(/* turbopackIgnore: true */ process.cwd(), configured);
}

const EMPTY_KNOWLEDGE: OdpsKnowledgeDocument = {
  version: "empty",
  tableAliases: [],
  fieldConventions: [],
  enumKnowledge: [],
  queryConventions: [],
};

export function loadBiReportOdpsKnowledge(): OdpsKnowledgeDocument {
  if (cachedKnowledge) {
    return cachedKnowledge;
  }

  const resolvedPath = resolveOdpsKnowledgePath();
  if (!resolvedPath) {
    cachedKnowledge = EMPTY_KNOWLEDGE;
    return cachedKnowledge;
  }

  const raw = fs.readFileSync(/* turbopackIgnore: true */ resolvedPath, "utf8");
  cachedKnowledge = JSON.parse(raw) as OdpsKnowledgeDocument;
  return cachedKnowledge;
}

export function retrieveBiReportOdpsKnowledgeContext(input: {
  skillKey: string;
  deterministicFindings: string[];
  matchedRules: string[];
}): BiReportOdpsKnowledgeContext | null {
  const knowledge = loadBiReportOdpsKnowledge();
  const aliasCandidates = new Set(SKILL_ALIAS_MAP[input.skillKey] ?? []);
  const hintText = [...input.deterministicFindings, ...input.matchedRules].join(" ").toLowerCase();

  if (hintText.includes("还款") || hintText.includes("回款")) {
    aliasCandidates.add("bill_repay");
    aliasCandidates.add("lender_repay_serial");
  }
  if (
    hintText.includes("放款") ||
    hintText.includes("营收") ||
    hintText.includes("取现") ||
    hintText.includes("收支") ||
    hintText.includes("收入") ||
    hintText.includes("支出")
  ) {
    aliasCandidates.add("business_income_expense");
    aliasCandidates.add("mini_loan");
    aliasCandidates.add("withdraw");
  }

  const matchedAliases = [...aliasCandidates];
  if (matchedAliases.length === 0) {
    return null;
  }

  const tableAliases = knowledge.tableAliases
    .filter((item) => item.isActive && aliasCandidates.has(item.alias))
    .slice(0, 5)
    .map(
      (item) =>
        `${item.alias}: ${item.cnName} -> ${item.physicalTableName}（${item.description}；分区字段 ${item.partitionField}）`,
    );

  const fieldConventions = knowledge.fieldConventions
    .filter((item) => item.isActive && aliasCandidates.has(item.tableAlias))
    .slice(0, 5)
    .map(
      (item) =>
        `${item.tableAlias}.${item.fieldName}: ${item.meaning}；常用方式：${item.commonUsage}${
          item.notes ? `；注意：${item.notes}` : ""
        }`,
    );

  const enumKnowledge = knowledge.enumKnowledge
    .filter((item) => item.isActive && aliasCandidates.has(item.tableAlias))
    .slice(0, 8)
    .map(
      (item) =>
        `${item.tableAlias}.${item.fieldName}.${item.enumValue} = ${item.enumLabel}${
          item.notes ? `（${item.notes}）` : ""
        }`,
    );

  const queryConventions = knowledge.queryConventions
    .filter((item) => item.isActive && (item.scope === "global" || item.scope === "repay" || item.scope === "loan"))
    .slice(0, 5)
    .map((item) => `${item.title}：${item.content}`);

  return {
    matchedAliases,
    tableAliases,
    fieldConventions,
    enumKnowledge,
    queryConventions,
  };
}

export function lintBiReportOdpsQuery(input: {
  skillKey: string;
  sql: string;
}): BiReportOdpsQueryLint {
  const knowledge = loadBiReportOdpsKnowledge();
  const sqlLower = input.sql.toLowerCase();
  const skillAliases = new Set(SKILL_ALIAS_MAP[input.skillKey] ?? []);
  const matchedTables = knowledge.tableAliases.filter((item) =>
    sqlLower.includes(item.physicalTableName.toLowerCase()),
  );
  const matchedAliases = matchedTables.map((item) => item.alias);
  const warnings: string[] = [];

  for (const table of matchedTables) {
    if (table.partitionField === "thedate" && !/\bthedate\b/i.test(input.sql)) {
      warnings.push(`${table.alias} 查询未显式包含 thedate 分区约束，可能触发全表扫描或口径漂移。`);
    }
  }

  const touchesAmountField =
    matchedTables.length > 0 && (/\bamt_[a-z_]+\b/i.test(input.sql) || /\bpay_amount\b/i.test(input.sql));
  const usesAmountConversion = /\/\s*1000(\.0)?|\/\s*10000(\.0)?|\/\s*100000000(\.0)?/i.test(input.sql);
  if (touchesAmountField && !usesAmountConversion) {
    warnings.push("SQL 命中了金额字段，但没有明显金额单位换算，需确认是否仍按“厘”口径输出。");
  }

  if (sqlLower.includes("sample_rds__loan_pay__bill_repay__1d") && sqlLower.includes("sample_rds__loan_finance__lender_repay_serial__1d")) {
    warnings.push("SQL 同时使用 bill_repay 和 lender_repay_serial，需确认是否混用了用户侧与资金侧还款口径。");
  }

  if (skillAliases.has("bill_repay") && matchedAliases.length === 0) {
    warnings.push("回款类 skill 没有命中已登记的核心 ODPS 表映射，请确认是否使用了未经登记的中间表或 ADS 表。");
  }

  return {
    matchedAliases,
    matchedPhysicalTables: matchedTables.map((item) => item.physicalTableName),
    warnings,
  };
}
