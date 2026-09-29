// lib/member-mcp/tools.ts
// Member MCP P0 tool surface: definitions, argument parsing and the Member
// Gateway envelope every tool result is wrapped in. Pure: no IO, no clock.

import { validateMemberToolEnvelope } from "@/lib/member-gateway/contract";
import type {
  MemberProjectionDecision,
  MemberToolEnvelope,
} from "@/lib/member-gateway/types";
import type { MemberMcpScope } from "@/lib/member-mcp/contract";

export const MEMBER_MCP_TOOL_NAMES = [
  "get_my_brief",
  "list_my_pending_prompts",
  "get_my_prompt",
] as const;

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
];

export type MemberMcpToolCall =
  | { toolName: "get_my_brief"; arguments: Record<string, never> }
  | {
      toolName: "list_my_pending_prompts";
      arguments: { limit: number; cursor: string | null };
    }
  | { toolName: "get_my_prompt"; arguments: { promptRef: string } };

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
  return { ok: false, message: "unknown tool" };
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
