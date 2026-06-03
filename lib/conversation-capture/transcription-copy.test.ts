import { describe, expect, it } from "vitest";
import { buildFallbackTranscript, buildSegments } from "@/lib/conversation-capture/transcription.service";

describe("conversation capture transcription copy", () => {
  it("uses English fallback transcript copy when the workspace is English", () => {
    const transcript = buildFallbackTranscript({
      workspaceId: "workspace-1",
      actorName: "Operator",
      english: true,
      session: {
        id: "capture-1",
        title: null,
        sourceType: "MANUAL_CAPTURE",
      } as never,
      context: {},
    });

    expect(transcript).toContain("this conversation already contains a clear next step");
    expect(transcript).toContain("Close the blocker first");
    expect(transcript).not.toContain("这次交流");
  });

  it("keeps Chinese fallback transcript copy for zh-CN workspaces", () => {
    const transcript = buildFallbackTranscript({
      workspaceId: "workspace-1",
      actorName: "Operator",
      english: false,
      session: {
        id: "capture-1",
        title: null,
        sourceType: "MANUAL_CAPTURE",
      } as never,
      context: {},
    });

    expect(transcript).toContain("这次交流 中已经出现了明确下一步");
    expect(transcript).toContain("建议先收口阻塞");
  });

  it("localizes generated speaker labels", () => {
    expect(buildSegments({ text: "First\nSecond", english: true }).map((item) => item.speaker)).toEqual([
      "Our side",
      "Counterparty",
    ]);
    expect(buildSegments({ text: "第一句。第二句。", english: false }).map((item) => item.speaker)).toEqual([
      "我方",
      "对方",
    ]);
  });
});
