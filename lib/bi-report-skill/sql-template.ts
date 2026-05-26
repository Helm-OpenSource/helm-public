import { lintBiReportOdpsQuery } from "@/lib/bi-report-skill/odps-knowledge";
import type { BiReportSkillPack, BiReportSubscriptionConfig } from "@/lib/bi-report-skill/types";

type ResolveBiReportSqlParamsOptions = {
  referenceDate?: Date;
};

const todayTokenPattern = /^{{today(?:([+-])(\d+)d)?}}$/;
const monthTokenPattern = /^{{month(?:([+-])(\d+)m)?}}$/;
const sqlPlaceholderPattern = /{{\s*([\w.]+)\s*}}/g;

export function resolveBiReportSqlParams(
  params: Record<string, string>,
  options: ResolveBiReportSqlParamsOptions = {},
) {
  const resolved: Record<string, string> = {};

  for (const [key, value] of Object.entries(params)) {
    resolved[key] = resolveDynamicSqlParamValue(value, options.referenceDate ?? new Date());
  }

  return resolved;
}

export function renderBiReportSql(template: string, params: Record<string, string>) {
  const missingParams = new Set<string>();

  const rendered = template.replace(sqlPlaceholderPattern, (match, rawKey: string) => {
    const value = params[rawKey];
    if (value == null) {
      missingParams.add(rawKey);
      return match;
    }

    return escapeSqlStringLiteral(value);
  });

  if (missingParams.size > 0) {
    throw new Error(`Bi report SQL rendering failed: missing params ${Array.from(missingParams).join(", ")}`);
  }

  return rendered;
}

export function buildBiReportQueryInput(input: {
  skill: BiReportSkillPack;
  subscription: BiReportSubscriptionConfig;
  referenceDate?: Date;
}) {
  const sqlParams = resolveBiReportSqlParams(input.subscription.sqlParams, {
    referenceDate: input.referenceDate,
  });

  assertBiReportQueryParamsDeclared(input.skill, sqlParams);

  const sql = renderBiReportSql(input.skill.querySql, sqlParams);
  const knowledgeLint = lintBiReportOdpsQuery({
    skillKey: input.skill.manifest.skillKey,
    sql,
  });

  return {
    sqlParams,
    sql,
    knowledgeLint,
  };
}

function resolveDynamicSqlParamValue(value: string, referenceDate: Date) {
  const trimmed = value.trim();
  const todayToken = trimmed.match(todayTokenPattern);
  if (todayToken) {
    const [, direction, rawDays] = todayToken;
    const offsetDays = rawDays ? Number(rawDays) : 0;
    const signedOffset =
      direction === "-"
        ? -offsetDays
        : direction === "+"
          ? offsetDays
          : 0;

    return formatDate(shiftDate(referenceDate, signedOffset));
  }

  const monthToken = trimmed.match(monthTokenPattern);
  if (monthToken) {
    const [, direction, rawMonths] = monthToken;
    const offsetMonths = rawMonths ? Number(rawMonths) : 0;
    const signedOffset =
      direction === "-"
        ? -offsetMonths
        : direction === "+"
          ? offsetMonths
          : 0;

    return formatMonth(shiftMonth(referenceDate, signedOffset));
  }

  return trimmed;
}

function shiftDate(value: Date, offsetDays: number) {
  const shifted = new Date(value);
  shifted.setDate(shifted.getDate() + offsetDays);
  return shifted;
}

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function shiftMonth(value: Date, offsetMonths: number) {
  const shifted = new Date(value);
  shifted.setMonth(shifted.getMonth() + offsetMonths);
  return shifted;
}

function formatMonth(value: Date) {
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}`;
}

function escapeSqlStringLiteral(value: string) {
  return value.replace(/'/g, "''");
}

function assertBiReportQueryParamsDeclared(skill: BiReportSkillPack, params: Record<string, string>) {
  const declared = new Set(skill.manifest.parameters.map((item) => item.name));

  for (const requiredParam of skill.manifest.parameters.filter((item) => item.required)) {
    if (!params[requiredParam.name]) {
      throw new Error(`Bi report SQL rendering failed: required param ${requiredParam.name} is empty`);
    }
  }

  for (const key of Object.keys(params)) {
    if (!declared.has(key)) {
      throw new Error(`Bi report SQL rendering failed: undeclared param ${key} for skill ${skill.manifest.skillKey}`);
    }
  }
}
