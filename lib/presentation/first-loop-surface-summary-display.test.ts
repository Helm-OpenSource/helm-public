import { describe, expect, it } from "vitest";
import { formatFirstLoopSurfaceText } from "@/components/shared/first-loop-surface-summary";

describe("formatFirstLoopSurfaceText", () => {
  it("keeps follow-up email wording tight on Chinese first-loop cards", () => {
    expect(
      formatFirstLoopSurfaceText("生成一封结构化 follow-up 邮件。", false),
    ).toBe("生成一封结构化 跟进邮件。");
  });

  it("turns return anchor jargon into plain return-point wording", () => {
    expect(
      formatFirstLoopSurfaceText("当前回访锚点 / 打开当前锚点", false),
    ).toBe("回到事项 / 打开回到事项");
  });

  it("keeps English first-loop copy unchanged", () => {
    expect(
      formatFirstLoopSurfaceText(
        "Generate a structured follow-up email.",
        true,
      ),
    ).toBe("Generate a structured follow-up email.");
  });
});
