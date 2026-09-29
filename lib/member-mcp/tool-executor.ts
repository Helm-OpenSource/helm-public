import "server-only";

import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import type { MemberProjectionDecision, MemberToolEnvelope } from "@/lib/member-gateway/types";
import type { MemberMcpAuthContext } from "@/lib/member-mcp/connection-service";
import { memberMcpProviderRef, memberRefForUser } from "@/lib/member-mcp/contract";
import { executeMemberPromptResponse } from "@/lib/member-mcp/response-intake";
import { executeMemberTaskTool } from "@/lib/member-mcp/task-executor";
import { executeMemberMcpWrite } from "@/lib/member-mcp/write-executor";
import {
  MEMBER_MCP_BLOCK_MESSAGES,
  buildContentDecision,
  buildMemberMcpEnvelope,
  buildSelfRecordDecision,
  type MemberMcpToolCall,
} from "@/lib/member-mcp/tools";

// Prompt rows are read directly rather than through prompt-store.service: that
// module reaches lib/caio-governance, which API code must not depend on
// (authority firewall, scripts/check-caio-terminology.ts).

// Unanswered prompts. "pending" (not yet delivered) is included: the member
// pulling their own queue is not an interruption, so quiet-hour holds do not
// apply to it. Listing never transitions a prompt; delivery receipts arrive
// with poll_my_prompts in P1.
const OPEN_PROMPT_STATES = ["pending", "delivered", "snoozed"] as const;

export async function executeMemberMcpTool(input: {
  auth: MemberMcpAuthContext;
  call: MemberMcpToolCall;
  now?: Date;
}): Promise<MemberToolEnvelope<unknown>> {
  const now = input.now ?? new Date();
  const requestId = `mmcp_${randomUUID()}`;
  const providerRef = memberMcpProviderRef(input.auth.clientType, input.auth.approvedClients);
  if (!providerRef) {
    return buildMemberMcpEnvelope({
      requestId,
      now,
      decision: buildSelfRecordDecision({ providerRef: null, classifiedAt: now, now }),
      data: null,
      error: {
        code: "provider_not_approved",
        message: "This client type is not on the workspace's approved list.",
        retryable: false,
      },
    });
  }
  const memberRef = memberRefForUser(input.auth.userId);
  const call = input.call;
  const contentDecision = (objectRef: string, fields: readonly string[]) =>
    buildContentDecision({
      workspaceId: input.auth.workspaceId,
      memberRef,
      objectRef,
      connectionRef: `member-mcp-connection:${input.auth.connectionId}`,
      scope: "member:prompt:read",
      providerRef,
      classification: input.auth.contentClassification,
      requestedFields: fields,
      now,
    });
  const blocked = (decision: MemberProjectionDecision) => {
    // Without an owner classification the surface denies on
    // current_classification; name that cause for the member.
    const code = input.auth.contentClassification === null ? "classification_unknown" : (decision.blockReason ?? "blocked");
    return buildMemberMcpEnvelope({
      requestId,
      now,
      decision,
      data: null,
      error: { code, message: MEMBER_MCP_BLOCK_MESSAGES[code] ?? "Content is not projectable.", retryable: false },
    });
  };

  if (call.toolName === "get_my_brief") {
    const [membership, workspace, counts] = await Promise.all([
      db.membership.findUnique({
        where: { workspaceId_userId: { workspaceId: input.auth.workspaceId, userId: input.auth.userId } },
        select: { role: true, title: true, groupTag: true, user: { select: { name: true } } },
      }),
      db.workspace.findUnique({ where: { id: input.auth.workspaceId }, select: { name: true } }),
      db.memberPrompt.groupBy({
        by: ["state"],
        where: {
          workspaceId: input.auth.workspaceId,
          memberRef,
          state: { in: [...OPEN_PROMPT_STATES] },
          expiresAt: { gt: now },
        },
        _count: { _all: true },
      }),
    ]);
    const byState = Object.fromEntries(OPEN_PROMPT_STATES.map((state) => [state, 0])) as Record<
      (typeof OPEN_PROMPT_STATES)[number],
      number
    >;
    for (const row of counts) {
      if ((OPEN_PROMPT_STATES as readonly string[]).includes(row.state)) {
        byState[row.state as (typeof OPEN_PROMPT_STATES)[number]] = row._count._all;
      }
    }
    return buildMemberMcpEnvelope({
      requestId,
      now,
      decision: buildSelfRecordDecision({ providerRef, classifiedAt: now, now }),
      data: {
        me: {
          name: membership?.user.name ?? null,
          role: membership?.role ?? null,
          title: membership?.title ?? null,
          groupTag: membership?.groupTag ?? null,
        },
        workspace: { name: workspace?.name ?? null },
        connection: {
          clientType: input.auth.clientType,
          deviceLabel: input.auth.deviceLabel,
          scopes: input.auth.scopes,
          expiresAt: input.auth.expiresAt.toISOString(),
        },
        prompts: {
          openTotal: byState.pending + byState.delivered + byState.snoozed,
          byState,
        },
        dataAsOf: now.toISOString(),
        boundary: input.auth.scopes.includes("member:signal:write") || input.auth.scopes.includes("member:report:write")
          ? "可读取；可提交工作信号与现场报告（待审阅候选）。回应提问与任务回执将在后续阶段开放。"
          : "只读。提交反馈需申请写入权限；回应提问与任务回执将在后续阶段开放。",
      },
      error: null,
    });
  }

  if (call.toolName === "list_my_pending_prompts") {
    const baseWhere = {
      workspaceId: input.auth.workspaceId,
      memberRef,
      state: { in: [...OPEN_PROMPT_STATES] },
      expiresAt: { gt: now },
    };
    let cursorWhere = {};
    if (call.arguments.cursor) {
      const anchor = await db.memberPrompt.findFirst({
        where: { ...baseWhere, id: call.arguments.cursor },
        select: { id: true, issuedAt: true },
      });
      if (!anchor) {
        return buildMemberMcpEnvelope({
          requestId,
          now,
          decision: buildSelfRecordDecision({ providerRef, classifiedAt: now, now }),
          data: null,
          error: { code: "cursor_invalid", message: "Cursor no longer points into the queue.", retryable: false },
        });
      }
      cursorWhere = {
        OR: [
          { issuedAt: { lt: anchor.issuedAt } },
          { issuedAt: anchor.issuedAt, id: { lt: anchor.id } },
        ],
      };
    }
    const rows = await db.memberPrompt.findMany({
      where: { ...baseWhere, ...cursorWhere },
      orderBy: [{ issuedAt: "desc" }, { id: "desc" }],
      take: call.arguments.limit + 1,
      select: {
        id: true,
        severity: true,
        subjectObjectRef: true,
        projectedSummary: true,
        state: true,
        version: true,
        issuedAt: true,
        expiresAt: true,
        snoozeUntil: true,
      },
    });
    const page = rows.slice(0, call.arguments.limit);
    const decision = contentDecision("member-prompt-queue", PROMPT_FIELDS);
    if (decision.projection === null) return blocked(decision);
    if (decision.projection === "metadata_only") {
      return buildMemberMcpEnvelope({
        requestId,
        now,
        decision,
        data: {
          items: page.map((row) => promptMetadata(row.id, decision)),
          nextCursor: rows.length > call.arguments.limit ? (page.at(-1)?.id ?? null) : null,
        },
        error: null,
      });
    }
    return buildMemberMcpEnvelope({
      requestId,
      now,
      decision,
      data: {
        items: page.map((row) => ({
          promptRef: row.id,
          severity: row.severity,
          subjectObjectRef: row.subjectObjectRef,
          summary: row.projectedSummary,
          state: row.state,
          version: row.version,
          issuedAt: row.issuedAt.toISOString(),
          expiresAt: row.expiresAt.toISOString(),
          snoozeUntil: row.snoozeUntil?.toISOString() ?? null,
        })),
        nextCursor: rows.length > call.arguments.limit ? (page.at(-1)?.id ?? null) : null,
      },
      error: null,
    });
  }

  if (
    call.toolName === "prepare_work_signal" ||
    call.toolName === "submit_work_signal" ||
    call.toolName === "prepare_field_report" ||
    call.toolName === "submit_field_report"
  ) {
    return executeMemberMcpWrite({ auth: input.auth, call, providerRef, requestId, now });
  }

  if (
    call.toolName === "prepare_prompt_response" ||
    call.toolName === "submit_prompt_response" ||
    call.toolName === "get_prompt_response_status"
  ) {
    return executeMemberPromptResponse({ auth: input.auth, call, providerRef, requestId, now });
  }

  if (
    call.toolName === "list_my_tasks" ||
    call.toolName === "get_task" ||
    call.toolName === "prepare_task_report" ||
    call.toolName === "submit_task_report"
  ) {
    return executeMemberTaskTool({ auth: input.auth, call, providerRef, requestId, now });
  }

  const row = await db.memberPrompt.findUnique({
    where: { id_workspaceId: { id: call.arguments.promptRef, workspaceId: input.auth.workspaceId } },
  });
  const evidenceRefs = row ? parseEvidenceRefs(row.evidenceRefsJson) : null;
  // A prompt addressed to someone else is indistinguishable from a missing one.
  if (!row || row.memberRef !== memberRef || evidenceRefs === null) {
    return buildMemberMcpEnvelope({
      requestId,
      now,
      decision: buildSelfRecordDecision({ providerRef, classifiedAt: now, now }),
      data: null,
      error: { code: "prompt_not_found", message: "No such prompt for this member.", retryable: false },
    });
  }
  const decision = contentDecision(row.id, PROMPT_FIELDS);
  if (decision.projection === null) return blocked(decision);
  if (decision.projection === "metadata_only") {
    return buildMemberMcpEnvelope({ requestId, now, decision, data: promptMetadata(row.id, decision), error: null });
  }
  return buildMemberMcpEnvelope({
    requestId,
    now,
    decision,
    data: {
      promptRef: row.id,
      severity: row.severity,
      severityRuleRef: row.severityRuleRef,
      subjectObjectRef: row.subjectObjectRef,
      summary: row.projectedSummary,
      evidenceRefs,
      state: row.state,
      version: row.version,
      issuedAt: row.issuedAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      snoozeUntil: row.snoozeUntil?.toISOString() ?? null,
    },
    error: null,
  });
}

const PROMPT_FIELDS = [
  "promptRef",
  "severity",
  "severityRuleRef",
  "subjectObjectRef",
  "summary",
  "evidenceRefs",
  "state",
  "version",
  "issuedAt",
  "expiresAt",
  "snoozeUntil",
] as const;

// metadata_only is the spec's field whitelist (METADATA_ONLY_FIELD_WHITELIST):
// the member learns a prompt exists and must be read inside Helm.
function promptMetadata(promptRef: string, decision: MemberProjectionDecision) {
  return {
    objectKind: "member_prompt",
    evidenceRef: promptRef,
    classifiedAt: decision.classifiedAt,
    freshness: decision.freshnessMinutes,
    requiresLocalView: true,
  };
}

// Same corruption guard as the prompt store: evidence refs must be a JSON
// array of strings, otherwise the row is not served.
function parseEvidenceRefs(value: string): string[] | null {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((item) => typeof item === "string") ? parsed : null;
  } catch {
    return null;
  }
}
