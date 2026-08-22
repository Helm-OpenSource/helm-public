import { describe, expect, it } from "vitest";

import {
  isMemberGatewaySessionOpenAt,
  MEMBER_GATEWAY_SESSION_WINDOW_MS,
  newMemberGatewaySessionId,
} from "@/lib/member-gateway/gateway-session";

describe("MEMBER_GATEWAY_SESSION_WINDOW_MS", () => {
  it("is frozen at 30 minutes", () => {
    expect(MEMBER_GATEWAY_SESSION_WINDOW_MS).toBe(30 * 60_000);
  });
});

describe("isMemberGatewaySessionOpenAt", () => {
  const openedAt = new Date("2026-08-20T10:00:00.000Z");
  const openedAtMs = openedAt.getTime();

  it("accepts the instant exactly at openedAt (inclusive lower bound)", () => {
    expect(
      isMemberGatewaySessionOpenAt({ openedAt, closedAt: null }, openedAtMs),
    ).toBe(true);
  });

  it("accepts an instant just before the window end", () => {
    const justBefore = openedAtMs + MEMBER_GATEWAY_SESSION_WINDOW_MS - 1;
    expect(
      isMemberGatewaySessionOpenAt({ openedAt, closedAt: null }, justBefore),
    ).toBe(true);
  });

  it("rejects the instant exactly at the window end (exclusive upper bound)", () => {
    const atWindowEnd = openedAtMs + MEMBER_GATEWAY_SESSION_WINDOW_MS;
    expect(
      isMemberGatewaySessionOpenAt({ openedAt, closedAt: null }, atWindowEnd),
    ).toBe(false);
  });

  it("rejects an instant past the window end", () => {
    const pastWindow = openedAtMs + MEMBER_GATEWAY_SESSION_WINDOW_MS + 1;
    expect(
      isMemberGatewaySessionOpenAt({ openedAt, closedAt: null }, pastWindow),
    ).toBe(false);
  });

  it("rejects an instant before openedAt", () => {
    expect(
      isMemberGatewaySessionOpenAt(
        { openedAt, closedAt: null },
        openedAtMs - 1,
      ),
    ).toBe(false);
  });

  it("rejects a closed session even when nowMs is inside the window", () => {
    const closedAt = new Date(openedAtMs + 60_000);
    expect(
      isMemberGatewaySessionOpenAt(
        { openedAt, closedAt },
        openedAtMs + 61_000,
      ),
    ).toBe(false);
  });

  it("accepts string-typed openedAt/closedAt inputs", () => {
    expect(
      isMemberGatewaySessionOpenAt(
        { openedAt: openedAt.toISOString(), closedAt: null },
        openedAtMs,
      ),
    ).toBe(true);
  });
});

describe("newMemberGatewaySessionId", () => {
  it("returns an mgws-prefixed uuid", () => {
    const id = newMemberGatewaySessionId();
    expect(id).toMatch(
      /^mgws-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("returns a distinct id on every call", () => {
    expect(newMemberGatewaySessionId()).not.toBe(newMemberGatewaySessionId());
  });
});
