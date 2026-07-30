import { describe, expect, it } from "vitest";

import {
  WORKBUDDY_DELIVERY_TOOL_NAMES,
  WORKBUDDY_MUTATION_TOOL_NAMES,
  WORKBUDDY_READ_TOOL_NAMES,
} from "@/lib/caio-collaboration/tool-schemas";
import { CaioAccessGatewayError } from "@/lib/caio-access-gateway/gateway-error-contract";
import {
  CAIO_GATEWAY_ALLOWED_TOOL_NAMES,
  CAIO_GATEWAY_CAPABILITY_KEYS,
  CAIO_GATEWAY_FORBIDDEN_TOOL_NAME_PATTERNS,
  CAIO_GATEWAY_INTENDED_MUTATION_TOOL_NAMES,
  CAIO_GATEWAY_TOOLS_BY_CAPABILITY,
  CAIO_GATEWAY_WRITING_TOOL_NAMES,
  assertToolAllowed,
  capabilityForCaioTool,
  filterToolDefinitions,
  isCaioToolAllowed,
} from "@/lib/caio-access-gateway/mcp-allowlist";

function expectScopeViolation(work: () => void): void {
  try {
    work();
    throw new Error("Expected scope_violation.");
  } catch (error) {
    expect(error).toBeInstanceOf(CaioAccessGatewayError);
    expect((error as CaioAccessGatewayError).code).toBe("scope_violation");
    expect((error as CaioAccessGatewayError).wireStatus).toBe(403);
  }
}

describe("caio gateway capability allowlist", () => {
  it("grants exactly the v1 capability keys", () => {
    expect(CAIO_GATEWAY_CAPABILITY_KEYS).toEqual([
      "caio.p1c.read",
      "caio.delivery.read",
      "caio.context_receipt.read",
      "caio.memory_candidate.query",
      "caio.memory_candidate.adopt",
      "caio.memory_candidate.reject",
      "caio.candidate.submit_restricted",
    ]);
  });

  it("every allowlisted tool maps to an intended capability key and is not a forbidden name", () => {
    const intended = new Set<string>(CAIO_GATEWAY_INTENDED_MUTATION_TOOL_NAMES);
    for (const name of CAIO_GATEWAY_ALLOWED_TOOL_NAMES) {
      const capability = capabilityForCaioTool(name);
      expect(capability).not.toBeNull();
      expect(CAIO_GATEWAY_CAPABILITY_KEYS).toContain(capability);
      if (intended.has(name)) continue;
      for (const pattern of CAIO_GATEWAY_FORBIDDEN_TOOL_NAME_PATTERNS) {
        expect(
          pattern.test(name),
          `allowlisted tool ${name} matches forbidden pattern ${String(pattern)}`,
        ).toBe(false);
      }
    }
  });

  it("only the three intended memory-candidate mutations may carry a mutation name", () => {
    expect(CAIO_GATEWAY_INTENDED_MUTATION_TOOL_NAMES).toEqual([
      "adopt_memory_candidate",
      "reject_memory_candidate",
      "submit_restricted_candidate",
    ]);
    for (const name of CAIO_GATEWAY_INTENDED_MUTATION_TOOL_NAMES) {
      const capability = capabilityForCaioTool(name);
      expect([
        "caio.memory_candidate.adopt",
        "caio.memory_candidate.reject",
        "caio.candidate.submit_restricted",
      ]).toContain(capability);
    }
  });

  it("refuses every in-tree tool whose executor performs a write", () => {
    // poll_ceo_prompts writes: it claims prompts (delivery.service claimedAt),
    // records presentations (presentedAt) and transitions envelopes to
    // "delivered". A read capability must never map onto it.
    expect(CAIO_GATEWAY_WRITING_TOOL_NAMES).toContain("poll_ceo_prompts");
    for (const name of CAIO_GATEWAY_WRITING_TOOL_NAMES) {
      expect(isCaioToolAllowed(name)).toBe(false);
      expectScopeViolation(() => assertToolAllowed(name));
    }
    for (const capability of CAIO_GATEWAY_CAPABILITY_KEYS) {
      for (const name of CAIO_GATEWAY_TOOLS_BY_CAPABILITY[capability]) {
        expect(CAIO_GATEWAY_WRITING_TOOL_NAMES).not.toContain(name);
      }
    }
  });

  it("maps p1c/delivery read onto existing dispatcher read tools", () => {
    for (const name of CAIO_GATEWAY_TOOLS_BY_CAPABILITY["caio.p1c.read"]) {
      expect(WORKBUDDY_READ_TOOL_NAMES).toContain(name);
    }
    for (const name of CAIO_GATEWAY_TOOLS_BY_CAPABILITY[
      "caio.delivery.read"
    ]) {
      expect(WORKBUDDY_DELIVERY_TOOL_NAMES).toContain(name);
    }
  });

  it("defines new tool names for context receipts, memory candidates, and restricted submit", () => {
    expect(
      CAIO_GATEWAY_TOOLS_BY_CAPABILITY["caio.context_receipt.read"],
    ).toEqual(["list_context_receipts", "get_context_receipt"]);
    expect(
      CAIO_GATEWAY_TOOLS_BY_CAPABILITY["caio.memory_candidate.query"],
    ).toEqual(["query_memory_candidates"]);
    expect(
      CAIO_GATEWAY_TOOLS_BY_CAPABILITY["caio.memory_candidate.adopt"],
    ).toEqual(["adopt_memory_candidate"]);
    expect(
      CAIO_GATEWAY_TOOLS_BY_CAPABILITY["caio.memory_candidate.reject"],
    ).toEqual(["reject_memory_candidate"]);
    expect(
      CAIO_GATEWAY_TOOLS_BY_CAPABILITY["caio.candidate.submit_restricted"],
    ).toEqual(["submit_restricted_candidate"]);
    for (const name of [
      "list_context_receipts",
      "get_context_receipt",
      "query_memory_candidates",
      "adopt_memory_candidate",
      "reject_memory_candidate",
      "submit_restricted_candidate",
    ]) {
      expect(capabilityForCaioTool(name)).not.toBeNull();
    }
  });

  it("rejects unknown tools with scope_violation", () => {
    expect(isCaioToolAllowed("totally_unknown_tool")).toBe(false);
    expectScopeViolation(() => assertToolAllowed("totally_unknown_tool"));
    expectScopeViolation(() => assertToolAllowed(""));
    expect(capabilityForCaioTool("totally_unknown_tool")).toBeNull();
  });

  it("rejects every dispatcher mutation tool (prepare_/submit_ pairs)", () => {
    for (const name of WORKBUDDY_MUTATION_TOOL_NAMES) {
      expect(isCaioToolAllowed(name)).toBe(false);
      expectScopeViolation(() => assertToolAllowed(name));
    }
  });

  it("rejects presence, approval, send, and production-write tool names", () => {
    const forbidden = [
      "begin_owner_presence_challenge",
      "complete_owner_presence_challenge",
      "approve_advice_decision",
      "approve_release",
      "send_email",
      "send_message",
      "prepare_prompt_response",
      "submit_prompt_response",
      "submit_question_selection",
      "submit_advice_decision",
      "delete_memory_entry",
      "write_production_record",
    ];
    for (const name of forbidden) {
      expect(isCaioToolAllowed(name)).toBe(false);
      expectScopeViolation(() => assertToolAllowed(name));
    }
  });

  it("accepts every allowlisted tool name", () => {
    for (const name of CAIO_GATEWAY_ALLOWED_TOOL_NAMES) {
      expect(isCaioToolAllowed(name)).toBe(true);
      expect(() => assertToolAllowed(name)).not.toThrow();
    }
    // No tool name is mapped twice across capabilities.
    const flattened = CAIO_GATEWAY_CAPABILITY_KEYS.flatMap(
      (key) => CAIO_GATEWAY_TOOLS_BY_CAPABILITY[key],
    );
    expect(new Set(flattened).size).toBe(flattened.length);
    expect(CAIO_GATEWAY_ALLOWED_TOOL_NAMES).toHaveLength(flattened.length);
  });

  it("filterToolDefinitions drops everything not allowlisted", () => {
    const tools = [
      { name: "get_p1c_read_projection", description: "read" },
      { name: "poll_ceo_prompts", description: "delivery (writes)" },
      { name: "submit_prompt_response", description: "mutation" },
      { name: "begin_owner_presence_challenge", description: "presence" },
      { name: "approve_everything", description: "forbidden" },
      { name: "query_memory_candidates", description: "new read" },
    ];
    const filtered = filterToolDefinitions(tools);
    expect(filtered.map((tool) => tool.name)).toEqual([
      "get_p1c_read_projection",
      "query_memory_candidates",
    ]);
  });
});
