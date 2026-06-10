import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pageHeaderSource = readFileSync("components/shared/page-header.tsx", "utf8");

describe("PageHeader bilingual defaults", () => {
  it("keeps briefing fallback labels locale-aware without changing the Chinese default", () => {
    expect(pageHeaderSource).toContain("english = false");
    expect(pageHeaderSource).toContain('english?: boolean');
    expect(pageHeaderSource).toContain('"What I see"');
    expect(pageHeaderSource).toContain('"You decide"');
    expect(pageHeaderSource).toContain('"我现在看到的重点"');
    expect(pageHeaderSource).toContain('"现在要确认"');
  });
});
