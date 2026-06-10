import { describe, expect, it } from "vitest";
import { formatMeetingIngestionRetrievalDateLabel } from "@/features/meetings/meeting-v2-ingestion-retrieval-date-labels";
import { formatDateLabel } from "@/lib/utils";

describe("formatMeetingIngestionRetrievalDateLabel", () => {
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
