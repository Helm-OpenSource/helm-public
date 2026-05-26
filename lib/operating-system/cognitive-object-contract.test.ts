import { describe, expect, it } from "vitest";

import {
  getHelmCognitiveObjectDefinition,
  helmCognitiveObjectDefinitions,
  helmControlPlaneDefinitions,
  validateHelmCognitiveObjectContract,
} from "@/lib/operating-system/cognitive-object-contract";

describe("cognitive object contract", () => {
  it("keeps the four-plane order frozen", () => {
    expect(helmControlPlaneDefinitions.map((item) => item.plane)).toEqual([
      "source-ingestion",
      "belief-runtime",
      "operator-governance",
      "execution-commitment",
    ]);
  });

  it("keeps committed intention as the only established execution object", () => {
    const established = helmCognitiveObjectDefinitions.filter(
      (item) => item.status === "established",
    );

    expect(established).toEqual([
      expect.objectContaining({
        kind: "committed-intention",
        plane: "execution-commitment",
      }),
    ]);
  });

  it("keeps belief, goal and operating-gap as formed but still needing the next layer", () => {
    expect(getHelmCognitiveObjectDefinition("belief").status).toBe(
      "formed-needs-next-layer",
    );
    expect(getHelmCognitiveObjectDefinition("goal").status).toBe(
      "formed-needs-next-layer",
    );
    expect(getHelmCognitiveObjectDefinition("operating-gap").status).toBe(
      "formed-needs-next-layer",
    );
  });

  it("preserves execution boundary notes", () => {
    const committed = getHelmCognitiveObjectDefinition("committed-intention");
    expect(committed.boundaryNotes.join(" ")).toContain("no auto-send");
    expect(committed.boundaryNotes.join(" ")).toContain("no broad auto-write");
  });

  it("validates the frozen contract without drift", () => {
    expect(() => validateHelmCognitiveObjectContract()).not.toThrow();
  });
});
