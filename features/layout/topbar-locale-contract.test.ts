import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const topbarSource = readFileSync("components/layout/topbar.tsx", "utf8");

describe("topbar locale contract", () => {
  it("threads the active workspace locale into the theme toggle", () => {
    expect(topbarSource).toContain("<ThemeToggle locale={locale} />");
  });
});
