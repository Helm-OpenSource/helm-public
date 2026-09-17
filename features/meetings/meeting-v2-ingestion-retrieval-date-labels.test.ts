import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { formatMeetingIngestionRetrievalDateLabel } from "@/features/meetings/meeting-v2-ingestion-retrieval-date-labels";
import { formatDateLabel } from "@/lib/utils";

describe("formatMeetingIngestionRetrievalDateLabel", () => {
  // formatDateLabel 对"今天/明天"返回相对文案；夹具是固定日期，所以时钟也要固定，
  // 否则每年 09-17/09-18 这两天用例必红（2026-09-17 正式构建就是这么红的）。
  beforeAll(() => vi.useFakeTimers({ now: new Date(2026, 8, 1, 9, 0), toFake: ["Date"] }));
  afterAll(() => vi.useRealTimers());
  const sampleDate = new Date(2026, 8, 18, 11, 45);

  it("formats ingestion retrieval dates with English month labels", () => {
    expect(formatMeetingIngestionRetrievalDateLabel(sampleDate, true, formatDateLabel)).toBe("Sep 18 11:45");
  });

  it("delegates Chinese ingestion retrieval dates to the existing formatter", () => {
    expect(formatMeetingIngestionRetrievalDateLabel(sampleDate, false, formatDateLabel)).toBe("09月18日 11:45");
  });

  it("keeps empty ingestion retrieval dates localized", () => {
    expect(formatMeetingIngestionRetrievalDateLabel(null, true, formatDateLabel)).toBe("Not set");
    expect(formatMeetingIngestionRetrievalDateLabel(null, false, formatDateLabel)).toBe("未设置");
  });
});
