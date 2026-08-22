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
  it("states the Architecture 5 write-on-verify copy: verify confirms AND writes runtime memory with a permanent taint tag; reject writes nothing", () => {
    expect(memoryClientSource).toContain(
      "验证会确认这是一条真实的成员信号，并将其写入运行时记忆",
    );
    expect(memoryClientSource).toContain("未信任 · 成员上行");
    expect(memoryClientSource).toContain("拒绝则不写入任何内容。");
    expect(memoryClientSource).toContain(
      "Verifying confirms this is a genuine member signal and writes it into runtime memory",
    );
    expect(memoryClientSource).toContain("Rejecting writes nothing.");
  });

  it("labels the verify button as writing memory, not just confirming", () => {
    expect(memoryClientSource).toContain('{english ? "Verify & write" : "验证并写入"}');
  });

  it("renders ruling-2 source-branched labels for member decisions, not the reflection family's status wording — PROMOTED (write-on-verify) reads differently from a legacy un-written VERIFIED row", () => {
    expect(memoryClientSource).toContain(
      "const memberSignalDecisionLabel = (status: string) => {",
    );
    expect(memoryClientSource).toContain("已验证并写入记忆");
    expect(memoryClientSource).toContain("Verified & written to memory");
    expect(memoryClientSource).toContain("已验证(旧流程,未写入)");
    expect(memoryClientSource).toContain("Verified (legacy, not written)");
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
