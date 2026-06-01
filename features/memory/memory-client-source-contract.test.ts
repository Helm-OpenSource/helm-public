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
