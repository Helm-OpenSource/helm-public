import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  "features/programs/program-application-form.tsx",
  "utf8",
);

describe("program application form accessibility", () => {
  it("gives the reviewed-program confirmation checkbox a stable accessible name", () => {
    expect(source).toContain('aria-label={');
    expect(source).toContain("Confirm reviewed program boundary");
    expect(source).toContain("确认理解计划审核边界");
  });
});
