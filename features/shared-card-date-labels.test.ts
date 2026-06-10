import { describe, expect, it, vi } from "vitest";
import {
  formatSharedCardDateLabel,
  formatSharedCardRelativeLabel,
} from "@/components/shared/card-date-labels";

describe("shared card date labels", () => {
  it("keeps English date labels free of Chinese text", () => {
    expect(
      formatSharedCardDateLabel(new Date("2026-06-04T09:30:00.000Z"), true),
    ).not.toMatch(/[\u4e00-\u9fff]/);
    expect(formatSharedCardDateLabel(null, true)).toBe("Not set");
  });

  it("keeps English relative labels free of Chinese text", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-04T12:00:00.000Z"));

    expect(
      formatSharedCardRelativeLabel(
        new Date("2026-06-04T09:00:00.000Z"),
        true,
      ),
    ).not.toMatch(/[\u4e00-\u9fff]/);
    expect(formatSharedCardRelativeLabel(null, true)).toBe("none");

    vi.useRealTimers();
  });

  it("preserves Chinese labels on the zh-CN path", () => {
    expect(
      formatSharedCardDateLabel(new Date("2026-06-04T09:30:00.000Z"), false),
    ).toMatch(/[\u4e00-\u9fff]/);
    expect(
      formatSharedCardRelativeLabel(
        new Date(Date.now() - 60 * 60 * 1000),
        false,
      ),
    ).toMatch(/[\u4e00-\u9fff]/);
  });
});
