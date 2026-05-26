import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const topbarSource = readFileSync("components/layout/topbar.tsx", "utf8");
const commandPaletteSource = readFileSync(
  "components/layout/command-palette.tsx",
  "utf8",
);

describe("Ask Helm entry surfaces", () => {
  it("routes topbar natural-language search through the intent router", () => {
    expect(topbarSource).toContain("buildSearchIntentHref");
    expect(topbarSource).toContain("submitTopbarSearch");
    expect(topbarSource).toContain("onSubmit={submitTopbarSearch}");
  });

  it("keeps an explicit governed workspace answer command visible for typed questions", () => {
    expect(commandPaletteSource).toContain("buildAskHelmHref");
    expect(commandPaletteSource).toContain("id: \"ask-helm-query\"");
    expect(commandPaletteSource).toContain("Ask workspace:");
    expect(commandPaletteSource).toContain("问当前工作区：");
  });
});
