import { describe, expect, it } from "vitest";

import { validateMemberToolEnvelope } from "@/lib/member-gateway/contract";
import {
  MEMBER_MCP_TOOLS,
  buildMemberMcpEnvelope,
  buildFieldReportPayload,
  buildSelfRecordDecision,
  parseMemberMcpToolCall,
  type MemberFieldReportInput,
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

  it("gates every write tool behind a write scope", () => {
    const byName = Object.fromEntries(MEMBER_MCP_TOOLS.map((tool) => [tool.name, tool.requiredScope]));
    expect(byName).toEqual({
      get_my_brief: "member:brief:read",
      list_my_pending_prompts: "member:prompt:read",
      get_my_prompt: "member:prompt:read",
      prepare_work_signal: "member:signal:write",
      submit_work_signal: "member:signal:write",
      prepare_field_report: "member:report:write",
      submit_field_report: "member:report:write",
      prepare_prompt_response: "member:prompt:respond",
      submit_prompt_response: "member:prompt:respond",
      get_prompt_response_status: "member:prompt:respond",
    });
  });

  it("parses work-signal calls and requires the challenge on submit", () => {
    expect(parseMemberMcpToolCall("prepare_work_signal", { kind: "blocker", summary: "  外呼线路今天下午中断 " })).toEqual({
      ok: true,
      call: { toolName: "prepare_work_signal", arguments: { kind: "blocker", summary: "外呼线路今天下午中断", detail: "" } },
    });
    expect(parseMemberMcpToolCall("submit_work_signal", { kind: "blocker", summary: "x" }).ok).toBe(false);
    expect(parseMemberMcpToolCall("submit_work_signal", { kind: "blocker", summary: "x", challengeRef: "c-1" })).toMatchObject({ ok: true });
    expect(parseMemberMcpToolCall("prepare_work_signal", { kind: "decision", summary: "x" }).ok).toBe(false);
    expect(parseMemberMcpToolCall("prepare_work_signal", { kind: "progress", summary: "" }).ok).toBe(false);
    expect(parseMemberMcpToolCall("prepare_work_signal", { kind: "progress", summary: "a\u0007b" }).ok).toBe(false);
    expect(parseMemberMcpToolCall("prepare_work_signal", { kind: "progress", summary: "x", relatedEvidenceRefs: ["e"] }).ok).toBe(false);
  });

  it("parses field reports and rejects malformed metrics", () => {
    const ok = parseMemberMcpToolCall("prepare_field_report", {
      kind: "shadow_check",
      title: "今日影子核对",
      metrics: [{ key: "qc.connect_rate", value: 0.31, unit: "ratio", window: "2026-09-29" }],
      text: "接通率偏低",
    });
    expect(ok).toMatchObject({ ok: true, call: { arguments: { metrics: [{ key: "qc.connect_rate", value: 0.31, unit: "ratio", window: "2026-09-29", source_ref: null }] } } });
    expect(parseMemberMcpToolCall("prepare_field_report", { kind: "gossip", title: "x" }).ok).toBe(false);
    expect(parseMemberMcpToolCall("prepare_field_report", { kind: "data_quality", title: "x", metrics: [{ key: "a", value: "1" }] }).ok).toBe(false);
    expect(parseMemberMcpToolCall("prepare_field_report", { kind: "data_quality", title: "x", metrics: [{ key: "a", value: Number.NaN }] }).ok).toBe(false);
    expect(parseMemberMcpToolCall("prepare_field_report", { kind: "data_quality", title: "x", metrics: [{ key: "a", value: 1, note: "y" }] }).ok).toBe(false);
    expect(parseMemberMcpToolCall("prepare_field_report", { kind: "data_quality", title: "x", metrics: Array.from({ length: 21 }, () => ({ key: "a", value: 1 })) }).ok).toBe(false);
  });
});

describe("buildFieldReportPayload", () => {
  const report = (overrides: Partial<MemberFieldReportInput> = {}): MemberFieldReportInput => ({
    kind: "shadow_check",
    title: "今日影子核对",
    metrics: [{ key: "qc.connect_rate", value: 0.31, unit: "ratio", window: "2026-09-29", source_ref: null }],
    text: "接通率偏低",
    ...overrides,
  });

  it("embeds the structured part as one canonical block and keeps text separate", () => {
    const built = buildFieldReportPayload(report(), ["qc.connect_rate"]);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.payload.kind).toBe("progress");
    expect(built.payload.summary).toBe("现场报告·影子核对：今日影子核对");
    expect(built.payload.relatedEvidenceRefs).toEqual([]);
    const [open, json, close, ...rest] = built.payload.detail.split("\n");
    expect(open).toBe("```helm-field-report/v1");
    expect(JSON.parse(json)).toEqual({ kind: "shadow_check", metrics: [{ key: "qc.connect_rate", value: 0.31, unit: "ratio", window: "2026-09-29", source_ref: null }] });
    expect(close).toBe("```");
    expect(rest.join("\n")).toBe("接通率偏低");
    // Deterministic: the same input hashes the same at prepare and submit.
    expect(buildFieldReportPayload(report(), ["qc.connect_rate"])).toEqual(built);
  });

  it("maps case observations to customer signals", () => {
    const built = buildFieldReportPayload(report({ kind: "case_observation", metrics: [] }), []);
    expect(built.ok && built.payload.kind).toBe("customer_signal");
  });

  it("rejects metric keys that are not registered, and all metrics when none are", () => {
    expect(buildFieldReportPayload(report(), ["qc.other"])).toMatchObject({ ok: false, message: expect.stringContaining("qc.connect_rate") });
    expect(buildFieldReportPayload(report(), [])).toMatchObject({ ok: false, message: expect.stringContaining("text only") });
    expect(buildFieldReportPayload(report({ metrics: [] }), []).ok).toBe(true);
  });

  it("rejects a report whose detail would exceed the signal limit", () => {
    expect(buildFieldReportPayload(report({ metrics: [], text: "字".repeat(3990) }), []).ok).toBe(false);
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

describe("prompt response tool parsing", () => {
  it("accepts responses and requires a reason for protected kinds", () => {
    expect(parseMemberMcpToolCall("prepare_prompt_response", { promptRef: "p-1", kind: "acknowledge" })).toEqual({
      ok: true,
      call: { toolName: "prepare_prompt_response", arguments: { promptRef: "p-1", kind: "acknowledge", text: "" } },
    });
    expect(parseMemberMcpToolCall("prepare_prompt_response", { promptRef: "p-1", kind: "refuse" })).toEqual({ ok: false, message: "reason_required" });
    expect(parseMemberMcpToolCall("prepare_prompt_response", { promptRef: "p-1", kind: "commitment_confirm", text: "x" }).ok).toBe(false);
    expect(parseMemberMcpToolCall("submit_prompt_response", { promptRef: "p-1", kind: "pause", text: "出差" }).ok).toBe(false);
    expect(
      parseMemberMcpToolCall("submit_prompt_response", { promptRef: "p-1", kind: "pause", text: " 出差 ", challengeRef: "c-1" }),
    ).toEqual({
      ok: true,
      call: { toolName: "submit_prompt_response", arguments: { promptRef: "p-1", kind: "pause", text: "出差", challengeRef: "c-1" } },
    });
    expect(parseMemberMcpToolCall("get_prompt_response_status", { inboxRef: "mmcp-inbox:c-1" }).ok).toBe(true);
    expect(parseMemberMcpToolCall("get_prompt_response_status", { inboxRef: "x", extra: 1 }).ok).toBe(false);
  });

  it("puts every response tool behind member:prompt:respond", () => {
    const names = ["prepare_prompt_response", "submit_prompt_response", "get_prompt_response_status"];
    for (const name of names) {
      expect(MEMBER_MCP_TOOLS.find((tool) => tool.name === name)?.requiredScope).toBe("member:prompt:respond");
    }
  });
});

