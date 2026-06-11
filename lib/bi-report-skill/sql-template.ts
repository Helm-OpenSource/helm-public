import { lintBiReportOdpsQuery } from "@/lib/bi-report-skill/odps-knowledge";
import type { BiReportSkillPack, BiReportSubscriptionConfig } from "@/lib/bi-report-skill/types";

type ResolveBiReportSqlParamsOptions = {
  referenceDate?: Date;
  /**
   * IANA timezone used to resolve `{{today}}`/`{{month}}` tokens into the
   * subscription's business date. Defaults to UTC, which silently shifts the
   * business day for +08:00 tenants between 00:00 and 08:00 local time —
   * callers with a subscription timezone should always pass it.
   */
  timeZone?: string;
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
    resolved[key] = resolveDynamicSqlParamValue(
      value,
      options.referenceDate ?? new Date(),
      options.timeZone,
    );
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
    timeZone: input.subscription.timezone || undefined,
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

function resolveDynamicSqlParamValue(value: string, referenceDate: Date, timeZone?: string) {
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

    return formatDate(shiftDate(referenceDate, signedOffset), timeZone);
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

    return shiftMonthLabel(referenceDate, signedOffset, timeZone);
  }

  return trimmed;
}

function shiftDate(value: Date, offsetDays: number) {
  const shifted = new Date(value);
  shifted.setDate(shifted.getDate() + offsetDays);
  return shifted;
}

function formatDate(value: Date, timeZone?: string) {
  if (timeZone) {
    try {
      // en-CA renders as YYYY-MM-DD.
      return new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(value);
    } catch {
      // Invalid IANA name in subscription config — fall back to UTC below.
    }
  }
  return value.toISOString().slice(0, 10);
}

function shiftMonthLabel(referenceDate: Date, offsetMonths: number, timeZone?: string) {
  // Determine the current year-month in the target timezone FIRST (the business
  // month can differ from the UTC month near midnight), then shift on calendar
  // (year, month) integers. Anchoring on day 1 avoids the setMonth() day-29-31
  // overflow bug, and rebuilding from UTC day-1 components keeps formatting
  // stable regardless of timezone.
  const [year, month] = formatDate(referenceDate, timeZone).split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + offsetMonths, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

function escapeSqlStringLiteral(value: string) {
  // ODPS/MaxCompute string literals use C-style backslash escapes, NOT the SQL
  // doubled-quote form. Verified against the live ODPS bridge:
  //   SELECT 'a''b'  -> "ab"   (ODPS treats '' as two adjacent literals and
  //                             concatenates them, silently DROPPING the quote)
  //   SELECT 'a\'b'  -> "a'b"  (correct)
  // So a quote must be escaped as \' , not '' — otherwise any value containing a
  // single quote (e.g. a name like O'Brien) is corrupted. Escape backslashes
  // first so an existing `\` can't combine with the quote escape we add.
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
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
