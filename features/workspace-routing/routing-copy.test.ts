import { describe, expect, it } from "vitest";
import { destinationLabel } from "./routing-copy";

describe("routing-copy destinationLabel", () => {
  it("control_tower / generic localized", () => {
    expect(destinationLabel({ kind: "control_tower" }, true)).toBe("Control tower");
    expect(destinationLabel({ kind: "generic" }, false)).toContain("通用面");
  });
  it("workstation shows its key", () => {
    expect(destinationLabel({ kind: "workstation", workstationKey: "collection" }, true)).toBe("Workstation: collection");
    expect(destinationLabel({ kind: "workstation", workstationKey: "collection" }, false)).toBe("工位: collection");
  });
});
