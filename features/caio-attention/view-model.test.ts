import { describe, expect, it } from "vitest";

import { caioAttentionPageCount, diffCaioAttentionCommand, isCaioAttentionPending, parseCaioAttentionPageParam } from "./view-model";

const prefill = {
  primaryUserId: "u1",
  ccUserIds: ["u2", "u3"],
  escalationUserId: "u4",
  reviewerUserIds: ["u4"],
  committedDueAt: new Date("2026-11-04T12:00:00.000Z"),
};

describe("caio attention view model", () => {
  it("reads only positive integer page params", () => {
    expect(parseCaioAttentionPageParam(undefined)).toBe(1);
    expect(parseCaioAttentionPageParam("3")).toBe(3);
    expect(parseCaioAttentionPageParam(["2", "9"])).toBe(2);
    for (const raw of ["0", "-1", "1.5", "abc", "01", "999999"]) expect(parseCaioAttentionPageParam(raw)).toBe(1);
  });

  it("always counts at least one page", () => {
    expect(caioAttentionPageCount(0, 20)).toBe(1);
    expect(caioAttentionPageCount(41, 20)).toBe(3);
  });

  it("treats only terminal statuses as no longer pending", () => {
    expect(["SUGGESTED", "DEFERRED", "DISPATCHED", "DISPOSITION_SUBMITTED"].every((s) => isCaioAttentionPending(s as never))).toBe(true);
    expect(["DISMISSED", "CANCELLED", "CLOSED"].some((s) => isCaioAttentionPending(s as never))).toBe(false);
  });

  it("reports no change when the OWNER keeps the prefill", () => {
    expect(diffCaioAttentionCommand(prefill, { ...prefill, committedDueAt: new Date(prefill.committedDueAt.getTime()) })).toEqual([]);
  });

  it("reports each edited field with before and after values", () => {
    const edited = { ...prefill, primaryUserId: "u5", ccUserIds: ["u2"], committedDueAt: null };
    expect(diffCaioAttentionCommand(prefill, edited)).toEqual([
      { field: "primaryUserId", before: ["u1"], after: ["u5"] },
      { field: "ccUserIds", before: ["u2", "u3"], after: ["u2"] },
      { field: "committedDueAt", before: ["2026-11-04T12:00:00.000Z"], after: [] },
    ]);
  });

  it("fills a missing prefill without inventing a previous value", () => {
    const empty = { primaryUserId: null, ccUserIds: [], escalationUserId: null, reviewerUserIds: [], committedDueAt: null };
    expect(diffCaioAttentionCommand(empty, { ...empty, primaryUserId: "u1" })).toEqual([{ field: "primaryUserId", before: [], after: ["u1"] }]);
  });
});
