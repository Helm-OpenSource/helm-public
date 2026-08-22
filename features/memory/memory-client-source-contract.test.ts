import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const memoryClientSource = readFileSync(
  join(process.cwd(), "features/memory/memory-client.tsx"),
  "utf8",
);

describe("memory client distillation review source contract", () => {
  it("renders a non-chat, review-only boundary for distillation candidates", () => {
    expect(memoryClientSource).toContain("Distillation candidate review");
    expect(memoryClientSource).toContain("does not create canonical MemoryFact");
    expect(memoryClientSource).toContain("promote memory");
    expect(memoryClientSource).toContain("execute actions");
    expect(memoryClientSource).toContain("change recommendation ranking");
    expect(memoryClientSource).toContain("This is not a chat surface");
  });

  it("keeps candidate decisions behind memory management permission", () => {
    expect(memoryClientSource).toContain("permissions.canManageMemoryFacts");
    expect(memoryClientSource).toContain("decision: \"approve\"");
    expect(memoryClientSource).toContain("decision: \"reject\"");
    expect(memoryClientSource).toContain("decision: \"defer\"");
  });
});

describe("memory client member signal verification source contract", () => {
  it("states the ruling-3 honesty boundary: verification confirms the signal, it does not write memory", () => {
    expect(memoryClientSource).toContain(
      "验证仅确认这是一条真实的成员信号，不构成记忆写入；记忆晋升是独立的后续能力。",
    );
    expect(memoryClientSource).toContain(
      "It does not write memory — memory promotion is a separate capability that has not shipped yet.",
    );
  });

  it("renders ruling-2 source-branched labels for member decisions, not the reflection family's status wording", () => {
    expect(memoryClientSource).toContain(
      "const memberSignalDecisionLabel = (status: string) => {",
    );
    expect(memoryClientSource).toContain("已验证为真实信号");
    expect(memoryClientSource).toContain("Verified as a genuine signal");
  });

  it("gates member signal verification two-level on canManageMemoryFacts: section stays visible, action gated with a denied message", () => {
    expect(memoryClientSource).toContain(
      "const memberSignalVerificationSection =",
    );
    expect(memoryClientSource).toContain(
      "memberSignalPending.length > 0 || memberSignalDecisions.length > 0",
    );
    expect(memoryClientSource).toContain(
      "verifyMemberSignalMemoryCandidateAction({",
    );
    expect(memoryClientSource).toContain('decision: "verify"');
    expect(memoryClientSource).toContain(
      "const memberSignalDeniedMessage = english",
    );
    expect(memoryClientSource).toContain("{memberSignalDeniedMessage}");
  });

  it("keeps the member signal section inside the frozen memoryLandingDeferredContext identifier", () => {
    expect(memoryClientSource).toContain(
      "const memoryLandingDeferredContext = (",
    );
    expect(memoryClientSource).toContain("{memberSignalVerificationSection}");
  });
});
