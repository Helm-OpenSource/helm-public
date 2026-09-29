import { describe, expect, it } from "vitest";

import { validateMemberToolEnvelope } from "@/lib/member-gateway/contract";
import {
  MEMBER_MCP_TOOLS,
  buildMemberMcpEnvelope,
  buildSelfRecordDecision,
  parseMemberMcpToolCall,
} from "@/lib/member-mcp/tools";

const now = new Date("2026-09-29T08:00:00.000Z");

describe("parseMemberMcpToolCall", () => {
  it("accepts well-formed calls and applies the default limit", () => {
    expect(parseMemberMcpToolCall("get_my_brief", {})).toEqual({ ok: true, call: { toolName: "get_my_brief", arguments: {} } });
    expect(parseMemberMcpToolCall("list_my_pending_prompts", {})).toEqual({ ok: true, call: { toolName: "list_my_pending_prompts", arguments: { limit: 20, cursor: null } } });
    expect(parseMemberMcpToolCall("get_my_prompt", { promptRef: "prompt:abc-1" })).toEqual({ ok: true, call: { toolName: "get_my_prompt", arguments: { promptRef: "prompt:abc-1" } } });
  });

  it("rejects unknown tools, extra arguments and malformed values", () => {
    expect(parseMemberMcpToolCall("submit_prompt_response", {}).ok).toBe(false);
    expect(parseMemberMcpToolCall("get_my_brief", { memberRef: "someone-else" }).ok).toBe(false);
    expect(parseMemberMcpToolCall("list_my_pending_prompts", { limit: 0 }).ok).toBe(false);
    expect(parseMemberMcpToolCall("list_my_pending_prompts", { limit: 51 }).ok).toBe(false);
    expect(parseMemberMcpToolCall("list_my_pending_prompts", { limit: 2.5 }).ok).toBe(false);
    expect(parseMemberMcpToolCall("list_my_pending_prompts", { cursor: "a b" }).ok).toBe(false);
    expect(parseMemberMcpToolCall("get_my_prompt", {}).ok).toBe(false);
    expect(parseMemberMcpToolCall("get_my_prompt", { promptRef: "x", memberRef: "y" }).ok).toBe(false);
    expect(parseMemberMcpToolCall("get_my_brief", []).ok).toBe(false);
  });

  it("exposes only read tools in P0", () => {
    expect(MEMBER_MCP_TOOLS.map((tool) => tool.requiredScope).every((scope) => scope.endsWith(":read"))).toBe(true);
  });
});

describe("envelopes", () => {
  it("projects self records with complete decision evidence", () => {
    const decision = buildSelfRecordDecision({ providerRef: "member-mcp-client:codex", classifiedAt: new Date("2026-09-29T07:00:00.000Z"), now });
    expect(decision).toMatchObject({ projection: "remote_projected", blockReason: null, freshnessMinutes: 60 });
    const envelope = buildMemberMcpEnvelope({ requestId: "r1", now, decision, data: { a: 1 }, error: null });
    expect(envelope.ok).toBe(true);
    expect(envelope.boundary).toMatchObject({ authorityEffect: "none", externalExecutionAllowed: false });
    expect(validateMemberToolEnvelope(envelope).valid).toBe(true);
  });

  it("blocks with provider_not_approved and never releases data", () => {
    const decision = buildSelfRecordDecision({ providerRef: null, classifiedAt: now, now });
    expect(decision).toMatchObject({ projection: null, blockReason: "provider_not_approved", providerRef: "" });
    const envelope = buildMemberMcpEnvelope({
      requestId: "r2",
      now,
      decision,
      data: { leaked: true },
      error: { code: "provider_not_approved", message: "no", retryable: false },
    });
    expect(envelope.ok).toBe(false);
    expect(envelope.data).toBeNull();
  });

  it("refuses to build an envelope that releases data without a projection", () => {
    const decision = buildSelfRecordDecision({ providerRef: null, classifiedAt: now, now });
    expect(() => buildMemberMcpEnvelope({ requestId: "r3", now, decision, data: { leaked: true }, error: null })).toThrow(/data_released_without_projection/);
  });
});
