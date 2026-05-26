import { safeParseJson } from "@/lib/utils";

type DingTalkWorkProgressRecord = {
  id: string;
  sourceId: string;
  sourceSummary: string;
  sourceScope: string;
  sourceType: string;
  draftPayload: string | null;
  createdAt: Date;
};

export type DingTalkWorkProgressItem = {
  reportId: string;
  templateName: string | null;
  reporterName: string | null;
  reporterId: string | null;
  departmentName: string | null;
  createdAt: Date | null;
  modifiedAt: Date | null;
  completedWork: string | null;
  weeklySummary: string | null;
  nextWeekPlan: string | null;
  needHelp: string | null;
  sections: Array<{
    key: string | null;
    value: string;
  }>;
  previewText: string;
  sourceScope: string;
  sourceType: string;
  sourceId: string;
  sourceSummary: string;
};

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readText(value: unknown, depth = 0): string | null {
  if (depth > 4 || value == null) {
    return null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    const merged = value
      .map((entry) => readText(entry, depth + 1))
      .filter((entry): entry is string => Boolean(entry))
      .join("\n")
      .trim();
    return merged ? merged : null;
  }
  if (typeof value === "object") {
    const row = value as Record<string, unknown>;
    for (const key of ["value", "text", "content", "markdown", "desc", "description"]) {
      const picked = readText(row[key], depth + 1);
      if (picked) {
        return picked;
      }
    }
    const merged = Object.values(row)
      .map((entry) => readText(entry, depth + 1))
      .filter((entry): entry is string => Boolean(entry))
      .join("\n")
      .trim();
    return merged ? merged : null;
  }
  return null;
}

function toDate(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value > 10_000_000_000 ? value : value * 1000);
  }
  if (typeof value === "string") {
    const asNum = Number(value.trim());
    if (Number.isFinite(asNum)) {
      return new Date(asNum > 10_000_000_000 ? asNum : asNum * 1000);
    }
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return new Date(parsed);
    }
  }
  return null;
}

function pickContentValue(contents: Array<Record<string, unknown>>, matcher: RegExp) {
  const hit = contents.find((item) => matcher.test(readString(item.key) ?? ""));
  return readText(hit?.value);
}

export function parseDingTalkWorkProgressRecord(
  record: DingTalkWorkProgressRecord,
): DingTalkWorkProgressItem | null {
  const parsedDraft = safeParseJson<Record<string, unknown> | null>(
    record.draftPayload,
    null,
  );
  const payload =
    parsedDraft && typeof parsedDraft.payload === "object" && parsedDraft.payload
      ? (parsedDraft.payload as Record<string, unknown>)
      : null;
  if (!payload) {
    return null;
  }

  const reportId =
    readString(payload.report_id) ??
    readString(payload.reportId) ??
    readString(payload.id) ??
    record.sourceId;
  const contents = Array.isArray(payload.contents)
    ? payload.contents
        .filter((item) => item && typeof item === "object")
        .map((item) => item as Record<string, unknown>)
    : [];

  const completedWork = pickContentValue(contents, /本周完成|已完成|完成工作|完成事项/);
  const weeklySummary = pickContentValue(contents, /本周工作总结|总结/);
  const nextWeekPlan = pickContentValue(contents, /下周工作计划|计划|下一步|待推进/);
  const needHelp = pickContentValue(contents, /需协调与帮助|风险|阻塞|问题/);
  const sections = contents
    .map((item) => ({
      key: readString(item.key),
      value: readText(item.value),
    }))
    .filter((item): item is { key: string | null; value: string } => Boolean(item.value));
  const firstSectionValue = sections[0]?.value ?? null;
  const previewText =
    weeklySummary ??
    nextWeekPlan ??
    completedWork ??
    needHelp ??
    firstSectionValue ??
    record.sourceSummary;

  return {
    reportId,
    templateName: readString(payload.template_name) ?? readString(payload.templateName),
    reporterName: readString(payload.creator_name) ?? readString(payload.creatorName),
    reporterId: readString(payload.creator_id) ?? readString(payload.creatorId),
    departmentName: readString(payload.dept_name) ?? readString(payload.deptName),
    createdAt: toDate(payload.create_time) ?? toDate(payload.createdAt) ?? record.createdAt,
    modifiedAt: toDate(payload.modified_time) ?? toDate(payload.modifiedAt),
    completedWork: completedWork ?? firstSectionValue,
    weeklySummary: weeklySummary ?? firstSectionValue,
    nextWeekPlan,
    needHelp,
    sections,
    previewText,
    sourceScope: record.sourceScope,
    sourceType: record.sourceType,
    sourceId: record.sourceId,
    sourceSummary: record.sourceSummary,
  };
}

export function buildDingTalkWorkProgressList(
  records: DingTalkWorkProgressRecord[],
): DingTalkWorkProgressItem[] {
  const parsed = records
    .filter((item) => item.sourceScope.endsWith(":WORK"))
    .filter((item) => item.sourceType === "work_report" || item.sourceType.includes("report"))
    .map(parseDingTalkWorkProgressRecord)
    .filter((item): item is DingTalkWorkProgressItem => Boolean(item));

  parsed.sort((left, right) => {
    const lt = left.createdAt ? left.createdAt.getTime() : 0;
    const rt = right.createdAt ? right.createdAt.getTime() : 0;
    return rt - lt;
  });

  const dedup = new Map<string, DingTalkWorkProgressItem>();
  for (const item of parsed) {
    if (!dedup.has(item.reportId)) {
      dedup.set(item.reportId, item);
    }
  }
  return [...dedup.values()];
}
