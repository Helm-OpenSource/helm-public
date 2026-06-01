import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..", "..");

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

describe("company definition card accessibility", () => {
  it("keeps editable definition fields reachable by accessible names", () => {
    const source = read("features/companies/company-definition-card.tsx");

    expect(source).toContain("aria-label={label}");
    expect(source).toContain(
      'aria-label={english ? "Definition confidence" : "定义置信度"}',
    );
  });
});
