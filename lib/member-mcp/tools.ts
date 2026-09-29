// lib/member-mcp/tools.ts
// Member MCP P0 tool surface: definitions, argument parsing and the Member
// Gateway envelope every tool result is wrapped in. Pure: no IO, no clock.

import {
  decideMemberProjection,
  decideMemberReadSurface,
  validateMemberToolEnvelope,
} from "@/lib/member-gateway/contract";
import {
  MEMBER_SIGNAL_DETAIL_MAX_CHARS,
  MEMBER_SIGNAL_SUMMARY_MAX_CHARS,
  type MemberWorkSignalKind,
  type MemberWorkSignalPayload,
} from "@/lib/member-gateway/signal";
import type {
  MemberObjectClassification,
  MemberProjectionDecision,
  MemberToolEnvelope,
} from "@/lib/member-gateway/types";
import type { MemberMcpScope } from "@/lib/member-mcp/contract";
import {
  MEMBER_MCP_RESPONSE_KINDS,
  MEMBER_MCP_RESPONSE_TEXT_MAX_CHARS,
  validateResponseText,
  type MemberMcpResponseKind,
} from "@/lib/member-mcp/response-contract";

export const MEMBER_MCP_TOOL_NAMES = [
  "get_my_brief",
  "list_my_pending_prompts",
  "get_my_prompt",
  "prepare_work_signal",
  "submit_work_signal",
  "prepare_field_report",
  "submit_field_report",
  "prepare_prompt_response",
  "submit_prompt_response",
  "get_prompt_response_status",
] as const;

export const MEMBER_MCP_WRITE_TOOL_NAMES = [
  "prepare_work_signal",
  "submit_work_signal",
  "prepare_field_report",
  "submit_field_report",
  "prepare_prompt_response",
  "submit_prompt_response",
] as const;

// Field-report kinds (staff-connect spec §3). A field report rides the
// existing work-signal receipt: the frozen signal kinds are not extended, the
// report's structured part is embedded in the payload detail as one
// canonical JSON block (see buildFieldReportPayload).
export const MEMBER_FIELD_REPORT_KINDS = [
  "daily_ops_brief",
  "shadow_check",
  "data_quality",
  "seat_feedback",
  "case_observation",
] as const;

export type MemberFieldReportKind = (typeof MEMBER_FIELD_REPORT_KINDS)[number];

export const MEMBER_FIELD_REPORT_LABELS: Record<MemberFieldReportKind, string> = {
  daily_ops_brief: "每日运营简报",
  shadow_check: "影子核对",
  data_quality: "数据质量",
  seat_feedback: "坐席反馈",
  case_observation: "案件观察",
};

const FIELD_REPORT_SIGNAL_KIND: Record<MemberFieldReportKind, MemberWorkSignalKind> = {
  daily_ops_brief: "progress",
  shadow_check: "progress",
  data_quality: "progress",
  seat_feedback: "progress",
  case_observation: "customer_signal",
};

export const MEMBER_FIELD_REPORT_BLOCK_OPEN = "```helm-field-report/v1";
export const MEMBER_FIELD_REPORT_MAX_METRICS = 20;

export type MemberMcpToolName = (typeof MEMBER_MCP_TOOL_NAMES)[number];

export type MemberMcpToolDefinition = {
  name: MemberMcpToolName;
  description: string;
  requiredScope: MemberMcpScope;
  inputSchema: Record<string, unknown>;
};

export const MEMBER_MCP_TOOLS: readonly MemberMcpToolDefinition[] = [
  {
    name: "get_my_brief",
    description:
      "读取我在 Helm 的简报：我的岗位与分组、这台设备的接入状态、CAIO 发给我且待处理的提问数量，以及数据截止时间。只读。",
    requiredScope: "member:brief:read",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "list_my_pending_prompts",
    description:
      "列出 CAIO 发给我、尚未回应的提问（待投递、已投递、已暂缓），按发出时间倒序。只读，不会改变提问状态。",
    requiredScope: "member:prompt:read",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "integer", minimum: 1, maximum: 50, default: 20 },
        cursor: { type: "string", maxLength: 191 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_my_prompt",
    description:
      "读取一条发给我的 CAIO 提问：摘要、证据引用、严重度、状态与版本号。只读。",
    requiredScope: "member:prompt:read",
    inputSchema: {
      type: "object",
      properties: { promptRef: { type: "string", minLength: 1, maxLength: 191 } },
      required: ["promptRef"],
      additionalProperties: false,
    },
  },
  {
    name: "prepare_work_signal",
    description:
      "提交工作信号第一步：把进展、阻碍或客户信号写成草稿，拿到一次性确认码（5 分钟内有效）。信号只作为待审阅的候选，不产生任何授权。",
    requiredScope: "member:signal:write",
    inputSchema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["progress", "blocker", "customer_signal"] },
        summary: { type: "string", minLength: 1, maxLength: 500 },
        detail: { type: "string", maxLength: 4000 },
      },
      required: ["kind", "summary"],
      additionalProperties: false,
    },
  },
  {
    name: "submit_work_signal",
    description:
      "提交工作信号第二步：带上确认码和与第一步完全相同的内容提交，返回回执编号。内容不同会被拒绝；同一确认码重复提交返回同一回执。",
    requiredScope: "member:signal:write",
    inputSchema: {
      type: "object",
      properties: {
        challengeRef: { type: "string", minLength: 1, maxLength: 191 },
        kind: { type: "string", enum: ["progress", "blocker", "customer_signal"] },
        summary: { type: "string", minLength: 1, maxLength: 500 },
        detail: { type: "string", maxLength: 4000 },
      },
      required: ["challengeRef", "kind", "summary"],
      additionalProperties: false,
    },
  },
  {
    name: "prepare_field_report",
    description:
      "提交现场报告第一步：选报告类型，填标题、结构化指标（指标键须在本工作区登记的清单内）和文字说明，拿到一次性确认码。文字只给人看，不进入 CAIO 推理。",
    requiredScope: "member:report:write",
    inputSchema: FIELD_REPORT_SCHEMA(false),
  },
  {
    name: "submit_field_report",
    description:
      "提交现场报告第二步：带上确认码和与第一步完全相同的内容提交，返回回执编号。",
    requiredScope: "member:report:write",
    inputSchema: FIELD_REPORT_SCHEMA(true),
  },
  {
    name: "prepare_prompt_response",
    description:
      "回应 CAIO 提问第一步：选择回应方式（已知悉 / 拒绝 / 暂停 / 申诉 / 进展汇报 / 回答）并填写内容，拿到一次性确认码（5 分钟内有效）。拒绝、暂停、申诉始终是你的正当权利，需要写明理由。",
    requiredScope: "member:prompt:respond",
    inputSchema: RESPONSE_SCHEMA(false),
  },
  {
    name: "submit_prompt_response",
    description:
      "回应 CAIO 提问第二步：带上确认码和与第一步完全相同的内容提交。系统先收下并返回收件编号，后台约 1 分钟内正式登记；用 get_prompt_response_status 查看登记结果。",
    requiredScope: "member:prompt:respond",
    inputSchema: RESPONSE_SCHEMA(true),
  },
  {
    name: "get_prompt_response_status",
    description: "查看一条回应的登记状态：已收到、已登记、未能登记（附原因）或待人工处理。只读。",
    requiredScope: "member:prompt:respond",
    inputSchema: {
      type: "object",
      properties: { inboxRef: { type: "string", minLength: 1, maxLength: 191 } },
      required: ["inboxRef"],
      additionalProperties: false,
    },
  },
];

function RESPONSE_SCHEMA(withChallenge: boolean): Record<string, unknown> {
  const properties: Record<string, unknown> = {
    promptRef: { type: "string", minLength: 1, maxLength: 191 },
    kind: { type: "string", enum: [...MEMBER_MCP_RESPONSE_KINDS] },
    text: { type: "string", maxLength: MEMBER_MCP_RESPONSE_TEXT_MAX_CHARS },
  };
  if (withChallenge) properties.challengeRef = { type: "string", minLength: 1, maxLength: 191 };
  return {
    type: "object",
    properties,
    required: withChallenge ? ["challengeRef", "promptRef", "kind"] : ["promptRef", "kind"],
    additionalProperties: false,
  };
}

function FIELD_REPORT_SCHEMA(withChallenge: boolean): Record<string, unknown> {
  const properties: Record<string, unknown> = {
    kind: { type: "string", enum: [...MEMBER_FIELD_REPORT_KINDS] },
    title: { type: "string", minLength: 1, maxLength: 200 },
    metrics: {
      type: "array",
      maxItems: MEMBER_FIELD_REPORT_MAX_METRICS,
      items: {
        type: "object",
        properties: {
          key: { type: "string" },
          value: { type: "number" },
          unit: { type: "string", maxLength: 16 },
          window: { type: "string", maxLength: 40 },
          source_ref: { type: "string", maxLength: 191 },
        },
        required: ["key", "value"],
        additionalProperties: false,
      },
    },
    text: { type: "string", maxLength: 3000 },
  };
  if (withChallenge) properties.challengeRef = { type: "string", minLength: 1, maxLength: 191 };
  return {
    type: "object",
    properties,
    required: withChallenge ? ["challengeRef", "kind", "title"] : ["kind", "title"],
    additionalProperties: false,
  };
}

export type MemberFieldReportMetric = {
  key: string;
  value: number;
  unit: string | null;
  window: string | null;
  source_ref: string | null;
};

export type MemberFieldReportInput = {
  kind: MemberFieldReportKind;
  title: string;
  metrics: MemberFieldReportMetric[];
  text: string;
};

export type MemberWorkSignalInput = {
  kind: MemberWorkSignalKind;
  summary: string;
  detail: string;
};

export type MemberMcpToolCall =
  | { toolName: "get_my_brief"; arguments: Record<string, never> }
  | {
      toolName: "list_my_pending_prompts";
      arguments: { limit: number; cursor: string | null };
    }
  | { toolName: "get_my_prompt"; arguments: { promptRef: string } }
  | { toolName: "prepare_work_signal"; arguments: MemberWorkSignalInput }
  | { toolName: "submit_work_signal"; arguments: MemberWorkSignalInput & { challengeRef: string } }
  | { toolName: "prepare_field_report"; arguments: MemberFieldReportInput }
  | { toolName: "submit_field_report"; arguments: MemberFieldReportInput & { challengeRef: string } }
  | { toolName: "prepare_prompt_response"; arguments: MemberPromptResponseInput }
  | { toolName: "submit_prompt_response"; arguments: MemberPromptResponseInput & { challengeRef: string } }
  | { toolName: "get_prompt_response_status"; arguments: { inboxRef: string } };

export type MemberPromptResponseInput = {
  promptRef: string;
  kind: MemberMcpResponseKind;
  text: string;
};

const REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9:._-]{0,190}$/;

export function parseMemberMcpToolCall(
  name: string,
  args: unknown,
): { ok: true; call: MemberMcpToolCall } | { ok: false; message: string } {
  const record =
    args && typeof args === "object" && !Array.isArray(args)
      ? (args as Record<string, unknown>)
      : null;
  if (!record) return { ok: false, message: "arguments must be an object" };
  const keys = Object.keys(record);
  if (name === "get_my_brief") {
    if (keys.length > 0) return { ok: false, message: "get_my_brief takes no arguments" };
    return { ok: true, call: { toolName: name, arguments: {} } };
  }
  if (name === "list_my_pending_prompts") {
    if (keys.some((key) => key !== "limit" && key !== "cursor")) {
      return { ok: false, message: "unknown argument" };
    }
    const limit = record.limit ?? 20;
    if (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1 || limit > 50) {
      return { ok: false, message: "limit must be an integer from 1 to 50" };
    }
    const cursor = record.cursor ?? null;
    if (cursor !== null && (typeof cursor !== "string" || !REF_PATTERN.test(cursor))) {
      return { ok: false, message: "cursor is malformed" };
    }
    return { ok: true, call: { toolName: name, arguments: { limit, cursor } } };
  }
  if (name === "get_my_prompt") {
    if (keys.some((key) => key !== "promptRef")) return { ok: false, message: "unknown argument" };
    const promptRef = record.promptRef;
    if (typeof promptRef !== "string" || !REF_PATTERN.test(promptRef)) {
      return { ok: false, message: "promptRef is malformed" };
    }
    return { ok: true, call: { toolName: name, arguments: { promptRef } } };
  }
  if (name === "prepare_work_signal" || name === "submit_work_signal") {
    const withChallenge = name === "submit_work_signal";
    const allowed = new Set(["kind", "summary", "detail", ...(withChallenge ? ["challengeRef"] : [])]);
    if (keys.some((key) => !allowed.has(key))) return { ok: false, message: "unknown argument" };
    const signal = parseWorkSignalInput(record);
    if (!signal.ok) return signal;
    if (!withChallenge) return { ok: true, call: { toolName: name, arguments: signal.value } };
    const challengeRef = readChallengeRef(record);
    if (!challengeRef) return { ok: false, message: "challengeRef is malformed" };
    return { ok: true, call: { toolName: name, arguments: { ...signal.value, challengeRef } } };
  }
  if (name === "prepare_field_report" || name === "submit_field_report") {
    const withChallenge = name === "submit_field_report";
    const allowed = new Set(["kind", "title", "metrics", "text", ...(withChallenge ? ["challengeRef"] : [])]);
    if (keys.some((key) => !allowed.has(key))) return { ok: false, message: "unknown argument" };
    const report = parseFieldReportInput(record);
    if (!report.ok) return report;
    if (!withChallenge) return { ok: true, call: { toolName: name, arguments: report.value } };
    const challengeRef = readChallengeRef(record);
    if (!challengeRef) return { ok: false, message: "challengeRef is malformed" };
    return { ok: true, call: { toolName: name, arguments: { ...report.value, challengeRef } } };
  }
  if (name === "prepare_prompt_response" || name === "submit_prompt_response") {
    const withChallenge = name === "submit_prompt_response";
    const allowed = new Set(["promptRef", "kind", "text", ...(withChallenge ? ["challengeRef"] : [])]);
    if (keys.some((key) => !allowed.has(key))) return { ok: false, message: "unknown argument" };
    const promptRef = record.promptRef;
    if (typeof promptRef !== "string" || !REF_PATTERN.test(promptRef)) {
      return { ok: false, message: "promptRef is malformed" };
    }
    const kind = record.kind;
    if (typeof kind !== "string" || !(MEMBER_MCP_RESPONSE_KINDS as readonly string[]).includes(kind)) {
      return { ok: false, message: `kind must be one of ${MEMBER_MCP_RESPONSE_KINDS.join(", ")}` };
    }
    const rawText = record.text === undefined ? "" : record.text;
    if (typeof rawText !== "string" || CONTROL_CHARACTERS.test(rawText)) {
      return { ok: false, message: "text must be printable" };
    }
    const text = rawText.trim();
    const textProblem = validateResponseText(kind as MemberMcpResponseKind, text);
    if (textProblem) return { ok: false, message: textProblem };
    const value = { promptRef, kind: kind as MemberMcpResponseKind, text };
    if (!withChallenge) return { ok: true, call: { toolName: name, arguments: value } };
    const challengeRef = readChallengeRef(record);
    if (!challengeRef) return { ok: false, message: "challengeRef is malformed" };
    return { ok: true, call: { toolName: name, arguments: { ...value, challengeRef } } };
  }
  if (name === "get_prompt_response_status") {
    if (keys.some((key) => key !== "inboxRef")) return { ok: false, message: "unknown argument" };
    const inboxRef = record.inboxRef;
    if (typeof inboxRef !== "string" || !REF_PATTERN.test(inboxRef)) {
      return { ok: false, message: "inboxRef is malformed" };
    }
    return { ok: true, call: { toolName: name, arguments: { inboxRef } } };
  }
  return { ok: false, message: "unknown tool" };
}

function readChallengeRef(record: Record<string, unknown>): string | null {
  const value = record.challengeRef;
  return typeof value === "string" && REF_PATTERN.test(value) ? value : null;
}

const WORK_SIGNAL_KINDS: readonly MemberWorkSignalKind[] = ["progress", "blocker", "customer_signal"];
// C0/C1 controls, bidi overrides and zero-width characters: member text is
// shown to reviewers, so nothing that can disguise what they read is accepted.
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u2069\ufeff]/;
// Only buildFieldReportPayload may emit the structured block; free text in a
// work signal or a report must not open (or close) a fence of its own.
const FENCE = "```";

function parseWorkSignalInput(
  record: Record<string, unknown>,
): { ok: true; value: MemberWorkSignalInput } | { ok: false; message: string } {
  const kind = record.kind;
  if (typeof kind !== "string" || !(WORK_SIGNAL_KINDS as readonly string[]).includes(kind)) {
    return { ok: false, message: "kind must be progress, blocker or customer_signal" };
  }
  const summary = typeof record.summary === "string" ? record.summary.trim() : "";
  if (!summary || summary.length > MEMBER_SIGNAL_SUMMARY_MAX_CHARS || CONTROL_CHARACTERS.test(summary)) {
    return { ok: false, message: "summary must be 1-500 printable characters" };
  }
  const detail = record.detail === undefined ? "" : record.detail;
  if (typeof detail !== "string" || detail.length > MEMBER_SIGNAL_DETAIL_MAX_CHARS || CONTROL_CHARACTERS.test(detail)) {
    return { ok: false, message: "detail must be at most 4000 printable characters" };
  }
  if (summary.includes(FENCE) || detail.includes(FENCE)) {
    return { ok: false, message: "work signals may not contain code fences; use the field report tools for structured reports" };
  }
  return { ok: true, value: { kind: kind as MemberWorkSignalKind, summary, detail } };
}

function optionalText(value: unknown, max: number): string | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (trimmed.length > max || CONTROL_CHARACTERS.test(trimmed)) return undefined;
  return trimmed || null;
}

function parseFieldReportInput(
  record: Record<string, unknown>,
): { ok: true; value: MemberFieldReportInput } | { ok: false; message: string } {
  const kind = record.kind;
  if (typeof kind !== "string" || !(MEMBER_FIELD_REPORT_KINDS as readonly string[]).includes(kind)) {
    return { ok: false, message: `kind must be one of ${MEMBER_FIELD_REPORT_KINDS.join(", ")}` };
  }
  const title = typeof record.title === "string" ? record.title.trim() : "";
  if (!title || title.length > 200 || CONTROL_CHARACTERS.test(title) || title.includes(FENCE)) {
    return { ok: false, message: "title must be 1-200 printable characters without code fences" };
  }
  const rawMetrics = record.metrics ?? [];
  if (!Array.isArray(rawMetrics) || rawMetrics.length > MEMBER_FIELD_REPORT_MAX_METRICS) {
    return { ok: false, message: `metrics must be an array of at most ${MEMBER_FIELD_REPORT_MAX_METRICS}` };
  }
  const metrics: MemberFieldReportMetric[] = [];
  for (const item of rawMetrics) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return { ok: false, message: "metric must be an object" };
    const metric = item as Record<string, unknown>;
    if (Object.keys(metric).some((key) => !["key", "value", "unit", "window", "source_ref"].includes(key))) {
      return { ok: false, message: "unknown metric field" };
    }
    if (typeof metric.key !== "string" || !metric.key) return { ok: false, message: "metric key is required" };
    if (typeof metric.value !== "number" || !Number.isFinite(metric.value)) {
      return { ok: false, message: `metric ${metric.key} value must be a finite number` };
    }
    const unit = optionalText(metric.unit, 16);
    const window = optionalText(metric.window, 40);
    const sourceRef = optionalText(metric.source_ref, 191);
    if (typeof sourceRef === "string" && !REF_PATTERN.test(sourceRef)) {
      return { ok: false, message: `metric ${metric.key} source_ref must be an opaque ref` };
    }
    if (metrics.some((seen) => seen.key === metric.key)) {
      return { ok: false, message: `metric ${metric.key} appears more than once` };
    }
    if (unit === undefined || window === undefined || sourceRef === undefined) {
      return { ok: false, message: `metric ${metric.key} has a malformed unit, window or source_ref` };
    }
    metrics.push({ key: metric.key, value: metric.value, unit, window, source_ref: sourceRef });
  }
  const text = record.text === undefined ? "" : record.text;
  if (typeof text !== "string" || text.length > 3000 || CONTROL_CHARACTERS.test(text) || text.includes(FENCE)) {
    return { ok: false, message: "text must be at most 3000 printable characters without code fences" };
  }
  return { ok: true, value: { kind: kind as MemberFieldReportKind, title, metrics, text: text.trim() } };
}

// Builds the work-signal payload a field report is recorded as. Deterministic
// (same input → same payload → same challenge hash): the structured block is
// canonical JSON with metrics in submitted order and fixed key order. Metric
// keys must be on the workspace's registered list; with an empty list only
// text reports are accepted. The whole payload stays untrusted candidate
// evidence — the block is structured, not verified.
export function buildFieldReportPayload(
  input: MemberFieldReportInput,
  allowedMetricKeys: readonly string[],
): { ok: true; payload: MemberWorkSignalPayload } | { ok: false; message: string } {
  const allowed = new Set(allowedMetricKeys);
  const unknown = input.metrics.filter((metric) => !allowed.has(metric.key)).map((metric) => metric.key);
  if (unknown.length > 0) {
    return {
      ok: false,
      message: allowed.size === 0
        ? "this workspace has no registered metric keys; submit the report as text only"
        : `unregistered metric keys: ${[...new Set(unknown)].join(", ")}`,
    };
  }
  const block = JSON.stringify({
    kind: input.kind,
    metrics: input.metrics.map((metric) => ({
      key: metric.key,
      value: metric.value,
      unit: metric.unit,
      window: metric.window,
      source_ref: metric.source_ref,
    })),
  });
  const detail = `${MEMBER_FIELD_REPORT_BLOCK_OPEN}\n${block}\n\`\`\`${input.text ? `\n${input.text}` : ""}`;
  if (detail.length > MEMBER_SIGNAL_DETAIL_MAX_CHARS) {
    return { ok: false, message: "report is too long; shorten the text or send fewer metrics" };
  }
  const summary = `现场报告·${MEMBER_FIELD_REPORT_LABELS[input.kind]}：${input.title}`.slice(0, MEMBER_SIGNAL_SUMMARY_MAX_CHARS);
  return {
    ok: true,
    payload: { kind: FIELD_REPORT_SIGNAL_KIND[input.kind], summary, detail, relatedEvidenceRefs: [] },
  };
}

// P0 reads only the caller's own records, so the projection policy is the
// self-record policy: the prompt summary was projected when CAIO issued it,
// and the brief is the member's own membership/connection metadata.
// classifiedAt is the instant the served record was produced (prompt
// issuance) or, for aggregates computed at read time, the read instant.
export const MEMBER_MCP_SELF_RECORD_POLICY_REF = "member-mcp:self-record";
export const MEMBER_MCP_SELF_RECORD_POLICY_VERSION = 1;
export const MEMBER_MCP_PURPOSE = "member_self_service";

export function buildSelfRecordDecision(input: {
  providerRef: string | null;
  classifiedAt: Date;
  now: Date;
}): MemberProjectionDecision {
  const base = {
    projectionPolicyRef: MEMBER_MCP_SELF_RECORD_POLICY_REF,
    projectionPolicyVersion: MEMBER_MCP_SELF_RECORD_POLICY_VERSION,
    providerRef: input.providerRef ?? "",
    purpose: MEMBER_MCP_PURPOSE,
    classifiedAt: input.classifiedAt.toISOString(),
    freshnessMinutes: Math.max(
      0,
      Math.floor((input.now.getTime() - input.classifiedAt.getTime()) / 60_000),
    ),
    deniedFields: [] as readonly string[],
  };
  if (!input.providerRef) {
    return { ...base, projection: null, blockReason: "provider_not_approved" };
  }
  return { ...base, projection: "remote_projected", blockReason: null };
}

// CAIO content served to a member (prompt summaries, evidence refs, later
// work packets) describes business objects, so it goes through the Member
// Gateway projection ladder (spec §8.2) with the owner-set tenant
// classification: unclassified never projects (classification_unknown),
// prohibited → LOCAL_VIEW_REQUIRED, local_only → metadata_only, and the
// provider must be on the tenant egress list. The read surface evidence is
// the member's own relationship to the record (their own queue), live
// membership and the connection scope; decideMemberReadSurface only accepts
// L1 tool names, so the brief's name stands in for these L3 reads.
export const MEMBER_MCP_CONTENT_POLICY_REF = "member-mcp:caio-content";
export const MEMBER_MCP_CONTENT_POLICY_VERSION = 1;

export function buildContentDecision(input: {
  workspaceId: string;
  memberRef: string;
  objectRef: string;
  connectionRef: string;
  scope: string;
  providerRef: string | null;
  classification: MemberObjectClassification | null;
  requestedFields: readonly string[];
  now: Date;
}): MemberProjectionDecision {
  const surface = decideMemberReadSurface({
    workspaceRef: input.workspaceId,
    memberRef: input.memberRef,
    objectRef: input.objectRef,
    tool: "get_my_brief",
    purpose: MEMBER_MCP_PURPOSE,
    liveMembershipRef: `live:${input.memberRef}`,
    toolScopeRef: `${input.connectionRef}#${input.scope}`,
    objectRelationshipAuthorizationRef: `addressee:${input.memberRef}`,
    fieldPurposePolicyRef: `${MEMBER_MCP_CONTENT_POLICY_REF}:v${MEMBER_MCP_CONTENT_POLICY_VERSION}`,
    sourceAuthorizationRef: input.connectionRef,
    tenantProviderEgressPolicyRef: input.providerRef,
    classification: input.classification,
  });
  const classifiedAtMs = input.classification ? Date.parse(input.classification.classifiedAt) : Number.NaN;
  return decideMemberProjection({
    surface,
    classification: input.classification,
    freshnessMinutes: Number.isFinite(classifiedAtMs)
      ? Math.max(0, Math.floor((input.now.getTime() - classifiedAtMs) / 60_000))
      : null,
    providerRef: input.providerRef,
    purpose: MEMBER_MCP_PURPOSE,
    projectionPolicyRef: MEMBER_MCP_CONTENT_POLICY_REF,
    projectionPolicyVersion: MEMBER_MCP_CONTENT_POLICY_VERSION,
    requestedFields: input.requestedFields,
  });
}

export const MEMBER_MCP_BLOCK_MESSAGES: Record<string, string> = {
  provider_not_approved: "This client type is not on the workspace's approved list.",
  classification_unknown: "The workspace has not classified CAIO content for member AI clients yet; read it in Helm.",
  LOCAL_VIEW_REQUIRED: "This content may only be viewed inside Helm.",
  read_surface_denied: "This content is not readable through this connection.",
  purpose_missing: "Read purpose missing.",
};

export class MemberMcpEnvelopeInvalidError extends Error {
  constructor(readonly errors: readonly string[]) {
    super(`member MCP envelope invalid: ${errors.join(", ")}`);
    this.name = "MemberMcpEnvelopeInvalidError";
  }
}

// Every envelope is validated before it leaves; an invalid one is a server
// bug and must never reach the client.
export function buildMemberMcpEnvelope<T>(input: {
  requestId: string;
  now: Date;
  decision: MemberProjectionDecision;
  data: T | null;
  error: { code: string; message: string; retryable: boolean } | null;
}): MemberToolEnvelope<T> {
  const envelope: MemberToolEnvelope<T> = {
    ok: input.error === null,
    requestId: input.requestId,
    serverTime: input.now.toISOString(),
    data: input.error === null ? input.data : null,
    error: input.error,
    boundary: {
      authorityEffect: "none",
      externalExecutionAllowed: false,
      decision: input.decision,
    },
  };
  const validation = validateMemberToolEnvelope(envelope);
  if (!validation.valid) throw new MemberMcpEnvelopeInvalidError(validation.errors);
  return envelope;
}
