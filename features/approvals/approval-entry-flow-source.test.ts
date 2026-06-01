import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const trackedActionButtonSource = readFileSync(
  "components/shared/first-loop-tracked-action-button.tsx",
  "utf8",
);
const sheetSource = readFileSync("components/ui/sheet.tsx", "utf8");

describe("approval entry flow shared source contracts", () => {
  it("keeps first-loop navigation available even when trace recording is slow", () => {
    expect(trackedActionButtonSource).toContain('import Link from "next/link"');
    expect(trackedActionButtonSource).toContain("<Link");
    expect(trackedActionButtonSource).toContain("href={href}");
    expect(trackedActionButtonSource).toContain(
      "void recordFirstLoopAdoptionEventAction",
    );
    expect(trackedActionButtonSource).not.toContain(
      "await recordFirstLoopAdoptionEventAction",
    );
    expect(trackedActionButtonSource).not.toContain("useTransition");
    expect(trackedActionButtonSource).not.toContain("disabled={pending}");
    expect(trackedActionButtonSource).not.toContain("router.push(href)");
  });

  it("keeps sheet close controls named for assistive operation", () => {
    expect(sheetSource).toContain("closeLabel = \"Close panel\"");
    expect(sheetSource).toContain("aria-label={closeLabel}");
    expect(sheetSource).toContain("type=\"button\"");
  });
});
