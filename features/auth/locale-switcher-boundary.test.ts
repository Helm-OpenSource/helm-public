import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("components/shared/locale-switcher.tsx", "utf8");

describe("workspace locale switcher boundary", () => {
  it("changes only the request locale instead of workspace operational controls", () => {
    expect(source).toContain("updatePublicLocaleAction");
    expect(source).not.toContain("updateWorkspaceOperationalControlsAction");
    expect(source).not.toContain("pilotMode");
    expect(source).not.toContain("captureConsentRequired");
    expect(source).not.toContain("dataRetentionDays");
  });
});
