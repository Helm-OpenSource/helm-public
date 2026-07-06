import { describe, expect, it } from "vitest";

import {
  CAPTURE_RETENTION_SWEEP_RULE_VERSION,
  buildRetentionSweepPacket,
} from "./retention-sweep";

const NOW = new Date("2026-07-06T00:00:00.000Z");

function daysAgo(days: number) {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
}

describe("buildRetentionSweepPacket", () => {
  it("lists only sessions older than the retention window, review-first", () => {
    const packet = buildRetentionSweepPacket({
      workspaceId: "ws-1",
      retentionDays: 90,
      now: NOW,
      sessions: [
        { id: "old", title: "老会话", endedAt: daysAgo(120), createdAt: daysAgo(121) },
        { id: "fresh", title: "新会话", endedAt: daysAgo(10), createdAt: daysAgo(10) },
        { id: "edge", title: null, endedAt: daysAgo(90), createdAt: daysAgo(91) },
      ],
    });

    expect(packet.ruleVersion).toBe(CAPTURE_RETENTION_SWEEP_RULE_VERSION);
    expect(packet.reviewPosture).toBe("review_required");
    expect(
      packet.pendingDeleteCandidates.map((c) => c.captureSessionId),
    ).toEqual(["old", "edge"]);
    expect(packet.pendingDeleteCandidates[0].ageDays).toBe(120);
    expect(packet.boundaries.join("\n")).toContain(
      "nothing is deleted automatically",
    );
  });

  it("falls back to createdAt when the session never ended", () => {
    const packet = buildRetentionSweepPacket({
      workspaceId: "ws-1",
      retentionDays: 30,
      now: NOW,
      sessions: [{ id: "unended", title: null, endedAt: null, createdAt: daysAgo(45) }],
    });
    expect(packet.pendingDeleteCandidates).toHaveLength(1);
    expect(packet.pendingDeleteCandidates[0].referenceDateIso).toBe(
      daysAgo(45).toISOString(),
    );
  });

  it("clamps retentionDays to at least one day", () => {
    const packet = buildRetentionSweepPacket({
      workspaceId: "ws-1",
      retentionDays: 0,
      now: NOW,
      sessions: [{ id: "s", title: null, endedAt: daysAgo(2), createdAt: daysAgo(2) }],
    });
    expect(packet.retentionDays).toBe(1);
    expect(packet.pendingDeleteCandidates).toHaveLength(1);
  });

  it("returns an empty candidate list when everything is inside the window", () => {
    const packet = buildRetentionSweepPacket({
      workspaceId: "ws-1",
      retentionDays: 90,
      now: NOW,
      sessions: [{ id: "s", title: null, endedAt: daysAgo(1), createdAt: daysAgo(1) }],
    });
    expect(packet.pendingDeleteCandidates).toEqual([]);
  });
});
