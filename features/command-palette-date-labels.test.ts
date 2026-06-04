import { describe, expect, it } from "vitest";
import { formatCommandPaletteMeetingDescription } from "@/components/layout/command-palette";

describe("command palette date labels", () => {
  it("keeps English meeting result descriptions free of Chinese date text", () => {
    const description = formatCommandPaletteMeetingDescription(
      new Date("2026-06-04T09:30:00.000Z"),
      true,
    );

    expect(description).toContain("Meeting");
    expect(description).not.toMatch(/[\u4e00-\u9fff]/);
  });

  it("preserves Chinese meeting result descriptions on the zh-CN path", () => {
    const description = formatCommandPaletteMeetingDescription(
      new Date("2026-06-04T09:30:00.000Z"),
      false,
    );

    expect(description).toContain("会议");
    expect(description).toMatch(/[\u4e00-\u9fff]/);
  });
});
