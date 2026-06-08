import { describe, it, expect } from "vitest";
import {
  agentImplementationModeSchema,
  agentImplementationRiskSchema,
  agentRedactionStatusSchema,
  worktreeProfileSchema,
  AGENT_FORBIDDEN_RISKS,
  AGENT_PUBLIC_CORE_AUTOMATABLE_RISKS,
  AGENT_REDACTION_SAFE,
  isRedactionSafe,
} from "./contracts";
import { diagnosticCommandRiskSchema } from "../diagnostics/command-registry";
import { redactionStatusSchema } from "../diagnostics/doctor-packet";

describe("agentic closed-set vocabulary", () => {
  it("modes and worktree profiles are the documented closed sets", () => {
    expect(agentImplementationModeSchema.options).toEqual([
      "explore",
      "specify",
      "implement",
      "validate",
      "review",
      "handoff",
    ]);
    expect(worktreeProfileSchema.options).toContain("repo_write_reviewed");
    expect(worktreeProfileSchema.options).toContain("external_write_forbidden");
  });

  it("AgentImplementationRisk equals the merged DiagnosticCommandRisk (#177) — no fork", () => {
    expect([...agentImplementationRiskSchema.options].sort()).toEqual(
      [...diagnosticCommandRiskSchema.options].sort(),
    );
  });

  it("forbidden and automatable risk sets are disjoint and correct", () => {
    expect([...AGENT_FORBIDDEN_RISKS].sort()).toEqual(["activation", "commitment", "external_write"]);
    expect([...AGENT_PUBLIC_CORE_AUTOMATABLE_RISKS].sort()).toEqual(["local_draft", "read"]);
    for (const r of AGENT_FORBIDDEN_RISKS) {
      expect(AGENT_PUBLIC_CORE_AUTOMATABLE_RISKS.has(r)).toBe(false);
    }
  });

  it("AgentRedactionStatus equals the canonical doctor-packet RedactionStatus — no fork", () => {
    expect([...agentRedactionStatusSchema.options].sort()).toEqual(
      [...redactionStatusSchema.options].sort(),
    );
    expect(agentRedactionStatusSchema.safeParse("raw_blocked").success).toBe(false);
    expect(agentRedactionStatusSchema.safeParse("unknown_blocked").success).toBe(false);
  });

  it("only synthetic/redacted/alias_only are redaction-safe", () => {
    expect([...AGENT_REDACTION_SAFE].sort()).toEqual(["alias_only", "redacted", "synthetic"]);
    expect(isRedactionSafe("raw_private_rejected")).toBe(false);
    expect(isRedactionSafe("unknown")).toBe(false);
  });
});
