import { describe, expect, it } from "vitest";
import { parseThreadParticipants } from "@/features/inbox/thread-participants";

describe("parseThreadParticipants", () => {
  it("reads a JSON array of addresses and drops blank entries", () => {
    expect(
      parseThreadParticipants('["a@example.com", "", "b@example.com", 3]'),
    ).toEqual(["a@example.com", "b@example.com"]);
  });

  it("keeps a raw address string from older imports", () => {
    expect(parseThreadParticipants("a@example.com")).toEqual(["a@example.com"]);
  });

  it("returns nothing for empty values", () => {
    expect(parseThreadParticipants(null)).toEqual([]);
    expect(parseThreadParticipants("   ")).toEqual([]);
  });
});
