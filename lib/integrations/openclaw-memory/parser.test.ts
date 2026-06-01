import { describe, expect, it } from "vitest";
import {
  buildOpenClawSourceLabel,
  mapOpenClawCategoryToMemoryType,
  parseOpenClawMemoryLine,
  parseOpenClawMemoryPayload,
  parseOpenClawSourceLabel,
} from "@/lib/integrations/openclaw-memory";

describe("openclaw memory parser", () => {
  it("parses valid jsonl record with normalized fields", () => {
    const line = JSON.stringify({
      id: "abc-1",
      text: "  hello   world  ",
      category: "Decision",
      scope: "agent:main",
      importance: 0.87,
      timestamp: 1774315046093,
      metadata: { k: "v" },
    });

    const parsed = parseOpenClawMemoryLine(line);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.record.externalId).toBe("abc-1");
    expect(parsed.record.text).toBe("hello   world");
    expect(parsed.record.category).toBe("decision");
    expect(parsed.record.scope).toBe("agent:main");
    expect(parsed.record.importance).toBe(87);
    expect(parsed.record.timestampMs).toBe(1774315046093);
    expect(parsed.record.rawMetadata).toBe('{"k":"v"}');
    expect(parsed.record.checksum.length).toBeGreaterThan(10);
  });

  it("rejects invalid and incomplete lines", () => {
    expect(parseOpenClawMemoryLine("").ok).toBe(false);
    expect(parseOpenClawMemoryLine("not-json").ok).toBe(false);
    expect(parseOpenClawMemoryLine(JSON.stringify({ id: "x" })).ok).toBe(false);
    expect(
      parseOpenClawMemoryLine(
        JSON.stringify({ id: "x", text: "ok", timestamp: "bad-ts" }),
      ).ok,
    ).toBe(false);
  });

  it("parses direct lancedb payload objects", () => {
    const parsed = parseOpenClawMemoryPayload({
      id: "mem-1",
      text: "from lancedb",
      category: "fact",
      scope: "agent:main",
      importance: 88,
      timestamp: 1774315046,
      metadata: "{}",
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.record.externalId).toBe("mem-1");
    expect(parsed.record.timestampMs).toBe(1774315046000);
  });

  it("maps source label and category consistently", () => {
    expect(buildOpenClawSourceLabel({ scope: "agent:main", category: "decision" })).toBe(
      "OPENCLAW:agent:main:decision",
    );
    expect(parseOpenClawSourceLabel("OPENCLAW:agent:main:decision")).toEqual({
      scope: "agent:main",
      category: "decision",
    });
    expect(mapOpenClawCategoryToMemoryType("decision")).toBe("DECISION");
    expect(mapOpenClawCategoryToMemoryType("preference")).toBe("RELATIONSHIP");
    expect(mapOpenClawCategoryToMemoryType("fact")).toBe("SUMMARY");
  });
});
