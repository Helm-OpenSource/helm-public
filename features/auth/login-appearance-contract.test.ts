import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("login build-time appearance contract", () => {
  it("imports the fixed stylesheet target without runtime configuration", () => {
    const page = readFileSync(new URL("../../app/(auth)/login/page.tsx", import.meta.url), "utf8");
    expect(page).toContain('import "./appearance.css";');
    expect(page).not.toContain("resolveDeploymentAuthStylesheetPath");
    expect(page).not.toContain('rel="stylesheet"');
  });

  it("keeps the public Core stylesheet empty by default", () => {
    const css = readFileSync(new URL("../../app/(auth)/login/appearance.css", import.meta.url), "utf8");
    expect(css.replace(/\/\*[\s\S]*?\*\//g, "").trim()).toBe("");
  });
});
