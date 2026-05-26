import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_INTERNAL_DOGFOOD_PACKET_INPUT,
  INTERNAL_DOGFOOD_PACKET_POSTURE,
  INTERNAL_DOGFOOD_PACKET_RULE_VERSION,
  INTERNAL_DOGFOOD_PACKET_RUNTIME_ADOPTION,
  POSITIVE_INTERNAL_DOGFOOD_PACKET_INPUT,
  buildInternalDogfoodPacket,
  type InternalDogfoodPacketInput,
} from "./internal-dogfood-packet";

function build(patch: Partial<InternalDogfoodPacketInput> = {}) {
  return buildInternalDogfoodPacket({
    ...POSITIVE_INTERNAL_DOGFOOD_PACKET_INPUT,
    ...patch,
  });
}

describe("internal dogfood packet constants", () => {
  it("keeps the packet disabled-internal-only and runtime adoption no-go", () => {
    expect(INTERNAL_DOGFOOD_PACKET_RULE_VERSION).toBe(
      "business-advancement-internal-dogfood-packet/v1",
    );
    expect(INTERNAL_DOGFOOD_PACKET_POSTURE).toBe(
      "Disabled-Internal-Dogfooding-Only",
    );
    expect(INTERNAL_DOGFOOD_PACKET_RUNTIME_ADOPTION).toBe("No-Go");
  });
});

describe("buildInternalDogfoodPacket", () => {
  it("defaults to Blocked without operator context and founder gate approval", () => {
    const packet = buildInternalDogfoodPacket(DEFAULT_INTERNAL_DOGFOOD_PACKET_INPUT);

    expect(packet.decision).toBe("Blocked");
    expect(packet.productionQueryAdoptionAllowed).toBe(false);
    expect(packet.runtimeIntegrationAllowed).toBe(false);
    expect(packet.publicTrialAllowed).toBe(false);
    expect(packet.blockers.join("\n")).toContain("preparer");
    expect(packet.blockers.join("\n")).toContain("Founder internal gate");
  });

  it("builds a review-only internal dogfooding packet from positive evidence", () => {
    const packet = buildInternalDogfoodPacket(POSITIVE_INTERNAL_DOGFOOD_PACKET_INPUT);

    expect(packet.decision).toBe("Ready-For-Internal-Dogfooding");
    expect(packet.runtimeAdoption).toBe("No-Go");
    expect(packet.productionQueryAdoptionAllowed).toBe(false);
    expect(packet.runtimeIntegrationAllowed).toBe(false);
    expect(packet.publicTrialAllowed).toBe(false);
    expect(packet.candidateGroups).toHaveLength(3);
    expect(packet.candidateGroups.reduce((sum, group) => sum + group.includedCount, 0)).toBe(4);
    expect(packet.blockers).toEqual([]);
  });

  it("requires strict operator timestamp", () => {
    const packet = build({
      operatorContext: {
        ...POSITIVE_INTERNAL_DOGFOOD_PACKET_INPUT.operatorContext,
        preparedAtIso: "April 30 2026",
      },
    });

    expect(packet.decision).toBe("Blocked");
    expect(packet.blockers.join("\n")).toContain("strict UTC timestamp");
  });

  it("blocks if founder gate is not ready", () => {
    const packet = build({
      founderGate: DEFAULT_INTERNAL_DOGFOOD_PACKET_INPUT.founderGate,
    });

    expect(packet.decision).toBe("Blocked");
    expect(packet.blockers.join("\n")).toContain("Founder internal gate");
  });

  it("blocks if there are no included candidates", () => {
    const packet = build({
      prototypeInput: {
        ...POSITIVE_INTERNAL_DOGFOOD_PACKET_INPUT.prototypeInput,
        rows: {},
      },
    });

    expect(packet.decision).toBe("Blocked");
    expect(packet.blockers.join("\n")).toContain("at least one included candidate");
  });

  it("blocks if any Phase 3M family is not evaluated", () => {
    const packet = build({
      prototypeInput: {
        ...POSITIVE_INTERNAL_DOGFOOD_PACKET_INPUT.prototypeInput,
        flags: {
          ...POSITIVE_INTERNAL_DOGFOOD_PACKET_INPUT.prototypeInput.flags,
          tpqr004: false,
        },
      },
    });

    expect(packet.decision).toBe("Blocked");
    expect(packet.blockers.join("\n")).toContain("Phase 3M prototype");
    expect(packet.productionQueryAdoptionAllowed).toBe(false);
    expect(packet.runtimeIntegrationAllowed).toBe(false);
  });

  it("keeps candidate groups review-only with visible boundary notes", () => {
    const packet = buildInternalDogfoodPacket(POSITIVE_INTERNAL_DOGFOOD_PACKET_INPUT);

    for (const group of packet.candidateGroups) {
      expect(group.reviewOnlyAction.toLowerCase()).toContain("review");
      expect(group.boundaryNote.toLowerCase()).toContain("review only");
    }
  });

  it("does not import production query, mobile, app, db, prisma, fs or network modules", () => {
    const source = readFileSync(
      "features/business-advancement/internal-dogfood-packet.ts",
      "utf8",
    );

    const importLines = source
      .split("\n")
      .filter((line) => line.trim().startsWith("import "));

    expect(importLines.join("\n")).not.toContain("@/");
    expect(importLines.join("\n")).not.toContain("data/queries");
    expect(importLines.join("\n")).not.toContain("features/mobile");
    expect(importLines.join("\n")).not.toContain("app/");
    expect(importLines.join("\n")).not.toContain("prisma");
    expect(importLines.join("\n")).not.toContain("from \"fs\"");
    expect(source).not.toContain("fetch(");
  });
});
